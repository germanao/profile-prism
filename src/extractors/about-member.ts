import type { ExtractionDictionary } from "../locales/extraction";
import type {
  Observation,
  ProfileEvidence,
  ProfileMaintenanceEvidence,
  VerificationDetailsEvidence,
} from "../scoring/evidence-schema";
import { comparableText, elementText, isElementRendered, queryRendered } from "./dom";
import { parseMemberSinceDays, parseRelativeAgeDays } from "./date-parser";
import { absent, observed, unavailable } from "./observations";

export interface AboutMemberFacts {
  verificationDetails: Observation<VerificationDetailsEvidence>;
  accountAge: Observation<{ days: number }>;
  profileMaintenance: Observation<ProfileMaintenanceEvidence>;
}

export interface AboutMemberExtractionOptions {
  now?: Date;
  /** Used transiently and never copied into the result. */
  currentEmployer?: string;
}

type VerificationMethod = "government-id" | "work-email" | "education";

function normalizedIncludes(
  text: string,
  tokens: readonly string[],
  dictionary: ExtractionDictionary,
): boolean {
  const normalized = comparableText(text, dictionary.locale);
  return tokens.some((token) => normalized.includes(comparableText(token, dictionary.locale)));
}

function candidateRows(root: ParentNode): HTMLElement[] {
  const explicit = queryRendered<HTMLElement>(root, [
    "[data-pe-verification-method]",
    "[data-profile-evidence-verification-method]",
    "[data-pe-maintenance]",
    "[data-profile-evidence-maintenance]",
    "li",
    "[role='listitem']",
    "article",
    "section",
    "p",
    "div",
  ].join(", "));
  const rootElement = (root as Node).nodeType === 1 ? root as HTMLElement : undefined;
  const rows = explicit.length > 0 ? explicit : rootElement && isElementRendered(rootElement) ? [rootElement] : [];
  return rows.filter((row, index, all) => {
    const text = elementText(row);
    if (text.length < 3 || text.length > 1_500) return false;
    // Prefer the smallest rendered row containing the fact to avoid parsing a
    // dialog container and its child as two independent methods.
    return !all.some((other, otherIndex) =>
      otherIndex !== index && row.contains(other) && elementText(other).length >= 3,
    );
  });
}

function contextualRowText(
  row: HTMLElement,
  dictionary: ExtractionDictionary,
): string {
  const direct = elementText(row);
  const relevantTokens = [
    ...dictionary.aboutMember.governmentId,
    ...dictionary.aboutMember.workEmail,
    ...dictionary.aboutMember.education,
    ...dictionary.aboutMember.joinedLinkedIn,
    ...dictionary.aboutMember.contactUpdated,
    ...dictionary.aboutMember.photoUpdated,
  ];
  if (normalizedIncludes(direct, relevantTokens, dictionary)) return direct;

  let parent: HTMLElement | null = row.parentElement;
  let depth = 0;
  while (parent && depth < 3) {
    if (parent.matches("[role='dialog'], dialog")) break;
    const text = elementText(parent);
    // A small row wrapper commonly carries the category heading while its
    // child paragraph carries only "Last updated...". Never broaden to the
    // entire dialog/section, where unrelated methods could be conflated.
    if (text.length <= 600 && normalizedIncludes(text, relevantTokens, dictionary)) {
      return text;
    }
    if (parent.tagName === "SECTION" || text.length > 600) break;
    parent = parent.parentElement;
    depth += 1;
  }
  return direct;
}

function methodFromAttribute(row: HTMLElement): VerificationMethod | undefined {
  const value = row.getAttribute("data-pe-verification-method") ??
    row.getAttribute("data-profile-evidence-verification-method") ?? "";
  if (/^(?:government-id|identity)$/iu.test(value)) return "government-id";
  if (/^(?:work-email|workplace)$/iu.test(value)) return "work-email";
  if (/^(?:education|school-email)$/iu.test(value)) return "education";
  return undefined;
}

function methodsFromText(
  text: string,
  dictionary: ExtractionDictionary,
): VerificationMethod[] {
  const normalized = comparableText(text, dictionary.locale);
  const invitation = /\b(?:get|start|add|verify|complete your|obter|iniciar|adicionar|verifique|obt[eé]n|inicia|agrega|añade|verifica tu)\b/iu.test(normalized);
  const completed = /\b(?:verified|completed|verificad[oa]|completad[oa]|conclu[ií]d[oa])\b/iu.test(normalized);
  if (invitation || !completed) return [];
  const methods: VerificationMethod[] = [];
  if (normalizedIncludes(text, dictionary.aboutMember.governmentId, dictionary)) methods.push("government-id");
  if (normalizedIncludes(text, dictionary.aboutMember.workEmail, dictionary)) methods.push("work-email");
  if (normalizedIncludes(text, dictionary.aboutMember.education, dictionary)) methods.push("education");
  return methods;
}

function significantCompanyTokens(value: string, locale: string): string[] {
  const ignored = new Set([
    "the", "and", "company", "inc", "llc", "ltd", "limited", "corp", "corporation",
    "sa", "s.a", "ltda", "empresa", "companhia", "companhia", "compania", "de", "do", "da",
  ]);
  return comparableText(value, locale)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function workplaceMatch(
  row: HTMLElement,
  text: string,
  currentEmployer: string | undefined,
  dictionary: ExtractionDictionary,
): VerificationDetailsEvidence["workplaceMatch"] {
  const explicit = row.getAttribute("data-pe-employer-match") ??
    row.getAttribute("data-profile-evidence-employer-match");
  if (explicit === "current") return "current";
  if (explicit === "former" || explicit === "unresolved") return "former_or_unresolved";
  if (!currentEmployer) return "former_or_unresolved";

  const normalizedRow = comparableText(text, dictionary.locale);
  const normalizedEmployer = comparableText(currentEmployer, dictionary.locale);
  if (normalizedEmployer.length >= 3 && normalizedRow.includes(normalizedEmployer)) return "current";
  const tokens = significantCompanyTokens(currentEmployer, dictionary.locale);
  if (tokens.length > 0 && tokens.every((token) => normalizedRow.includes(token))) return "current";
  return "former_or_unresolved";
}

function explicitDateText(row: HTMLElement): string {
  return [
    row.getAttribute("data-pe-verification-date"),
    row.getAttribute("data-profile-evidence-verification-date"),
    elementText(row),
  ].filter(Boolean).join(" ");
}

function completedDialog(root: ParentNode): boolean {
  const rootElement = (root as Node).nodeType === 1 ? root as HTMLElement : undefined;
  if (!rootElement) return false;
  if (rootElement.getAttribute("data-complete") === "true") return true;
  const busy = rootElement.getAttribute("aria-busy") === "true" || queryRendered(
    rootElement,
    "[aria-busy='true'], [role='progressbar']",
  ).length > 0;
  return rootElement.matches("[role='dialog'], dialog") && !busy;
}

function parseMaintenanceAge(
  row: HTMLElement,
  text: string,
  dictionary: ExtractionDictionary,
  now: Date,
): number | undefined {
  const explicit = row.getAttribute("data-pe-updated-days") ??
    row.getAttribute("data-profile-evidence-updated-days");
  if (explicit && /^\d{1,5}$/u.test(explicit)) return Number.parseInt(explicit, 10);
  const normalized = comparableText(text, dictionary.locale);
  if (/(?:less than|under|menos de|ha menos de)\s+(?:one|1|um|un)\s+(?:year|ano|año)/iu.test(normalized)) {
    return 364;
  }
  if (/(?:more than|over|mais de|mas de)\s+(?:one|1|um|un)\s+(?:year|ano|año)/iu.test(normalized)) {
    return 366;
  }
  return parseRelativeAgeDays(text, dictionary, now);
}

export function extractAboutMemberFacts(
  root: ParentNode,
  dictionary: ExtractionDictionary,
  options: AboutMemberExtractionOptions = {},
): AboutMemberFacts {
  const now = options.now ? new Date(options.now) : new Date();
  const rows = candidateRows(root);
  const complete = completedDialog(root);
  let governmentId = false;
  let workplace = false;
  let education = false;
  let match: VerificationDetailsEvidence["workplaceMatch"] = "none";
  const verificationAges: number[] = [];
  let accountDays: number | undefined;
  let contactUpdatedDays: number | undefined;
  let photoUpdatedDays: number | undefined;

  for (const row of rows) {
    const directText = elementText(row);
    const text = contextualRowText(row, dictionary);
    const explicitMethod = methodFromAttribute(row);
    const methods = explicitMethod ? [explicitMethod] : methodsFromText(text, dictionary);
    for (const method of methods) {
      if (method === "government-id") governmentId = true;
      if (method === "education") education = true;
      if (method === "work-email") {
        workplace = true;
        match = workplaceMatch(row, text, options.currentEmployer, dictionary) ?? "former_or_unresolved";
      }
      const age = parseRelativeAgeDays(explicitDateText(row), dictionary, now);
      if (age !== undefined) verificationAges.push(age);
    }

    if (normalizedIncludes(text, dictionary.aboutMember.joinedLinkedIn, dictionary)) {
      accountDays ??= parseMemberSinceDays(text, dictionary, now);
    }

    const hasUpdatedToken = normalizedIncludes(text, dictionary.aboutMember.updated, dictionary) ||
      row.hasAttribute("data-pe-updated-days") || row.hasAttribute("data-profile-evidence-updated-days");
    if (hasUpdatedToken && normalizedIncludes(text, dictionary.aboutMember.contactUpdated, dictionary)) {
      contactUpdatedDays ??= parseMaintenanceAge(row, directText, dictionary, now);
    }
    if (hasUpdatedToken && normalizedIncludes(text, dictionary.aboutMember.photoUpdated, dictionary)) {
      photoUpdatedDays ??= parseMaintenanceAge(row, directText, dictionary, now);
    }
  }

  // LinkedIn sometimes renders dialog prose in nested generic divs. Use the
  // dialog's combined text only as a method-presence fallback; do not derive a
  // date from it because an unrelated join/update date could be selected.
  const rootElement = (root as Node).nodeType === 1 ? root as HTMLElement : undefined;
  if (rootElement) {
    const rootText = elementText(rootElement);
    for (const method of methodsFromText(rootText, dictionary)) {
      if (method === "government-id") governmentId = true;
      if (method === "education") education = true;
      if (method === "work-email") {
        workplace = true;
        if (match === "none") {
          match = workplaceMatch(rootElement, rootText, options.currentEmployer, dictionary) ?? "former_or_unresolved";
        }
      }
    }
  }

  const methodsFound = governmentId || workplace || education;
  const verificationAgeDays = verificationAges.length > 0 ? Math.max(...verificationAges) : undefined;
  const detailsValue: VerificationDetailsEvidence = {
    governmentId,
    workplace,
    workplaceMatch: workplace ? match : "none",
    education,
    ...(verificationAgeDays !== undefined ? { verificationAgeDays } : {}),
  };
  const verificationDetails = methodsFound || complete
    ? observed(detailsValue, methodsFound ? 0.98 : 0.94, "dom:about-member:verification-details")
    : unavailable<VerificationDetailsEvidence>("dom:about-member:verification-details-not-rendered");
  const accountAge = accountDays !== undefined
    ? observed({ days: accountDays }, 0.98, "dom:about-member:account-join-date")
    : complete
      ? absent<{ days: number }>(0.94, "dom:about-member:no-account-join-date")
      : unavailable<{ days: number }>("dom:about-member:account-join-date-not-rendered");
  const maintenanceValue: ProfileMaintenanceEvidence = {
    ...(contactUpdatedDays !== undefined ? { contactUpdatedDays } : {}),
    ...(photoUpdatedDays !== undefined ? { photoUpdatedDays } : {}),
  };
  const profileMaintenance = Object.keys(maintenanceValue).length > 0
    ? observed(maintenanceValue, 0.94, "dom:about-member:profile-maintenance")
    : complete
      ? absent<ProfileMaintenanceEvidence>(0.9, "dom:about-member:no-maintenance-date")
      : unavailable<ProfileMaintenanceEvidence>("dom:about-member:maintenance-not-rendered");

  return { verificationDetails, accountAge, profileMaintenance };
}

function preferMoreSpecific<T>(
  current: Observation<T>,
  incoming: Observation<T>,
): Observation<T> {
  if (incoming.state === "observed") return incoming;
  if (current.state === "observed") return current;
  if (incoming.state === "absent" && current.state === "unavailable") return incoming;
  return current;
}

/** Pure integration helper; it cannot add raw dialog or company text to evidence. */
export function mergeAboutMemberFacts(
  evidence: ProfileEvidence,
  facts: AboutMemberFacts,
): ProfileEvidence {
  const currentMaintenance = evidence.profileMaintenance ??
    unavailable<ProfileMaintenanceEvidence>("model:profile-maintenance-not-captured");
  return {
    ...evidence,
    workplaceEducationVerification: preferMoreSpecific(
      evidence.workplaceEducationVerification,
      facts.verificationDetails,
    ),
    accountAge: preferMoreSpecific(evidence.accountAge, facts.accountAge),
    profileMaintenance: preferMoreSpecific(currentMaintenance, facts.profileMaintenance),
  };
}
