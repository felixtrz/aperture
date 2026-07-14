---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Skinning inputs for custom WGSL materials (parity plan F3) — the analog of a
three.js `SkinnedMesh` driving a custom `ShaderMaterial`/TSL vertex shader. A
custom material opts in with `material.customWgsl({ skinned: true })` (or the
low-level `createCustomWgslMaterialAsset({ skinned })`); the renderer then binds
the mesh's existing joint palette, adds the `JOINTS_0`/`WEIGHTS_0` vertex
attributes, and prepends a versioned WGSL contract header so a custom **vertex**
entry point skins with zero app-side GPU wiring. This flips advanced-audit
scenario #5 (custom shader on skinned characters) from ❌ to ✅.

**The contract header** (`APERTURE_SKINNED_WGSL_HEADER`, version `v1`) exposes
`apertureSkin(position, normal, joints0, weights0) -> ApertureSkinnedVertex`
(the `{ position, normal }` convenience — the normal is renormalized after the
linear-blend transform) plus `apertureSkinMatrix` / `apertureSkinPosition` /
`apertureSkinDirection`. Those helpers are **byte-for-byte** the StandardMaterial
skinning WGSL (`STANDARD_SKINNING_WGSL`), rebound from the standard
`skinJointMatrices` to the contract's `apertureSkinJointMatrices`, so a custom
shader reproduces the exact linear-blend-skinning result (zero-weight vertices
fall back to identity = bind pose). The vertex input struct still declares
`@location(8) joints0: vec4u` + `@location(9) weights0: vec4f` — the renderer
owns the vertex-buffer LAYOUT + the palette binding, not the attribute names.
**Deviation from the plan's `apertureSkin(position, normal)` shorthand:** WGSL
vertex attributes are per-invocation inputs, so the helper takes the four args
`(position, normal, joints0, weights0)`.

**Group map — why a binding, not a new group.** The default `maxBindGroups`
limit is 4 (valid indices 0-3) and the A1 lit contract already owns `@group(3)`,
so a `@group(4)` for skinning would exceed the limit and fail at pipeline
creation on SwiftShader/default devices. Instead the joint palette rides an
extra **binding** inside the existing world-transforms group — `@group(1)
@binding(1)` — which is **exactly** where the StandardMaterial skinned path binds
`skinJointMatrices`, and does not collide with the lit `@group(3)`. The final
custom-WGSL group map: `group(0)` view · `group(1)` world transforms (`@binding
0`) + joint palette (`@binding 1`) · `group(2)` material bindings · `group(3)`
A1 lit contract. The custom pipeline's vertex layout gains the `JOINTS_0` (uint4
`@location(8)`) + `WEIGHTS_0` (float4 `@location(9)`) attributes — the
StandardMaterial skinned layout (stride 56), byte-identical. The palette buffer
is the SAME snapshot bones the standard skinned path consumes
(`draw.boneMatrixOffset`/`boneMatrixCount` into `snapshot.bones`); extraction
leaves `batchKey.skinned` FALSE for custom materials (that flag drives the
STANDARD skinned pipeline), so the custom route treats a draw as skinned when it
carries a bone-matrix range and builds/binds the palette itself.

**Composes with A1 lit.** `{ skinned: true, lighting: "lit" }` is supported —
both contract headers prepend (skinning first, then lighting), both feature
tokens (`skinned:v1`, `lit:v1`) participate in the pipeline key, and the
lit+skinned explicit pipeline layout swaps `group(1)` for the transforms+palette
layout while staying 4 groups (no collision). The `apertureSkin(...).normal` is
the world-ready normal to hand the lit helpers.

**Byte-identity + determinism.** The `skinned:v1` token and the contract header
participate in the pipeline key ONLY when `skinned: true`, so a non-skinned
custom material keeps byte-identical pipeline keys AND the byte-identical
POSITION/NORMAL/UV vertex layout (pinned by a literal-key test). Custom-material
skinning is a renderer-side pipeline concern downstream of the RenderSnapshot, so
`test/determinism` stays GREEN with **no** fixture refresh. A future contract
layout change bumps the version instead of colliding with cached pipelines.

**Validation** (structured `code:` diagnostics, never a device error):
`customMaterialSource.invalidSkinned` (non-boolean),
`customMaterialSource.skinnedReservedBindGroup` (a user `@group(1) @binding(1)` —
the reserved palette binding; your `@group(1) @binding(0)` world transforms stay
yours), `customMaterialSource.skinnedReservedSymbol` (redeclaring an `aperture*`
skinning symbol), and the frame-time `customWgslMaterial.skinnedWithoutSkinData`
(a `skinned` material drawn on a mesh with no valid bone-matrix range).

**Honest deferral — morph deltas.** The v1 skinning contract ships skinning
cleanly; **morph-target deltas for custom materials are NOT exposed.** The
standard morph path binds three additional storage buffers plus a per-instance
descriptor, which is disproportionate to the skinning core, so a morphed custom
material is a separate future opt-in — today, author morph via a
`material.standard()` mesh or bake the deltas into a `material.storage()`
binding. This is recorded in the header comment, `docs/AUTHORING.md`, the F3
status block in `docs/THREEJS_PARITY_PLAN.md`, and scenario #5's audit note.

Authoring surface: `skinned?: boolean` on `CustomWgslMaterialAsset` /
`createCustomWgslMaterialAsset` / the `material.customWgsl(...)` facade
(transitively, via the descriptor type), plus the exported contract constants +
WGSL header + validation helpers (`APERTURE_SKINNED_*`,
`APERTURE_SKINNED_WGSL_HEADER`, `wgslSourceDeclaresSkinnedBindGroup`,
`wgslSourceDeclaresSkinnedReservedSymbol`) from `@aperture-engine/render`.
Example: `examples/skinned-custom-material.*` — a procedural 2-bone skinned strip
whose custom vertex shader calls `apertureSkin(...)` and whose custom fragment
shader applies an animated noise dissolve; the Playwright e2e proves it renders
through the app route (`skinned:v1` in the key, 2 bones), that a bind pose vs a
bent pose at the SAME dissolve produce different pixels (skinning moves
vertices), and that the dissolve animates between presented frames.
