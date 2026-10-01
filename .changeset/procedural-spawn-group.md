---
"@aperture-engine/app": minor
---

Add `spawn.group` for named, keyed and tagged transform-only ECS parents. Compose
procedural parts and imported models through existing `transform.parent`, then
revise or snapshot the assembly using ordinary ECS state. Groups allocate no
render assets, do not introduce a scene graph or component inheritance, and
clean up partial entities when construction fails.
