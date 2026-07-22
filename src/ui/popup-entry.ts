import {
  GET_CURRENT_SCORE_MESSAGE,
  isCurrentScoreResponse,
  type CurrentScoreResponse
} from "../platform/messages";
import { sendMessageToActiveTab } from "../platform/browser-api";
import {
  getPreferences,
  savePreferences,
  type Preferences,
  type UiLocalePreference
} from "../platform/storage";
import { resolveUiLocale } from "./copy";
import { renderPopup, type PopupViewModel } from "./popup";

function requirePopupRoot(): HTMLElement {
  const candidate = document.querySelector<HTMLElement>("#app");
  if (!candidate) {
    throw new Error("Popup root is missing");
  }
  return candidate;
}

const root = requirePopupRoot();

let preferences: Preferences = {
  enabled: true,
  uiLocale: "auto",
  acceptedDisclosureVersion: null
};
let state: CurrentScoreResponse | null = null;
let connectionError = false;

function model(): PopupViewModel {
  return {
    preferences,
    locale: resolveUiLocale(preferences.uiLocale),
    state,
    connectionError
  };
}

function render(): void {
  const currentModel = model();
  document.documentElement.lang = currentModel.locale;
  renderPopup(root, currentModel, {
    enable: () => void enable(),
    disable: () => void disable(),
    setLocale: (locale) => void setLocale(locale)
  });
}

async function requestState(
  type: typeof GET_CURRENT_SCORE_MESSAGE,
  retries = 0
): Promise<void> {
  try {
    const response = await sendMessageToActiveTab<unknown>({ type });
    if (!isCurrentScoreResponse(response)) {
      throw new Error("Invalid score response");
    }
    state = response;
    connectionError = false;
    render();
    if (response.status === "processing" && retries > 0) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 120));
      await requestState(GET_CURRENT_SCORE_MESSAGE, retries - 1);
    }
  } catch {
    state = null;
    connectionError = true;
    render();
  }
}

async function enable(): Promise<void> {
  preferences = await savePreferences({ enabled: true });
  state = { status: "processing" };
  connectionError = false;
  render();
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 60));
  await requestState(GET_CURRENT_SCORE_MESSAGE, 5);
}

async function disable(): Promise<void> {
  preferences = await savePreferences({ enabled: false });
  state = { status: "disabled" };
  connectionError = false;
  render();
}

async function setLocale(locale: UiLocalePreference): Promise<void> {
  preferences = await savePreferences({ uiLocale: locale });
  render();
}

async function start(): Promise<void> {
  try {
    preferences = await getPreferences();
  } catch {
    preferences = {
      enabled: true,
      uiLocale: "auto",
      acceptedDisclosureVersion: null
    };
  }
  render();
  if (preferences.enabled) {
    await requestState(GET_CURRENT_SCORE_MESSAGE, 4);
  }
}

void start();
