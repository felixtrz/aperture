---
"@aperture-engine/render": patch
---

Move the combined render-world prepared-resource prepare-and-bind helper and its
report-summary adapter behind the `@aperture-engine/render/test-support`
subpath while keeping the app-facing prepared-resource summary API public.
