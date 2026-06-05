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
assertion is the `pipelineKey`, not a `prepared-material:`/`bind-group:` key. The audit
fixed this assertion (`test/e2e/custom-material.spec.ts`) and added a gated key-format
contract test (`test/materials/key-format-contract.test.ts`) so the format drift cannot
recur silently.

## OPEN follow-up — custom-WGSL runtime mutation/animation staleness (audit #22)

Fixing the stale `pipelineKey` assertion above unmasked a deeper, pre-existing bug in the
SAME class as M7-T6, but on the **custom-WGSL** path. `examples/custom-material.worker.js`
`updateWaterMaterial()` calls `assets.markReady(material, createWaterMaterial(time))` each
frame (bumping the material version with new uniform `values`), yet the rendered center
pixel never changes — the shader animates in `shaderTime` but not on the GPU.

**Root cause:** the custom-WGSL bind-group/buffer key is keyed by the SHADER version, not
the MATERIAL version. In `packages/render/src/assets/custom-wgsl-material-preparation.ts`
(~line 207) the prepared source key is built as `shaderKey + ":v" + entry.version`, where
that `entry.version` is the _shader_ entry's version. A `markReady` that changes only the
material's uniform `values` (same shader source) leaves the shader version — and therefore
the key — stable, so the frame bind-group cache reuses the stale bind group and the new
`time` never reaches the GPU. This is exactly the M7-T6 built-in bug, one path over.

**Fix path (analogous to M7-T6):** thread the MATERIAL registry `entry.version` into the
custom-WGSL prepared resource + bind-group/buffer keys so a same-handle uniform-value
change re-creates the GPU resources. Then un-`fixme` the WaterMaterial test
(`test/e2e/custom-material.spec.ts`) and verify the center pixel animates on the real GPU.
Out of the M7 / SOTA-audit scope (custom-WGSL is a separate feature); the WaterMaterial
test is `test.fixme` with this note so the proof is an explicit known-blocker, not a
silently-red dead spec.
