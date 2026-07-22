import { enExtraction } from "./en";
import { esExtraction } from "./es";
import { ptExtraction } from "./pt";
import type { ExtractionDictionary, SupportedExtractionLocale } from "./types";

export type { ExtractionDictionary, SectionKey, SupportedExtractionLocale } from "./types";

export const extractionDictionaries: Readonly<Record<SupportedExtractionLocale, ExtractionDictionary>> = {
  en: enExtraction,
  pt: ptExtraction,
  es: esExtraction,
};

export function normalizeExtractionLocale(locale?: string | null): SupportedExtractionLocale {
  const language = locale?.trim().toLocaleLowerCase().split(/[-_]/u)[0];
  return language === "pt" || language === "es" ? language : "en";
}

export function getExtractionDictionary(locale?: string | null): ExtractionDictionary {
  return extractionDictionaries[normalizeExtractionLocale(locale)];
}
