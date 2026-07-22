/**
 * The small browser surface used by the extension. Keeping it here makes the
 * runtime work with Chromium's callback API and Firefox's Promise API without
 * shipping a compatibility dependency.
 */

type StorageValues = Record<string, unknown>;

interface StorageChangeLike {
  oldValue?: unknown;
  newValue?: unknown;
}

interface RuntimeMessageSenderLike {
  tab?: { id?: number };
}

type RuntimeMessageHandler = (
  message: unknown,
  sender: RuntimeMessageSenderLike
) => unknown | Promise<unknown>;

interface ExtensionApiLike {
  storage: {
    local: {
      get(keys?: unknown, callback?: (values: StorageValues) => void):
        | Promise<StorageValues>
        | void;
      set(values: StorageValues, callback?: () => void): Promise<void> | void;
    };
    onChanged: {
      addListener(
        listener: (
          changes: Record<string, StorageChangeLike>,
          areaName: string
        ) => void
      ): void;
      removeListener(
        listener: (
          changes: Record<string, StorageChangeLike>,
          areaName: string
        ) => void
      ): void;
    };
  };
  runtime: {
    lastError?: { message?: string };
    getURL(path: string): string;
    getManifest(): { version?: string };
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: RuntimeMessageSenderLike,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ): void;
      removeListener(
        listener: (
          message: unknown,
          sender: RuntimeMessageSenderLike,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ): void;
    };
  };
  i18n?: {
    getMessage(name: string, substitutions?: string | string[]): string;
    getUILanguage?(): string;
  };
  tabs?: {
    query(
      queryInfo: { active: boolean; currentWindow: boolean },
      callback?: (tabs: Array<{ id?: number }>) => void
    ): Promise<Array<{ id?: number }>> | void;
    sendMessage(
      tabId: number,
      message: unknown,
      callback?: (response: unknown) => void
    ): Promise<unknown> | void;
  };
}

declare global {
  // Firefox exposes the standards-oriented Promise namespace.
  // eslint-disable-next-line no-var
  var browser: ExtensionApiLike | undefined;
}

function resolveApi(): { api: ExtensionApiLike; promiseBased: boolean } {
  const browserApi = globalThis.browser;
  if (browserApi) {
    return { api: browserApi, promiseBased: true };
  }

  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ExtensionApiLike;
  }).chrome;
  if (chromeApi) {
    return { api: chromeApi, promiseBased: false };
  }

  throw new Error("WebExtension API is unavailable");
}

function runtimeError(api: ExtensionApiLike): Error | undefined {
  const message = api.runtime.lastError?.message;
  return message ? new Error(message) : undefined;
}

export async function storageGet(
  defaults: StorageValues
): Promise<StorageValues> {
  const { api, promiseBased } = resolveApi();
  if (promiseBased) {
    return (await api.storage.local.get(defaults)) ?? defaults;
  }

  return new Promise((resolve, reject) => {
    api.storage.local.get(defaults, (values) => {
      const error = runtimeError(api);
      if (error) {
        reject(error);
        return;
      }
      resolve(values ?? defaults);
    });
  });
}

export async function storageSet(values: StorageValues): Promise<void> {
  const { api, promiseBased } = resolveApi();
  if (promiseBased) {
    await api.storage.local.set(values);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    api.storage.local.set(values, () => {
      const error = runtimeError(api);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function onStorageChanged(
  listener: (
    changes: Record<string, StorageChangeLike>,
    areaName: string
  ) => void
): () => void {
  const { api } = resolveApi();
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}

export function onRuntimeMessage(handler: RuntimeMessageHandler): () => void {
  const { api } = resolveApi();
  const listener = (
    message: unknown,
    sender: RuntimeMessageSenderLike,
    sendResponse: (response: unknown) => void
  ): boolean => {
    Promise.resolve(handler(message, sender)).then(
      (response) => sendResponse(response),
      () => sendResponse(undefined)
    );
    return true;
  };

  api.runtime.onMessage.addListener(listener);
  return () => api.runtime.onMessage.removeListener(listener);
}

export async function sendMessageToActiveTab<T>(message: unknown): Promise<T> {
  const { api, promiseBased } = resolveApi();
  if (!api.tabs) {
    throw new Error("Tabs API is unavailable");
  }

  let tabs: Array<{ id?: number }>;
  if (promiseBased) {
    tabs = (await api.tabs.query({ active: true, currentWindow: true })) ?? [];
  } else {
    tabs = await new Promise((resolve, reject) => {
      api.tabs?.query({ active: true, currentWindow: true }, (result) => {
        const error = runtimeError(api);
        if (error) {
          reject(error);
          return;
        }
        resolve(result ?? []);
      });
    });
  }

  const tabId = tabs[0]?.id;
  if (typeof tabId !== "number") {
    throw new Error("No active tab is available");
  }

  if (promiseBased) {
    return (await api.tabs.sendMessage(tabId, message)) as T;
  }

  return await new Promise<T>((resolve, reject) => {
    api.tabs?.sendMessage(tabId, message, (response) => {
      const error = runtimeError(api);
      if (error) {
        reject(error);
        return;
      }
      resolve(response as T);
    });
  });
}

export function extensionUrl(path: string): string {
  return resolveApi().api.runtime.getURL(path);
}

export function extensionVersion(): string {
  return resolveApi().api.runtime.getManifest().version ?? "0.0.0";
}

export function uiLanguage(): string {
  return resolveApi().api.i18n?.getUILanguage?.() ?? navigator.language ?? "en";
}

export function browserMessage(
  key: string,
  substitutions?: string | string[]
): string {
  try {
    return resolveApi().api.i18n?.getMessage(key, substitutions) ?? "";
  } catch {
    return "";
  }
}
