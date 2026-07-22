import type { ExtractionDictionary } from "../locales/extraction";
import { findSection, meaningfulSectionText, sectionItems } from "./dom";
import type { SectionContentFact } from "./types";

type CoreSectionKey = SectionContentFact["key"];

const CORE_SECTIONS: readonly CoreSectionKey[] = ["about", "experience", "education", "skills"];

function substantiveThreshold(key: CoreSectionKey): number {
  if (key === "about") return 80;
  if (key === "skills") return 12;
  return 30;
}

export function extractCoreSectionFacts(
  root: ParentNode,
  dictionary: ExtractionDictionary,
): SectionContentFact[] {
  return CORE_SECTIONS.map((key) => {
    const section = findSection(root, key, dictionary);
    if (!section) {
      return { key, state: "unavailable", substantive: false, text: "", confidence: 0 };
    }
    if (section.explicitlyEmpty) {
      return { key, state: "absent", substantive: false, text: "", confidence: section.confidence };
    }

    const text = meaningfulSectionText(section.element);
    const items = sectionItems(section.element);
    if (!text && items.length === 0) {
      return { key, state: "unavailable", substantive: false, text: "", confidence: 0 };
    }
    const substantive = text.length >= substantiveThreshold(key) || items.length >= (key === "experience" ? 2 : 3);
    return { key, state: "observed", substantive, text, confidence: section.confidence };
  });
}
