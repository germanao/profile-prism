export type SupportedExtractionLocale = "en" | "pt" | "es";

export type SectionKey =
  | "about"
  | "experience"
  | "education"
  | "skills"
  | "activity"
  | "recommendations";

export interface ExtractionDictionary {
  locale: SupportedExtractionLocale;
  sectionLabels: Record<SectionKey, readonly string[]>;
  emptyStateText: Partial<Record<SectionKey | "generic", readonly string[]>>;
  verification: {
    identity: readonly string[];
    workplace: readonly string[];
    education: readonly string[];
    verified: readonly string[];
  };
  aboutMember: {
    governmentId: readonly string[];
    workEmail: readonly string[];
    education: readonly string[];
    joinedLinkedIn: readonly string[];
    contactUpdated: readonly string[];
    photoUpdated: readonly string[];
    updated: readonly string[];
  };
  date: {
    months: Readonly<Record<string, number>>;
    current: readonly string[];
    rangeSeparators: readonly string[];
    relativeDayUnits: readonly string[];
    relativeWeekUnits: readonly string[];
    relativeMonthUnits: readonly string[];
    relativeYearUnits: readonly string[];
    relativePrefixes: readonly string[];
  };
  network: {
    connections: readonly string[];
    followers: readonly string[];
  };
  profile: {
    memberSince: readonly string[];
    currentRoleSeparators: readonly string[];
    defaultImageText: readonly string[];
  };
  content: {
    genericPhrases: readonly string[];
    outcomeTerms: readonly string[];
  };
}
