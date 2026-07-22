import type { ExtractionDictionary } from "../locales/extraction";
import type {
  ContentSpecificity,
  CoreCompleteness,
  CrossSectionConsistency,
  Observation,
} from "../scoring/evidence-schema";
import { comparableText, similarText, tokenize } from "./dom";
import { observed, unavailable } from "./observations";
import type { ExperienceFacts, SectionContentFact, TopCardFacts } from "./types";

const TECHNOLOGY_PATTERN = /\b(?:javascript|typescript|java|python|golang|rust|c\+\+|c#|\.net|react|angular|vue|node(?:\.js)?|aws|azure|gcp|kubernetes|docker|terraform|sql|postgres(?:ql)?|mysql|mongodb|redis|kafka|machine learning|aprendizado de máquina|aprendizaje automático|api|microservices|microsserviços|microservicios)\b/giu;
const PROJECT_TERMS: Readonly<Record<string, readonly string[]>> = {
  en: ["project", "product", "platform", "migration", "architecture", "launched", "delivered"],
  pt: ["projeto", "produto", "plataforma", "migração", "arquitetura", "lançou", "entregou"],
  es: ["proyecto", "producto", "plataforma", "migración", "arquitectura", "lanzó", "entregó"],
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "uma", "para", "com", "das", "dos", "que",
  "por", "como", "una", "con", "del", "los", "las", "profile", "perfil", "experience", "experiência",
  "experiencia", "about", "sobre", "skills", "competências", "habilidades", "aptitudes",
]);

function discriminatingTokens(value: string, locale: string): Set<string> {
  return new Set(tokenize(value, locale).filter((token) => !STOP_WORDS.has(token)));
}

export function deriveCoreCompleteness(
  facts: readonly SectionContentFact[],
): Observation<CoreCompleteness> {
  const known = facts.filter((fact) => fact.state !== "unavailable");
  if (known.length === 0) return unavailable("dom:core-sections:none-rendered");
  const confirmedEmpty = facts.filter((fact) => fact.state === "absent").length;
  const substantive = facts.filter((fact) => fact.state === "observed" && fact.substantive).length;
  const observedCount = facts.filter((fact) => fact.state === "observed").length;
  let value: CoreCompleteness = "neutral";
  if (confirmedEmpty >= 3) value = "three_or_more_confirmed_empty";
  else if (substantive >= 3) value = "several_substantive_sections";
  else if (observedCount >= 2 && substantive >= 1) value = "adequate";
  else if (known.length < 2) return unavailable("dom:core-sections:insufficient-rendered-sections");
  const confidence = known.reduce((sum, fact) => sum + fact.confidence, 0) / known.length;
  return observed(value, confidence, `dom:core-sections:${value}`);
}

export function isBroadlyThinProfile(
  facts: readonly SectionContentFact[],
  experience: ExperienceFacts,
): boolean {
  if (experience.detail.state === "observed" && experience.detail.value === "established_empty_or_vague") return true;
  const known = facts.filter((fact) => fact.state !== "unavailable");
  if (known.length < 3) return false;
  return facts.filter((fact) => fact.state === "observed" && fact.substantive).length <= 1;
}

export function deriveCrossSectionConsistency(
  dictionary: ExtractionDictionary,
  topCard: TopCardFacts,
  experience: ExperienceFacts,
  sectionFacts: readonly SectionContentFact[],
): Observation<CrossSectionConsistency> {
  if (
    experience.companyAffiliation.state === "observed" &&
    experience.companyAffiliation.value === "material_identity_conflict"
  ) {
    return observed("material_conflict", experience.companyAffiliation.extractionConfidence, "dom:cross-section:current-company-conflict");
  }

  const sections: string[] = [];
  if (topCard.headline.state === "observed") sections.push(topCard.headline.value);
  if (topCard.about.state === "observed") sections.push(topCard.about.value);
  const experienceText = experience.roles
    .map((role) => [role.title, role.employer, role.description].filter(Boolean).join(" "))
    .join(" ");
  if (experienceText) sections.push(experienceText);
  const skills = sectionFacts.find((fact) => fact.key === "skills" && fact.state === "observed")?.text;
  if (skills) sections.push(skills);
  if (sections.length < 2) return unavailable("dom:cross-section:fewer-than-two-rendered-sections");

  const tokenSets = sections.map((text) => discriminatingTokens(text, dictionary.locale));
  const frequencies = new Map<string, number>();
  for (const tokens of tokenSets) {
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  const sharedTokens = Array.from(frequencies.values()).filter((frequency) => frequency >= 2).length;
  const pairSimilarities: number[] = [];
  let alignedPairCount = 0;
  for (let left = 0; left < sections.length; left += 1) {
    for (let right = left + 1; right < sections.length; right += 1) {
      const leftSection = sections[left];
      const rightSection = sections[right];
      const leftTokens = tokenSets[left];
      const rightTokens = tokenSets[right];
      if (!leftSection || !rightSection || !leftTokens || !rightTokens) continue;
      const similarity = similarText(leftSection, rightSection, dictionary.locale);
      pairSimilarities.push(similarity);
      let sharedInPair = 0;
      for (const token of leftTokens) {
        if (rightTokens.has(token)) sharedInPair += 1;
      }
      if (sharedInPair >= 2 || similarity >= 0.18) alignedPairCount += 1;
    }
  }
  const bestSimilarity = Math.max(0, ...pairSimilarities);
  const strongPairCount = pairSimilarities.filter((similarity) => similarity >= 0.35).length;
  const value: CrossSectionConsistency = sections.length >= 3 && alignedPairCount >= 2 &&
    (sharedTokens >= 4 || strongPairCount >= 2)
    ? "strong_alignment"
    : sharedTokens >= 2 || bestSimilarity >= 0.18
      ? "partial_alignment"
      : "neutral";
  return observed(value, sections.length >= 3 ? 0.84 : 0.72, `dom:cross-section:${value}`);
}

export function deriveContentSpecificity(
  dictionary: ExtractionDictionary,
  topCard: TopCardFacts,
  experience: ExperienceFacts,
  sectionFacts: readonly SectionContentFact[],
  supportedLanguage: boolean,
): Observation<ContentSpecificity> {
  if (!supportedLanguage) return unavailable("dom:content-specificity:unsupported-interface-language");
  const candidateTexts = [
    topCard.headline.state === "observed" ? topCard.headline.value : "",
    topCard.about.state === "observed" ? topCard.about.value : "",
    ...experience.roles.map((role) => role.description ?? ""),
    ...sectionFacts
      .filter((fact) => fact.state === "observed" && (fact.key === "skills" || fact.key === "education"))
      .map((fact) => fact.text),
  ].filter((text) => text.length >= 12);
  const seen = new Set<string>();
  const texts = candidateTexts.filter((text) => {
    const normalized = comparableText(text, dictionary.locale);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  if (texts.length === 0) return unavailable("dom:content-specificity:no-rendered-content");
  const combined = texts.join(" ");
  const technologyMatches = new Set(Array.from(combined.matchAll(TECHNOLOGY_PATTERN), (match) => comparableText(match[0], dictionary.locale)));
  const normalized = comparableText(combined, dictionary.locale);
  const projectTerms = PROJECT_TERMS[dictionary.locale] ?? PROJECT_TERMS.en ?? [];
  const outcomeCount = dictionary.content.outcomeTerms.filter((term) => normalized.includes(comparableText(term, dictionary.locale))).length;
  const projectCount = projectTerms.filter((term) => normalized.includes(comparableText(term, dictionary.locale))).length;
  const numericOutcome = /\b\d+(?:[.,]\d+)?\s*(?:%|x|ms|s|hours?|dias?|días?|days?)\b/iu.test(combined);
  const concrete = technologyMatches.size >= 2 || outcomeCount + projectCount >= 2 || (technologyMatches.size >= 1 && numericOutcome);
  const genericHits = dictionary.content.genericPhrases.filter((phrase) =>
    normalized.includes(comparableText(phrase, dictionary.locale)),
  ).length;
  let repeatedPairs = 0;
  for (let left = 0; left < texts.length; left += 1) {
    for (let right = left + 1; right < texts.length; right += 1) {
      const leftText = texts[left];
      const rightText = texts[right];
      if (leftText && rightText && similarText(leftText, rightText, dictionary.locale) >= 0.75) repeatedPairs += 1;
    }
  }
  const value: ContentSpecificity = concrete
    ? "concrete_technologies_projects_or_outcomes"
    : genericHits >= 1 && repeatedPairs >= 1
      ? "wholly_generic_repeated"
      : "neutral";
  return observed(value, concrete ? 0.88 : value === "wholly_generic_repeated" ? 0.78 : 0.66, `dom:content-specificity:${value}`);
}
