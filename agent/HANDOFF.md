# Handoff — M7-T6 (runtime material mutation pixel proof) — ✅ RESOLVED

**Resolved:** 2026-06-05 · **Commit:** `98a34acd` · **Gate:** green (413 files / 2293 tests)

M7-T6 is **done** — and with it **M7 is COMPLETE (9/9)**. This file is kept only as a
record of the fix; there is no outstanding blocker.

## The fix (Done-when #3, the pixel green→red proof)

**Root cause.** The app's prepared-material frame path cached the built-in unlit bind
group by a **version-INDEPENDENT** key. So when `materials.set` bumped the registry
version (1→2), the version-keyed prepared-scalar cache allocated a fresh **red** buffer
at `@2`, but the downstream frame bind-group cache reused the `@1` **green** bind group
(which still pointed at the `@1` green buffer) → green render.

**Fix (`packages/render/src/materials/prepared-resource.ts`).** Thread the registry
`entry.version` into the SOURCE keys:

- `preparedMaterialResourceKey(sourceMaterialKey, version)` → `prepared-material:<key>@v<version>`
- `preparedMaterialBindGroupResourceKey({ sourceMaterialKey, pipelineKey, version })` →
  `prepared-material-bind-group:<key>@v<version>|pipeline:<pipelineKey>`

This matches the precedent custom-WGSL already used
(`custom-wgsl-material-preparation.ts`, `${shaderKey}:v${entry.version}`). Because the
built-in buffer label is `descriptor.materialResourceKey`, the **buffer resourceKey**, the
**bind-group plan entry**, the **bind-group resourceKey**, and the **frame bind-group
cache key** all inherit the version — so a same-handle content change re-creates the GPU
resources instead of reusing the prior version's.

**Why the prior naive attempt drew transparent.** Stamping only the buffer label left the
renderer's lookup by the _reported_ (still version-independent) `materialResourceKey`/
`bindGroupResourceKey` mismatched → the draw couldn't resolve its bind group → skipped →
transparent. Versioning at the SOURCE keeps every linked key consistent.

**Scope.** unlit / standard / matcap / debug-normal (the families that go through
`prepared-resource.ts`). Custom-WGSL is a separate path (unaffected). Textured-standard
buffer keys remain version-independent (their buffer label is the raw material label —
out of the scalar/color-mutation scope; texture changes are a variant flip, re-extraction
acceptable per the SOTA bar).

## Proof

- **#3** `test/e2e/material-mutation.spec.ts` (un-`fixme`) — unlit quad center pixel
  green→red on the real GPU (headed Chrome/Metal), no new mesh/material handle.
- **#4** `test/materials/runtime-material-mutation.test.ts` — `prepareSnapshotMaterials`
  entry action transitions `created` → `updated` after the version bump.
- **#1/#2** `test/materials/runtime-material-mutation.test.ts` (`30541c06`) — frozen patch
  - version bump + version-gated mirror.
- No regression: `matcap-app` + `materials-showcase` E2E pass (matcap + standard kinds);
  11 resource-key vitest files updated for the `@v` suffix; `pnpm run check` green.

## Unrelated pre-existing issue spotted (NOT this change)

`test/e2e/custom-material.spec.ts:114` (WaterMaterial) asserts the `pipelineKey` contains
`"example/water|shader:"`, but the current format is
`"example/water|bindings:…|specialization:…"` (the pipelineKey format drifted since commit
`b58c4c96`). This E2E is not in the gate, so it went unnoticed. It is **unrelated** to the
M7-T6 change — custom-WGSL does not use the keys this change touched, and the failing
assertion is the `pipelineKey`, not a `prepared-material:`/`bind-group:` key. Left for a
future custom-WGSL touch-up (out of M7 scope).
