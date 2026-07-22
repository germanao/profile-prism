import type { Observation } from "../scoring/evidence-schema";
import type { SupportedExtractionLocale } from "../locales/extraction";

export interface ProfileExtractionOptions {
  /** The current page URL. It is used only to validate the /in/ route and is never retained. */
  url?: string | URL;
  /** LinkedIn interface locale. Falls back to the document language and then English. */
  locale?: SupportedExtractionLocale | string;
  /** Stable clock injection for deterministic date parsing tests. */
  now?: Date;
}

export interface ElementMatch<T extends Element = HTMLElement> {
  element: T;
  confidence: number;
  source: string;
}

export interface SectionMatch extends ElementMatch<HTMLElement> {
  explicitlyEmpty: boolean;
}

export interface ParsedProfileDate {
  year: number;
  month?: number;
}

export interface ParsedDateRange {
  start?: ParsedProfileDate;
  end?: ParsedProfileDate;
  current: boolean;
  confidence: number;
}

export interface ExperienceRole {
  title?: string;
  employer?: string;
  description?: string;
  dateText?: string;
  dates?: ParsedDateRange;
  linkedEmployer: boolean;
  current: boolean;
  sourceElement: HTMLElement;
}

export interface TopCardFacts {
  name: Observation<string>;
  headline: Observation<string>;
  about: Observation<string>;
  currentCompany: Observation<string>;
  accountAge: Observation<{ days: number }>;
  imageKind: Observation<"personal" | "default_or_non_person" | "none">;
}

export interface ExperienceFacts {
  sectionState: "observed" | "absent" | "unavailable";
  roles: readonly ExperienceRole[];
  detail: Observation<
    "several_substantive_dated_roles" | "adequate" | "established_empty_or_vague" | "neutral"
  >;
  chronology: Observation<"rich_coherent" | "consistent" | "material_contradiction" | "neutral">;
  companyAffiliation: Observation<
    "linked_employer_specific_role" | "material_identity_conflict" | "neutral"
  >;
}

export interface SectionContentFact {
  key: "about" | "experience" | "education" | "skills";
  state: "observed" | "absent" | "unavailable";
  substantive: boolean;
  text: string;
  confidence: number;
}

export interface ActivityFacts {
  distribution: Observation<
    "distributed_over_years" | "at_least_six_months" | "sudden_near_duplicate_burst_with_thin_signal" | "neutral"
  >;
  engagement: Observation<"varied_specific_over_time" | "some_genuine_exchange" | "repeated_generic_pattern" | "neutral">;
}
