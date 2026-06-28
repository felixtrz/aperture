import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale.js";
import { getMessages, type Messages } from "./messages.js";
import { getCurrentLocale, onLocaleChange } from "./runtime.js";

/**
 * Track the active locale inside a React island. The first render always uses
 * the default locale so it matches the server-rendered HTML; the real locale is
 * read after mount and on every subsequent change, avoiding hydration
 * mismatches.
 */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocale(getCurrentLocale());
    return onLocaleChange(setLocale);
  }, []);

  return locale;
}

/** Convenience wrapper returning the message catalog for the active locale. */
export function useMessages(): Messages {
  return getMessages(useLocale());
}
