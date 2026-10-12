---
"@aperture-engine/cli": patch
"@aperture-engine/reference-assets": patch
---

Discover public type-only and namespace re-exported modules in the reference
corpus using the existing TypeScript parser. Preserve shared and cyclic public
entrypoint relationships while excluding export examples inside comments or
strings, private import-only modules, and the existing renderer curation boundary.
Include the public execution-realm and submitted-geometry guides and inspection
types without indexing renderer implementation or internal review evidence.
