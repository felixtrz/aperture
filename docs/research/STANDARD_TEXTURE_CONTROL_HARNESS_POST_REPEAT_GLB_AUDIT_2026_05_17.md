# StandardMaterial Texture-Control Harness Post-Repeat/GLB Audit

Date: 2026-05-17

## Scope

Re-check the controlled StandardMaterial browser harnesses after:

- local helper extraction in `examples/standard-texture-control.js` and
  `test/e2e/standard-texture-control.spec.ts`;
- repeat-address sampler browser coverage;
- minimal GLB-derived base-color texture browser coverage;
- GLB texture-transform diagnostics;
- GLB sampler mapping status coverage.

This audit does not change runtime behavior.

## References Inspected

- `docs/research/STANDARD_TEXTURE_CONTROL_HARNESS_MAINTAINABILITY_AUDIT_2026_05_17.md`
- `docs/research/CONTROLLED_STANDARD_ADDRESS_MODE_SAMPLER_BROWSER_VERIFICATION_PLAN_2026_05_18.md`
- `examples/standard-texture-control.js`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-texture-control.spec.ts`
- `test/e2e/standard-gltf-texture.spec.ts`

## Current Shape

The controlled authored harness is larger but healthier than before the local
cleanup:

- scenario flags, mesh fixtures, texture IDs/assets/bytes/semantics, sampler
  assets, material bindings, expectations, and status construction are local
  helper boundaries rather than repeated inline branches;
- Playwright has shared status-loading, positive-status, expected-failure,
  blocked-texture, status-required, and canvas-sample helpers;
- repeat sampler coverage remains isolated to a base-color scenario with
  explicit expected and rejected colors.

The GLB fixture is still intentionally small:

- it creates one inline glTF root and source registration report;
- it renders the mapped base-color texture in the positive path;
- it reports texture-transform diagnostics before draw submission;
- it now publishes JSON-safe source/mapped sampler settings without backend
  sampler objects.

## Findings

No architecture drift found:

- both harnesses still author source assets and ECS-facing components;
- rendering remains derived from extraction snapshots;
- WebGPU resources and frame caches remain inside `@aperture-engine/webgpu`;
- browser status exposes handles, source enum values, mapped source asset
  fields, counters, diagnostics, readback pixels, and pipeline/layout strings,
  not GPU objects.

Remaining maintainability risk:

- `examples/standard-gltf-texture.js` is now responsible for GLB root creation,
  source registration, scenario failure metadata, sampler status mapping,
  material status, and readback expectations in one file.
- `test/e2e/standard-gltf-texture.spec.ts` has the positive screenshot/readback
  assertion and the transform diagnostic assertion inline. Adding
  metallic-roughness without helper extraction would duplicate the base-color
  status shape and sampler assertions.
- The authored texture-control harness does not need more cleanup before the
  next GLB slice, but the GLB harness should get a small helper pass when the
  next GLB material slot is added.

## Recommendation

Do not refactor the authored texture-control harness again immediately. It is
large, but the repeat and failure branches are now explicit enough for targeted
changes.

Before or during the metallic-roughness GLB browser fixture, extract local GLB
helpers for:

- fixture scenario metadata and expected failure metadata;
- texture-slot status construction;
- sampler source/mapped status construction;
- shared positive rendered status assertion;
- shared expected no-draw diagnostic assertion.

Keep these helpers local to the GLB example and spec. Do not add a public test
utility or runtime API until at least two GLB fixtures prove the shape.

## Follow-Up Task

### task-1113 — Extract GLB texture browser fixture helpers

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor: this audit, the current GLB base-color fixture, and
`docs/research/GLB_METALLIC_ROUGHNESS_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`.

Acceptance criteria:

- Local helpers describe GLB texture slots, sampler status, and expected failure
  metadata without changing published status values.
- Playwright helper functions cover positive rendered texture status and
  expected no-draw diagnostic status.
- The existing GLB base-color render, sampler status, and texture-transform
  diagnostic tests pass unchanged in behavior.
- Validation runs `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
  and `pnpm run typecheck:test`.
