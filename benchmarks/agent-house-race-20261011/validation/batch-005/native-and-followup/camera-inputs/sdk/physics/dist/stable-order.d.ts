/**
 * Locale-independent string ordering for deterministic physics output
 * (results, events, debug lines). `localeCompare()` without an explicit
 * locale derives its collation from the process environment (LC_ALL/LANG
 * under full-ICU Node), so id orderings — and every test asserting them —
 * could differ across machines. Codepoint comparison is identical everywhere.
 */
export declare function compareStableStrings(left: string, right: string): number;
//# sourceMappingURL=stable-order.d.ts.map