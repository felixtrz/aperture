---
"@aperture-engine/render": patch
"@aperture-engine/cli": patch
---

Add CPU inspection of selected static draw vertex bounds through an explicit
retained bundle view. Reports preserve source vertex witnesses, draw identity,
numerical and unsupported-data diagnostics, and null incomplete aggregate bounds.
The offline `inspect projected-bounds` command reuses bundle decoding and shares
active-position/range validation with coplanar inspection without starting an app
or renderer.
