import type { CurrentScoreResponse } from "../platform/messages";
import type { Preferences, UiLocalePreference } from "../platform/storage";
import { getCopy, type SupportedUiLocale } from "./copy";

export interface PopupViewModel {
  preferences: Preferences;
  locale: SupportedUiLocale;
  state: CurrentScoreResponse | null;
  connectionError: boolean;
}

export interface PopupActions {
  enable(): void;
  disable(): void;
  setLocale(locale: UiLocalePreference): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function appendLinks(container: HTMLElement, locale: SupportedUiLocale): void {
  const ui = getCopy(locale);
  const localizedSuffix = locale === "en" ? "" : `-${locale}`;
  const links = element("nav", "links");
  links.setAttribute("aria-label", ui.preferences);
  const privacy = element("a", undefined, ui.privacyPolicy);
  privacy.href = `privacy-policy${localizedSuffix}.html`;
  privacy.target = "_blank";
  privacy.rel = "noopener";
  const inventory = element("a", undefined, ui.dataInventory);
  inventory.href = `data-inventory${localizedSuffix}.html`;
  inventory.target = "_blank";
  inventory.rel = "noopener";
  links.append(privacy, inventory);
  container.append(links);
}

function appendLocalePreference(
  container: HTMLElement,
  model: PopupViewModel,
  actions: PopupActions
): void {
  const ui = getCopy(model.locale);
  const wrapper = element("div", "preference");
  const label = element("label", undefined, ui.language);
  label.htmlFor = "ui-locale";
  const select = element("select");
  select.id = "ui-locale";
  const locales: Array<[UiLocalePreference, string]> = [
    ["auto", ui.autoLanguage],
    ["en", "English"],
    ["pt", "Português"],
    ["es", "Español"]
  ];
  for (const [value, text] of locales) {
    const option = element("option", undefined, text);
    option.value = value;
    option.selected = model.preferences.uiLocale === value;
    select.append(option);
  }
  select.addEventListener("change", () => {
    const value = select.value;
    if (value === "auto" || value === "en" || value === "pt" || value === "es") {
      actions.setLocale(value);
    }
  });
  wrapper.append(label, select);
  container.append(wrapper);
}

function pageStatus(model: PopupViewModel): { text: string; tone: "quiet" | "success" | "warning" } {
  const ui = getCopy(model.locale);
  if (!model.preferences.enabled) {
    return { text: ui.popupDisabled, tone: "quiet" };
  }
  if (model.connectionError) {
    return { text: ui.popupIncomplete, tone: "warning" };
  }
  if (!model.state) {
    return { text: ui.popupScanning, tone: "quiet" };
  }
  if (model.state.status === "unsupported") {
    return { text: ui.popupUnsupported, tone: "quiet" };
  }
  switch (model.state.scanStatus?.phase) {
    case "available":
      return { text: ui.popupProfileReady, tone: "success" };
    case "scanning":
      return { text: ui.popupScanning, tone: "quiet" };
    case "complete":
      return { text: ui.popupComplete, tone: "success" };
    case "partial":
    case "cancelled":
    case "failed":
      return { text: ui.popupIncomplete, tone: "warning" };
  }
  if (model.state.status === "error") {
    return { text: ui.popupIncomplete, tone: "warning" };
  }
  if (model.state.status === "processing") {
    return { text: ui.popupScanning, tone: "quiet" };
  }
  if (model.state.status === "ready") {
    return { text: ui.popupProfileReady, tone: "success" };
  }
  return { text: ui.popupDisabled, tone: "quiet" };
}

function appendAutomaticSwitch(
  container: HTMLElement,
  model: PopupViewModel,
  actions: PopupActions
): void {
  const ui = getCopy(model.locale);
  const enabled = model.preferences.enabled;
  const setting = element("section", "automatic-setting");
  const label = element("div", "setting-copy");
  label.append(
    element("strong", undefined, ui.automaticScoring),
    element("span", undefined, enabled ? ui.onLabel : ui.offLabel)
  );

  const toggle = element("button", "toggle");
  toggle.type = "button";
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", String(enabled));
  toggle.setAttribute(
    "aria-label",
    `${ui.automaticScoring}: ${enabled ? ui.onLabel : ui.offLabel}`
  );
  toggle.append(element("span", "toggle-knob"));
  toggle.addEventListener("click", enabled ? actions.disable : actions.enable);
  setting.append(label, toggle);
  container.append(setting);
}

export function renderPopup(
  root: HTMLElement,
  model: PopupViewModel,
  actions: PopupActions
): void {
  const ui = getCopy(model.locale);
  root.replaceChildren();
  root.className = "popup";

  const header = element("header", "popup-header");
  const mark = element("img", "brand-mark");
  mark.src = "icons/icon-48.png";
  mark.alt = "";
  mark.width = 40;
  mark.height = 40;
  const heading = element("div", "popup-heading");
  heading.append(
    element("h1", undefined, ui.shortExtensionName),
    element("p", "on-device", ui.onDeviceLabel)
  );
  header.append(mark, heading);
  root.append(header);

  const controls = element("div", "popup-controls");
  appendAutomaticSwitch(controls, model, actions);
  root.append(controls);

  const context = element("section", "context-card");
  const status = pageStatus(model);
  const statusElement = element("p", `page-status ${status.tone}`, status.text);
  statusElement.setAttribute("aria-live", "polite");
  statusElement.setAttribute("role", "status");
  context.append(statusElement);
  root.append(context);

  const footer = element("footer", "popup-footer");
  footer.append(element("h2", "section-heading", ui.preferences));
  const preferenceCard = element("div", "preference-card");
  appendLocalePreference(preferenceCard, model, actions);
  footer.append(preferenceCard);
  appendLinks(footer, model.locale);
  root.append(footer);
}
