import type {
  CriterionId,
  MessageKey,
  ScoreBand
} from "../scoring";
import { browserMessage, uiLanguage } from "../platform/browser-api";
import type { UiLocalePreference } from "../platform/storage";

export type SupportedUiLocale = "en" | "pt" | "es";

export interface UiCopy {
  extensionName: string;
  shortExtensionName: string;
  badgeLabel: (score: number) => string;
  scoreHeading: (score: number) => string;
  evidenceCoverage: (percent: number, label: string) => string;
  supportingEvidence: string;
  cautionEvidence: string;
  unavailableEvidence: string;
  noSupportingEvidence: string;
  noCautionEvidence: string;
  noUnavailableEvidence: string;
  insufficientEvidence: string;
  scoreMethodSummary: string;
  pointImpact: (points: string) => string;
  moreChecks: (count: number) => string;
  unavailableChecks: (count: number) => string;
  safetyNotAssessed: string;
  heuristicDisclaimer: string;
  decisionDisclaimer: string;
  viewFullBreakdown: string;
  showMoreInToolbar: string;
  close: string;
  enableTitle: string;
  enableDisclosure: string;
  enableAction: string;
  enabledTitle: string;
  disabledTitle: string;
  disableAction: string;
  refreshAction: string;
  processing: string;
  unsupported: string;
  noPageConnection: string;
  genericError: string;
  privacyPolicy: string;
  dataInventory: string;
  preferences: string;
  language: string;
  autoLanguage: string;
  automaticScoring: string;
  onLabel: string;
  offLabel: string;
  popupInstruction: string;
  profileReady: string;
  onDeviceLabel: string;
  popupProfileReady: string;
  popupScanning: string;
  popupComplete: string;
  popupIncomplete: string;
  popupUnsupported: string;
  popupDisabled: string;
  evidenceSectionLabel: string;
  evidenceHighlights: string;
  allSignals: string;
  showLess: string;
  conciseEvidenceDisclaimer: string;
  additionalContext: string;
  statusLabel: string;
  authenticityQuestion: string;
  initialEstimate: string;
  fullVisibleProfileScanned: string;
  initialEstimateHint: string;
  checkedEvidence: (checked: number, total: number) => string;
  evidenceIndexDisclaimer: string;
  scanAvailable: string;
  scanAction: string;
  scanScanning: string;
  scanComplete: string;
  scanPartial: string;
  scanCancelled: string;
  scanFailed: string;
  scanOverlayTitle: string;
  scanOverlayLiveEstimate: string;
  scanOverlayElapsed: (seconds: number) => string;
  scanOverlayCompleteTitle: string;
  scanOverlayIncompleteTitle: string;
  scanOverlayIncompleteBody: string;
  scanStagePreparing: string;
  scanStageVerification: string;
  scanStageReading: string;
  scanStageSettling: string;
  scanStageReturning: string;
  scanActionShort: string;
  scanScanningShort: string;
  scanUpdatedShort: string;
  scanRetryShort: string;
  cancelScan: string;
  retryScan: string;
  currentScore: (score: number) => string;
  coverageLabels: Record<"very-low" | "low" | "partial" | "high", string>;
  bandLabels: Record<ScoreBand, string>;
  criterionUnavailable: (criterion: string) => string;
}

const copy: Record<SupportedUiLocale, UiCopy> = {
  en: {
    extensionName: "Profile Prism",
    shortExtensionName: "Profile Prism",
    badgeLabel: (score) => `Profile Evidence score: ${score} out of 100`,
    scoreHeading: (score) => `Profile Prism evidence: ${score} / 100`,
    evidenceCoverage: (percent, label) => `Weighted checks inspected: ${percent}% — ${label}`,
    supportingEvidence: "Supporting evidence",
    cautionEvidence: "Caution evidence",
    unavailableEvidence: "Unavailable or not loaded",
    noSupportingEvidence: "No supporting signal was confidently observed.",
    noCautionEvidence: "No caution signal was confidently observed.",
    noUnavailableEvidence: "No material criterion is currently unavailable.",
    insufficientEvidence:
      "Insufficient visible evidence: only a small share of profile signals is available so far. Missing checks do not lower the score; treat this as an early estimate.",
    scoreMethodSummary:
      "50 is neutral. Supporting signals raise the score; caution signals lower it.",
    pointImpact: (points) => `${points} points`,
    moreChecks: (count) => `Show ${count} more`,
    unavailableChecks: (count) =>
      `${count} check${count === 1 ? " is" : "s are"} not available yet — ${count === 1 ? "it has" : "they have"} not lowered the score.`,
    safetyNotAssessed: "Safety / scam behavior: Not assessed",
    heuristicDisclaimer:
      "Heuristic assessment of visible profile information. Not identity verification or a determination of fraud.",
    decisionDisclaimer:
      "Do not use this score as the sole basis for recruiting, employment, reporting, blocking, or trust decisions.",
    viewFullBreakdown: "View full breakdown",
    showMoreInToolbar: "Open the extension from the toolbar to view every criterion.",
    close: "Close",
    enableTitle: "Enable on LinkedIn profiles",
    enableDisclosure:
      "When enabled, this extension reads the listed information currently rendered on LinkedIn profile pages and temporarily processes it in browser memory to calculate an evidence score. No profile content, profile URL, photograph, score, cookie, authentication data, message, or contact information is sent to us or a third party. Profile-derived information is not retained after the page is closed or replaced.",
    enableAction: "Enable on LinkedIn profiles",
    enabledTitle: "Profile scoring is enabled",
    disabledTitle: "Profile scoring is disabled",
    disableAction: "Disable",
    refreshAction: "Refresh visible evidence",
    processing: "Reading currently visible evidence…",
    unsupported: "Open a supported LinkedIn profile page to see an evidence score.",
    noPageConnection:
      "The current page is not available to the extension. Open or reload a supported LinkedIn profile page.",
    genericError: "The visible evidence could not be evaluated on this page.",
    privacyPolicy: "Privacy policy",
    dataInventory: "Field-level data inventory",
    preferences: "Preferences",
    language: "Interface language",
    autoLanguage: "Browser language",
    automaticScoring: "Automatic scoring",
    onLabel: "On",
    offLabel: "Off",
    popupInstruction:
      "Open any LinkedIn profile. The score appears automatically beside the name; hover it for details.",
    profileReady: "Profile detected. The score is beside the name.",
    onDeviceLabel: "On-device only",
    popupProfileReady: "Profile ready",
    popupScanning: "Scanning profile\u2026",
    popupComplete: "Visible profile scanned",
    popupIncomplete: "Scan incomplete",
    popupUnsupported: "Open a LinkedIn profile to begin",
    popupDisabled: "Automatic scoring is off",
    evidenceSectionLabel: "Evidence breakdown",
    evidenceHighlights: "Evidence highlights",
    allSignals: "All signals",
    showLess: "Show less",
    conciseEvidenceDisclaimer:
      "Evidence index\u2014not identity verification or a fraud decision.",
    additionalContext: "Additional context",
    statusLabel: "Status",
    authenticityQuestion: "How authentic is this profile?",
    initialEstimate: "Initial estimate",
    fullVisibleProfileScanned: "Full visible profile scanned",
    initialEstimateHint: "More visible sections can refine this estimate.",
    checkedEvidence: (checked, total) => `${checked} of ${total} evidence checks read`,
    evidenceIndexDisclaimer:
      "Evidence index based on visible profile information. It is not identity verification or a fraud determination.",
    scanAvailable: "Profile ready",
    scanAction: "Verify authenticity",
    scanScanning: "Scanning visible profile",
    scanComplete: "Full visible profile scanned",
    scanPartial: "Partial scan complete",
    scanCancelled: "Scan cancelled",
    scanFailed: "Scan could not finish",
    scanOverlayTitle: "Full profile scan",
    scanOverlayLiveEstimate: "Live estimate",
    scanOverlayElapsed: (seconds) => `${seconds}s elapsed`,
    scanOverlayCompleteTitle: "Score updated",
    scanOverlayIncompleteTitle: "Scan incomplete",
    scanOverlayIncompleteBody:
      "Best visible result kept. Retry or return to the profile.",
    scanStagePreparing: "Preparing full scan",
    scanStageVerification: "Checking verification details",
    scanStageReading: "Reading visible profile sections",
    scanStageSettling: "Waiting for LinkedIn to finish loading",
    scanStageReturning: "Returning to the top",
    scanActionShort: "Click to verify authenticity",
    scanScanningShort: "Scanning\u2026",
    scanUpdatedShort: "Updated",
    scanRetryShort: "Verify authenticity again",
    cancelScan: "Cancel scan",
    retryScan: "Verify authenticity again",
    currentScore: (score) => `Current score ${score} out of 100`,
    coverageLabels: {
      "very-low": "Very low evidence",
      low: "Low evidence",
      partial: "Partial visible evidence",
      high: "High evidence"
    },
    bandLabels: {
      "several-caution-signals": "Several caution signals — verify independently",
      inconclusive: "Inconclusive",
      "more-supporting-signals": "More supporting signals",
      "strong-supporting-signals": "Strong supporting signals — not a guarantee"
    },
    criterionUnavailable: (criterion) => `${criterion} was not visible or could not be read.`
  },
  pt: {
    extensionName: "Profile Prism",
    shortExtensionName: "Profile Prism",
    badgeLabel: (score) => `Pontuação de evidências do perfil: ${score} de 100`,
    scoreHeading: (score) => `Evidências do Profile Prism: ${score} / 100`,
    evidenceCoverage: (percent, label) => `Verificações ponderadas analisadas: ${percent}% — ${label}`,
    supportingEvidence: "Evidências favoráveis",
    cautionEvidence: "Evidências de cautela",
    unavailableEvidence: "Indisponível ou não carregado",
    noSupportingEvidence: "Nenhum sinal favorável foi observado com confiança.",
    noCautionEvidence: "Nenhum sinal de cautela foi observado com confiança.",
    noUnavailableEvidence: "Nenhum critério relevante está indisponível no momento.",
    insufficientEvidence:
      "Evidências visíveis insuficientes: apenas uma pequena parte dos sinais do perfil está disponível. Verificações ausentes não reduzem a pontuação; considere-a uma estimativa inicial.",
    scoreMethodSummary:
      "50 é neutro. Sinais favoráveis aumentam a pontuação; sinais de cautela a reduzem.",
    pointImpact: (points) => `${points} pontos`,
    moreChecks: (count) => `Mostrar mais ${count}`,
    unavailableChecks: (count) =>
      `Verificações ainda indisponíveis: ${count}. Elas não reduzem a pontuação.`,
    safetyNotAssessed: "Segurança / comportamento de golpe: Não avaliado",
    heuristicDisclaimer:
      "Avaliação heurística das informações visíveis do perfil. Não é verificação de identidade nem determinação de fraude.",
    decisionDisclaimer:
      "Não use esta pontuação como único fundamento para decisões de recrutamento, emprego, denúncia, bloqueio ou confiança.",
    viewFullBreakdown: "Ver análise completa",
    showMoreInToolbar: "Abra a extensão na barra de ferramentas para ver todos os critérios.",
    close: "Fechar",
    enableTitle: "Ativar nos perfis do LinkedIn",
    enableDisclosure:
      "Quando ativada, esta extensão lê as informações listadas que estão renderizadas nas páginas de perfil do LinkedIn e as processa temporariamente na memória do navegador para calcular uma pontuação de evidências. Nenhum conteúdo ou URL de perfil, fotografia, pontuação, cookie, dado de autenticação, mensagem ou informação de contato é enviado a nós ou a terceiros. As informações derivadas do perfil não são retidas depois que a página é fechada ou substituída.",
    enableAction: "Ativar nos perfis do LinkedIn",
    enabledTitle: "A pontuação de perfis está ativada",
    disabledTitle: "A pontuação de perfis está desativada",
    disableAction: "Desativar",
    refreshAction: "Atualizar evidências visíveis",
    processing: "Lendo as evidências visíveis…",
    unsupported: "Abra uma página de perfil compatível do LinkedIn para ver a pontuação.",
    noPageConnection:
      "A página atual não está disponível para a extensão. Abra ou recarregue uma página de perfil compatível do LinkedIn.",
    genericError: "Não foi possível avaliar as evidências visíveis nesta página.",
    privacyPolicy: "Política de privacidade",
    dataInventory: "Inventário de dados por campo",
    preferences: "Preferências",
    language: "Idioma da interface",
    autoLanguage: "Idioma do navegador",
    automaticScoring: "Pontuação automática",
    onLabel: "Ativada",
    offLabel: "Desativada",
    popupInstruction:
      "Abra qualquer perfil do LinkedIn. A pontuação aparece automaticamente ao lado do nome; passe o cursor sobre ela para ver os detalhes.",
    profileReady: "Perfil detectado. A pontuação está ao lado do nome.",
    onDeviceLabel: "Somente neste dispositivo",
    popupProfileReady: "Perfil pronto",
    popupScanning: "Analisando perfil\u2026",
    popupComplete: "Perfil visível analisado",
    popupIncomplete: "Análise incompleta",
    popupUnsupported: "Abra um perfil do LinkedIn para começar",
    popupDisabled: "A pontuação automática está desativada",
    evidenceSectionLabel: "Análise das evidências",
    evidenceHighlights: "Destaques das evidências",
    allSignals: "Todos os sinais",
    showLess: "Mostrar menos",
    conciseEvidenceDisclaimer:
      "Índice de evidências\u2014não é verificação de identidade nem decisão sobre fraude.",
    additionalContext: "Contexto adicional",
    statusLabel: "Status",
    authenticityQuestion: "Quão autêntico é este perfil?",
    initialEstimate: "Estimativa inicial",
    fullVisibleProfileScanned: "Perfil visível totalmente analisado",
    initialEstimateHint: "Mais seções visíveis podem refinar esta estimativa.",
    checkedEvidence: (checked, total) => `${checked} de ${total} critérios analisados`,
    evidenceIndexDisclaimer:
      "Índice de evidências baseado nas informações visíveis do perfil. Não é verificação de identidade nem determinação de fraude.",
    scanAvailable: "Perfil pronto",
    scanAction: "Verificar a autenticidade",
    scanScanning: "Analisando o perfil visível",
    scanComplete: "Perfil visível verificado por completo",
    scanPartial: "Análise parcial concluída",
    scanCancelled: "Análise cancelada",
    scanFailed: "Não foi possível concluir",
    scanOverlayTitle: "Análise completa do perfil",
    scanOverlayLiveEstimate: "Estimativa ao vivo",
    scanOverlayElapsed: (seconds) => `${seconds}s decorridos`,
    scanOverlayCompleteTitle: "Pontuação atualizada",
    scanOverlayIncompleteTitle: "Análise incompleta",
    scanOverlayIncompleteBody:
      "Melhor resultado visível mantido. Tente novamente ou volte ao perfil.",
    scanStagePreparing: "Preparando a análise completa",
    scanStageVerification: "Verificando detalhes de validação",
    scanStageReading: "Lendo as seções visíveis do perfil",
    scanStageSettling: "Aguardando o LinkedIn terminar de carregar",
    scanStageReturning: "Voltando ao topo",
    scanActionShort: "Clique para verificar a autenticidade",
    scanScanningShort: "Analisando\u2026",
    scanUpdatedShort: "Atualizado",
    scanRetryShort: "Verificar a autenticidade novamente",
    cancelScan: "Cancelar análise",
    retryScan: "Verificar a autenticidade novamente",
    currentScore: (score) => `Pontuação atual ${score} de 100`,
    coverageLabels: {
      "very-low": "Evidência muito baixa",
      low: "Evidência baixa",
      partial: "Evidência visível parcial",
      high: "Evidência alta"
    },
    bandLabels: {
      "several-caution-signals": "Vários sinais de cautela — verifique de forma independente",
      inconclusive: "Inconclusivo",
      "more-supporting-signals": "Mais sinais favoráveis",
      "strong-supporting-signals": "Sinais favoráveis fortes — sem garantia"
    },
    criterionUnavailable: (criterion) => `${criterion} não estava visível ou não pôde ser lido.`
  },
  es: {
    extensionName: "Profile Prism",
    shortExtensionName: "Profile Prism",
    badgeLabel: (score) => `Puntuación de evidencia del perfil: ${score} de 100`,
    scoreHeading: (score) => `Evidencia de Profile Prism: ${score} / 100`,
    evidenceCoverage: (percent, label) => `Comprobaciones ponderadas analizadas: ${percent}% — ${label}`,
    supportingEvidence: "Evidencia favorable",
    cautionEvidence: "Evidencia de precaución",
    unavailableEvidence: "No disponible o no cargado",
    noSupportingEvidence: "No se observó con confianza ninguna señal favorable.",
    noCautionEvidence: "No se observó con confianza ninguna señal de precaución.",
    noUnavailableEvidence: "Ningún criterio relevante está indisponible actualmente.",
    insufficientEvidence:
      "Evidencia visible insuficiente: solo una pequeña parte de las señales del perfil está disponible. Las comprobaciones ausentes no reducen la puntuación; considérela una estimación inicial.",
    scoreMethodSummary:
      "50 es neutral. Las señales favorables aumentan la puntuación; las señales de precaución la reducen.",
    pointImpact: (points) => `${points} puntos`,
    moreChecks: (count) => `Mostrar ${count} más`,
    unavailableChecks: (count) =>
      `Comprobaciones aún no disponibles: ${count}. No reducen la puntuación.`,
    safetyNotAssessed: "Seguridad / conducta de estafa: No evaluada",
    heuristicDisclaimer:
      "Evaluación heurística de la información visible del perfil. No es una verificación de identidad ni una determinación de fraude.",
    decisionDisclaimer:
      "No use esta puntuación como única base para decisiones de contratación, empleo, denuncia, bloqueo o confianza.",
    viewFullBreakdown: "Ver desglose completo",
    showMoreInToolbar: "Abra la extensión desde la barra de herramientas para ver todos los criterios.",
    close: "Cerrar",
    enableTitle: "Activar en perfiles de LinkedIn",
    enableDisclosure:
      "Cuando está activada, esta extensión lee la información indicada que se muestra actualmente en las páginas de perfil de LinkedIn y la procesa temporalmente en la memoria del navegador para calcular una puntuación de evidencia. No se envía a nosotros ni a terceros ningún contenido o URL de perfil, fotografía, puntuación, cookie, dato de autenticación, mensaje ni información de contacto. La información derivada del perfil no se conserva después de cerrar o reemplazar la página.",
    enableAction: "Activar en perfiles de LinkedIn",
    enabledTitle: "La puntuación de perfiles está activada",
    disabledTitle: "La puntuación de perfiles está desactivada",
    disableAction: "Desactivar",
    refreshAction: "Actualizar evidencia visible",
    processing: "Leyendo la evidencia visible…",
    unsupported: "Abra una página de perfil de LinkedIn compatible para ver una puntuación.",
    noPageConnection:
      "La página actual no está disponible para la extensión. Abra o recargue una página de perfil de LinkedIn compatible.",
    genericError: "No se pudo evaluar la evidencia visible en esta página.",
    privacyPolicy: "Política de privacidad",
    dataInventory: "Inventario de datos por campo",
    preferences: "Preferencias",
    language: "Idioma de la interfaz",
    autoLanguage: "Idioma del navegador",
    automaticScoring: "Puntuación automática",
    onLabel: "Activada",
    offLabel: "Desactivada",
    popupInstruction:
      "Abra cualquier perfil de LinkedIn. La puntuación aparece automáticamente junto al nombre; pase el cursor sobre ella para ver los detalles.",
    profileReady: "Perfil detectado. La puntuación está junto al nombre.",
    onDeviceLabel: "Solo en este dispositivo",
    popupProfileReady: "Perfil listo",
    popupScanning: "Analizando perfil\u2026",
    popupComplete: "Perfil visible analizado",
    popupIncomplete: "Análisis incompleto",
    popupUnsupported: "Abra un perfil de LinkedIn para comenzar",
    popupDisabled: "La puntuación automática está desactivada",
    evidenceSectionLabel: "Desglose de evidencia",
    evidenceHighlights: "Evidencia destacada",
    allSignals: "Todas las señales",
    showLess: "Mostrar menos",
    conciseEvidenceDisclaimer:
      "Índice de evidencia: no es verificación de identidad ni una decisión sobre fraude.",
    additionalContext: "Contexto adicional",
    statusLabel: "Estado",
    authenticityQuestion: "¿Qué tan auténtico es este perfil?",
    initialEstimate: "Estimación inicial",
    fullVisibleProfileScanned: "Perfil visible analizado por completo",
    initialEstimateHint: "Más secciones visibles pueden precisar esta estimación.",
    checkedEvidence: (checked, total) => `${checked} de ${total} criterios analizados`,
    evidenceIndexDisclaimer:
      "Índice de evidencia basado en la información visible del perfil. No es verificación de identidad ni una determinación de fraude.",
    scanAvailable: "Perfil listo",
    scanAction: "Verificar la autenticidad",
    scanScanning: "Analizando el perfil visible",
    scanComplete: "Perfil visible escaneado por completo",
    scanPartial: "Análisis parcial completado",
    scanCancelled: "Análisis cancelado",
    scanFailed: "No se pudo completar",
    scanOverlayTitle: "Análisis completo del perfil",
    scanOverlayLiveEstimate: "Estimación en vivo",
    scanOverlayElapsed: (seconds) => `${seconds}s transcurridos`,
    scanOverlayCompleteTitle: "Puntuación actualizada",
    scanOverlayIncompleteTitle: "Análisis incompleto",
    scanOverlayIncompleteBody:
      "Se conservó el mejor resultado visible. Reintente o vuelva al perfil.",
    scanStagePreparing: "Preparando el análisis completo",
    scanStageVerification: "Comprobando los detalles de verificación",
    scanStageReading: "Leyendo las secciones visibles del perfil",
    scanStageSettling: "Esperando a que LinkedIn termine de cargar",
    scanStageReturning: "Volviendo al inicio",
    scanActionShort: "Haz clic para verificar la autenticidad",
    scanScanningShort: "Analizando\u2026",
    scanUpdatedShort: "Actualizado",
    scanRetryShort: "Verificar la autenticidad de nuevo",
    cancelScan: "Cancelar análisis",
    retryScan: "Verificar la autenticidad de nuevo",
    currentScore: (score) => `Puntuación actual ${score} de 100`,
    coverageLabels: {
      "very-low": "Evidencia muy baja",
      low: "Evidencia baja",
      partial: "Evidencia visible parcial",
      high: "Evidencia alta"
    },
    bandLabels: {
      "several-caution-signals": "Varias señales de precaución — verifique de forma independiente",
      inconclusive: "Inconcluso",
      "more-supporting-signals": "Más señales favorables",
      "strong-supporting-signals": "Señales favorables sólidas — sin garantía"
    },
    criterionUnavailable: (criterion) => `${criterion} no estaba visible o no pudo leerse.`
  }
};

/** Every model-v2 rule outcome that can create a non-zero score contribution. */
export const NON_ZERO_MESSAGE_KEYS = [
  "criterion.identity-verification.active",
  "criterion.affiliation-verification.workplace-and-education",
  "criterion.affiliation-verification.workplace",
  "criterion.affiliation-verification.education",
  "criterion.account-age.under-30-days",
  "criterion.account-age.30-to-179-days",
  "criterion.account-age.180-days-to-2-years",
  "criterion.account-age.2-to-5-years",
  "criterion.account-age.over-5-years",
  "criterion.work-history-detail.several_substantive_dated_roles",
  "criterion.work-history-detail.adequate",
  "criterion.work-history-detail.established_empty_or_vague",
  "criterion.career-chronology.rich_coherent",
  "criterion.career-chronology.consistent",
  "criterion.career-chronology.material_contradiction",
  "criterion.cross-section-consistency.strong_alignment",
  "criterion.cross-section-consistency.partial_alignment",
  "criterion.cross-section-consistency.material_conflict",
  "criterion.company-affiliation.linked_employer_specific_role",
  "criterion.company-affiliation.material_identity_conflict",
  "criterion.core-completeness.several_substantive_sections",
  "criterion.core-completeness.adequate",
  "criterion.core-completeness.three_or_more_confirmed_empty",
  "criterion.activity-distribution.distributed_over_years",
  "criterion.activity-distribution.at_least_six_months",
  "criterion.activity-distribution.sudden_near_duplicate_burst_with_thin_signal",
  "criterion.reciprocal-engagement.varied_specific_over_time",
  "criterion.reciprocal-engagement.some_genuine_exchange",
  "criterion.reciprocal-engagement.repeated_generic_pattern",
  "criterion.network-maturity.plausible",
  "criterion.network-maturity.under_30_established_senior_or_recruiter_with_thin_signal",
  "criterion.recommendations.several_specific_across_people_and_time",
  "criterion.recommendations.some",
  "criterion.recommendations.repeated_boilerplate",
  "criterion.content-specificity.concrete_technologies_projects_or_outcomes",
  "criterion.content-specificity.wholly_generic_repeated",
  "criterion.profile-image.default-new-and-thin"
] as const satisfies readonly MessageKey[];

export type NonZeroMessageKey = (typeof NON_ZERO_MESSAGE_KEYS)[number];

const nonZeroMessageKeySet: ReadonlySet<string> = new Set(NON_ZERO_MESSAGE_KEYS);

const detailedEvidenceMessages: Record<
  SupportedUiLocale,
  Record<NonZeroMessageKey, string>
> = {
  en: {
    "criterion.identity-verification.active":
      "A native LinkedIn profile-verification badge is visible.",
    "criterion.affiliation-verification.workplace-and-education":
      "Both workplace and education verifications are visible.",
    "criterion.affiliation-verification.workplace":
      "A workplace verification is visible.",
    "criterion.affiliation-verification.education":
      "An education verification is visible.",
    "criterion.account-age.under-30-days":
      "Visible account-age information indicates the account is less than 30 days old.",
    "criterion.account-age.30-to-179-days":
      "Visible account-age information indicates the account is 30 to 179 days old.",
    "criterion.account-age.180-days-to-2-years":
      "Visible account-age information indicates the account is between 180 days and two years old.",
    "criterion.account-age.2-to-5-years":
      "Visible account-age information indicates the account is between two and five years old.",
    "criterion.account-age.over-5-years":
      "Visible account-age information indicates the account is more than five years old.",
    "criterion.work-history-detail.several_substantive_dated_roles":
      "Several substantive roles with dates are visible in the work history.",
    "criterion.work-history-detail.adequate":
      "The visible work history contains adequate role detail for this assessment.",
    "criterion.work-history-detail.established_empty_or_vague":
      "The profile presents an established professional claim, but its visible work history is empty or unusually vague.",
    "criterion.career-chronology.rich_coherent":
      "The visible career chronology is detailed and internally coherent.",
    "criterion.career-chronology.consistent":
      "The visible work dates are internally consistent.",
    "criterion.career-chronology.material_contradiction":
      "The visible work dates contain a material internal contradiction.",
    "criterion.cross-section-consistency.strong_alignment":
      "The visible headline, About, Experience, and Skills information strongly align.",
    "criterion.cross-section-consistency.partial_alignment":
      "The visible profile sections show partial alignment.",
    "criterion.cross-section-consistency.material_conflict":
      "The visible profile sections contain a material conflict in professional claims.",
    "criterion.company-affiliation.linked_employer_specific_role":
      "A specific role is visibly linked to the claimed employer's LinkedIn page.",
    "criterion.company-affiliation.material_identity_conflict":
      "The visible employer identity materially conflicts with the profile's current professional claim.",
    "criterion.core-completeness.several_substantive_sections":
      "Several core profile sections contain substantive information.",
    "criterion.core-completeness.adequate":
      "The visible core profile sections contain an adequate amount of information.",
    "criterion.core-completeness.three_or_more_confirmed_empty":
      "At least three core profile sections are visibly present but empty.",
    "criterion.activity-distribution.distributed_over_years":
      "Visible activity is distributed across multiple years.",
    "criterion.activity-distribution.at_least_six_months":
      "Visible activity spans at least six months.",
    "criterion.activity-distribution.sudden_near_duplicate_burst_with_thin_signal":
      "A sudden burst of near-duplicate visible activity appears alongside another thin-profile signal.",
    "criterion.reciprocal-engagement.varied_specific_over_time":
      "Visible interactions are varied, specific, and distributed over time.",
    "criterion.reciprocal-engagement.some_genuine_exchange":
      "Some specific reciprocal exchange is visible.",
    "criterion.reciprocal-engagement.repeated_generic_pattern":
      "Visible interactions repeatedly follow the same generic pattern.",
    "criterion.network-maturity.plausible":
      "The visible network size is plausible relative to the profile's visible maturity.",
    "criterion.network-maturity.under_30_established_senior_or_recruiter_with_thin_signal":
      "Fewer than 30 connections are visible despite an established senior or recruiter claim and another thin-profile signal.",
    "criterion.recommendations.several_specific_across_people_and_time":
      "Several specific recommendations from different people or times are visible.",
    "criterion.recommendations.some":
      "Some specific recommendation evidence is visible.",
    "criterion.recommendations.repeated_boilerplate":
      "Visible recommendations repeatedly use substantially boilerplate wording.",
    "criterion.content-specificity.concrete_technologies_projects_or_outcomes":
      "Visible content names concrete technologies, projects, or outcomes.",
    "criterion.content-specificity.wholly_generic_repeated":
      "The assessed visible content is wholly generic and repetitive.",
    "criterion.profile-image.default-new-and-thin":
      "A default or non-person image appears on a profile that is both recently created and broadly thin."
  },
  pt: {
    "criterion.identity-verification.active":
      "Um selo nativo de verificação de perfil do LinkedIn está visível.",
    "criterion.affiliation-verification.workplace-and-education":
      "As verificações de trabalho e de formação estão visíveis.",
    "criterion.affiliation-verification.workplace":
      "Uma verificação de trabalho está visível.",
    "criterion.affiliation-verification.education":
      "Uma verificação de formação está visível.",
    "criterion.account-age.under-30-days":
      "As informações visíveis de antiguidade indicam que a conta tem menos de 30 dias.",
    "criterion.account-age.30-to-179-days":
      "As informações visíveis de antiguidade indicam que a conta tem entre 30 e 179 dias.",
    "criterion.account-age.180-days-to-2-years":
      "As informações visíveis de antiguidade indicam que a conta tem entre 180 dias e dois anos.",
    "criterion.account-age.2-to-5-years":
      "As informações visíveis de antiguidade indicam que a conta tem entre dois e cinco anos.",
    "criterion.account-age.over-5-years":
      "As informações visíveis de antiguidade indicam que a conta tem mais de cinco anos.",
    "criterion.work-history-detail.several_substantive_dated_roles":
      "Vários cargos substanciais com datas estão visíveis no histórico profissional.",
    "criterion.work-history-detail.adequate":
      "O histórico profissional visível contém detalhes adequados sobre os cargos para esta avaliação.",
    "criterion.work-history-detail.established_empty_or_vague":
      "O perfil apresenta uma trajetória profissional estabelecida, mas o histórico visível está vazio ou é incomumente vago.",
    "criterion.career-chronology.rich_coherent":
      "A cronologia profissional visível é detalhada e internamente coerente.",
    "criterion.career-chronology.consistent":
      "As datas profissionais visíveis são internamente consistentes.",
    "criterion.career-chronology.material_contradiction":
      "As datas profissionais visíveis contêm uma contradição interna relevante.",
    "criterion.cross-section-consistency.strong_alignment":
      "As informações visíveis do título, Sobre, Experiência e Competências estão fortemente alinhadas.",
    "criterion.cross-section-consistency.partial_alignment":
      "As seções visíveis do perfil apresentam alinhamento parcial.",
    "criterion.cross-section-consistency.material_conflict":
      "As seções visíveis do perfil contêm um conflito relevante entre alegações profissionais.",
    "criterion.company-affiliation.linked_employer_specific_role":
      "Um cargo específico está visivelmente vinculado à página da empresa declarada no LinkedIn.",
    "criterion.company-affiliation.material_identity_conflict":
      "A identidade visível da empresa diverge de forma relevante da alegação profissional atual do perfil.",
    "criterion.core-completeness.several_substantive_sections":
      "Várias seções principais do perfil contêm informações substanciais.",
    "criterion.core-completeness.adequate":
      "As seções principais visíveis do perfil contêm uma quantidade adequada de informações.",
    "criterion.core-completeness.three_or_more_confirmed_empty":
      "Pelo menos três seções principais do perfil estão visivelmente presentes, mas vazias.",
    "criterion.activity-distribution.distributed_over_years":
      "A atividade visível está distribuída por vários anos.",
    "criterion.activity-distribution.at_least_six_months":
      "A atividade visível abrange pelo menos seis meses.",
    "criterion.activity-distribution.sudden_near_duplicate_burst_with_thin_signal":
      "Uma sequência repentina de atividades visíveis quase duplicadas aparece junto com outro sinal de perfil pouco detalhado.",
    "criterion.reciprocal-engagement.varied_specific_over_time":
      "As interações visíveis são variadas, específicas e distribuídas ao longo do tempo.",
    "criterion.reciprocal-engagement.some_genuine_exchange":
      "Há alguma troca recíproca e específica visível.",
    "criterion.reciprocal-engagement.repeated_generic_pattern":
      "As interações visíveis repetem o mesmo padrão genérico.",
    "criterion.network-maturity.plausible":
      "O tamanho visível da rede é plausível em relação à maturidade visível do perfil.",
    "criterion.network-maturity.under_30_established_senior_or_recruiter_with_thin_signal":
      "Menos de 30 conexões estão visíveis apesar de uma alegação de recrutador ou profissional sênior estabelecido e de outro sinal de perfil pouco detalhado.",
    "criterion.recommendations.several_specific_across_people_and_time":
      "Várias recomendações específicas de pessoas ou momentos diferentes estão visíveis.",
    "criterion.recommendations.some":
      "Algumas evidências de recomendações específicas estão visíveis.",
    "criterion.recommendations.repeated_boilerplate":
      "As recomendações visíveis repetem textos substancialmente padronizados.",
    "criterion.content-specificity.concrete_technologies_projects_or_outcomes":
      "O conteúdo visível menciona tecnologias, projetos ou resultados concretos.",
    "criterion.content-specificity.wholly_generic_repeated":
      "O conteúdo visível avaliado é inteiramente genérico e repetitivo.",
    "criterion.profile-image.default-new-and-thin":
      "Uma imagem padrão ou que não representa uma pessoa aparece em um perfil que é recente e pouco detalhado."
  },
  es: {
    "criterion.identity-verification.active":
      "Se muestra una insignia nativa de verificación de perfil de LinkedIn.",
    "criterion.affiliation-verification.workplace-and-education":
      "Se muestran verificaciones tanto laborales como educativas.",
    "criterion.affiliation-verification.workplace":
      "Se muestra una verificación laboral.",
    "criterion.affiliation-verification.education":
      "Se muestra una verificación educativa.",
    "criterion.account-age.under-30-days":
      "La información visible de antigüedad indica que la cuenta tiene menos de 30 días.",
    "criterion.account-age.30-to-179-days":
      "La información visible de antigüedad indica que la cuenta tiene entre 30 y 179 días.",
    "criterion.account-age.180-days-to-2-years":
      "La información visible de antigüedad indica que la cuenta tiene entre 180 días y dos años.",
    "criterion.account-age.2-to-5-years":
      "La información visible de antigüedad indica que la cuenta tiene entre dos y cinco años.",
    "criterion.account-age.over-5-years":
      "La información visible de antigüedad indica que la cuenta tiene más de cinco años.",
    "criterion.work-history-detail.several_substantive_dated_roles":
      "Se muestran varios puestos sustanciales con fechas en el historial laboral.",
    "criterion.work-history-detail.adequate":
      "El historial laboral visible contiene detalles adecuados sobre los puestos para esta evaluación.",
    "criterion.work-history-detail.established_empty_or_vague":
      "El perfil presenta una trayectoria profesional consolidada, pero el historial laboral visible está vacío o es inusualmente impreciso.",
    "criterion.career-chronology.rich_coherent":
      "La cronología profesional visible es detallada e internamente coherente.",
    "criterion.career-chronology.consistent":
      "Las fechas laborales visibles son internamente consistentes.",
    "criterion.career-chronology.material_contradiction":
      "Las fechas laborales visibles contienen una contradicción interna relevante.",
    "criterion.cross-section-consistency.strong_alignment":
      "La información visible del titular, Acerca de, Experiencia y Aptitudes coincide claramente.",
    "criterion.cross-section-consistency.partial_alignment":
      "Las secciones visibles del perfil muestran una coincidencia parcial.",
    "criterion.cross-section-consistency.material_conflict":
      "Las secciones visibles del perfil contienen un conflicto relevante entre afirmaciones profesionales.",
    "criterion.company-affiliation.linked_employer_specific_role":
      "Un puesto específico está visiblemente vinculado a la página de LinkedIn de la empresa declarada.",
    "criterion.company-affiliation.material_identity_conflict":
      "La identidad visible de la empresa entra en conflicto relevante con la afirmación profesional actual del perfil.",
    "criterion.core-completeness.several_substantive_sections":
      "Varias secciones principales del perfil contienen información sustancial.",
    "criterion.core-completeness.adequate":
      "Las secciones principales visibles del perfil contienen una cantidad adecuada de información.",
    "criterion.core-completeness.three_or_more_confirmed_empty":
      "Al menos tres secciones principales del perfil están visiblemente presentes, pero vacías.",
    "criterion.activity-distribution.distributed_over_years":
      "La actividad visible está distribuida a lo largo de varios años.",
    "criterion.activity-distribution.at_least_six_months":
      "La actividad visible abarca al menos seis meses.",
    "criterion.activity-distribution.sudden_near_duplicate_burst_with_thin_signal":
      "Una ráfaga repentina de actividad visible casi duplicada aparece junto con otra señal de perfil poco detallado.",
    "criterion.reciprocal-engagement.varied_specific_over_time":
      "Las interacciones visibles son variadas, específicas y están distribuidas a lo largo del tiempo.",
    "criterion.reciprocal-engagement.some_genuine_exchange":
      "Se muestra algún intercambio recíproco y específico.",
    "criterion.reciprocal-engagement.repeated_generic_pattern":
      "Las interacciones visibles repiten el mismo patrón genérico.",
    "criterion.network-maturity.plausible":
      "El tamaño visible de la red es plausible en relación con la madurez visible del perfil.",
    "criterion.network-maturity.under_30_established_senior_or_recruiter_with_thin_signal":
      "Se muestran menos de 30 contactos pese a una afirmación consolidada de reclutador o profesional sénior y a otra señal de perfil poco detallado.",
    "criterion.recommendations.several_specific_across_people_and_time":
      "Se muestran varias recomendaciones específicas de distintas personas o momentos.",
    "criterion.recommendations.some":
      "Se muestra alguna evidencia de recomendaciones específicas.",
    "criterion.recommendations.repeated_boilerplate":
      "Las recomendaciones visibles repiten una redacción sustancialmente estandarizada.",
    "criterion.content-specificity.concrete_technologies_projects_or_outcomes":
      "El contenido visible menciona tecnologías, proyectos o resultados concretos.",
    "criterion.content-specificity.wholly_generic_repeated":
      "El contenido visible evaluado es totalmente genérico y repetitivo.",
    "criterion.profile-image.default-new-and-thin":
      "Una imagen predeterminada o que no representa a una persona aparece en un perfil que es reciente y poco detallado."
  }
};

function isNonZeroMessageKey(value: MessageKey): value is NonZeroMessageKey {
  return nonZeroMessageKeySet.has(value);
}

const criterionLabels: Record<
  SupportedUiLocale,
  Record<CriterionId, string>
> = {
  en: {
    "identity-verification": "LinkedIn profile verification badge",
    "affiliation-verification": "Workplace or education verification",
    "account-age": "Account age",
    "work-history-detail": "Work-history detail and specificity",
    "career-chronology": "Career chronology",
    "cross-section-consistency": "Cross-section consistency",
    "company-affiliation": "Claimed-company affiliation",
    "core-completeness": "Core profile completeness",
    "activity-distribution": "Activity over time",
    "reciprocal-engagement": "Reciprocal engagement",
    "network-maturity": "Network relative to profile maturity",
    recommendations: "Recommendations and mutual social proof",
    "content-specificity": "Visible content specificity",
    "profile-image": "Profile image signal",
    "profile-maintenance": "Profile maintenance and update history"
  },
  pt: {
    "identity-verification": "Selo de verificação de perfil do LinkedIn",
    "affiliation-verification": "Verificação de trabalho ou formação",
    "account-age": "Idade da conta",
    "work-history-detail": "Detalhes e especificidade do histórico profissional",
    "career-chronology": "Cronologia da carreira",
    "cross-section-consistency": "Consistência entre as seções",
    "company-affiliation": "Vínculo declarado com empresa",
    "core-completeness": "Completude principal do perfil",
    "activity-distribution": "Atividade ao longo do tempo",
    "reciprocal-engagement": "Interações recíprocas",
    "network-maturity": "Rede em relação à maturidade do perfil",
    recommendations: "Recomendações e evidência social mútua",
    "content-specificity": "Especificidade do conteúdo visível",
    "profile-image": "Sinal da imagem do perfil",
    "profile-maintenance": "Manutenção e histórico de atualizações do perfil"
  },
  es: {
    "identity-verification": "Insignia de verificación de perfil de LinkedIn",
    "affiliation-verification": "Verificación laboral o educativa",
    "account-age": "Antigüedad de la cuenta",
    "work-history-detail": "Detalle y especificidad del historial laboral",
    "career-chronology": "Cronología profesional",
    "cross-section-consistency": "Consistencia entre secciones",
    "company-affiliation": "Afiliación declarada con la empresa",
    "core-completeness": "Integridad principal del perfil",
    "activity-distribution": "Actividad a lo largo del tiempo",
    "reciprocal-engagement": "Interacción recíproca",
    "network-maturity": "Red en relación con la madurez del perfil",
    recommendations: "Recomendaciones y prueba social mutua",
    "content-specificity": "Especificidad del contenido visible",
    "profile-image": "Señal de imagen del perfil",
    "profile-maintenance": "Mantenimiento e historial de actualizaciones del perfil"
  }
};

function normalizeLocale(value: string): SupportedUiLocale {
  const language = value.toLowerCase().split(/[-_]/)[0];
  return language === "pt" || language === "es" ? language : "en";
}

export function resolveUiLocale(
  preference: UiLocalePreference
): SupportedUiLocale {
  return preference === "auto" ? normalizeLocale(uiLanguage()) : preference;
}

export function getCopy(locale: SupportedUiLocale): UiCopy {
  return copy[locale];
}

export function criterionLabel(
  criterion: CriterionId,
  locale: SupportedUiLocale
): string {
  return criterionLabels[locale][criterion];
}

function i18nKey(messageKey: MessageKey): string {
  return messageKey.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function evidenceMessage(
  messageKey: MessageKey,
  criterion: CriterionId,
  scoreImpact: number,
  locale: SupportedUiLocale
): string {
  const localized = browserMessage(i18nKey(messageKey));
  if (localized) {
    return localized;
  }

  const structuredVerification = structuredVerificationMessage(messageKey, locale);
  if (structuredVerification) {
    return structuredVerification;
  }

  if (messageKey === "criterion.identity-verification.badge-visible-neutral") {
    return locale === "pt"
      ? "Um selo genérico de verificação do LinkedIn está visível; ele só informa que podem existir detalhes e não conta como verificação de identidade."
      : locale === "es"
        ? "Se muestra una insignia genérica de verificación de LinkedIn; solo indica que puede haber detalles y no cuenta como verificación de identidad."
        : "A generic LinkedIn verification badge is visible; it only indicates that details may exist and does not count as identity verification.";
  }

  if (messageKey === "criterion.profile-maintenance.contact-and-photo-within-one-year") {
    return locale === "pt"
      ? "As informações de contato e a foto do perfil foram atualizadas no último ano."
      : locale === "es"
        ? "La información de contacto y la foto del perfil se actualizaron durante el último año."
        : "Both contact information and the profile photo were updated within the past year.";
  }
  if (messageKey === "criterion.profile-maintenance.one-field-within-one-year") {
    return locale === "pt"
      ? "Um dos campos visíveis de contato ou foto foi atualizado no último ano."
      : locale === "es"
        ? "Uno de los campos visibles de contacto o foto se actualizó durante el último año."
        : "One visible contact or profile-photo field was updated within the past year.";
  }

  if (isNonZeroMessageKey(messageKey)) {
    return detailedEvidenceMessages[locale][messageKey];
  }

  const label = criterionLabel(criterion, locale);
  if (scoreImpact > 0) {
    return locale === "pt"
      ? `${label}: as evidências visíveis sustentam o perfil.`
      : locale === "es"
        ? `${label}: la evidencia visible respalda el perfil.`
        : `${label}: visible evidence supports the profile.`;
  }
  if (scoreImpact < 0) {
    return locale === "pt"
      ? `${label}: as evidências visíveis indicam cautela.`
      : locale === "es"
        ? `${label}: la evidencia visible indica precaución.`
        : `${label}: visible evidence indicates caution.`;
  }
  return label;
}

function joinedList(values: readonly string[], locale: SupportedUiLocale): string {
  if (values.length <= 1) return values[0] ?? "";
  const conjunction = locale === "pt" ? " e " : locale === "es" ? " y " : " and ";
  if (values.length === 2) return `${values[0]}${conjunction}${values[1]}`;
  const serialComma = locale === "en" ? "," : "";
  return `${values.slice(0, -1).join(", ")}${serialComma}${conjunction}${values.at(-1)}`;
}

function structuredVerificationMessage(
  messageKey: MessageKey,
  locale: SupportedUiLocale,
): string | undefined {
  const prefix = "criterion.affiliation-verification.";
  if (!messageKey.startsWith(prefix)) return undefined;
  const parts = messageKey.slice(prefix.length).split("+");
  if (parts.includes("unavailable") || parts.includes("absent") || parts.includes("no-explicit-method")) {
    return undefined;
  }

  const labels: string[] = [];
  if (parts.includes("government-id")) {
    labels.push(locale === "pt" ? "documento oficial" : locale === "es" ? "documento oficial" : "government ID");
  }
  if (parts.includes("current-workplace")) {
    labels.push(locale === "pt" ? "e-mail da empresa atual" : locale === "es" ? "correo de la empresa actual" : "current-employer work email");
  } else if (parts.includes("workplace")) {
    labels.push(locale === "pt"
      ? "e-mail profissional sem correspondência confirmada com a empresa atual"
      : locale === "es"
        ? "correo laboral sin coincidencia confirmada con la empresa actual"
        : "work email without a confirmed current-employer match");
  }
  if (parts.includes("education")) {
    labels.push(locale === "pt" ? "formação" : locale === "es" ? "educación" : "education");
  }
  if (labels.length === 0) return undefined;

  const methods = joinedList(labels, locale);
  const base = locale === "pt"
    ? `Os detalhes estruturados mostram verificação por ${methods}.`
    : locale === "es"
      ? `Los detalles estructurados muestran verificación mediante ${methods}.`
      : `Structured details show verification through ${methods}.`;
  if (parts.includes("maintained-12-months")) {
    return `${base} ${locale === "pt"
      ? "O método visível mais antigo existe há pelo menos 12 meses."
      : locale === "es"
        ? "El método visible más antiguo existe desde hace al menos 12 meses."
        : "The oldest visible method has been maintained for at least 12 months."}`;
  }
  if (parts.includes("maintained-6-months")) {
    return `${base} ${locale === "pt"
      ? "O método visível mais antigo existe há pelo menos seis meses."
      : locale === "es"
        ? "El método visible más antiguo existe desde hace al menos seis meses."
        : "The oldest visible method has been maintained for at least six months."}`;
  }
  return base;
}

export function unavailableMessage(
  messageKey: MessageKey,
  criterion: CriterionId,
  locale: SupportedUiLocale
): string {
  const localized = browserMessage(i18nKey(messageKey));
  return localized || copy[locale].criterionUnavailable(criterionLabel(criterion, locale));
}
