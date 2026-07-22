import type { ExtractionDictionary } from "../locales/extraction";
import type { CareerChronology, Observation } from "../scoring/evidence-schema";
import { dateRangeIsContradictory, parseLocalizedDateRange, profileDateOrdinal } from "./date-parser";
import {
  comparableText,
  elementText,
  findSection,
  normalizeVisibleText,
  queryRendered,
  readField,
  renderedTextSegments,
  sectionItems,
  similarText,
} from "./dom";
import { absent, observed, unavailable } from "./observations";
import type { ExperienceFacts, ExperienceRole, TopCardFacts } from "./types";

const ESTABLISHED_CLAIMS: Readonly<Record<string, readonly string[]>> = {
  en: ["senior", "principal", "lead", "director", "head of", "manager", "recruiter", "talent acquisition", "executive"],
  pt: ["sênior", "senior", "principal", "líder", "lider", "diretor", "diretora", "gerente", "recrutador", "recrutadora", "aquisição de talentos", "executivo", "executiva"],
  es: ["sénior", "senior", "principal", "líder", "director", "directora", "gerente", "reclutador", "reclutadora", "adquisición de talento", "ejecutivo", "ejecutiva"],
};

const LEGAL_SUFFIXES = /\b(?:inc|incorporated|llc|ltd|limited|corp|corporation|gmbh|sa|s\.a\.?|srl|ltda)\b\.?/giu;

export function headlineClaimsEstablishedRole(headline: string, locale: string): boolean {
  const normalized = comparableText(headline, locale);
  const claims = ESTABLISHED_CLAIMS[locale] ?? ESTABLISHED_CLAIMS.en ?? [];
  return claims.some((term) => normalized.includes(term)) ||
    /\b(?:[1-9]\d?)\+\s*(?:years?|anos?|años?)\b/iu.test(normalized);
}

function fieldText(item: ParentNode, field: string, fallbacks: readonly string[]): string | undefined {
  const match = readField(item, field, fallbacks);
  const text = elementText(match?.element);
  return text || undefined;
}

function visibleLines(root: ParentNode): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const text of renderedTextSegments(root)) {
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
  }
  for (const element of queryRendered<HTMLElement>(
    root,
    "[data-pe-field], [data-profile-evidence-field], h3, h4, time, p, span[aria-hidden='true']",
  )) {
    const text = elementText(element);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
  }
  return lines;
}

function isDateLine(text: string): boolean {
  return /\b(?:19|20|21)\d{2}\b/u.test(text);
}

function primaryLineValue(text: string): string {
  return normalizeVisibleText(text.split(/\s+[·•]\s+/u)[0]);
}

function linkedCompanyName(
  links: readonly HTMLAnchorElement[],
  title: string | undefined,
): string | undefined {
  for (const link of links) {
    const lines = visibleLines(link).map(primaryLineValue).filter(Boolean);
    const candidate = lines.find((line) => line !== title && !isDateLine(line));
    if (candidate && candidate.length <= 160) return candidate;
  }
  return undefined;
}

interface InheritedCompany {
  employer?: string;
  linked: boolean;
}

function semanticRoleCandidates(
  section: HTMLElement,
): Array<{ element: HTMLElement; inherited: InheritedCompany }> {
  const anchors = queryRendered<HTMLAnchorElement>(section, "a[href]").filter((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    return !/skill-associations|\/skills?\//iu.test(href) && visibleLines(anchor).some(isDateLine);
  });
  return anchors.flatMap((anchor) => {
    const parentElement = anchor.parentElement;
    if (!parentElement || !section.contains(parentElement)) return [];
    let container: HTMLElement = parentElement;
    const anchorSegments = new Set(renderedTextSegments(anchor));
    while (container.parentElement && container.parentElement !== section) {
      const outsideHeader = renderedTextSegments(container).some((segment) => !anchorSegments.has(segment));
      if (outsideHeader) break;
      const parent = container.parentElement;
      const otherRoleAnchor = anchors.some((candidate) => candidate !== anchor && parent.contains(candidate));
      if (otherRoleAnchor) break;
      container = parent;
    }

    let companyScope: HTMLElement | null = container;
    let linked = false;
    while (companyScope && section.contains(companyScope)) {
      if (queryRendered(companyScope, "a[href*='/company/']").length > 0) {
        linked = true;
        break;
      }
      companyScope = companyScope.parentElement;
    }
    return [{ element: container, inherited: { linked } }];
  });
}

function extractRole(
  item: HTMLElement,
  dictionary: ExtractionDictionary,
  inherited: InheritedCompany = { linked: false },
): ExperienceRole {
  const lines = visibleLines(item);
  const dateText = fieldText(item, "dates", ["[data-field='dates']", "time", "[aria-label*='date' i]"]) ??
    lines.find(isDateLine);
  const dateIndex = dateText ? lines.indexOf(dateText) : -1;
  const explicitTitle = fieldText(item, "title", ["h3", "[data-field='title']"]);
  const title = explicitTitle ?? lines.find((line) =>
    line !== dateText && !isDateLine(line) && primaryLineValue(line) !== inherited.employer,
  );
  const companyLinks = queryRendered<HTMLAnchorElement>(item, "a[href*='/company/']");
  const explicitEmployer = fieldText(item, "employer", ["[data-field='company']", "h4"]);
  const beforeDate = dateIndex > 0
    ? lines.slice(0, dateIndex).find((line) => line !== title && !isDateLine(line))
    : undefined;
  const employer = explicitEmployer ?? inherited.employer ?? linkedCompanyName(companyLinks, title) ??
    (beforeDate ? primaryLineValue(beforeDate) : undefined);
  const explicitDescription = fieldText(item, "description", ["[data-field='description']", "[data-pe-description]"]);
  const description = explicitDescription ?? lines
    .filter((text) => text !== title && text !== employer && text !== dateText && !isDateLine(text))
    .filter((text) => text.length >= 35)
    .sort((left, right) => right.length - left.length)[0];
  const dates = dateText ? parseLocalizedDateRange(dateText, dictionary) : undefined;
  return {
    ...(title ? { title } : {}),
    ...(employer ? { employer } : {}),
    ...(description ? { description } : {}),
    ...(dateText ? { dateText } : {}),
    ...(dates ? { dates } : {}),
    linkedEmployer: inherited.linked || companyLinks.length > 0,
    current: Boolean(dates?.current || item.getAttribute("data-current") === "true"),
    sourceElement: item,
  };
}

function groupedRoleCandidates(
  item: HTMLElement,
): Array<{ element: HTMLElement; inherited: InheritedCompany }> {
  const nested = queryRendered<HTMLElement>(item, "ul li, ol li").filter((candidate) =>
    visibleLines(candidate).some(isDateLine),
  );
  if (nested.length === 0) return [{ element: item, inherited: { linked: false } }];

  const groupLinks = queryRendered<HTMLAnchorElement>(item, "a[href*='/company/']").filter((link) =>
    !nested.some((candidate) => candidate.contains(link)),
  );
  const groupLines = visibleLines(item);
  const nestedLines = new Set(nested.flatMap(visibleLines));
  const groupEmployer = linkedCompanyName(groupLinks, undefined) ?? groupLines
    .map(primaryLineValue)
    .find((line) => line && !nestedLines.has(line) && !isDateLine(line));
  return nested.map((element) => ({
    element,
    inherited: { ...(groupEmployer ? { employer: groupEmployer } : {}), linked: groupLinks.length > 0 },
  }));
}

function flatSectionRoles(
  section: HTMLElement,
  dictionary: ExtractionDictionary,
): ExperienceRole[] {
  const headingLabels = new Set(
    dictionary.sectionLabels.experience.map((label) => comparableText(label, dictionary.locale)),
  );
  const segments = renderedTextSegments(section).filter(
    (segment) => !headingLabels.has(comparableText(segment, dictionary.locale)),
  );
  const dateIndexes = segments.flatMap((segment, index) => isDateLine(segment) ? [index] : []);
  if (dateIndexes.length === 0) return [];

  const companyLinks = queryRendered<HTMLAnchorElement>(section, "a[href*='/company/']");
  return dateIndexes.flatMap((dateIndex, roleIndex) => {
    const previousDateIndex = dateIndexes[roleIndex - 1] ?? -1;
    const nextDateIndex = dateIndexes[roleIndex + 1] ?? segments.length;
    const before = segments.slice(previousDateIndex + 1, dateIndex)
      .filter((line) => line.length >= 2 && !/^show\s+all/iu.test(line));
    if (before.length === 0) return [];

    const employerLine = before.at(-1);
    const titleLine = before.at(-2);
    if (!employerLine) return [];
    const employer = primaryLineValue(employerLine);
    const title = titleLine && titleLine.length <= 180 ? titleLine : undefined;
    const descriptionStart = dateIndex + 1;
    const nextRolePreamble = roleIndex + 1 < dateIndexes.length ? 2 : 0;
    const descriptionEnd = Math.max(descriptionStart, nextDateIndex - nextRolePreamble);
    const descriptionParts = segments.slice(descriptionStart, descriptionEnd)
      .filter((line) => line !== employerLine && line !== titleLine)
      .filter((line) => line.length >= 12 && !/^skills?:/iu.test(line));
    const description = descriptionParts.join(" ");
    const dateText = segments[dateIndex];
    if (!dateText) return [];
    const dates = parseLocalizedDateRange(dateText, dictionary);
    const linkedEmployer = companyLinks.some((link) => {
      const linkText = comparableText(elementText(link), dictionary.locale);
      return linkText.includes(comparableText(employer, dictionary.locale));
    }) || companyLinks.length >= dateIndexes.length;
    return [{
      ...(title ? { title } : {}),
      ...(employer ? { employer } : {}),
      ...(description ? { description } : {}),
      dateText,
      ...(dates ? { dates } : {}),
      linkedEmployer,
      current: Boolean(dates?.current),
      sourceElement: section,
    }];
  });
}

function roleIsSubstantive(role: ExperienceRole): boolean {
  return Boolean(
    role.title &&
    role.employer &&
    role.dates?.start &&
    ((role.description?.length ?? 0) >= 35 || role.sourceElement.querySelectorAll("li").length >= 2),
  );
}

function companyComparable(value: string, locale: string): string {
  return comparableText(value, locale).replace(LEGAL_SUFFIXES, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function companiesMateriallyDiffer(left: string, right: string, locale: string): boolean {
  const normalizedLeft = companyComparable(left, locale);
  const normalizedRight = companyComparable(right, locale);
  if (!normalizedLeft || !normalizedRight) return false;
  return similarText(normalizedLeft, normalizedRight, locale) < 0.35;
}

export function extractExperienceFacts(
  root: ParentNode,
  dictionary: ExtractionDictionary,
  topCard: TopCardFacts,
): ExperienceFacts {
  const section = findSection(root, "experience", dictionary);
  const establishedClaim = topCard.headline.state === "observed" &&
    headlineClaimsEstablishedRole(topCard.headline.value, dictionary.locale);

  if (!section) {
    return {
      sectionState: "unavailable",
      roles: [],
      detail: unavailable("dom:experience:not-rendered"),
      chronology: unavailable("dom:experience:not-rendered"),
      companyAffiliation: unavailable("dom:experience:not-rendered"),
    };
  }
  if (section.explicitlyEmpty) {
    return {
      sectionState: "absent",
      roles: [],
      detail: establishedClaim
        ? observed("established_empty_or_vague", section.confidence, "dom:experience:explicit-empty-established-claim")
        : absent(section.confidence, "dom:experience:explicit-empty"),
      chronology: absent(section.confidence, "dom:experience:explicit-empty"),
      companyAffiliation: absent(section.confidence, "dom:experience:explicit-empty"),
    };
  }

  const semanticCandidates = semanticRoleCandidates(section.element);
  const items = sectionItems(section.element);
  const roles = (semanticCandidates.length > 0
    ? semanticCandidates.map(({ element, inherited }) => extractRole(element, dictionary, inherited))
    : items.length > 0
      ? items.flatMap(groupedRoleCandidates).map(({ element, inherited }) =>
      extractRole(element, dictionary, inherited),
      )
      : flatSectionRoles(section.element, dictionary)
  ).filter((role) =>
    Boolean(role.title || role.employer || role.dateText || role.description),
  );
  if (roles.length === 0) {
    return {
      sectionState: "unavailable",
      roles: [],
      detail: unavailable("dom:experience:partial-or-not-loaded"),
      chronology: unavailable("dom:experience:partial-or-not-loaded"),
      companyAffiliation: unavailable("dom:experience:partial-or-not-loaded"),
    };
  }

  const substantiveCount = roles.filter(roleIsSubstantive).length;
  const datedRoles = roles.filter((role) => role.dates?.start);
  const vague = roles.every((role) => !role.title || !role.employer || !role.dates?.start);
  const detailValue = substantiveCount >= 3
    ? "several_substantive_dated_roles"
    : substantiveCount >= 1 || datedRoles.length >= 2
      ? "adequate"
      : establishedClaim && vague
        ? "established_empty_or_vague"
        : "neutral";

  const contradiction = roles.some((role) => role.dates && dateRangeIsContradictory(role.dates));
  const ordinals = datedRoles
    .flatMap((role) => role.dates?.start ? [profileDateOrdinal(role.dates.start)] : []);
  const historySpan = ordinals.length >= 2 ? Math.max(...ordinals) - Math.min(...ordinals) : 0;
  const chronology: Observation<CareerChronology> = contradiction
    ? observed<CareerChronology>(
      "material_contradiction",
      Math.min(1, section.confidence * 0.98),
      "dom:experience:chronology:material_contradiction",
    )
    : substantiveCount >= 3 && datedRoles.length >= 3 && historySpan >= 24
      ? observed<CareerChronology>(
        "rich_coherent",
        section.confidence * 0.94,
        "dom:experience:chronology:rich_coherent",
      )
      : datedRoles.length >= 2
        ? observed<CareerChronology>(
          "consistent",
          section.confidence * 0.86,
          "dom:experience:chronology:consistent",
        )
        : unavailable<CareerChronology>("dom:experience:chronology:insufficient-visible-dated-roles");

  const currentRoles = roles.filter((role) => role.current);
  const onlyCurrentRole = currentRoles.length === 1 ? currentRoles[0] : undefined;
  const explicitConflict = section.element.getAttribute("data-pe-company-conflict") === "true" ||
    section.element.getAttribute("data-profile-evidence-company-conflict") === "true";
  const structuredMismatch =
    topCard.currentCompany.state === "observed" &&
    Boolean(onlyCurrentRole?.employer) &&
    companiesMateriallyDiffer(topCard.currentCompany.value, onlyCurrentRole!.employer!, dictionary.locale);
  const linkedSpecific = currentRoles.some((role) => role.linkedEmployer && Boolean(role.title && role.employer));
  const companyValue = explicitConflict
    ? "material_identity_conflict"
    : linkedSpecific && !structuredMismatch
      ? "linked_employer_specific_role"
      : "neutral";

  return {
    sectionState: "observed",
    roles,
    detail: observed(detailValue, section.confidence, `dom:experience:detail:${detailValue}`),
    chronology,
    companyAffiliation: observed(
      companyValue,
      explicitConflict ? 1 : structuredMismatch ? section.confidence * 0.55 : section.confidence * 0.9,
      structuredMismatch
        ? "dom:experience:company:ambiguous-visible-mismatch-neutral"
        : `dom:experience:company:${companyValue}`,
    ),
  };
}
