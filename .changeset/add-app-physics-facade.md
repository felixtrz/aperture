---
"@aperture-engine/app": patch
---

Add an opt-in app physics facade for `createApertureApp`. The facade can create
and install the Rapier backend, enables the fixed-step physics route by default,
supports custom backend factories, and threads asset-backed collider geometry
providers into the backend without example-local glue.
