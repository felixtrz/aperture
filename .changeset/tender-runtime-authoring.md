---
"@aperture-engine/app": minor
"@aperture-engine/runtime": patch
---

Improve authoring ergonomics for headless systems, runtime uniforms, character
movement, and animation controls.

`physics.moveCharacter` now accepts a live `Entity` as well as a serialized
entity ref, `spawn.runtimeUniform` updates existing uniforms by key, update
phase effects flush during app steps, and animation access returns no-op
controls for non-animated entities.
