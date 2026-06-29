# Vendored Simplified Chinese webfont

`noto-sans-sc-{400,500,700}.woff2` are **Noto Sans SC** (思源黑体), licensed
under the SIL Open Font License 1.1 (see `OFL.txt`).

These files are **subsets** containing only the ~440 CJK glyphs used by the
localized docs UI, generated via the Google Fonts `text=` API:

```
https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@{400,500,700}&text=<glyphs>
```

The subset is vendored (rather than linked from Google Fonts) so mainland-China
visitors are never served from an origin that may be blocked or slow.

To regenerate after the Chinese copy changes (new characters), re-run the
extraction over `src/i18n/messages.ts` and re-fetch. The `@font-face` rules and
`unicode-range` scoping live in `src/styles/cjk.css`.
