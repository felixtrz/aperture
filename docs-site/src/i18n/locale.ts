// Framework-agnostic locale primitives shared by the Astro build, the browser
// runtime, and the React islands. Nothing in this module touches the DOM so it
// is safe to import during static rendering.

export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

/** Built-in fallback. The static HTML is rendered in this locale. */
export const DEFAULT_LOCALE: Locale = "en";

/** localStorage key holding an explicit, user-chosen locale. */
export const LOCALE_STORAGE_KEY = "aperture-docs-locale";

/** Window event dispatched whenever the active locale changes. */
export const LOCALE_CHANGE_EVENT = "aperture:locale-change";

/** Value applied to the document `lang` attribute for each locale. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-Hans",
};

/** Short label shown inside the language toggle. */
export const LOCALE_SHORT_LABEL: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
};

/** Full, self-referential label (each name written in its own language). */
export const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Map an arbitrary BCP-47 tag (or stored value) onto a supported locale.
 * Returns `null` when the tag is neither English nor Chinese so callers can
 * fall back to the default. Every Chinese variant (Simplified, Traditional,
 * regional) resolves to the Simplified catalog because it is the only Chinese
 * translation that ships today.
 */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  const tag = value.trim().toLowerCase();
  if (tag.length === 0) {
    return null;
  }

  if (tag === "en" || tag.startsWith("en-") || tag.startsWith("en_") || tag === "english") {
    return "en";
  }

  if (
    tag === "zh" ||
    tag.startsWith("zh-") ||
    tag.startsWith("zh_") ||
    tag.includes("hans") ||
    tag.includes("hant") ||
    tag.includes("chinese")
  ) {
    return "zh";
  }

  return null;
}

/**
 * Resolve the best locale from an ordered list of candidate tags (typically
 * `navigator.languages`). The first candidate that looks like English or
 * Chinese wins, honouring the visitor's ranked browser preferences. When none
 * of the preferences are English or Chinese we fall back to English.
 */
export function detectLocale(candidates: readonly (string | null | undefined)[]): Locale {
  for (const candidate of candidates) {
    const resolved = normalizeLocale(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return DEFAULT_LOCALE;
}
