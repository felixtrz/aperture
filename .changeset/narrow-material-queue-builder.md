---
"@aperture-engine/render": patch
---

Move the allocating material queue snapshot builder behind
`@aperture-engine/render/test-support` while keeping the reusable writer,
scratch, and summary APIs public.
