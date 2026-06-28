// Browser-only locale runtime. Every DOM access is wrapped in a function (never
// executed at import time) so this module can be pulled into server-rendered
// React islands without crashing the static build.

import {
  DEFAULT_LOCALE,
  LOCALE_CHANGE_EVENT,
  LOCALE_HTML_LANG,
  LOCALE_STORAGE_KEY,
  detectLocale,
  isLocale,
  normalizeLocale,
  type Locale,
} from "./locale.js";
import { getMessages } from "./messages.js";

function readStoredLocale(): Locale | null {
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the locale
    // still applies for the current page, it just will not be remembered.
  }
}

/** Locale chosen from a saved preference, then the browser's languages. */
export function resolveLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) {
    return stored;
  }

  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  return detectLocale(languages);
}

/** Locale currently reflected on the document, set by the boot script. */
export function getCurrentLocale(): Locale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const value = document.documentElement.dataset.locale;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function resolvePath(locale: Locale, path: string): string | null {
  let current: unknown = getMessages(locale);
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : null;
}

function applyAttributeBindings(
  element: HTMLElement,
  locale: Locale,
  spec: string,
): void {
  for (const pair of spec.split(";")) {
    const [attr, path] = pair.split(":").map((part) => part.trim());
    if (!attr || !path) {
      continue;
    }
    const value = resolvePath(locale, path);
    if (value !== null) {
      element.setAttribute(attr, value);
    }
  }
}

/** Translate every `[data-i18n]` / `[data-i18n-attr]` node within `root`. */
export function applyTranslations(root: ParentNode, locale: Locale): void {
  const textNodes = root.querySelectorAll<HTMLElement>("[data-i18n]");
  for (const element of textNodes) {
    const value = resolvePath(locale, element.dataset.i18n ?? "");
    if (value !== null) {
      element.textContent = value;
    }
  }

  const attrNodes = root.querySelectorAll<HTMLElement>("[data-i18n-attr]");
  for (const element of attrNodes) {
    applyAttributeBindings(element, locale, element.dataset.i18nAttr ?? "");
  }
}

function syncToggleButtons(locale: Locale): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    "[data-locale-option]",
  );
  for (const button of buttons) {
    const active = button.dataset.localeOption === locale;
    button.setAttribute("aria-pressed", String(active));
    button.dataset.active = String(active);
  }
}

/**
 * Apply `locale` to the whole document: update `lang`/`data-locale`, translate
 * static nodes, refresh the toggle, optionally persist the choice, and notify
 * listeners (React islands, the landing hero) via a window event.
 */
export function setLocale(
  locale: Locale,
  options: { readonly persist?: boolean } = {},
): void {
  const root = document.documentElement;
  root.dataset.locale = locale;
  root.lang = LOCALE_HTML_LANG[locale];

  if (options.persist) {
    persistLocale(locale);
  }

  applyTranslations(document, locale);
  syncToggleButtons(locale);

  window.dispatchEvent(
    new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: locale }),
  );
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<Locale>).detail;
    listener(isLocale(detail) ? detail : getCurrentLocale());
  };
  window.addEventListener(LOCALE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handler);
}

let initialized = false;

/**
 * Wire the language toggle and apply the active locale. Safe to call from more
 * than one entry script; only the first call takes effect.
 */
export function initI18n(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  // The boot script already set data-locale before paint; trust it, but fall
  // back to a fresh resolution if it was missing for any reason.
  const current = document.documentElement.dataset.locale;
  const locale = isLocale(current) ? current : resolveLocale();

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const option = target.closest<HTMLElement>("[data-locale-option]");
    if (!option) {
      return;
    }
    const next = option.dataset.localeOption;
    if (isLocale(next)) {
      event.preventDefault();
      setLocale(next, { persist: true });
    }
  });

  setLocale(locale);
  document.documentElement.dataset.i18nReady = "true";
}
