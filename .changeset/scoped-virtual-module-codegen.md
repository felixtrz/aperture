---
"@aperture-engine/vite-plugin": patch
---

Skip config evaluation and generated-type writes for unrelated Vite module
loads, avoiding excessive worker creation during documentation and app builds.
Refresh generated types explicitly when a hot-updated module is the config or
one of its imported dependencies, including when Vite reuses cached virtual
module transforms.
