import { describe, expect, it } from "vitest";
import {
  createEmptyProfileEvidence,
  observedObservation
} from "../../src/scoring/evidence-schema";
import { evaluateProfileEvidence } from "../../src/scoring/evaluate";
import type { CriterionId } from "../../src/scoring";
import {
  NON_ZERO_MESSAGE_KEYS,
  evidenceMessage,
  getCopy,
  type SupportedUiLocale
} from "../../src/ui/copy";

function criterionFromKey(key: (typeof NON_ZERO_MESSAGE_KEYS)[number]): CriterionId {
  return key.split(".")[1] as CriterionId;
}

describe("detailed model-v2 evidence explanations", () => {
  it("ships concise popup, FAB, and popover copy in every supported locale", () => {
    for (const locale of ["en", "pt", "es"] as const) {
      const ui = getCopy(locale);
      for (const value of [
        ui.shortExtensionName,
        ui.onDeviceLabel,
        ui.popupProfileReady,
        ui.popupScanning,
        ui.popupComplete,
        ui.popupIncomplete,
        ui.popupUnsupported,
        ui.popupDisabled,
        ui.evidenceHighlights,
        ui.allSignals,
        ui.showLess,
        ui.conciseEvidenceDisclaimer,
        ui.authenticityQuestion,
        ui.scanActionShort,
        ui.scanScanningShort,
        ui.scanUpdatedShort,
        ui.scanRetryShort,
        ui.scanOverlayTitle,
        ui.scanOverlayLiveEstimate,
        ui.scanOverlayCompleteTitle,
        ui.scanOverlayIncompleteTitle,
        ui.scanOverlayIncompleteBody,
        ui.scanStagePreparing,
        ui.scanStageVerification,
        ui.scanStageReading,
        ui.scanStageSettling,
        ui.scanStageReturning
      ]) {
        expect(value.trim(), locale).not.toBe("");
        expect(value.length, `${locale}: ${value}`).toBeLessThan(90);
      }
    }
  });

  it("localizes the explicit full-scan invitation", () => {
    expect(getCopy("en").authenticityQuestion).toBe(
      "How authentic is this profile?"
    );
    expect(getCopy("en").scanActionShort).toBe(
      "Click to verify authenticity"
    );
    expect(getCopy("pt").scanActionShort).toBe(
      "Clique para verificar a autenticidade"
    );
    expect(getCopy("es").scanActionShort).toBe(
      "Haz clic para verificar la autenticidad"
    );
    expect(getCopy("en").scanAction).toBe("Verify authenticity");
    expect(getCopy("en").scanRetryShort).toBe(
      "Verify authenticity again"
    );
  });

  it("has deterministic EN/PT/ES copy for every non-zero model-v2 rule key", () => {
    expect(NON_ZERO_MESSAGE_KEYS).toHaveLength(37);
    expect(new Set(NON_ZERO_MESSAGE_KEYS).size).toBe(NON_ZERO_MESSAGE_KEYS.length);

    const genericFallbacks: Record<SupportedUiLocale, RegExp> = {
      en: /visible evidence (supports the profile|indicates caution)/i,
      pt: /as evidências visíveis (sustentam o perfil|indicam cautela)/i,
      es: /la evidencia visible (respalda el perfil|indica precaución)/i
    };

    for (const locale of ["en", "pt", "es"] as const) {
      for (const key of NON_ZERO_MESSAGE_KEYS) {
        const message = evidenceMessage(
          key,
          criterionFromKey(key),
          1,
          locale
        );
        expect(message, `${locale}: ${key}`).not.toMatch(genericFallbacks[locale]);
        expect(message.length, `${locale}: ${key}`).toBeGreaterThan(24);
      }
    }
  });

  it("states the observed supporting reason instead of only naming its criterion", () => {
    const evidence = createEmptyProfileEvidence();
    evidence.workHistoryDetail = observedObservation(
      "several_substantive_dated_roles",
      "fixture:experience"
    );
    const supporting = evaluateProfileEvidence(evidence).explanations.supporting[0]!;

    expect(
      evidenceMessage(
        supporting.messageKey,
        supporting.criterion,
        supporting.scoreImpact,
        "en"
      )
    ).toBe("Several substantive roles with dates are visible in the work history.");
    expect(
      evidenceMessage(
        supporting.messageKey,
        supporting.criterion,
        supporting.scoreImpact,
        "pt"
      )
    ).toContain("Vários cargos substanciais com datas");
    expect(
      evidenceMessage(
        supporting.messageKey,
        supporting.criterion,
        supporting.scoreImpact,
        "es"
      )
    ).toContain("varios puestos sustanciales con fechas");
  });

  it("states the observed caution reason and its important gating conditions", () => {
    const evidence = createEmptyProfileEvidence();
    evidence.accountAge = observedObservation(
      { days: 12 },
      "fixture:account-age"
    );
    evidence.networkMaturity = observedObservation(
      "under_30_established_senior_or_recruiter_with_thin_signal",
      "fixture:network"
    );
    const caution = evaluateProfileEvidence(evidence).explanations.caution;
    const accountAge = caution.find((item) => item.criterion === "account-age")!;
    const network = caution.find((item) => item.criterion === "network-maturity")!;

    expect(
      evidenceMessage(
        accountAge.messageKey,
        accountAge.criterion,
        accountAge.scoreImpact,
        "en"
      )
    ).toContain("less than 30 days old");
    expect(
      evidenceMessage(
        accountAge.messageKey,
        accountAge.criterion,
        accountAge.scoreImpact,
        "pt"
      )
    ).toContain("menos de 30 dias");
    expect(
      evidenceMessage(
        accountAge.messageKey,
        accountAge.criterion,
        accountAge.scoreImpact,
        "es"
      )
    ).toContain("menos de 30 días");

    const networkMessage = evidenceMessage(
      network.messageKey,
      network.criterion,
      network.scoreImpact,
      "en"
    );
    expect(networkMessage).toContain("Fewer than 30 connections");
    expect(networkMessage).toContain("senior or recruiter claim");
    expect(networkMessage).toContain("another thin-profile signal");
  });

  it("explains model-v2 verification and maintenance facts without exposing raw identity data", () => {
    const evidence = createEmptyProfileEvidence();
    evidence.identityVerification = observedObservation("active", "fixture:badge");
    evidence.workplaceEducationVerification = observedObservation({
      governmentId: true,
      workplace: true,
      workplaceMatch: "current",
      education: false,
      verificationAgeDays: 500,
    }, "fixture:dialog");
    evidence.profileMaintenance = observedObservation({
      contactUpdatedDays: 20,
      photoUpdatedDays: 80,
    }, "fixture:dialog");
    const result = evaluateProfileEvidence(evidence);

    const informational = result.explanations.informational[0]!;
    expect(evidenceMessage(
      informational.messageKey,
      informational.criterion,
      informational.scoreImpact,
      "en",
    )).toContain("does not count as identity verification");

    const verification = result.explanations.supporting.find(
      ({ criterion }) => criterion === "affiliation-verification",
    )!;
    const verificationText = evidenceMessage(
      verification.messageKey,
      verification.criterion,
      verification.scoreImpact,
      "en",
    );
    expect(verificationText).toContain("government ID");
    expect(verificationText).toContain("current-employer work email");
    expect(verificationText).toContain("at least 12 months");

    const maintenance = result.explanations.supporting.find(
      ({ criterion }) => criterion === "profile-maintenance",
    )!;
    expect(evidenceMessage(
      maintenance.messageKey,
      maintenance.criterion,
      maintenance.scoreImpact,
      "en",
    )).toContain("Both contact information and the profile photo");
  });
});
