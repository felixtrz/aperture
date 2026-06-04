# Handoff — M7-T6 blocker (runtime material mutation pixel proof)

**Date:** 2026-06-04 · **Commit:** `30541c06` · **Gate:** green (409 files / 2279 tests)

## Status

M7 is **5/9 done** (T1–T5 complete, committed + gate-green). **M7-T6 is IN PROGRESS, not
done** — its authoring surface is implemented and proven headlessly (Done-when **#1, #2,
#4**), but Done-when **#3** (the GPU pixel transition) is **blocked** by a pre-existing
engine gap. Per the honesty rule, M7-T6 is not marked done and the run stops here.

## What landed (M7-T6 authoring surface — correct + gate-green, commit `30541c06`)

- `packages/render/src/materials/factories.ts` — `patchStandardMaterial` /
  `patchUnlitMaterial` / `patchMatcapMaterial`: each returns a NEW frozen asset with the
  provided scalar/color uniform fields merged over `prev` (prev never mutated).
- `packages/app/src/systems/materials.ts` (new) + `context.ts` / `systems.ts` —
  `this.materials.set(handle, patch)` / `.get(handle)` on `ApertureSystemContext`: reads
  the asset, patches by kind, `assetsRegistry.markReady(handle, next)` (version+1, no new
  handle, no GPU calls).
- Proof: `test/materials/runtime-material-mutation.test.ts` (6) — #1 frozen patch, #2
  version bump + version-gated mirror re-serializes the patched asset, #4
  `prepareSnapshotMaterials` action `'updated'` after the mutation, + unlit/matcap +
  unregistered-handle diagnostic.
- `examples/material-mutation.*` (route) + `test/e2e/material-mutation.spec.ts`
  (`test.fixme`, documents #3 below).

## The blocker (Done-when #3 — pixel green→red)

Pixel-readback E2E run on the real GPU (headed Chrome/Metal). The **authoring path works
end-to-end**, verified with instrumentation (since reverted):

1. `materials.set(handle, {baseColorFactor: red})` bumps the registry version to 2.
2. The version-gated source-asset mirror delivers the red asset to the main thread —
   `mirroredMaterialColor=[1,0,0,1]` at version 2 in the main's registry.
3. The red asset reaches the unlit GPU adapter — `options.material` is red, `materialKey`
   correctly becomes `material:mutable-material@2`, and the frame-resource slot cache
   correctly re-creates at `@2`.

**But the rendered pixel stays green.** Root cause: built-in (unlit/standard/matcap)
material GPU resources are cached by a **version-INDEPENDENT** `materialResourceKey`. The
version-keyed prepared-material cache (`prepared-unlit-material-cache.ts`,
`preparedScalarUnlitMaterialCacheKey` includes `sourceVersion`) DOES allocate a fresh red
buffer at `@2`, but its `resourceKey` collides with the `@1` buffer's, so the downstream
frame **bind-group cache** (`createUnlitFrameGpuResources`, keyed by `material.resourceKey`)
reuses the `@1` green bind group → green render. Custom-WGSL materials update correctly
(their uniform values live in the bind group), which is why `examples/custom-material`
mutates visibly.

### Fix path (for whoever resumes)

Thread the material **version** into the built-in-material GPU resource keys
(`materialResourceKey` → buffer + bind-group cache keys) consistently across
unlit/standard/matcap, so a same-handle content change allocates distinct GPU resources.
**Caution:** a naive version-stamp of just the buffer label
(`prepared-unlit-material-cache.ts` `createUnlitMaterialBufferDescriptor` label) was tried
and REVERTED — it broke the resource linkage and the draw was skipped (transparent pixel,
`a:0`). The keys are interdependent; the version must flow through every linked key
(buffer resourceKey, bind-group plan entry resourceKey, frame bind-group cache key,
reported `bindGroupResourceKey`). Likely touches:

- `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` (frame bind-group cache key)
- `packages/webgpu/src/materials/unlit/unlit-app-frame-resources.ts`
- the standard + matcap equivalents
- `packages/webgpu/src/resources/core/resource-keys.ts` (`materialUniformBufferResourceKey`)
- update the resource-key assertions in the affected vitest (blast radius ~1 file for unlit).

Once fixed, un-`fixme` `test/e2e/material-mutation.spec.ts` and tick M7-T6 Done-when #3.

## Options for the user

1. Resume the deep webgpu fix above (substantial render-path work + test updates).
2. Descope M7-T6 #3 to the headless `'updated'`-action proof (already passing) + accept
   the E2E as a documented follow-up.
3. Continue M7-T7 → T8 → T9 (none depend on T6) and leave T6 #3 open as a tracked follow-up.
