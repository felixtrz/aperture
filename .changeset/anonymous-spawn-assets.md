---
"@aperture-engine/app": patch
---

Give anonymous primitive spawns independent mesh and material asset identities.
Spawning a new unnamed, unkeyed primitive no longer replaces the geometry or
appearance of earlier anonymous entities. Preserve explicit key/name asset IDs
and intentional sharing through asset handles.
