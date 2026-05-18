# Completed Tasks

## task-1148 through task-1152 — GLB diagnostics, texture transforms, and collector audits

Completed: 2026-05-18

Completed task ids:

- `task-1149` — Surface app diagnostics summary in the standard GLB browser
  status.
- `task-1148` — Implement base-color texture transform offset/scale sampling.
- `task-1150` — Audit generic frame-resource collector after implementation.
- `task-1152` — Add generic collector failed-route diagnostics coverage.
- `task-1151` — Plan StandardMaterial non-UV0 texture-coordinate fixture.

Summary:

- Published `report.diagnosticsSummary` in the GLB texture browser status and
  asserted queued material/resource-set summaries for successful StandardMaterial
  routes.
- Added StandardMaterial base-color texture transform offset/scale support for
  UV0 via material uniform packing and WGSL UV transform sampling.
- Kept unsupported diagnostics for rotation and transformed non-UV0 paths.
- Added `standard-gltf-texture?scenario=base-color-transform-sampling` with
  screenshot/readback coverage and changed the existing transform failure path
  into an unsupported-rotation fixture.
- Audited the generic queued material frame-resource collector and documented
  that it does not import app/ECS/browser ownership or hard-code built-in
  buckets.
- Added direct generic collector failed frame-resource route coverage.
- Planned a GLB-shaped base-color `texCoord: 1` browser fixture and added
  `task-1153` as the next implementation slice.

Validation run:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "mapped base-color texture|delayed source dependencies|texture transforms"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "offset and scale transforms|texture transforms before"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec prettier --check` on touched implementation, test, and research
  files.

## task-1153 — Standard GLB base-color UV1 browser fixture

Completed: 2026-05-18

Summary:

- Added `standard-gltf-texture?scenario=base-color-uv1`, authoring glTF
  `baseColorTexture.texCoord = 1` against a mesh with `TEXCOORD_0` and
  `TEXCOORD_1`.
- Published JSON-safe expected texcoord/readiness status for the fixture and
  preserved the disclaimer that this is GLB-shaped browser coverage, not binary
  GLB mesh import support.
- Added Playwright coverage for the UV1 pipeline key, mesh layout key,
  readiness slot, JSON-safe status, and UV1-selected screenshot/readback color.

Validation run:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec prettier --check examples/standard-gltf-texture.js test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## task-1154 — StandardMaterial texture-transform support audit

Completed: 2026-05-18

Summary:

- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`.
- Verified the current supported transform surface is limited to
  `baseColorTexture` offset/scale on `TEXCOORD_0`.
- Confirmed rotation, transformed UV1, and transformed non-base-color slots
  still emit honest mapping/readiness diagnostics and should not submit draws
  through the app path.
- Documented remaining gaps: no browser fixture yet for transformed UV1
  no-draw status, rotation remains planned, and the low-level packer is not a
  transform validation boundary.

Validation run:

- Documentation-only audit slice; covered by touched-file Prettier,
  `pnpm run check:progress`, and `git diff --check`.

## task-1155 — Generic collector dependency-failure diagnostics coverage

Completed: 2026-05-18

Summary:

- Added direct generic collector coverage for invalid texture/sampler dependency
  preparation in `test/webgpu/queued-material-frame-resource-set.test.ts`.
- Verified dependency failures return JSON-safe diagnostics and do not call
  frame-resource option creation, frame-resource creation, or append callbacks.
- Kept the existing built-in frame-resource wrapper coverage passing.

Validation run:

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## task-1156 — StandardMaterial texture-transform rotation fixture plan

Completed: 2026-05-18

Summary:

- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_FIXTURE_PLAN_2026_05_18.md`.
- Selected a narrow GLB-shaped base-color rotation sampling fixture using a
  known center UV, a nearest 4x4 texture, and a 90-degree rotation plus offset
  that distinguishes rotated, offset/scale-only, and untransformed texels.
- Identified the needed mapping/readiness support predicate changes, uniform
  rotation packing, WGSL scale-rotate-offset helper, and browser readback
  assertions.
- Added `task-1161` as the implementation follow-up.

Validation run:

- Documentation-only planning slice; covered by touched-file Prettier,
  `pnpm run check:progress`, and `git diff --check`.

## task-1157 — Generic material-family app route summary migration plan

Completed: 2026-05-18

Summary:

- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`.
- Decided the successful queued resource-set summary should move to a generic
  material-family helper before another material family is added.
- Kept the public app diagnostics field name `routedResourceSet` as the
  recommended compatibility path.
- Added `task-1162` to move the built-in summary helper behind a generic
  queued material frame-resource summary type/helper.

Validation run:

- Documentation-only planning slice; covered by touched-file Prettier,
  `pnpm run check:progress`, and `git diff --check`.

## task-1158 — GLB missing TEXCOORD_1 browser diagnostic fixture

Completed: 2026-05-18

Summary:

- Added `standard-gltf-texture?scenario=base-color-uv1-missing`, authoring glTF
  `baseColorTexture.texCoord = 1` while keeping the mesh UV0-only.
- Verified browser status reports JSON-safe
  `render.standardMaterialTexture.missingTexCoord1` diagnostics before queueing
  or draw submission.
- Kept the successful `base-color-uv1` fixture unchanged as the paired positive
  path.

Validation run:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "missing TEXCOORD_1"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## task-1159 — StandardMaterial texture-transform packer boundary note

Completed: 2026-05-18

Summary:

- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_PACKER_BOUNDARY_2026_05_18.md`.
- Documented that `packStandardMaterial()` serializes already-accepted
  StandardMaterial data and is not the unsupported-transform validation
  boundary.
- Confirmed readiness and extraction tests own unsupported transform and missing
  UV-stream diagnostics.

Validation run:

- Documentation-only note; covered by touched-file Prettier,
  `pnpm run check:progress`, and `git diff --check`.

## task-1160 — Generic collector dependency-failure coverage audit

Completed: 2026-05-18

Summary:

- Added
  `docs/research/GENERIC_COLLECTOR_DEPENDENCY_FAILURE_COVERAGE_AUDIT_2026_05_18.md`.
- Verified generic collector tests now cover success, failed frame-resource
  result diagnostics, and invalid texture/sampler dependency preparation.
- Confirmed dependency failures do not call frame-resource option creation,
  frame-resource creation, or append callbacks.
- Added `task-1165` for duplicate-pipeline reuse coverage.

Validation run:

- Documentation-only audit slice; covered by touched-file Prettier,
  `pnpm run check:progress`, and `git diff --check`.

## task-1127 through task-1147 — Queued frame-resource split, GLB diagnostics, and route summaries

Completed: 2026-05-17

Completed task ids:

- `task-1127` — Extract queued built-in frame-resource preparation set.
- `task-1128` — Add GLB invalid texture/sampler diagnostics matrix tests.
- `task-1129` — Add GLB delayed dependency browser diagnostics fixture.
- `task-1132` — Plan GLB alpha-mask backface visual fixture.
- `task-1136` — Audit StandardMaterial alpha-mask coverage alignment.
- `task-1137` — Add GLB alpha-mask backface visual fixture.
- `task-1138` — Add queued built-in frame-resource reuse regression test.
- `task-1139` — Audit GLB delayed dependency browser status.
- `task-1140` — Extract standard GLB texture scenario status helpers.
- `task-1141` — Add StandardMaterial delayed dependency texture-readiness
  status.
- `task-1142` — Audit queued frame-resource extraction boundary.
- `task-1143` — Plan generic material-family frame-resource adapter interface.
- `task-1144` — Expose queued route summary in app diagnostics.
- `task-1145` — Plan GLB texture-transform sampling fixture.
- `task-1146` — Audit standard GLB texture helper extraction.
- `task-1147` — Introduce generic queued material frame-resource collector
  contracts.

Summary:

- Moved queued built-in frame-resource scratch ownership/result assembly from
  `app.ts` into `queued-built-in-frame-resource-set.ts` and covered success,
  failed-route diagnostics, and scratch reuse.
- Preserved GLB texture/sampler `dependencyKind` diagnostics across all
  StandardMaterial texture slots.
- Added delayed dependency and alpha-mask backface browser coverage with
  JSON-safe status/readiness data.
- Audited the frame-resource extraction boundary and removed an unused
  `snapshot` input from the extracted module.
- Planned the generic material-family frame-resource adapter interface and
  base-color texture-transform sampling fixture.
- Added `diagnosticsSummary` to WebGPU app render report JSON for queued
  material routes/resource sets and unsupported route reports.
- Audited the standard GLB texture helper extraction; no corrective code change
  was needed.
- Added `queued-material-frame-resource-set.ts` with generic collector scratch,
  adapter/sink callbacks, and a built-in wrapper path over the generic
  collector.

Validation run:

- `pnpm exec vitest run test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec vitest run test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/assets/gltf-source-registration-dependencies.test.ts test/materials/standard-texture-readiness.test.ts`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm run check:progress`
- `pnpm run check`

## task-1112 through task-1135 — Queue collector and GLB texture/render-state diagnostics expansion

Completed: 2026-05-17

Completed task ids:

- `task-1112` — Extract queued built-in resource-set collector.
- `task-1119` — Add GLB StandardMaterial occlusion texture browser fixture.
- `task-1120` — Add GLB StandardMaterial emissive texture browser fixture.
- `task-1121` — Add GLB alpha-mask double-sided render-state browser
  diagnostics.
- `task-1122` — Audit GLB browser helpers after occlusion/emissive expansion.
- `task-1123` — Plan generic material-family frame-resource collector split.
- `task-1124` — Add GLB render-state browser helper cleanup.
- `task-1125` — Plan GLB StandardMaterial dependency diagnostics matrix.
- `task-1126` — Add GLB alpha-mask texture pixel fixture plan.
- `task-1130` — Add GLB alpha-mask texture pixel fixture.
- `task-1131` — Audit GLB texture browser status after alpha-mask pixels.
- `task-1133` — Add StandardMaterial textured alpha-mask shader contract test.
- `task-1134` — Add GLB alpha-mask texture mobile viewport smoke test.
- `task-1135` — Add StandardMaterial alpha-mask buffer flag test.

Summary:

- Moved the built-in material queue-to-resource-set collection flow out of
  `packages/webgpu/src/webgpu/app.ts` into
  `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.
- Added focused collector coverage for one successful built-in route and one
  unsupported-family route-report diagnostic, keeping diagnostics JSON-safe and
  free of raw GPU handles.
- Added `standard-gltf-texture?scenario=occlusion` and
  `standard-gltf-texture?scenario=emissive`, mapping GLB-derived
  `occlusionTexture` and `emissiveTexture` through source registration and the
  app-facade WebGPU path.
- Added `standard-gltf-texture?scenario=alpha-mask-double-sided`, publishing
  JSON-safe glTF source render-state fields and mapped StandardMaterial render
  state with the current `standard|mask|none|less|none` pipeline key.
- Added
  `docs/research/GLB_BROWSER_HELPERS_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`;
  no ECS/source-asset ownership drift or JSON-safety issue was found.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`,
  selecting a focused `queued-built-in-frame-resource-set` extraction as the
  next renderer/material architecture step.
- Extracted local `standard-gltf-texture` status helpers for
  `standardMaterial` render-state status and optional `standardTexture` status
  without changing the published browser status shape.
- Added
  `docs/research/GLB_STANDARD_MATERIAL_DEPENDENCY_DIAGNOSTICS_MATRIX_2026_05_17.md`,
  documenting current GLB StandardMaterial texture/sampler dependency coverage
  across base-color, metallic-roughness, normal, occlusion, and emissive slots.
- Added follow-up tasks for GLB invalid texture/sampler diagnostics matrix tests
  and GLB delayed dependency browser diagnostics.
- Added
  `docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`,
  selecting a two-sample GLB-shaped alpha-mask base-color texture fixture that
  proves one opaque pixel and one masked clear pixel without claiming
  transparent blending.
- Added `standard-gltf-texture?scenario=alpha-mask-texture`, using a
  GLB-shaped base-color texture with alpha values above and below cutoff.
- Added Playwright coverage that verifies the alpha-test pipeline key, one
  opaque screenshot/readback sample, and one masked clear screenshot/readback
  sample without claiming transparent blending or binary `.glb` loading.
- Added
  `docs/research/GLB_TEXTURE_BROWSER_STATUS_AFTER_ALPHA_MASK_AUDIT_2026_05_17.md`;
  no ECS/render ownership drift or JSON-safety issue was found after the
  alpha-mask texture sample fields.
- Added a focused StandardMaterial shader contract test proving the
  base-color-textured WGSL variant samples texture alpha before applying
  `material.alphaCutoff` and keeps the textured alpha-mask pipeline key stable.
- Added a narrow-viewport Playwright smoke test for the GLB alpha-mask texture
  scenario to verify JSON-safe status, one draw, the alpha-test pipeline key,
  and the opaque/masked pixel split.
- Added a material-buffer packing test for textured masked StandardMaterial
  assets, locking alpha-mask feature flags, `alphaCutoff`, texture dependency
  keys, and JSON-safety expectations.
- Updated public tracker pages and refilled the ready backlog.

Validation run:

- `pnpm exec tsc --noEmit -p tsconfig.json`
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/queued-material-frame-resource-route.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm run build`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "occlusion"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "emissive"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "alpha-mask"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "base-color alpha"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec vitest run test/webgpu/standard-shader.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "narrow viewport"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec vitest run test/webgpu/standard-material-buffer.test.ts`

## task-1117 — Audit GLB texture browser status after metallic/normal work

Completed: 2026-05-17

Summary:

- Added
  `docs/research/GLB_TEXTURE_BROWSER_STATUS_AFTER_NORMAL_AUDIT_2026_05_17.md`.
- Verified the GLB browser fixture remains ECS/source-asset authored and
  snapshot-derived after base-color, metallic-roughness, normal-map, sampler
  status, and transform-diagnostic coverage.
- Verified browser status remains JSON-safe and does not expose raw texture
  bytes, GPU resources, backend caches, queues, encoders, or WebGPU handles.
- Added `task-1122` to repeat the audit after occlusion/emissive expansion.

Validation run:

- Documentation-only audit slice; covered by formatting and final repo
  validation after handoff updates.

## task-1115 — Add GLB StandardMaterial normal texture browser fixture

Completed: 2026-05-17

Summary:

- Added `standard-gltf-texture?scenario=normal-map` to
  `examples/standard-gltf-texture.js`.
- The scenario maps a glTF `normalTexture` through source registration, uses a
  local tangent-bearing plane mesh fixture, and renders through the existing
  ECS/app-facade WebGPU path.
- Browser status reports JSON-safe normal expectations, sampler mapping, source
  asset keys, pipeline/resource counters, diagnostics, draw counts, and
  readback samples when available.
- Added Playwright coverage for the normal-map GLB fixture and expanded the full
  GLB texture spec to four scenarios.

Validation run:

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "normal texture|normal-map"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## task-1118 — Plan GLB alpha-mode and double-sided render-state browser diagnostics

Completed: 2026-05-17

Summary:

- Added
  `docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`.
- Selected a first browser diagnostics/status slice for glTF `MASK`
  alpha-mode plus `doubleSided: true`.
- Defined expected JSON-safe source/mapped render-state fields, pipeline key
  behavior, assertions, and non-goals.
- Added `task-1121` as the implementation follow-up.

Validation run:

- Documentation-only planning slice; covered by formatting and final repo
  validation after handoff updates.

## task-1116 — Plan GLB occlusion/emissive browser fixture split

Completed: 2026-05-17

Summary:

- Added
  `docs/research/GLB_OCCLUSION_EMISSIVE_BROWSER_FIXTURE_SPLIT_PLAN_2026_05_17.md`.
- Chose separate GLB-derived occlusion and emissive browser fixture
  implementation tasks to keep visual assertions and status fields focused.
- Defined expected glTF material shape, texture bytes, JSON-safe status fields,
  pixel/readback strategy, and non-goals for each slot.
- Added `task-1119` and `task-1120` follow-ups.

Validation run:

- Documentation-only planning slice; covered by formatting and final repo
  validation after handoff updates.

## task-1106 through task-1114 — GLB texture browser expansion, queue planning, and harness audit

Completed: 2026-05-17

Summary:

- Audited GLB texture browser upload-usage boundaries after decoded glTF image
  textures started requesting `["sampled", "copy-dst"]`.
- Planned and implemented a GLB-derived StandardMaterial
  `metallicRoughnessTexture` browser scenario through glTF mapping, source
  registration, ECS authoring, and app-facade WebGPU rendering.
- Added JSON-safe GLB sampler source/mapped status to the browser fixture and
  Playwright assertions that no backend sampler resources or cache fields leak
  into status.
- Planned the next generic material-family queue migration around extracting
  the built-in queue-to-frame-resource collector out of `app.ts`.
- Audited the StandardMaterial texture-control and GLB browser harnesses after
  repeat sampler, GLB transform diagnostics, and GLB sampler status additions.
- Extracted local GLB scenario/status helpers in the example and e2e spec
  without changing published status values.
- Planned the next GLB-derived normal texture browser fixture.

Validation run:

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "mapped base-color"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "metallic-roughness"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`

## task-1099 through task-1105 — StandardMaterial texture browser harness, GLB fixture, sampler, and transform diagnostics

Completed: 2026-05-17

Summary:

- Refactored `examples/standard-texture-control.js` into local helpers for
  scenario flags, mesh fixture selection, texture/sampler assets, material
  bindings, and expectations.
- Refactored repeated Playwright setup/status assertions in
  `test/e2e/standard-texture-control.spec.ts`.
- Added `examples/standard-gltf-texture.html` and
  `examples/standard-gltf-texture.js` with a minimal GLB-equivalent
  StandardMaterial base-color texture fixture that maps material, texture,
  sampler, and mesh source assets through glTF reports/source registration into
  the normal ECS/app-facade render path.
- Fixed glTF decoded texture assets to request `["sampled", "copy-dst"]`, so
  uploadable image source data is compatible with WebGPU texture uploads while
  keeping GPU ownership in the backend.
- Added controlled `base-color-repeat-sampler` browser coverage for
  StandardMaterial repeat-U address mode sampling.
- Added GLB-derived `base-color-transform` expected-failure browser coverage
  for preserved `KHR_texture_transform` metadata and promoted
  `render.standardMaterialTexture.unsupportedTextureTransform` diagnostics.
- Added research docs for the updated StandardMaterial browser texture matrix,
  repeat address-mode sampler verification, and GLB texture-transform
  diagnostics.

Validation run:

- `node --check examples/standard-texture-control.js`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/materials/gltf-texture.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "texture transforms"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts -g "repeat sampler"`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check`

## task-1098 — Controlled StandardMaterial texture-transform diagnostics browser scenario

Completed: 2026-05-17

Summary:

- Added `standard-texture-control?scenario=base-color-transform`, which authors
  base-color texture bindings with a non-identity transform on both controlled
  StandardMaterial peers.
- The scenario publishes JSON-safe expected-failure status for
  `render.standardMaterialTexture.unsupportedTextureTransform`, including the
  expected transform metadata and no prepared pipeline keys.
- Added Playwright coverage verifying the transform scenario blocks draw
  submission and does not claim texture-transform sampling support.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts -g "base-color texture transforms"`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check:progress`
- `pnpm run check`

## task-1095 — Plan GLB StandardMaterial texture browser fixture

Completed: 2026-05-17

Summary:

- Added
  `docs/research/GLB_STANDARD_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`.
- Selected a minimal GLB-derived StandardMaterial base-color fixture as the
  first honest imported texture browser proof.
- Clarified that authored-source browser tests should continue to own precise
  slot, UV1, sampler, missing-tangent, and transform diagnostic assertions.
- Kept IBL, shadows, full glTF PBR fidelity, sampler comparisons, UV1, texture
  transforms, compression, skins, morphs, and animation deferred.
- Added `task-1100` for implementing the minimal GLB StandardMaterial
  base-color browser fixture.

Validation run:

- Documentation-only planning slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1094 — Audit StandardMaterial texture-control harness maintainability

Completed: 2026-05-17

Summary:

- Added
  `docs/research/STANDARD_TEXTURE_CONTROL_HARNESS_MAINTAINABILITY_AUDIT_2026_05_17.md`.
- Verified the harness remains ECS-authored and JSON-safe, with WebGPU resource
  ownership still inside `@aperture-engine/webgpu`.
- Identified concrete maintainability risk from the growing scenario branch
  matrix in `examples/standard-texture-control.js` and repeated assertions in
  `test/e2e/standard-texture-control.spec.ts`.
- Added `task-1099` to extract local harness helpers before adding more
  scenarios such as `base-color-transform`.

Validation run:

- Documentation-only audit slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1093 — Plan StandardMaterial texture-transform diagnostics browser verification

Completed: 2026-05-17

Summary:

- Added
  `docs/research/CONTROLLED_STANDARD_TEXTURE_TRANSFORM_DIAGNOSTICS_BROWSER_PLAN_2026_05_17.md`.
- Confirmed StandardMaterial texture transforms are preserved as source
  binding data and already diagnosed by readiness/extraction, but are not
  rendered by current shader variants.
- Selected `baseColorTexture` as the narrow browser negative path for
  `render.standardMaterialTexture.unsupportedTextureTransform`.
- Added `task-1098` for implementing a controlled
  `base-color-transform` expected-failure browser scenario.

Validation run:

- Documentation-only planning slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1097 — Add controlled StandardMaterial base-color linear sampler browser verification

Completed: 2026-05-17

Summary:

- Added `?scenario=base-color-linear-sampler` to
  `examples/standard-texture-control.js`.
- The scenario uses a base-color texture with distinct texels, a linear clamp
  sampler, and ambient-only lighting to prove StandardMaterial honors sampler
  filtering without creating a new shader/pipeline variant.
- Published JSON-safe sampler settings, expected blended color, rejected
  nearest color, pipeline keys, resource counters, diagnostics, and app-facade
  readback samples.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify sampler
  resource creation, no diagnostics, stable screenshot/readback distinction, and
  no sampler-specific pipeline key.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1096 — Add controlled StandardMaterial base-color UV1 browser verification

Completed: 2026-05-17

Summary:

- Added `?scenario=base-color-uv1` to
  `examples/standard-texture-control.js`.
- Added a local `TEXCOORD_1` plane mesh helper for the controlled browser
  fixture and authored the textured StandardMaterial with
  `baseColorTexture.texCoord: 1`.
- Published JSON-safe UV1 expectations, pipeline keys, mesh layout keys,
  resource counters, diagnostics, and app-facade readback samples.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify
  `standard|baseColorTexture|uv1|opaque|back|less|none`,
  `POSITION,NORMAL,TEXCOORD_0,TEXCOORD_1`, no diagnostics, and visible/readback
  distinction.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1092 — Plan StandardMaterial sampler comparison browser verification

Completed: 2026-05-17

Summary:

- Added
  `docs/research/CONTROLLED_STANDARD_SAMPLER_BROWSER_VERIFICATION_PLAN_2026_05_17.md`.
- Confirmed StandardMaterial sampler resources and source-side sampler fidelity
  diagnostics exist, but current controlled StandardMaterial browser scenarios
  only prove sampler creation with nearest clamp settings.
- Selected a base-color linear-sampler scenario as the smallest browser-visible
  proof that sampler filtering changes StandardMaterial texture sampling.
- Kept address-mode comparisons, mip/LOD fidelity warnings, GLB import, UV1,
  texture transforms, IBL, and shadows out of the first sampler browser proof.
- Added `task-1097` for implementing the controlled base-color linear sampler
  browser scenario.

Validation run:

- Documentation-only planning slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1089 — Plan StandardMaterial UV1 browser verification

Completed: 2026-05-17

Summary:

- Added
  `docs/research/CONTROLLED_STANDARD_UV1_BROWSER_VERIFICATION_PLAN_2026_05_17.md`.
- Confirmed UV1 support already exists below browser coverage: readiness accepts
  `texCoord: 1` per StandardMaterial texture slot, extraction diagnoses missing
  `TEXCOORD_1`, and WebGPU pipeline/shader variants include `uv1`.
- Selected `baseColorTexture` as the smallest browser-visible UV1 proof because
  it avoids normal-map tangents, PBR ambiguity, GLB import, sampler comparison,
  and texture transforms.
- Added `task-1096` for implementing a controlled `base-color-uv1` browser
  scenario with a local `TEXCOORD_1` mesh fixture.

Validation run:

- Documentation-only planning slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1091 — Add normal-map missing-tangents browser diagnostics

Completed: 2026-05-17

Summary:

- Added `?scenario=normal-map-missing-tangents` to
  `examples/standard-texture-control.js`.
- The scenario authors normal-mapped StandardMaterial peers on the built-in
  plane mesh without `TANGENT`, keeps the normal texture and sampler ready, and
  expects `render.standardNormalMap.missingTangents`.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify JSON-safe
  expected-failure status, two tangent-readiness diagnostics, no extracted mesh
  draws, no pipeline layout keys, and zero submitted draw calls.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1090 — Audit StandardMaterial browser texture coverage after occlusion/emissive scenarios

Completed: 2026-05-17

Summary:

- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_COVERAGE_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`.
- Updated the StandardMaterial browser texture slot matrix after base-color,
  metallic-roughness, normal-map, occlusion, and emissive controlled browser
  proofs landed.
- Confirmed remaining browser-visible gaps are now normal missing-tangents,
  UV1, sampler comparisons, texture-transform diagnostics, GLB mapping, IBL,
  and shadows.
- Updated the ready queue so the next task is `task-1091` normal-map
  missing-tangents browser diagnostics, with UV1/sampler/transform planning and
  a harness maintainability audit following.

Validation run:

- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check`

## task-1088 — Add controlled StandardMaterial occlusion/emissive browser verification

Completed: 2026-05-17

Summary:

- Added `?scenario=occlusion` and `?scenario=emissive` to
  `examples/standard-texture-control.js`.
- The occlusion scenario uses ambient-only lighting and a low red-channel data
  occlusion texture to prove the ambient diffuse term darkens relative to the
  scalar peer.
- The emissive scenario uses low-light conditions, an sRGB emissive texture,
  and a nonzero emissive factor to prove the emissive peer brightens relative to
  the scalar peer.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify both pipeline
  keys, texture/sampler resources, no diagnostics, screenshot differences, and
  app-facade readback differences when available.
- Kept GLB import, IBL, shadows, UV1, sampler comparisons, and texture
  transforms deferred.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1086 through task-1087 — Normal-map browser verification and boundary audit

Completed: 2026-05-17

Completed task ids:

- `task-1086` — Add controlled StandardMaterial normal-map browser
  verification.
- `task-1087` — Audit StandardMaterial normal-map browser boundaries.

Summary:

- Added `?scenario=normal-map` to
  `examples/standard-texture-control.js`.
- The scenario creates a local tangent-enriched plane mesh asset, authors a
  StandardMaterial `normalTexture` with `semantic: "normal"` and data color
  space, uses scenario-specific lighting, and publishes JSON-safe expected
  normal-map data, pipeline keys, mesh layout keys, resource counters,
  diagnostics, and app-facade readback samples.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify the
  `standard|normalTexture|opaque|back|less|none` pipeline,
  `POSITION,NORMAL,TEXCOORD_0,TANGENT` layout, texture/sampler resource
  creation, no diagnostics, screenshot distinction, and readback distinction.
- Added
  `docs/research/STANDARD_NORMAL_MAP_BROWSER_BOUNDARY_AUDIT_2026_05_17.md`,
  confirming the browser proof stays ECS-authored and keeps GPU resources inside
  `@aperture-engine/webgpu`.
- Tracked `normal-map-missing-tangents` as a concrete follow-up instead of
  broadening the normal-map positive proof.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec prettier --check examples/standard-texture-control.js test/e2e/standard-texture-control.spec.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1085 — Plan controlled StandardMaterial occlusion/emissive browser verification

Completed: 2026-05-17

Summary:

- Added
  `docs/research/CONTROLLED_STANDARD_OCCLUSION_EMISSIVE_BROWSER_VERIFICATION_PLAN_2026_05_17.md`.
- Chose one implementation task with two explicit scenarios instead of one
  combined assertion:
  - `?scenario=occlusion` with ambient-dominant lighting to isolate occlusion's
    ambient diffuse effect.
  - `?scenario=emissive` with low-light conditions to isolate emissive
    contribution.
- Kept IBL, shadows, GLB import, sampler comparisons, UV1, and texture
  transforms deferred.

Validation run:

- Documentation-only planning slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1084 — Plan controlled StandardMaterial normal-map browser verification

Completed: 2026-05-17

Summary:

- Added
  `docs/research/CONTROLLED_STANDARD_NORMAL_MAP_BROWSER_VERIFICATION_PLAN_2026_05_17.md`.
- Confirmed the browser gap is not shader/resource support but a tangent-bearing
  browser mesh fixture: built-in primitives currently expose `POSITION`,
  `NORMAL`, and `TEXCOORD_0`, while normal-mapped StandardMaterial rendering
  requires `TANGENT`.
- Selected a controlled `standard-texture-control?scenario=normal-map`
  follow-up using a local tangent-enriched mesh fixture and app-facade readback.
- Planned a paired `normal-map-missing-tangents` negative path with
  `render.standardNormalMap.missingTangents`, either in the same implementation
  slice if small or as the first follow-up.

Validation run:

- Documentation-only planning slice; covered by formatting and progress checks
  after tracker/backlog updates.

## task-1081 through task-1083 — App-facade readback, metallic-roughness browser proof, and readback boundary audit

Completed: 2026-05-17

Completed task ids:

- `task-1081` — Implement optional app-facade current-texture readback samples.
- `task-1082` — Add controlled StandardMaterial metallic-roughness browser
  verification.
- `task-1083` — Audit app-facade readback boundaries after implementation.

Summary:

- Added opt-in `readbackSamples` support to `WebGpuApp.render()`.
  `assembleFrameBoundary()` now optionally enqueues current-texture copy
  commands before encoder finish, and `mapFrameBoundaryReadbackSamples()`
  returns JSON-safe decoded RGBA samples or failure reasons without exposing GPU
  handles.
- Kept readback omitted unless requested. Render success remains independent of
  readback success so unsupported readback reports a JSON-safe failure while
  the frame can still render.
- Extended `examples/standard-texture-control.js` to opt into COPY_SRC canvas
  usage when available and publish app-facade readback samples for controlled
  positive scenarios.
- Added `?scenario=metallic-roughness` to the controlled StandardMaterial
  texture harness. The scenario verifies a metallic-roughness texture slot with
  fixed direct lighting, resource counters, pipeline keys, screenshot sampling,
  and app-facade readback when available.
- Added
  `docs/research/APP_FACADE_READBACK_BOUNDARY_AUDIT_2026_05_17.md` and updated
  public tracker pages so the next focus is normal-map browser planning.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec prettier --check examples/standard-texture-control.js test/e2e/standard-texture-control.spec.ts packages/webgpu/src/webgpu/app.ts packages/webgpu/src/webgpu/frame-boundary.ts packages/webgpu/src/webgpu/current-texture-view.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/frame-boundary-smoke.test.ts test/webgpu/frame-boundary-json.test.ts test/webgpu/frame-boundary-diagnostics.test.ts`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check:progress`

## task-1077 through task-1080 — StandardMaterial texture browser gap audit, metallic-roughness plan, negative variants, and tracker alignment

Completed: 2026-05-17

Completed task ids:

- `task-1077` — Audit StandardMaterial texture browser coverage gaps.
- `task-1078` — Plan controlled StandardMaterial metallic-roughness browser
  verification.
- `task-1079` — Add loading/failed StandardMaterial texture browser diagnostics
  variants.
- `task-1080` — Audit tracker/backlog alignment after readback planning.

Summary:

- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`,
  distinguishing precise base-color browser coverage from showcase smoke
  coverage and listing metallic-roughness, normal, occlusion, emissive,
  sampler, UV, and transform browser gaps.
- Added
  `docs/research/CONTROLLED_STANDARD_METALLIC_ROUGHNESS_BROWSER_VERIFICATION_PLAN_2026_05_17.md`,
  selecting a narrow direct-lit browser assertion for
  `metallicRoughnessTexture` without claiming full glTF PBR fidelity.
- Extended `examples/standard-texture-control.js` with `loading-texture` and
  `failed-texture` scenarios. Both keep the scalar StandardMaterial peer ready,
  block the textured peer through source texture status, publish JSON-safe
  expected-failure status, and submit no draws.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify missing,
  loading, and failed base-color texture no-submission diagnostics through one
  scenario table.
- Added
  `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_READBACK_AND_TEXTURE_GAPS_AUDIT_2026_05_17.md`
  and updated tracker pages so the next focus is `task-1081` app-facade
  current-texture readback, followed by the controlled metallic-roughness
  browser proof.
- Added backlog follow-ups for metallic-roughness implementation, readback
  boundary audit, and later normal/occlusion/emissive browser planning.

Validation run:

- `pnpm exec prettier --check docs/research/STANDARD_MATERIAL_TEXTURE_BROWSER_GAP_AUDIT_2026_05_17.md`
- `pnpm exec prettier --check docs/research/CONTROLLED_STANDARD_METALLIC_ROUGHNESS_BROWSER_VERIFICATION_PLAN_2026_05_17.md agent/BACKLOG.md`
- `node --check examples/standard-texture-control.js`
- `pnpm exec prettier --check examples/standard-texture-control.js test/e2e/standard-texture-control.spec.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check:progress`

## task-1076 — Plan app-facade current-texture readback support

Completed: 2026-05-17

Summary:

- Added
  `docs/research/APP_FACADE_CURRENT_TEXTURE_READBACK_PLAN_2026_05_17.md`.
- Selected an opt-in app render option for future current-texture readback
  samples rather than exposing textures, command encoders, queues, or other
  WebGPU objects from `WebGpuApp`.
- Kept screenshots as the current fallback for controlled examples and deferred
  implementation to `task-1081`.

Validation run:

- Documentation-only planning slice; run `pnpm run check:progress` after
  tracker updates.

## task-1075 — Audit tracker/backlog alignment after browser texture coverage

Completed: 2026-05-17

Summary:

- Added
  `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_BROWSER_TEXTURE_COVERAGE_AUDIT_2026_05_17.md`.
- Verified the public tracker, render-pipeline comparison page, backlog, and
  completed-task log reflect the StandardMaterial browser texture proof and
  missing-texture diagnostics path.
- Moved the recommended next task to `task-1076`, planning app-facade
  current-texture readback support for controlled examples.

Validation run:

- `pnpm run check:progress`
- `pnpm run check`

## task-1074 — Add StandardMaterial missing/not-ready browser texture diagnostics coverage

Completed: 2026-05-17

Summary:

- Extended `examples/standard-texture-control.js` with
  `?scenario=missing-texture`.
- The missing-texture scenario keeps the scalar StandardMaterial peer ready,
  authors the textured StandardMaterial with a missing base-color texture and
  ready sampler, and publishes an expected-failure status with JSON-safe
  diagnostic codes.
- Extended `test/e2e/standard-texture-control.spec.ts` to verify the
  no-submission missing-texture path and
  `render.standardMaterialTexture.textureNotReady`.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1073 — Plan StandardMaterial missing/not-ready browser texture diagnostics

Completed: 2026-05-17

Summary:

- Added
  `docs/research/STANDARD_TEXTURE_NEGATIVE_BROWSER_DIAGNOSTICS_PLAN_2026_05_17.md`.
- Selected a `standard-texture-control?scenario=missing-texture` follow-up so
  the positive StandardMaterial browser texture proof has a matching focused
  no-submission diagnostics path.
- Kept loading/failed variants, resource-withheld failures, app-facade readback,
  and GLB material import deferred.

Validation run:

- Documentation-only planning slice; covered by the latest `pnpm run check`
  before this task and by formatting/progress checks after tracker updates.

## task-1071 and task-1072 — Controlled StandardMaterial browser texture proof

Completed: 2026-05-17

Completed task ids:

- `task-1071` — Add dedicated controlled StandardMaterial texture browser
  example.
- `task-1072` — Audit controlled StandardMaterial texture browser boundaries.

Summary:

- Added `examples/standard-texture-control.html` and
  `examples/standard-texture-control.js`, a fixed app-facade browser example
  with a scalar StandardMaterial baseline and a base-color textured
  StandardMaterial sample.
- Added Playwright coverage that verifies the textured StandardMaterial
  pipeline key, texture/sampler resource creation, draw submission, JSON-safe
  status, and visually distinct screenshot samples.
- Added the example to the browser harness links and `check:examples`.
- Audited that the example stays ECS-authored and app-facade driven, without a
  GLB viewer, hidden scene graph, raw GPU handles, or source texture payloads in
  status JSON.

Validation run:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`

## task-1066 through task-1070 — Texture readiness promotion and browser verification planning

Completed: 2026-05-17

Completed task ids:

- `task-1066` — Plan StandardMaterial texture semantic/color-space readiness
  diagnostics.
- `task-1067` — Add StandardMaterial texture semantic/color-space readiness
  diagnostics.
- `task-1068` — Audit StandardMaterial texture semantic/color-space readiness
  boundaries.
- `task-1069` — Plan controlled StandardMaterial texture browser verification.
- `task-1070` — Audit tracker/backlog alignment after texture readiness
  planning.

Summary:

- Confirmed StandardMaterial readiness already validates slot semantic and
  color-space expectations, then identified the narrow missing bridge: extracted
  render diagnostics were dropping the expected/actual semantic and color-space
  fields.
- Added optional semantic/color-space fields to `RenderDiagnostic` and copied
  those values from StandardMaterial texture readiness diagnostics during
  extraction.
- Added focused extraction assertions proving blocked render diagnostics carry
  expected/actual texture semantic and color-space values while remaining
  JSON-safe.
- Audited that the change does not mutate assets, create WebGPU resources, or
  change app report defaults.
- Planned controlled StandardMaterial browser texture verification, then audited
  the browser harness and chose a dedicated app-style example because the
  multi-entity readback path still uses unlit frame-resource preparation.
- Updated the public tracker and backlog so the next ready task is the
  controlled StandardMaterial browser texture scenario.

Validation run:

- `pnpm exec vitest run test/rendering/extraction.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`

## task-1051 through task-1065 — Prepared/app alignment, route grouping, diagnostics example, and glTF render-state coverage

Completed: 2026-05-17

Completed task ids:

- `task-1051` — Plan prepared/app resource reuse alignment summary.
- `task-1052` — Add prepared/app resource reuse alignment coverage.
- `task-1053` — Audit prepared/app resource reuse alignment boundaries.
- `task-1054` — Plan route summary grouping consumer shape.
- `task-1055` — Add route summary grouping consumer coverage.
- `task-1056` — Audit route summary grouping boundaries.
- `task-1057` — Plan prepared/app reuse diagnostics example usage.
- `task-1058` — Add prepared/app reuse diagnostics example coverage.
- `task-1059` — Audit prepared/app reuse diagnostics example boundaries.
- `task-1060` — Plan generic material-family route helper consolidation.
- `task-1061` — Plan glTF alpha/double-sided mapping verification.
- `task-1062` — Add glTF alpha/double-sided mapping coverage.
- `task-1063` — Audit glTF alpha/double-sided mapping boundaries.
- `task-1064` — Plan StandardMaterial metallic-roughness texture browser coverage.
- `task-1065` — Audit tracker/backlog alignment after diagnostics and glTF
  plans.

Summary:

- Added `createPreparedResourceAppReuseAlignmentSummary()` in the WebGPU
  package to compare render prepared facade counts with app reuse prepared
  facade and resource counters without exposing backend cache maps.
- Added `createQueuedMaterialPrepareRouteSummary()` and
  `createQueuedMaterialRouteSummaryGroup()` to compactly group prepare-route and
  frame-resource-route health for explicit diagnostics consumers.
- Extended `examples/app-diagnostics.js` and Playwright coverage with an
  example-owned `preparedAppReuseSummary`, keeping the WebGPU app report shape
  unchanged.
- Deferred broader route orchestration extraction until a concrete duplication,
  allocation, or diagnostics need appears.
- Added glTF asset-mapping tests for `OPAQUE`, `MASK`, `BLEND`,
  `alphaCutoff`, and `doubleSided` mapping into StandardMaterial render state.
- Planned the next StandardMaterial browser/fidelity work around controlled
  texture verification and semantic/color-space readiness diagnostics.

Validation run:

- `pnpm exec vitest run test/webgpu/prepared-resource-app-reuse-alignment-summary.test.ts test/webgpu/prepared-resource-lifetime-alignment-summary.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts test/webgpu/queued-material-frame-resource-route.test.ts test/webgpu/material-queue-route-report.test.ts`
- `node --check examples/app-diagnostics.js`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/assets/gltf-asset-mapping-json.test.ts test/webgpu/standard-render-state-summary.test.ts`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## task-1046 through task-1050 — Route summary policy and prepared summary consumer

Completed: 2026-05-17

Completed task ids:

- `task-1046` — Plan frame-resource route summary diagnostics consumer.
- `task-1047` — Audit route summary diagnostics consumer boundaries.
- `task-1048` — Plan render-world prepared summary consumer shape.
- `task-1049` — Add render-world prepared summary consumer coverage.
- `task-1050` — Audit render-world prepared summary consumer boundaries.

Summary:

- Decided to keep `createQueuedMaterialFrameResourceRouteShellSummary()`
  helper-only for now. Successful app frames still omit route summaries by
  default, and failed frame-resource preparation still uses
  `webGpuApp.frameResourceRoute`.
- Audited that deferral against JSON safety, app report shape, ownership
  separation, and allocation discipline.
- Planned and added
  `createRenderWorldPreparedResourceSummaryFromReport()` in the render package
  to adapt `prepareAndBindSnapshotPreparedResourcesToRenderWorld()` reports into
  the existing compact prepared resource summary shape.
- Added targeted render summary coverage proving apply/preparation, binding,
  draw-readiness, and explicit diagnostics are counted once without exposing
  missing asset keys or GPU/backend details.
- Documented the new prepared summary consumer helper in
  `docs/DIAGNOSTICS_SUMMARIES.md`.
- Audited that no WebGPU backend cache state moved into render-package
  summaries.

Validation run:

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec vitest run test/rendering/render-world-prepared-resource-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`

## task-1016 through task-1045 — Generic app route helpers, diagnostics examples, and helper-composition regression

Completed: 2026-05-17

Completed task ids:

- `task-1016` — Plan generic built-in frame-resource helper app integration.
- `task-1017` — Wire app resource append through the generic helper.
- `task-1018` — Audit generic helper app integration boundaries.
- `task-1019` — Confirm prepared lifetime alignment summary docs coverage.
- `task-1020` — Plan sampler fidelity summary aggregation.
- `task-1021` — Add sampler fidelity summary aggregation.
- `task-1022` — Audit sampler fidelity summary boundaries.
- `task-1023` — Plan sampler fidelity example usage.
- `task-1024` — Add sampler fidelity example summary usage.
- `task-1025` — Audit sampler fidelity example boundaries.
- `task-1026` — Plan next generic material-family app route migration.
- `task-1027` — Audit tracker and backlog completion estimates.
- `task-1028` — Extract queued built-in frame-resource option helper.
- `task-1029` — Audit frame-resource option helper boundaries.
- `task-1030` — Plan texture/sampler dependency preparation helper extraction.
- `task-1031` — Add texture/sampler dependency preparation helper coverage.
- `task-1032` — Audit texture/sampler dependency preparation helper
  boundaries.
- `task-1033` — Plan final queued built-in app route helper composition.
- `task-1034` — Add queued built-in helper composition regression.
- `task-1035` — Audit queued built-in helper composition regression.
- `task-1036` — Plan prepared/sampler diagnostics example consolidation.
- `task-1037` — Add prepared/lifetime diagnostics example summary coverage.
- `task-1038` — Audit diagnostics example summary boundaries.
- `task-1039` — Plan next generic material-family route contract slice.
- `task-1040` — Audit tracker/backlog alignment after diagnostics examples.
- `task-1041` — Add next generic material-family route contract coverage.
- `task-1042` — Audit next generic route contract boundaries.
- `task-1043` — Plan StandardMaterial sampler readiness alignment follow-up.
- `task-1044` — Add StandardMaterial sampler readiness alignment coverage.
- `task-1045` — Audit StandardMaterial sampler readiness alignment boundaries.

Summary:

- Routed successful queued built-in frame resource appending through the generic
  built-in adapter helper while preserving family buckets, failure diagnostics,
  and successful-frame report shape.
- Added `createStandardMaterialSamplerFidelitySummary()` in the WebGPU package
  and exposed example-only sampler fidelity summary output in
  `examples/app-diagnostics.js`.
- Added `createPreparedResourceLifetimeAlignmentSummary()` and documented the
  prepared facade/backend lifetime comparison boundary.
- Extracted small named helpers for queued built-in frame-resource option
  assembly and texture/sampler dependency preparation inside
  `packages/webgpu/src/webgpu/app.ts`.
- Added a mixed built-in WebGPU app regression proving successful helper-composed
  frames omit route diagnostics while preserving creation and reuse counts.
- Added example-owned prepared resource and prepared lifetime summaries to the
  app diagnostics example with Playwright assertions for compact counts and
  handle/GPU omission.
- Planned the next generic route contract slice around a compact JSON-safe
  frame-resource route shell summary helper and audited tracker/backlog
  alignment.
- Added the compact frame-resource route shell summary helper and tests proving
  it omits facade/backend keys, raw diagnostics, and GPU handles.
- Planned a render-package texture/sampler alignment summary helper that keeps
  blocking readiness diagnostics separate from non-blocking sampler fidelity
  warnings.
- Added `createStandardMaterialTextureSamplerAlignmentSummary()` with tests and
  diagnostics docs coverage.
- Added implementation plans and boundary audits for each helper slice, keeping
  ECS/source asset ownership separate from WebGPU prepared resources and cache
  summaries.

Validation run:

- `pnpm exec vitest run test/rendering/render-world-prepared-resource-summary.test.ts test/materials/standard-sampler-fidelity.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/prepared-resource-lifetime-alignment-summary.test.ts`
- `pnpm exec vitest run test/webgpu/standard-material-sampler-fidelity-summary.test.ts`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "reuses unlit, standard, and matcap app resource cache slots|standardFrameResources.missingLights|routes scalar and textured StandardMaterial queue items"`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `node --check examples/app-diagnostics.js`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:examples`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec vitest run test/materials/standard-texture-sampler-alignment.test.ts`

## task-1002 through task-1015 — Prepared summaries, sampler fidelity, and generic adapter helpers

Completed: 2026-05-17

Completed task ids:

- `task-1002` — Plan render-world prepared resource summary alignment.
- `task-1003` — Add render-world prepared resource summary alignment coverage.
- `task-1004` — Audit render-world prepared resource summary boundaries.
- `task-1005` — Plan StandardMaterial sampler fidelity diagnostics coverage.
- `task-1006` — Audit latest diagnostics/example tracker alignment.
- `task-1007` — Add StandardMaterial sampler fidelity report.
- `task-1008` — Document StandardMaterial sampler fidelity diagnostics.
- `task-1009` — Audit StandardMaterial sampler fidelity boundaries.
- `task-1010` — Plan generic material-family preparation handoff
  implementation.
- `task-1011` — Add generic material-family preparation handoff coverage.
- `task-1012` — Audit generic material-family preparation handoff boundaries.
- `task-1013` — Plan prepared resource lifetime summary cleanup.
- `task-1014` — Add prepared resource lifetime alignment summary.
- `task-1015` — Audit prepared resource lifetime alignment boundaries.

Summary:

- Added compact render-world prepared resource summaries in the render package,
  keeping prepared facade counts separate from WebGPU backend cache summaries.
- Added StandardMaterial sampler fidelity diagnostics for mip filtering, LOD
  range, and anisotropy warnings without changing texture upload or app report
  behavior.
- Added a generic built-in frame-resource adapter helper that appends valid
  family resources through adapter callbacks and returns a compact report shell
  without raw resources.
- Added prepared resource lifetime alignment summaries in the WebGPU package to
  compare facade prepared counts with backend stale/missing/pending-destroy
  resource counts.
- Updated diagnostics docs, public trackers, backlog, and boundary audits.
- Validation run: targeted render/material/WebGPU tests, render and WebGPU
  package typechecks, test typecheck, progress tracker validation, and final
  `pnpm run check` passed with 244 Vitest files / 1147 tests.

## task-0969, task-0970, task-0973, and task-0982 through task-1001 — Texture fidelity summaries, progress tracker validation, and frame-resource contracts

Completed: 2026-05-17

Completed task ids:

- `task-0969` — Plan StandardMaterial texture fidelity diagnostics slice.
- `task-0982` — Audit StandardMaterial texture fidelity plan boundaries.
- `task-0983` — Add StandardMaterial texture fidelity summary coverage.
- `task-0970` — Add progress tracker freshness validation.
- `task-0973` — Document public progress tracker workflow.
- `task-0984` — Audit StandardMaterial texture fidelity summary boundaries.
- `task-0985` — Plan generic frame-resource success-path migration.
- `task-0986` — Audit generic frame-resource success-path plan boundaries.
- `task-0987` — Add successful-frame route-shell omission regression.
- `task-0988` — Audit successful-frame route-shell omission regression.
- `task-0989` — Wrap frame-resource preparation through the route shell
  internally.
- `task-0990` — Audit internal frame-resource route shell boundaries.
- `task-0991` — Document StandardMaterial texture fidelity summary helper.
- `task-0992` — Plan optional app diagnostics exposure for texture fidelity
  summaries.
- `task-0993` — Audit progress tracker validation and workflow boundaries.
- `task-0994` — Add StandardMaterial texture fidelity manual usage guidance.
- `task-0995` — Audit texture fidelity summary docs boundaries.
- `task-0996` — Plan generic frame-resource adapter contract extraction.
- `task-0997` — Add generic frame-resource adapter contract coverage.
- `task-0998` — Audit generic frame-resource adapter contract boundaries.
- `task-0999` — Plan StandardMaterial texture fidelity example usage.
- `task-1000` — Add StandardMaterial texture fidelity example/test coverage.
- `task-1001` — Audit StandardMaterial texture fidelity example usage
  boundaries.

Summary:

- Planned and audited a narrow StandardMaterial texture fidelity diagnostics
  slice that stays out of IBL, shadows, shader rewrites, texture uploads, and
  app report wiring.
- Added `createStandardMaterialTextureFidelitySummary()` in
  `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`.
  It summarizes existing StandardMaterial texture readiness JSON by field and
  issue code while omitting material, texture, sampler, and GPU handles.
- Added focused tests for ready fields, sampler issues, color-space issues,
  semantic issues, UV issues, transform issues, deterministic ordering, and JSON
  safety.
- Added `scripts/check-progress-tracker.mjs`, wired `pnpm run check:progress`
  into `pnpm run check`, and documented the public tracker workflow in
  `README.md`, `AGENTS.md`, and `docs/index.html`.
- Planned and audited the next generic frame-resource success-path migration:
  internally wrap successful and failed built-in frame-resource preparation
  through the generic shell while keeping successful reports unchanged.
- Added a WebGPU app regression proving successful mixed-family frames do not
  emit `webGpuApp.frameResourceRoute` diagnostics by default.
- Extracted frame-resource route shell creation into a named internal app helper
  while preserving successful app report shape and failure diagnostics.
- Documented the StandardMaterial texture fidelity summary helper in
  `docs/DIAGNOSTICS_SUMMARIES.md`, planned against default app report wiring,
  and added manual usage guidance.
- Audited progress tracker validation/workflow boundaries and texture fidelity
  docs boundaries.
- Planned and added a small generic frame-resource adapter result/context
  contract with built-in adapter test coverage.
- Added example-only texture fidelity summary output to
  `examples/app-diagnostics.js` and Playwright assertions proving aggregate
  counts and handle omission.
- Updated `docs/index.html` and `docs/render-pipeline-comparison.html` with the
  latest status, phase estimates, and recommended next task.

Validation run:

- `pnpm exec vitest run test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm run check:progress`
- `node --check scripts/check-progress-tracker.mjs`
- `pnpm exec prettier --check README.md docs/index.html scripts/check-progress-tracker.mjs package.json AGENTS.md test/webgpu/standard-material-texture-fidelity-summary.test.ts packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "frameResourceRoute|routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm run check` passed, including package boundaries, progress tracker
  validation, build/typecheck, test typecheck, examples syntax, lint, format
  check, and 241 Vitest files / 1138 tests.
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm run check:examples`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`

## task-0961 through task-0981 — StandardMaterial UV1 coverage, alpha/cull diagnostics, public progress tracker, and generic material route contract

Completed: 2026-05-17

Completed task ids:

- `task-0961` — Add StandardMaterial UV1 per-field coverage.
- `task-0962` — Audit StandardMaterial UV1 per-field coverage boundaries.
- `task-0963` — Plan StandardMaterial alpha/cull diagnostics slice.
- `task-0964` — Add StandardMaterial alpha/cull diagnostics helper/tests.
- `task-0965` — Audit StandardMaterial alpha/cull diagnostics boundaries.
- `task-0966` — Plan generic material-family queue-to-prepare handoff.
- `task-0967` — Add generic material-family route contract coverage.
- `task-0968` — Audit generic material-family route contract boundaries.
- `task-0971` — Wire generic prepare route into built-in app route reporting.
- `task-0972` — Audit generic app route reporting boundaries.
- `task-0974` — Plan generic app frame resource adapter migration.
- `task-0975` — Add generic frame-resource adapter shell coverage.
- `task-0976` — Audit generic frame-resource adapter shell boundaries.
- `task-0977` — Plan frame-resource route shell app integration.
- `task-0978` — Wire frame-resource route shell into app diagnostics.
- `task-0979` — Audit frame-resource route shell app diagnostics boundaries.
- `task-0980` — Plan successful-frame route shell reporting policy.
- `task-0981` — Audit successful-frame route shell policy boundaries.

Summary:

- Added StandardMaterial `TEXCOORD_1` readiness coverage for base color,
  metallic-roughness, normal, occlusion, and emissive texture fields.
- Added WebGPU pipeline/shader feature coverage proving every StandardMaterial
  texture field can select a `uv1` shader variant and matching vertex layout.
- Planned and implemented `createStandardMaterialRenderStateSummary()` as a
  JSON-safe WebGPU inspection helper for alpha mode, alpha cutoff, blend,
  depth-write, cull, double-sided flags, pipeline tokens, and mismatch
  diagnostics.
- Audited the UV1 and alpha/cull diagnostics boundaries; no runtime queue,
  pipeline descriptor, shader, or source material behavior changed.
- Added a public GitHub Pages-ready dashboard at `docs/index.html` and updated
  `docs/render-pipeline-comparison.html` with phase completion estimates and
  concrete missing pieces.
- Updated `AGENTS.md` and `agent/WAKE.md` so future project-status and
  render-pipeline work keeps the public tracker current.
- Enabled GitHub Pages for `main` `/docs` at
  `https://felixtrz.github.io/aperture/`.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_PREPARE_HANDOFF_PLAN_2026_05_17.md`
  to define the smallest next generic route contract around existing built-in
  material adapters, without moving GPU resource ownership or changing app
  behavior yet.
- Refreshed `docs/index.html` and `docs/render-pipeline-comparison.html` so the
  public tracker points at `task-0968` and records the generic route contract
  as landed while app resource wiring remains.
- Added `queued-material-prepare-route.ts` with the generic queued material
  prepare route context/result/adapter contract and
  `routeQueuedMaterialPrepare()` helper.
- Extended built-in material queue route adapters to implement the generic
  route contract while preserving existing built-in phase/blend validation.
- Added tests for successful built-in route shells, missing adapters, material
  mismatches, unsupported phases, and unsupported StandardMaterial blend
  presets without exposing raw GPU handles.
- Audited the generic route contract boundary and confirmed it does not make the
  app facade own source material state or GPU resources, and that route
  diagnostics remain JSON-safe and separate from retained backend cache
  summaries.
- Wired WebGPU app route collection through `routeQueuedMaterialPrepare()`
  before built-in family resource preparation, while preserving existing
  app-facing unsupported-family, mismatch, phase, and blend diagnostic codes.
- Kept source-version backend preparation keys separate from facade queue
  resource keys so successful frame output and cache reuse counts remain
  unchanged.
- Audited app route reporting and documented the key split, diagnostic
  compatibility, and retained cache summary separation.
- Planned the next generic frame-resource adapter shell and explicitly preserved
  source-version backend cache keys separately from facade queue resource keys.
- Added `createQueuedMaterialFrameResourceRouteShell()` to expose a JSON-safe
  status/key/diagnostic shell around frame resource preparation without copying
  raw GPU resource handles.
- Audited the frame-resource route shell and confirmed it remains a
  reporting-only boundary that keeps facade keys, backend keys, diagnostics, and
  retained cache summaries separate.
- Planned the first app integration point for the frame-resource route shell as
  failure diagnostics after `adapter.createFrameResources()`, without adding a
  successful-frame report surface yet.
- Added `webGpuApp.frameResourceRoute` diagnostics for failed queued built-in
  frame resource preparation, exposing facade/backend key split and route status
  without raw GPU handles.
- Audited the new frame-resource route diagnostic and confirmed it is
  failure-only, JSON-safe, and separate from retained cache reports.
- Planned to keep successful-frame route shells omitted for now unless a later
  optional diagnostics/report flag justifies the report-shape and allocation
  cost.
- Audited that policy and confirmed successful-frame route shells should remain
  omitted by default to avoid hidden valid-frame diagnostics allocation.

Validation run:

- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts test/webgpu/standard-pipeline-descriptor.test.ts`
- `pnpm exec vitest run test/webgpu/standard-render-state-summary.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/webgpu/standard-render-state-summary.test.ts test/webgpu/built-in-material-queue-phase.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- Browser smoke checks for `http://127.0.0.1:4173/index.html` and
  `http://127.0.0.1:4173/render-pipeline-comparison.html`.
- GitHub Pages status/build checks and cache-busted HTTP 200 verification for
  `https://felixtrz.github.io/aperture/`.
- `pnpm exec vitest run test/webgpu/queued-material-prepare-route.test.ts test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/queued-material-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-prepare-route.test.ts test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts --testNamePattern "queued material prepare route contract|built-in material queue route adapter factory|built-in material app resource adapter factory|routes scalar and textured StandardMaterial queue items with unlit and matcap draws|diagnoses unsupported material queue families without submitting|diagnoses unsupported alpha-test material queue families without submitting|diagnoses unsupported transparent material queue families and blend presets without submitting|includes asset mismatch details in material queue route reports|resets material queue route report shell state across failed frames|renders mixed opaque and alpha-test StandardMaterial queue items|renders transparent StandardMaterial alpha-blend queue items after opaque phases"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts test/webgpu/queued-material-prepare-route.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts --testNamePattern "queued material frame resource route shell|queued material prepare route contract|built-in material app resource adapter factory|routes scalar and textured StandardMaterial queue items with unlit and matcap draws|diagnoses unsupported material queue families without submitting|includes asset mismatch details in material queue route reports"`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm run check` passed, including package boundaries, build/typecheck, test
  typecheck, examples syntax, lint, format check, and 238 Vitest files / 1128
  tests.

## task-0924 through task-0960 — Diagnostics summaries, app diagnostics example aggregation, docs, and UV audit

Completed: 2026-05-17

Completed task ids:

- `task-0924` — Plan queued draw package cache diagnostics.
- `task-0925` — Audit queued material route allocation/report shape.
- `task-0926` — Plan material queue phase summary helper.
- `task-0927` — Add material queue phase summary helper.
- `task-0928` — Audit material queue phase summary boundaries.
- `task-0929` — Add draw package scratch summary helper.
- `task-0930` — Reuse queued material route collector arrays.
- `task-0931` — Audit queued material route collector reuse boundaries.
- `task-0932` — Audit draw package scratch summary boundaries.
- `task-0933` — Plan render frame queue diagnostics placement.
- `task-0934` — Add render frame queue diagnostics summary helper.
- `task-0935` — Audit render frame queue diagnostics summary boundaries.
- `task-0936` — Plan queued built-in resource set summary helper.
- `task-0937` — Add queued built-in resource set summary helper.
- `task-0938` — Audit queued built-in resource set summary boundaries.
- `task-0939` — Plan app diagnostics summary grouping.
- `task-0940` — Add app diagnostics summary helper.
- `task-0941` — Audit app diagnostics summary boundaries.
- `task-0942` — Plan StandardMaterial dependency diagnostics summary.
- `task-0943` — Add StandardMaterial dependency diagnostics summary helper.
- `task-0944` — Audit StandardMaterial dependency diagnostics summary
  boundaries.
- `task-0945` — Plan app diagnostics example summary usage.
- `task-0946` — Add app diagnostics dependency summary usage.
- `task-0947` — Audit app diagnostics dependency summary boundaries.
- `task-0948` — Plan diagnostics summary scratch reuse.
- `task-0949` — Plan app diagnostics dependency summary browser validation.
- `task-0950` — Add app diagnostics dependency summary Playwright assertions.
- `task-0951` — Audit app diagnostics dependency summary browser boundaries.
- `task-0952` — Plan README diagnostics summary note.
- `task-0953` — Add README diagnostics summary note.
- `task-0954` — Audit README diagnostics summary note boundaries.
- `task-0955` — Plan diagnostics summaries index doc.
- `task-0956` — Add diagnostics summaries index doc.
- `task-0957` — Audit diagnostics summaries index boundaries.
- `task-0958` — Plan optional app report diagnostics summary flag.
- `task-0959` — Plan StandardMaterial UV coordinate support audit.
- `task-0960` — Audit StandardMaterial UV coordinate support boundaries.

Summary:

- Added renderer-side and WebGPU-side JSON-safe diagnostics summaries for
  material queue phases, draw package scratch/pool behavior, render-frame queue
  diagnostics, queued built-in resource sets, app diagnostics grouping, and
  material dependency readiness aggregation.
- Reused queued built-in route collector arrays so valid resource-set wrapping
  no longer allocates fresh route arrays on each reset.
- Kept current-frame diagnostics summaries separate from retained backend cache
  reports and app `resourceReuse`.
- Updated the app diagnostics example to publish aggregate
  `dependencySummary` data for failure scenarios, and added Playwright
  assertions proving aggregate counts are present while detailed failure handles
  remain separate.
- Added `docs/DIAGNOSTICS_SUMMARIES.md` and README wording for public
  diagnostics summary usage.
- Planned and audited StandardMaterial UV coordinate support; current behavior
  supports `TEXCOORD_0`/`TEXCOORD_1`, diagnoses higher coordinate sets, and
  needs per-field UV1 test coverage.
- Refilled the ready backlog with `task-0961` through `task-0965`; recommended
  next task is `task-0961`.

Validation run:

- `pnpm exec vitest run test/rendering/material-queue.test.ts`
- `pnpm exec vitest run test/rendering/draw-package.test.ts test/webgpu/frame-readiness.test.ts`
- `pnpm exec vitest run test/webgpu/reusable-route-collector.test.ts test/webgpu/webgpu-app.test.ts --testNamePattern "reusable route collector|routes scalar and textured StandardMaterial queue items with unlit and matcap draws|unsupported material queue families|unsupported alpha-test material queue families|unsupported transparent material queue families|material queue route report shell|includes asset mismatch details"`
- `pnpm exec vitest run test/webgpu/render-frame-plan.test.ts`
- `pnpm exec vitest run test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec vitest run test/webgpu/material-dependency-diagnostics-summary.test.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- Focused TypeScript checks for `packages/render`, `packages/webgpu`, and
  `tsconfig.test.json`.
- `pnpm run check` passed, including package boundaries, build/typecheck,
  test typecheck, examples syntax, lint, format check, and 237 Vitest files /
  1121 tests.

## task-0901 through task-0923 — Render-world binding, cache lifetime reporting, and material queue ordering follow-up

Completed: 2026-05-17

Completed task ids:

- `task-0901` — Plan combined render-world prepared resource binding helper.
- `task-0902` — Add combined render-world prepared resource binding helper.
- `task-0903` — Audit combined render-world prepared resource binding helper.
- `task-0904` — Plan prepared mesh backend cache last-used tracking.
- `task-0905` — Add prepared mesh backend cache last-used tracking.
- `task-0906` — Audit prepared mesh backend cache last-used boundary.
- `task-0907` — Plan prepared mesh backend cache eviction report.
- `task-0908` — Add prepared mesh backend cache eviction helper.
- `task-0909` — Plan prepared mesh backend eviction app policy.
- `task-0910` — Audit prepared mesh backend cache eviction boundaries.
- `task-0911` — Plan generic app cache-lifetime policy surface.
- `task-0912` — Audit app resource reuse report cache-lifetime readiness.
- `task-0913` — Plan prepared texture/sampler cache summary boundary.
- `task-0914` — Add prepared texture/sampler cache summary helpers.
- `task-0915` — Audit prepared texture/sampler cache summary boundaries.
- `task-0916` — Expose texture/sampler cache summary in app reports.
- `task-0917` — Audit app texture/sampler cache summary report boundaries.
- `task-0918` — Plan generic retained backend cache summary grouping.
- `task-0919` — Add retained backend cache summary JSON regression.
- `task-0920` — Audit retained backend cache summary grouping boundaries.
- `task-0921` — Plan stable material queue ordering.
- `task-0922` — Add stable material queue ordering regression coverage.
- `task-0923` — Audit stable material queue ordering boundaries.

Summary:

- Added a combined render-world prepared resource helper that applies a
  snapshot once, prepares mesh/material facades, and binds both logical resource
  key families.
- Added prepared mesh backend cache `lastUsedFrame` metadata, manual eviction
  reporting, and audits/plans proving the metadata stays WebGPU-private.
- Added texture/sampler retained backend cache summaries and exposed
  `textureSamplerCache` in app `resourceReuse` separately from
  `preparedMaterialCache`.
- Added app JSON regression coverage for retained mesh/material/texture/sampler
  cache summaries together.
- Audited retained backend cache summary grouping and kept flat report fields.
- Added material queue ordering plan/audit plus a regression proving sorting
  derived queue items does not mutate source snapshots.
- Refilled the ready backlog with `task-0924` through `task-0928`; recommended
  next task is `task-0924`.

Validation run:

- `pnpm exec vitest run test/rendering/render-world-prepared-resources.test.ts test/rendering/render-world-prepared-meshes.test.ts test/rendering/render-world-prepared-materials.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-mesh-cache.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/app-texture-sampler-resources.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed, including package boundaries, build/typecheck,
  test typecheck, examples syntax, lint, format check, and 233 Vitest files /
  1103 tests.

## task-0886 through task-0900 — Prepared mesh/material facade and backend cache reporting handoff

Completed: 2026-05-17

Completed task ids:

- `task-0886` — Audit backend cache `lastUsedFrame` metadata boundary.
- `task-0887` — Add stale backend prepared material cache tests.
- `task-0888` — Add prepared mesh store facade.
- `task-0889` — Route first queue mesh keys from the prepared mesh facade.
- `task-0890` — Audit prepared mesh facade queue-key handoff.
- `task-0891` — Plan render-world prepared mesh binding helper.
- `task-0892` — Bind prepared mesh facade keys into render world.
- `task-0893` — Audit render-world prepared mesh binding helper.
- `task-0894` — Add prepared mesh facade stale-pruning app regressions.
- `task-0895` — Plan generic queued prepared-resource report shape.
- `task-0896` — Audit app prepared facade report shape.
- `task-0897` — Plan prepared mesh backend cache summary.
- `task-0898` — Add prepared mesh backend cache summary helper.
- `task-0899` — Expose prepared mesh backend cache summary in app reports.
- `task-0900` — Audit prepared mesh backend cache summary boundaries.

Summary:

- Added audits and plans for prepared material backend cache `lastUsedFrame`
  metadata, prepared mesh facade queue-key handoff, render-world mesh binding,
  generic prepared-resource report shape, and prepared mesh backend cache
  summaries.
- Expanded prepared material backend cache tests to prove stale retained entries
  keep older `lastUsedFrame` metadata across source/dependency version changes.
- Added renderer-independent `PreparedMeshStore` facade metadata and JSON-safe
  summaries.
- Routed queued built-in mesh resource keys through the prepared mesh facade
  while keeping WebGPU mesh buffer cache ownership in the backend.
- Added render-world helpers that bind prepared mesh facade keys into
  `RenderWorldObject.gpu.meshResourceKey` strings without mutating snapshots or
  storing WebGPU resources.
- Added app regressions proving snapshot-pruned prepared mesh/material facades
  can shrink while backend prepared material and mesh caches remain retained.
- Added WebGPU prepared mesh backend cache summaries and exposed
  `preparedMeshCache` in app resource reuse reports separately from
  `preparedMeshFacade`.
- Refilled the ready backlog with `task-0901` through `task-0905`; recommended
  next task is `task-0901`.

Validation run:

- `pnpm exec vitest run test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/prepared-matcap-material-cache.test.ts test/webgpu/prepared-standard-material-cache.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/assets/render-asset-preparation.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts test/rendering/snapshot-prepared-materials.test.ts test/assets/render-asset-preparation.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/render-world-prepared-meshes.test.ts test/rendering/render-world-prepared-materials.test.ts test/rendering/snapshot-prepared-materials.test.ts test/rendering/material-queue.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/rendering/snapshot-prepared-materials.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-mesh-cache.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm --filter @aperture-engine/render build`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed, including package boundaries, build/typecheck,
  test typecheck, examples syntax, lint, format check, and 231 Vitest files /
  1094 tests.

## task-0862 — Add render-world prepared material binding integration plan

Completed: 2026-05-17

Summary:

- Added
  `docs/research/RENDER_WORLD_PREPARED_MATERIAL_BINDING_INTEGRATION_PLAN_2026_05_17.md`
  to define the smallest render-world binding integration slice for prepared
  material facade entries.
- Planned a render package helper that updates
  `RenderWorldObject.gpu.materialResourceKey` from prepared material metadata
  string keys without mutating `RenderSnapshot` or storing WebGPU resources.
- Added `task-0867` as the implementation follow-up.

Validation run:

- `pnpm exec prettier --write docs/research/RENDER_WORLD_PREPARED_MATERIAL_BINDING_INTEGRATION_PLAN_2026_05_17.md`

## task-0861 — Audit render prepared material store facade boundaries

Completed: 2026-05-17

Summary:

- Added
  `docs/research/RENDER_PREPARED_MATERIAL_STORE_FACADE_BOUNDARY_AUDIT_2026_05_17.md`
  to verify the render package facade remains renderer-independent.
- Confirmed the facade does not import WebGPU, expose backend handles, mutate
  source asset authority, or make `RenderWorld` own prepared entries.
- Confirmed render-world binding tests use string material resource keys and
  leave `RenderSnapshot` unchanged.

Validation run:

- `pnpm exec prettier --write docs/research/RENDER_PREPARED_MATERIAL_STORE_FACADE_BOUNDARY_AUDIT_2026_05_17.md`

## task-0860 — Add render prepared material store facade

Completed: 2026-05-17

Summary:

- Added a renderer-independent `PreparedMaterialStore` facade in
  `packages/render/src/assets/preparation.ts`, backed by
  `PreparedRenderAssetStore<"material", PreparedMaterialAssetMetadata>`.
- The facade exposes prepare, get, list, remove, clear, and `entries` access
  without importing WebGPU or exposing backend handles.
- Added focused tests for prepare/update/unchanged/remove/clear behavior and
  render-world material resource key binding through string placeholders.
- Added `task-0865` as a follow-up for a JSON-safe prepared material facade
  summary helper.

Validation run:

- `pnpm exec prettier --write packages/render/src/assets/preparation.ts test/assets/render-asset-preparation.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/assets/render-asset-preparation.test.ts`

## task-0859 — Plan prepared texture/sampler dependency store boundary

Completed: 2026-05-17

Summary:

- Added
  `docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`
  to define how prepared material stores should depend on texture/sampler GPU
  resources without owning them.
- Documented boundary rules for source version keys, prepared texture/sampler
  inputs, separate texture/sampler cache ownership, and JSON-safe diagnostics.
- Added `task-0864` as the implementation follow-up for an explicitly named
  prepared material texture/sampler dependency input.

Validation run:

- `pnpm exec prettier --write docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`

## task-0858 — Add prepared built-in material store unload summary coverage

Completed: 2026-05-17

Summary:

- Added a focused prepared built-in material store test proving JSON-safe
  summary counts update after removing and clearing family cache entries.
- Confirmed no new public unload API was needed for this coverage slice.
- Kept texture/sampler resources and Standard light resources outside prepared
  material store ownership.

Validation run:

- `pnpm exec prettier --write test/webgpu/prepared-built-in-material-store.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-built-in-material-store.test.ts`

## task-0857 — Audit store-aware built-in material adapter context

Completed: 2026-05-17

Summary:

- Added
  `docs/research/STORE_AWARE_BUILT_IN_MATERIAL_ADAPTER_CONTEXT_AUDIT_2026_05_17.md`
  to verify the explicit prepared material store context did not change source
  asset authority, `RenderSnapshot` semantics, adjacent resource ownership, or
  public app report shape.
- Confirmed adapter callbacks now receive `preparedMaterials` explicitly while
  the callback cache view omits the prepared material store field.
- Confirmed texture/sampler GPU resources, Standard group-3 light resources,
  pipelines, frame-resource caches, and command submission remain outside
  prepared material store ownership.

Validation run:

- `pnpm exec prettier --write docs/research/STORE_AWARE_BUILT_IN_MATERIAL_ADAPTER_CONTEXT_AUDIT_2026_05_17.md`

## task-0856 — Add fallback diagnostics coverage for Matcap and Standard app helpers

Completed: 2026-05-17

Summary:

- Extended the app frame-resource fallback diagnostics test file beyond unlit
  to cover Matcap and Standard helper failures.
- Added missing group-2 material layout coverage for Matcap and scalar Standard
  prepared material fallback diagnostics.
- Added missing prepared texture/sampler GPU resource coverage for Matcap and
  base-color textured Standard fallback diagnostics.
- Verified diagnostics expose material family, material key, fallback reason,
  sanitized helper diagnostics, and no raw GPU handles.

Validation run:

- `pnpm exec prettier --write test/webgpu/unlit-app-frame-resources.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/unlit-app-frame-resources.test.ts`

## task-0855 — Plan generic render-world prepared material store API

Completed: 2026-05-17

Summary:

- Added
  `docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`
  to define the smallest renderer-independent prepared material store facade for
  `@aperture-engine/render`.
- Planned a facade backed by `PreparedRenderAssetStore<"material",
PreparedMaterialResourceDescriptor>` with prepare, get, list, remove, and
  clear behavior.
- Distinguished renderer-independent material metadata from WebGPU-owned
  buffers, bind groups, texture/sampler GPU resources, and Standard light
  resources.
- Added `task-0860` as the implementation follow-up.

Validation run:

- `pnpm exec prettier --write docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`

## task-0853 through task-0854 — Store-aware adapter context and summary invalidation coverage

Completed: 2026-05-17

Completed task ids:

- `task-0853` — Move built-in material adapter table into store-aware
  preparation context.
- `task-0854` — Add prepared material store invalidation summary tests.

Summary:

- Updated queued and single-material built-in material adapter frame preparation
  options to receive an explicit `preparedMaterials` store context.
- Hid `preparedMaterials` from the adapter callback cache view so callbacks use
  the store context instead of reaching through app cache internals for material
  buckets.
- Added app-level assertions proving prepared material cache summary counts
  update across source material, texture, and sampler source-version changes
  while remaining JSON-safe.

Validation run:

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/prepared-built-in-material-store.test.ts test/webgpu/webgpu-app.test.ts`

## task-0852 — Audit prepared built-in material store boundary

Completed: 2026-05-17

Summary:

- Added
  `docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md`
  to verify the WebGPU-private prepared built-in material store does not change
  ECS/source asset authority, `RenderSnapshot` semantics, public API shape, or
  ownership of texture/sampler and Standard light resources.
- Confirmed the store is not exported from the public WebGPU package surface
  and only feeds JSON-safe prepared material summary counts.
- Kept `task-0853` as the next implementation step and added `task-0857` as the
  follow-up audit for the store-aware adapter context.

Validation run:

- `pnpm exec prettier --check docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md agent/BACKLOG.md agent/COMPLETED.md`

## task-0845 and task-0847 through task-0851 — Adapter-driven prepared material store and diagnostics

Completed: 2026-05-17

Completed task ids:

- `task-0845` — Move built-in material preparation behind adapter registry.
- `task-0847` — Add prepared material cache summary counters.
- `task-0848` — Plan render-world prepared material store handoff.
- `task-0849` — Audit post-adapter built-in material preparation route.
- `task-0850` — Add prepared-material fallback diagnostics.
- `task-0851` — Add WebGPU prepared built-in material store container.

Summary:

- Moved single built-in material app-frame resource preparation through the
  internal queued built-in material family adapter table while preserving public
  app reports and reuse counters.
- Added JSON-safe prepared material cache summaries to WebGPU app resource reuse
  reports without exposing raw GPU handles or cache internals.
- Added
  `docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`
  to define the smallest next handoff from app-local prepared caches toward
  render-world/prepared-asset ownership.
- Added
  `docs/research/POST_ADAPTER_BUILT_IN_MATERIAL_PREPARATION_ROUTE_AUDIT_2026_05_17.md`;
  the audit found no source-asset, render-snapshot, texture/sampler, Standard
  light, app report, or package-boundary drift.
- Added sanitized prepared-material fallback diagnostics for unexpected helper
  failures while keeping expected skipped routes silent.
- Added a WebGPU-private prepared built-in material store that owns unlit,
  Matcap, and Standard prepared material cache buckets and feeds the existing
  summary report path.

Validation run:

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-app-material-resource.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-built-in-material-store.test.ts test/webgpu/prepared-app-material-resource.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- Final `pnpm run check` passed, including 228 Vitest files / 1063 tests.

## task-0846 — Built-in prepared-material fallback diagnostics plan

Completed: 2026-05-17

Summary:

- Added
  `docs/research/BUILT_IN_PREPARED_MATERIAL_FALLBACK_DIAGNOSTICS_PLAN_2026_05_17.md`
  to define when prepared material helper failures should remain silent
  fallbacks versus when they should emit JSON-safe app diagnostics.
- Added `task-0850` as the implementation follow-up for sanitized
  prepared-material fallback diagnostics.

Validation run:

- Documentation-only task. Previous final `pnpm run check` passed in this run.

## task-0841 through task-0844 — Matcap prepared cache and generic preparation cleanup

Completed: 2026-05-17

Completed task ids:

- `task-0841` — Add Matcap prepared material cache helper.
- `task-0842` — Wire Matcap app route through prepared material cache.
- `task-0843` — Normalize built-in prepared material use results.
- `task-0844` — Audit generic built-in material preparation boundary.

Summary:

- Added a WebGPU-private Matcap prepared material cache helper with
  texture/sampler dependency source-version keys and direct tests for material,
  texture, and sampler invalidation.
- Routed Matcap app frame-resource misses through prepared group-2 material
  resources while keeping texture/sampler GPU resources external to the material
  cache.
- Added app regressions for Matcap prepared material reuse and texture/sampler
  source-version invalidation while prepared mesh resources are reused.
- Added a shared internal `PreparedAppMaterialResourceUse<T>` shape and counter
  helper used by unlit, Matcap, and Standard app-frame helpers.
- Added
  `docs/research/GENERIC_BUILT_IN_MATERIAL_PREPARATION_BOUNDARY_AUDIT_2026_05_17.md`;
  no source-asset ownership, snapshot, texture/sampler, Standard light, public
  report, or package-boundary drift was found.

Validation run:

- `pnpm exec vitest run test/webgpu/prepared-matcap-material-cache.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-app-material-resource.test.ts test/webgpu/prepared-matcap-material-cache.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- Final `pnpm run check` passed, including 226 Vitest files / 1054 tests.

## task-0830 through task-0840 — Textured Standard prepared material routes

Completed: 2026-05-17

Completed task ids:

- `task-0830` — Add metallic-roughness textured Standard prepared helper.
- `task-0831` — Wire metallic-roughness Standard prepared cache into app
  route.
- `task-0832` — Add metallic-roughness Standard prepared app-route
  invalidation tests.
- `task-0833` — Audit Standard textured-family prepared route expansion.
- `task-0834` — Plan normal/occlusion/emissive Standard prepared cache
  expansion.
- `task-0835` — Extract generic textured Standard prepared helper.
- `task-0836` — Add normal-map Standard prepared app route.
- `task-0837` — Add occlusion/emissive Standard prepared app route.
- `task-0838` — Audit generic textured Standard prepared route.
- `task-0839` — Plan generic material-family preparation handoff.
- `task-0840` — Consolidate Standard textured prepared helper internals.

Summary:

- Added metallic-roughness, normal, and occlusion/emissive Standard prepared
  material helpers with texture/sampler dependency keys and direct cache reuse
  coverage.
- Routed metallic-roughness, normal, and occlusion/emissive Standard app
  frame-resource misses through prepared group-2 material resources while
  keeping group-3 light resources frame-derived.
- Added app regressions for prepared material reuse and texture/sampler
  source-version invalidation across the expanded Standard textured routes.
- Added audits and plans for Standard textured prepared route boundaries,
  normal/occlusion/emissive expansion, and the next generic material-family
  preparation handoff.
- Consolidated Standard textured prepared helper internals so base-color,
  metallic-roughness, normal, and occlusion/emissive wrappers share one
  texture-set resource assembly path.

Validation run:

- `pnpm exec vitest run test/webgpu/prepared-standard-material-cache.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- Final `pnpm run check` passed, including 224 Vitest files / 1048 tests.

## task-0796 through task-0809 — Prepared material and mesh cache groundwork

Completed: 2026-05-17

Completed task ids:

- `task-0796` — Audit app-local material resource path against render-world
  goals.
- `task-0797` — Add app descriptor-plan scratch writers.
- `task-0798` — Add Standard light-pack scratch writer.
- `task-0799` — Reuse app frame-resource success result shells.
- `task-0800` — Plan unlit scalar prepared material cache slice.
- `task-0801` — Add internal prepared material cache for scalar unlit.
- `task-0802` — Audit scalar unlit prepared material cache boundaries.
- `task-0803` — Add scalar unlit prepared-cache frame-miss regression.
- `task-0804` — Plan textured unlit prepared dependency handoff.
- `task-0805` — Add queued scoped bind-group scratch writer.
- `task-0806` — Plan prepared mesh cache handoff.
- `task-0807` — Add unlit prepared texture dependency key helper.
- `task-0808` — Extend unlit prepared cache for textured bindings.
- `task-0809` — Add direct prepared mesh cache helper.

Summary:

- Added audits/plans for app-local material resource ownership, scalar unlit
  prepared material caching, textured unlit dependency handoff, scalar cache
  boundaries, and prepared mesh cache handoff.
- Added scratch-backed writer APIs for view uniform, world transform, light
  packet, light descriptor, and queued scoped bind-group planning.
- Updated unlit, Matcap, and Standard app frame-resource helpers to reuse
  success result shells on cache hits.
- Added a WebGPU-private scalar unlit prepared material cache and wired scalar
  unlit app frames to consume prepared group-2 material resources.
- Added a scalar prepared-cache frame-miss app regression proving prepared
  material reuse survives frame-resource cache misses.
- Added texture/sampler handle-version dependency key derivation and direct
  textured unlit prepared-cache support for group-2 material bindings.
- Added a WebGPU-private prepared mesh cache helper keyed by source mesh
  handle/version and upload layout signature.

Validation run:

- `pnpm exec vitest run test/webgpu/view-uniform-buffer.test.ts test/webgpu/world-transform-buffer.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/light-packing.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/webgpu-app.test.ts test/webgpu/unlit-bind-group.test.ts test/webgpu/unlit-material-buffer-resource.test.ts`
- `pnpm exec vitest run test/webgpu/pipeline-scoped-bind-groups.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-mesh-cache.test.ts test/webgpu/prepared-unlit-material-cache.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## task-0794 through task-0795 — Utility coverage and prepared-resource handoff plan

Completed: 2026-05-17

Completed task ids:

- `task-0794` — Add app frame-resource utility tests.
- `task-0795` — Plan generic prepared material resource cache handoff.

Summary:

- Added focused tests for private app frame-resource utilities, covering
  ordered string-list equality/mismatch behavior, successful WebGPU-like queue
  writes, missing queue write support, and absence from the public WebGPU
  package surface.
- Added
  `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
  to define the staged handoff from app-local material frame resources toward a
  WebGPU-owned prepared material resource cache backed by render-layer material
  preparation descriptors.
- Refilled the ready backlog with unlit scalar prepared material cache planning
  and implementation follow-ups.

Validation run:

- `pnpm exec vitest run test/webgpu/app-frame-resource-utils.test.ts`

## task-0791 and task-0793 — Cache-slot regression and allocation cleanup plan

Completed: 2026-05-17

Completed task ids:

- `task-0791` — Add focused app frame-resource cache slot regression tests.
- `task-0793` — Plan app frame-resource hot-path allocation cleanup.

Summary:

- Tightened the three-family WebGPU app reuse regression so it captures first
  frame unlit, Matcap, and Standard resources, then proves the second frame
  reuses per-family material resources and Standard light resources through the
  app facade.
- Kept the regression focused on public app reports and resource reuse counters
  rather than exposing cache internals.
- Added
  `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md` to
  distinguish steady-state success-path allocations from setup/cache-miss
  allocation and adjacent queued-route scratch work.
- Refilled the ready backlog with descriptor-plan, Standard light-pack, and
  success-result-shell allocation cleanup tasks.

Validation run:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`

## task-0788 through utility follow-up — Standard helper and shared frame utilities

Completed: 2026-05-17

Completed task ids:

- `task-0788` — Extract StandardMaterial app frame-resource reuse helper.
- `task-0789` — Audit StandardMaterial frame-resource helper boundaries.
- `task-0790` — Plan shared app frame-resource utility extraction.
- `task-0792` — Audit app frame-resource extraction sequence.
- Follow-up utility slice — Extract and audit shared app frame-resource
  utilities.

Summary:

- Extracted StandardMaterial app frame-resource create/reuse behavior into
  `standard-app-frame-resources.ts` with explicit device/cache/snapshot/layout
  inputs and snapshot-derived light buffer reuse.
- Added a Standard helper boundary audit confirming app route orchestration,
  pipeline selection, frame planning, and submission remain outside the helper.
- Planned and performed a narrow extraction of duplicated non-allocating helper
  utilities into private `app-frame-resource-utils.ts`.
- Added a boundary audit confirming the shared utilities remain private,
  mechanical helpers with no app/render ownership.
- Added an overall extraction-sequence audit confirming app lifecycle, pipeline
  selection, frame planning, and submission remain app-owned.

Validation run:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run check`

## task-0783 through task-0787 — Frame-resource cache slots and unlit/Matcap helper extraction

Completed: 2026-05-17

Completed task ids:

- `task-0783` — Add explicit app frame-resource cache slots.
- `task-0784` — Extract unlit app frame-resource reuse helper.
- `task-0785` — Audit unlit frame-resource helper boundaries.
- `task-0786` — Extract Matcap app frame-resource reuse helper.
- `task-0787` — Plan StandardMaterial frame-resource reuse extraction.

Summary:

- Replaced nullable per-family app frame-resource cache fields with explicit
  mutable cache slots.
- Extracted unlit app frame-resource create/reuse behavior into
  `unlit-app-frame-resources.ts` with explicit device/cache/layout inputs.
- Added an unlit helper boundary audit confirming app-owned routing, pipeline
  selection, frame planning, and submission remain outside the helper.
- Extracted Matcap app frame-resource create/reuse behavior into
  `matcap-app-frame-resources.ts` using the same explicit input pattern.
- Planned StandardMaterial app frame-resource extraction with specific attention
  to snapshot-derived light buffer ownership and dynamic light buffer writes.

Validation run:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## task-0778 through task-0782 — App resource helper extraction and adapter shell

Completed: 2026-05-17

Completed task ids:

- `task-0778` — Extract app texture/sampler resource helpers.
- `task-0779` — Audit app texture/sampler helper boundaries.
- `task-0780` — Plan frame resource reuse helper extraction.
- `task-0781` — Add app resource adapter construction shell.
- `task-0782` — Audit app resource adapter construction boundaries.

Summary:

- Extracted app texture/sampler preparation into
  `app-texture-sampler-resources.ts` with explicit assets/device/cache/reuse
  dependencies.
- Updated `app.ts` to use the extracted helpers while preserving material queue
  route behavior.
- Added a boundary audit confirming the helper does not own app frame caches,
  render snapshots, pipeline layouts, frame planning, or submission.
- Planned the frame-resource reuse extraction and cache-slot boundary.
- Added `built-in-material-app-resource-adapter.ts`, a small internal shell that
  composes route adapters with caller-provided texture/sampler and
  frame-resource callbacks.
- Added focused adapter construction tests and a boundary audit confirming the
  shell is not a public material plugin API.

Validation run:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/built-in-material-queue-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## task-0773 through task-0777 — Built-in material route adapter extraction and shell reuse

Completed: 2026-05-17

Completed task ids:

- `task-0773` — Add built-in material route adapter factory.
- `task-0774` — Use route-only adapter factory in app routing.
- `task-0775` — Audit built-in adapter factory boundaries.
- `task-0776` — Plan app-local resource adapter split.
- `task-0777` — Add route report shell app reuse regression test.

Summary:

- Added a route-only built-in material queue adapter factory for `unlit`,
  `matcap`, and `standard` families.
- Covered factory family list, material asset type guards, duplicate-family
  diagnostics, and phase/blend validation.
- Updated `app.ts` to compose app-local resource closures from route adapters
  while leaving texture/sampler preparation, frame-resource creation, and bucket
  appends inside the app route.
- Added a boundary audit confirming the route adapter factory does not own GPU
  resources or app state.
- Planned the next app-local resource adapter split.
- Added an app regression test proving the reused route report shell resets
  across two failed frames.

Validation run:

- `pnpm exec vitest run test/webgpu/built-in-material-queue-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## task-0743 through task-0772 — GLB fixture diagnostics and material queue route reporting

Completed: 2026-05-17

Completed task ids:

- `task-0743` — Add combined GLB fixture JSON coverage.
- `task-0744` — Add combined GLB unresolved material fixture.
- `task-0745` — Audit combined GLB fixture diagnostics boundaries.
- `task-0746` — Plan generic material-family queue contract.
- `task-0747` — Export queued material adapter helper and tests.
- `task-0748` — Add queued material adapter registry diagnostics.
- `task-0749` — Add queued material adapter registry JSON helpers.
- `task-0750` — Audit queued material adapter registry boundaries.
- `task-0751` — Plan WebGPU app material queue route report.
- `task-0752` — Tighten existing WebGPU app route diagnostic JSON assertions.
- `task-0753` — Add material queue route report helper.
- `task-0754` — Add material queue route report JSON helpers.
- `task-0755` — Add material queue route diagnostic aggregation.
- `task-0756` — Audit material queue route report boundaries.
- `task-0757` — Plan built-in material adapter route extraction.
- `task-0758` — Add built-in material queue family helper.
- `task-0759` — Use built-in material queue family helper in app route.
- `task-0760` — Add built-in material queue phase diagnostic helper tests.
- `task-0761` — Audit built-in material queue helper boundaries.
- `task-0762` — Plan material queue route report app integration.
- `task-0763` — Emit failure-only material queue route reports.
- `task-0764` — Add successful queued built-in route absence checks.
- `task-0765` — Audit failure-only route report wiring.
- `task-0766` — Plan reusable route report shell.
- `task-0767` — Tighten queued route diagnostic JSON shape.
- `task-0768` — Add reusable material queue route report shell.
- `task-0769` — Use route report shell for failure projection.
- `task-0770` — Audit route report shell and app projection boundaries.
- `task-0771` — Plan built-in adapter registry factory extraction.
- `task-0772` — Add material queue asset-mismatch route report coverage.

Summary:

- Extended the combined GLB fixture coverage with JSON stability and unresolved
  material diagnostics while keeping it pure import/source-registration/ECS
  replay coverage.
- Planned and added a queued material adapter registry surface with duplicate
  family diagnostics plus JSON-safe inspection helpers.
- Added a pure WebGPU material queue route report helper that summarizes queued,
  routed, and skipped route items by family/phase and aggregates diagnostics by
  severity/code.
- Added built-in material queue family and phase helpers, then updated
  `createWebGpuApp` to use them without changing supported family or phase
  behavior.
- Wired failure-only `webGpuApp.materialQueueRouteReport` diagnostics into the
  queued built-in app route while preserving existing specific diagnostics and
  keeping successful queued renders report-free by default.
- Tightened route report JSON projection so absent optional diagnostic fields are
  omitted while `null` blend presets remain explicit.
- Added a reusable route report shell writer/reset API that reuses its bucket
  maps, diagnostics array, diagnostic summary, and routed-key set across writes.
- Updated app failure projection to use the route report shell stored in queued
  route scratch.
- Added asset-mismatch route report coverage with a crafted snapshot that keeps
  ECS-authored assets real while forcing a mismatched pipeline family.
- Planned the route-only built-in material adapter registry factory extraction.
- Added audits and plans for helper boundaries, route report integration, and a
  future reusable route report shell.
- Refilled the ready backlog with `task-0773` through `task-0777`.

Validation run:

- Focused Vitest runs for GLB fixture JSON/unresolved-material tests.
- Focused Vitest runs for queued material adapter helpers and JSON helpers.
- Focused Vitest runs for material queue route report, JSON, diagnostics, shell
  reuse, and WebGPU app route diagnostics/successful queued paths.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 217 Vitest files / 997 tests.

## task-0738 through task-0742 — GLB source registration orchestration and combined fixture

Completed: 2026-05-17

Completed task ids:

- `task-0738` — Add source registration orchestration skeleton.
- `task-0739` — Add source registration orchestration JSON tests.
- `task-0740` — Audit source registration orchestration boundaries.
- `task-0741` — Add combined import facade fixture coverage.
- `task-0742` — Audit combined GLB import fixture boundaries.

Summary:

- Added `registerGltfSourceAssetsFromReports`, a narrow helper that accepts a
  caller-owned `AssetRegistry` plus optional already-produced asset mapping and
  mesh construction reports.
- The helper invokes the existing material/texture/sampler and mesh source
  registration helpers, preserves nested reports, emits deterministic stage
  summaries, and reports missing input or failed nested stages.
- Added JSON coverage proving combined registration reports preserve nested
  summaries while omitting raw source payloads, ECS data, render packets,
  snapshots, and GPU handles.
- Added a tiny in-memory GLB fixture test that composes report-driven import,
  source registration, primitive material resolution, ECS command planning, ECS
  replay, and loader orchestration without running render extraction or WebGPU.
- Added boundary audits for source registration orchestration and combined GLB
  fixture composition. No corrective refactors were needed.
- Refilled the ready backlog with `task-0743` through `task-0747`.

Validation run:

- `pnpm exec vitest run test/assets/gltf-source-registration-orchestration.test.ts`
- `pnpm exec vitest run test/assets/gltf-source-registration-orchestration.test.ts test/assets/gltf-source-registration-orchestration-json.test.ts`
- `pnpm exec vitest run test/assets/gltf-combined-import-fixture.test.ts`
- `pnpm exec vitest run test/assets/gltf-source-registration-orchestration.test.ts test/assets/gltf-source-registration-orchestration-json.test.ts test/assets/gltf-combined-import-fixture.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## task-0737 — Plan explicit source registration orchestration helper

Completed: 2026-05-17

Summary:

- Added
  `docs/research/GLB_EXPLICIT_SOURCE_REGISTRATION_ORCHESTRATION_PLAN_2026_05_17.md`.
- Defined a narrow helper shape that accepts a caller-provided `AssetRegistry`
  plus already-produced asset mapping and mesh construction reports.
- Planned deterministic composition of existing material/texture/sampler and
  mesh registration helpers, compact stage summaries, missing/failed input
  diagnostics, JSON expectations, and duplicate-key/partial-failure tests.
- Kept ECS replay, render extraction, render-world preparation, and WebGPU
  explicitly out of scope.
- Follow-up tasks: `task-0738` through `task-0742`.

Validation run:

- `pnpm run format:check`

## task-0702 through task-0716 — GLB mesh registration, ECS command planning, and replay

Completed: 2026-05-17

Completed task ids:

- `task-0702` — Add GLB mesh source asset registration helper.
- `task-0703` — Add GLB mesh source asset registration JSON tests.
- `task-0704` — Audit GLB mesh source registration boundaries.
- `task-0705` — Plan GLB ECS authoring command integration from source reports.
- `task-0706` — Add GLB primitive material resolution edge-case tests.
- `task-0707` — Add GLB ECS authoring command plan scene/node skeleton.
- `task-0708` — Add GLB ECS primitive renderable command planning.
- `task-0709` — Add GLB ECS authoring command JSON tests.
- `task-0710` — Audit GLB ECS authoring command boundaries.
- `task-0711` — Add repeated mesh reference entity-key tests.
- `task-0712` — Plan GLB ECS authoring command replay boundary.
- `task-0713` — Add GLB ECS authoring command replay helper.
- `task-0714` — Add GLB ECS command replay JSON/report tests.
- `task-0715` — Audit GLB ECS command replay boundaries.
- `task-0716` — Add GLB command replay duplicate-key tests.

Summary:

- Added `registerGltfMeshSourceAssetsFromConstructionReport`, which writes
  constructed GLB `MeshAsset` source data into `AssetRegistry` as ready `mesh`
  assets, skips duplicate/invalid plans, preserves handle normalization, and
  exposes JSON-safe registration reports.
- Added GLB primitive material resolution edge coverage for custom key prefixes,
  duplicate materials that are not available, default materials from
  registration reports, and unregistered indexed materials.
- Planned and implemented `createGltfEcsAuthoringCommandPlan`, a serializable
  report-driven bridge from scene traversal, mesh registration, and primitive
  material resolution reports into ECS authoring commands.
- The command planner emits scene/node/primitive commands with node-scoped
  primitive entity keys, `parentEntityKey` relationships, mesh/material handle
  ids, dependencies, skipped entries, diagnostics, and JSON-safe projections.
- Planned and implemented `replayGltfEcsAuthoringCommands`, the first explicit
  ECS mutation stage for GLB authoring commands. It registers known components
  by default, creates entities, resolves parent keys in a second pass, applies
  known components, returns raw entity mappings for runtime use, and exposes a
  JSON helper that omits raw ECS entities.
- Added boundary audits for mesh source registration, ECS command planning, and
  ECS command replay. No corrective refactors were needed.
- Refilled the ready backlog with `task-0717` through `task-0721`.

Validation run:

- Focused Vitest runs for mesh source registration, primitive material
  resolution, ECS command planning, and ECS command replay.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed, including 200 Vitest files / 942 tests.

## task-0717 through task-0736 — GLB import facade orchestration and optional mapping

Completed: 2026-05-17

Completed task ids:

- `task-0717` — Add GLB command replay invalid-component tests.
- `task-0718` — Plan GLB loader orchestration facade boundary.
- `task-0719` — Add GLB loader orchestration report skeleton.
- `task-0720` — Add GLB loader orchestration JSON tests.
- `task-0721` — Audit GLB loader orchestration boundaries.
- `task-0722` — Add GLB orchestration prerequisite diagnostic tests.
- `task-0723` — Add GLB orchestration stage-count edge tests.
- `task-0724` — Audit GLB orchestration diagnostics boundaries.
- `task-0725` — Plan minimal GLB report-driven import facade.
- `task-0726` — Add GLB report-driven import facade skeleton.
- `task-0727` — Add GLB report-driven import JSON tests.
- `task-0728` — Audit GLB report-driven import facade boundaries.
- `task-0729` — Plan optional GLB material mapping in import facade.
- `task-0730` — Add report-driven import material mapping composition.
- `task-0731` — Add report-driven import material mapping JSON tests.
- `task-0732` — Audit report-driven import material mapping boundary.
- `task-0733` — Plan optional GLB mesh mapping in import facade.
- `task-0734` — Add report-driven import mesh mapping composition.
- `task-0735` — Add report-driven import mesh mapping JSON tests.
- `task-0736` — Audit report-driven import mesh mapping boundary.

Summary:

- Hardened ECS command replay with invalid component-name and malformed
  component-value diagnostics.
- Added a report-only GLB loader orchestration summary with stage status,
  side-effect classification, prerequisite diagnostics, stage counts, and
  JSON-safe projection.
- Added a minimal report-driven import facade that creates root validation and
  scene traversal reports from glTF JSON, accepts caller-provided stage reports,
  and returns orchestration.
- Extended the import facade with optional pure material/texture asset mapping
  and optional pure mesh primitive/accessor/mesh-construction report creation.
- Added JSON coverage proving image bytes, mesh typed arrays, registry entries,
  ECS entities, render packets, and GPU handles stay out of serialized facade
  reports.
- Added boundary audits for orchestration, orchestration diagnostics,
  report-driven import, optional material mapping, and optional mesh mapping.
- Refilled the ready backlog with `task-0737` through `task-0741`.

Validation run:

- Focused Vitest runs for command replay and import/orchestration helpers.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

Move or summarize completed backlog tasks here.

Format:

## task-id — Title

Completed: YYYY-MM-DD

Summary:

- What changed.
- Important files.
- Validation run.
- Follow-up tasks added.

## task-0701 — Normalize GLB mesh construction handle keys before registration

Completed: 2026-05-17

Summary:

- Updated mesh source asset construction reports to expose normalized planned
  mesh ids as `handleKey` and full registered mesh handle keys as
  `registeredHandleKey`.
- Added focused tests proving `mesh:gltf:mesh:0:primitive:0` can be derived
  without double-prefixing `mesh:`.
- Important files:
  `packages/render/src/assets/gltf-mesh-asset-construction.ts`,
  `test/assets/gltf-mesh-asset-construction.test.ts`,
  `test/assets/gltf-mesh-asset-construction-json.test.ts`,
  `docs/research/GLB_MESH_SOURCE_ASSET_REGISTRATION_PLAN_2026_05_17.md`.
- Validation run: focused mesh construction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed; final
  `pnpm run check` covered the full workspace.
- Follow-up tasks added: next ready task is `task-0702`.

## task-0700 — Audit GLB primitive material resolution boundaries

Completed: 2026-05-17

Summary:

- Audited the primitive material resolver and JSON tests against ECS, registry,
  and WebGPU ownership boundaries.
- Confirmed the helper stays report-driven and does not mutate registries,
  create default materials, author ECS, or touch WebGPU/browser APIs.
- Important files:
  `docs/research/GLB_PRIMITIVE_MATERIAL_RESOLUTION_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: ownership scan, `pnpm run check:boundaries`, focused material
  resolution tests, and `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: `task-0701` through `task-0705`.

## task-0699 — Add GLB primitive material resolution JSON tests

Completed: 2026-05-17

Summary:

- Added JSON stability coverage for primitive material resolution reports.
- Confirmed resolved/unresolved primitive material entries and skipped
  dependency diagnostics remain JSON-safe without registry, mesh buffer, ECS, or
  GPU payloads.
- Important files:
  `test/assets/gltf-primitive-material-resolution-json.test.ts`.
- Validation run: focused primitive material resolution tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into the boundary audit.

## task-0698 — Add GLB primitive material resolution report skeleton

Completed: 2026-05-17

Summary:

- Added `createGltfPrimitiveMaterialResolutionReport`, a renderer-independent
  helper that resolves primitive material indices from registration reports,
  caller-provided available material handles, and optional default material
  handles.
- Covered registered, duplicate/pre-existing, skipped dependency, and missing
  default material cases.
- Important files:
  `packages/render/src/assets/gltf-primitive-material-resolution.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-primitive-material-resolution.test.ts`.
- Validation run: focused primitive material resolution tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: `task-0699` and `task-0700`.

## task-0697 — Plan GLB mesh source asset registry registration

Completed: 2026-05-17

Summary:

- Planned the mesh source asset registration handoff from constructed
  `MeshAsset`s into `AssetRegistry`.
- Captured the handle-key normalization hazard where construction reports carry
  a full registered mesh key through a field named `handleKey`.
- Important files:
  `docs/research/GLB_MESH_SOURCE_ASSET_REGISTRATION_PLAN_2026_05_17.md`.
- Validation run: formatting covered by final validation.
- Follow-up tasks added: `task-0701` through `task-0705`.

## task-0696 — Audit GLB mesh source asset construction boundaries

Completed: 2026-05-17

Summary:

- Audited mesh source asset construction and JSON projection boundaries.
- Confirmed construction returns plain `MeshAsset` source data and does not
  register assets, author ECS, create render packets, or touch WebGPU/browser
  APIs.
- Important files:
  `docs/research/GLB_MESH_SOURCE_ASSET_CONSTRUCTION_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: ownership scan, `pnpm run check:boundaries`, focused mesh
  construction tests, and `pnpm exec tsc --noEmit -p tsconfig.test.json`
  passed.
- Follow-up tasks added: mesh source registration planning and implementation
  tasks.

## task-0695 — Add GLB mesh source asset construction JSON tests

Completed: 2026-05-17

Summary:

- Added JSON helpers and tests for GLB mesh source asset construction reports.
- Summarized vertex/index typed arrays by constructor and length while
  preserving stream, submesh, material slot, and bounds metadata.
- Important files:
  `packages/render/src/assets/gltf-mesh-asset-construction.ts`,
  `test/assets/gltf-mesh-asset-construction-json.test.ts`.
- Validation run: focused mesh construction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into the boundary audit.

## task-0694 — Add GLB mesh source asset construction skeleton

Completed: 2026-05-17

Summary:

- Added `createMeshAssetsFromGltfDecodedAccessors`, which builds a
  renderer-independent `MeshAsset` from decoded GLB primitive arrays.
- The helper packs supported attributes into one vertex stream, creates an
  optional index buffer, emits one submesh/material slot, computes local bounds,
  and reports mismatched attributes or invalid indices.
- Important files:
  `packages/render/src/assets/gltf-mesh-asset-construction.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-mesh-asset-construction.test.ts`.
- Validation run: focused mesh construction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: JSON tests and boundary audit.

## task-0693 — Audit GLB typed-array decoding boundaries

Completed: 2026-05-17

Summary:

- Audited the typed-array decoding helper and JSON tests against source asset,
  ECS, registry, and WebGPU boundaries.
- Confirmed decoding consumes caller-provided buffer bytes and returns
  renderer-independent typed arrays without constructing `MeshAsset`s or
  touching registries/WebGPU.
- Important files:
  `docs/research/GLB_TYPED_ARRAY_DECODING_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: ownership scan, `pnpm run check:boundaries`, focused decoding
  tests, and `pnpm run format:check` passed.
- Follow-up tasks added: mesh source asset construction planning and
  implementation tasks.

## task-0691 — Add GLB typed-array decoding JSON tests

Completed: 2026-05-17

Summary:

- Added JSON coverage for typed-array decoding reports.
- Confirmed decoded arrays are summarized by constructor and length, with raw
  buffer bytes omitted.
- Important files: `test/assets/gltf-accessor-decoding-json.test.ts`.
- Validation run: focused decoding tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into the boundary audit.

## task-0690 — Add GLB typed-array decoding report skeleton

Completed: 2026-05-17

Summary:

- Added `decodeGltfPrimitiveAccessors`, which decodes validated accessor ranges
  into renderer-independent typed arrays using caller-provided buffer bytes.
- Covered tight and strided float attributes, index decoding, and `uint8` to
  `uint16` index canonicalization.
- Important files: `packages/render/src/assets/gltf-accessor-decoding.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-accessor-decoding.test.ts`.
- Validation run: focused decoding tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: JSON tests and boundary audit.

## task-0689 — Plan GLB mesh source asset construction handoff

Completed: 2026-05-17

Summary:

- Planned how decoded GLB primitive arrays should become renderer-independent
  `MeshAsset` source data.
- Defined vertex stream, optional index buffer, one submesh, material slot,
  bounds, diagnostics, and non-goals for registry/ECS/WebGPU work.
- Important files:
  `docs/research/GLB_MESH_SOURCE_ASSET_CONSTRUCTION_HANDOFF_PLAN_2026_05_17.md`.
- Validation run: formatting covered by final validation.
- Follow-up tasks added: mesh construction implementation and audit tasks.

## task-0688 — Audit GLB accessor validation boundaries

Completed: 2026-05-17

Summary:

- Audited accessor validation reports and JSON tests.
- Confirmed validation remains byte-range/format metadata only and does not
  decode buffers, allocate typed arrays, construct `MeshAsset`s, author ECS, or
  touch WebGPU.
- Important files:
  `docs/research/GLB_ACCESSOR_VALIDATION_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: ownership scan, `pnpm run check:boundaries`, focused accessor
  validation tests, and `pnpm run format:check` passed.
- Follow-up tasks added: typed-array decoding and mesh construction slices.

## task-0687 — Plan GLB typed-array decoding report

Completed: 2026-05-17

Summary:

- Planned the typed-array decoding layer after accessor/buffer validation.
- Covered strided bufferViews, tightly packed accessors, optional indices,
  `uint8` index canonicalization, and deferred sparse/quantized/normalized
  diagnostics.
- Important files:
  `docs/research/GLB_TYPED_ARRAY_DECODING_REPORT_PLAN_2026_05_17.md`.
- Validation run: formatting covered by final validation.
- Follow-up tasks added: typed-array decoding implementation and JSON tests.

## task-0686 — Add GLB accessor validation JSON tests

Completed: 2026-05-17

Summary:

- Added JSON coverage for accessor/buffer validation reports.
- Confirmed buffer, bufferView, accessor, semantic, byte-range, and
  expected-format metadata is preserved without raw bytes, typed arrays, mesh
  assets, ECS, or GPU handles.
- Important files: `test/assets/gltf-accessor-validation-json.test.ts`.
- Validation run: focused accessor validation tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into typed-array planning.

## task-0685 — Add GLB accessor/buffer reference validation report skeleton

Completed: 2026-05-17

Summary:

- Added `validateGltfPrimitiveAccessorReferences`, a metadata-only validation
  layer between mesh primitive mapping and typed-array decoding.
- The helper validates buffers, bufferViews, accessors, byte ranges, semantic
  formats, sparse deferral, and zero-fill deferral without decoding bytes.
- Important files: `packages/render/src/assets/gltf-accessor-validation.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-accessor-validation.test.ts`.
- Validation run: focused accessor validation tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: JSON tests and decoding planning.

## task-0684 — Plan GLB primitive material resolution handoff

Completed: 2026-05-17

Summary:

- Planned how GLB primitive `material` indices should resolve to registered or
  already-available Aperture material handles before ECS authoring.
- Defined default material behavior, skipped/duplicate/missing dependency
  diagnostics, report shape, and non-goals that keep registry mutation out of
  the resolver.
- Important files:
  `docs/research/GLB_PRIMITIVE_MATERIAL_RESOLUTION_HANDOFF_PLAN_2026_05_17.md`.
- Validation run: formatting covered by final validation.
- Follow-up tasks added: none directly; backlog refilled with accessor and mesh
  construction slices.

## task-0683 — Audit GLB scene traversal boundaries

Completed: 2026-05-17

Summary:

- Audited the scene traversal helper and JSON tests against ECS/WebGPU ownership
  boundaries.
- Confirmed traversal uses serializable scene/node keys and transform payloads,
  does not mutate ECS or registries, and does not touch WebGPU/browser APIs.
- Important files:
  `docs/research/GLB_SCENE_TRAVERSAL_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: ownership scan, `pnpm run check:boundaries`, focused scene
  traversal tests, and `pnpm run format:check` passed.
- Follow-up tasks added: `task-0685` through `task-0689`.

## task-0682 — Plan GLB accessor and buffer reference validation

Completed: 2026-05-17

Summary:

- Planned the accessor/buffer reference validation layer between mesh primitive
  mapping and later typed-array decoding.
- Defined buffer, bufferView, accessor, semantic, byte-range, sparse deferral,
  and `uint8` index canonicalization policy while keeping decoding and
  `MeshAsset` construction out of scope.
- Important files:
  `docs/research/GLB_ACCESSOR_BUFFER_REFERENCE_VALIDATION_PLAN_2026_05_17.md`.
- Validation run: formatting covered by final validation.
- Follow-up tasks added: `task-0685` through `task-0689`.

## task-0681 — Add GLB scene traversal JSON tests

Completed: 2026-05-17

Summary:

- Added JSON fixture coverage for GLB scene traversal reports.
- Confirmed scene keys, node keys, parent relationships, transform payloads,
  matrix decomposition warnings, and cycle diagnostics are JSON-safe.
- Important files: `test/assets/gltf-scene-traversal-json.test.ts`.
- Validation run: focused scene traversal tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0682`.

## task-0680 — Add GLB scene traversal diagnostics report skeleton

Completed: 2026-05-17

Summary:

- Added `createGltfSceneTraversalReport`, a renderer-independent helper for
  scene selection, root/node traversal, deterministic scene/node entity keys,
  transform payload validation, cycle diagnostics, and matrix transform
  deferral.
- The helper does not create ECS entities, register assets, decode meshes, or
  touch WebGPU.
- Important files: `packages/render/src/assets/gltf-scene-traversal.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-scene-traversal.test.ts`.
- Validation run: focused scene traversal tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0681`.

## task-0679 — Audit GLB mesh mapping boundaries

Completed: 2026-05-17

Summary:

- Audited the GLB mesh primitive mapper and JSON helper against package
  boundaries, ECS ownership, and WebGPU ownership rules.
- Confirmed the helper stays source-report-only, leaves mesh decoding
  unresolved, and does not author ECS or touch WebGPU/browser APIs.
- Important files:
  `docs/research/GLB_MESH_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: ownership scan, `pnpm run check:boundaries`, focused GLB mesh
  mapping tests, and `pnpm run format:check` passed.
- Follow-up tasks added: `task-0680` through `task-0684`.

## task-0678 — Plan GLB scene and node traversal diagnostics

Completed: 2026-05-17

Summary:

- Planned a renderer-independent scene/node traversal diagnostics report before
  ECS authoring commands.
- Defined scene selection, deterministic scene/node entity keys, parent
  relationships, transform payload validation, cycle diagnostics, and matrix
  decomposition deferral.
- Important files:
  `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed during final validation.
- Follow-up tasks added: `task-0680`, `task-0681`, and `task-0683`.

## task-0677 — Add GLB mesh primitive mapping JSON tests

Completed: 2026-05-17

Summary:

- Added JSON fixture coverage for GLB mesh primitive mapping reports.
- Confirmed planned handle keys, primitive source indices, attribute/index
  references, diagnostics, and mesh summaries are JSON-safe and raw typed arrays
  are not embedded.
- Important files: `test/assets/gltf-mesh-primitive-json.test.ts`.
- Validation run: focused GLB mesh mapping tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0678`.

## task-0676 — Add GLB mesh primitive mapping report skeleton

Completed: 2026-05-17

Summary:

- Added `createGltfMeshPrimitiveMappingReport`, a renderer-independent helper
  that validates glTF mesh/primitive references and emits deterministic planned
  mesh handle keys.
- The helper reports missing meshes, missing primitives, missing `POSITION`,
  unsupported primitive modes, invalid accessor references, compressed primitive
  extensions, and unresolved accessor data without decoding buffers or creating
  ECS commands.
- Important files: `packages/render/src/assets/gltf-mesh-primitive.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-mesh-primitive.test.ts`.
- Validation run: focused GLB mesh mapping tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0677`.

## task-0675 — Plan minimal GLB mesh primitive source asset mapping

Completed: 2026-05-17

Summary:

- Planned the minimal GLB mesh primitive source mapping report.
- Defined deterministic mesh handle ids, reference validation vs accessor
  decoding separation, supported `POSITION`/`NORMAL`/`TEXCOORD_0`/indices
  scope, unsupported primitive diagnostics, JSON expectations, and non-goals.
- Important files:
  `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed after the plan was added.
- Follow-up tasks added: implementation and JSON coverage continued in
  `task-0676` and `task-0677`.

## task-0674 — Add GLB registration dependency edge coverage

Completed: 2026-05-17

Summary:

- Added focused coverage proving registered GLB material entries create
  `AssetRegistry` dependency edges to texture and sampler handles.
- Covered duplicate pre-existing texture/sampler entries as satisfied
  dependencies and missing dependency skips with diagnostics.
- Important files:
  `test/assets/gltf-source-registration-dependencies.test.ts`.
- Validation run: focused GLB source registration tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0672`.

## task-0673 — Audit GLB registry handoff boundaries

Completed: 2026-05-17

Summary:

- Audited the GLB source asset registry handoff after implementation.
- Confirmed registry writes stay source-asset-only, duplicate handling avoids
  overwrites, partial failures are report-backed, and no ECS/WebGPU/image decode
  boundary drift was introduced.
- Important files:
  `docs/research/GLB_REGISTRY_HANDOFF_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: `pnpm run check:boundaries`, focused GLB source registration
  tests, and `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: `task-0675` through `task-0679`.

## task-0672 — Plan GLB ECS authoring command handoff

Completed: 2026-05-17

Summary:

- Planned the serializable ECS authoring command report that should follow
  source asset registration.
- Defined scene/node/primitive entity-key strategy, component command shape,
  registration boundaries, and mesh/node/transform prerequisites before any ECS
  command helper is implemented.
- Important files:
  `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`.
- Validation run: documentation formatting to be covered by final validation.
- Follow-up tasks added: mesh primitive and scene traversal planning tasks.

## task-0671 — Add GLB registration report JSON tests

Completed: 2026-05-17

Summary:

- Added JSON fixture coverage for GLB source asset registration reports.
- Confirmed written/skipped handle keys and duplicate diagnostics are preserved
  and raw texture byte arrays/source data are not embedded in JSON output.
- Important files: `test/assets/gltf-source-registration-json.test.ts`.
- Validation run: focused GLB source registration tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0674`.

## task-0670 — Add GLB source asset registration report skeleton

Completed: 2026-05-17

Summary:

- Added `registerGltfSourceAssetsFromMappingReport`, which promotes successful
  `GltfAssetMappingReport` texture, sampler, and material plans into ready
  `AssetRegistry` source assets.
- The helper returns JSON-safe written/skipped/diagnostic reports, skips
  duplicates without overwriting, preserves material dependency handles, and
  avoids ECS/WebGPU/image decode work.
- Important files: `packages/render/src/assets/gltf-source-registration.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/gltf-source-registration.test.ts`.
- Validation run: focused GLB source registration tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0671`.

## task-0669 — Plan GLB source asset registry registration contract

Completed: 2026-05-17

Summary:

- Planned the source-asset-only handoff from `GltfAssetMappingReport` to
  `AssetRegistry` registration.
- Defined deterministic write order, ready-state registration semantics,
  duplicate-key behavior, partial-failure behavior, handle normalization,
  material dependency edges, JSON report expectations, and non-goals.
- Important files:
  `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: documentation/backlog formatting to be covered by the final
  run validation.
- Follow-up tasks added: `task-0674` dependency edge coverage.

## task-0668 — Audit GLB orchestration report boundaries

Completed: 2026-05-17

Summary:

- Audited the GLB orchestration report helper against package boundaries and
  ECS/WebGPU ownership rules.
- Confirmed the helper only plans source assets and deterministic handle keys;
  it does not mutate registries, author ECS, decode images, or touch WebGPU.
- Important files:
  `docs/research/GLB_ORCHESTRATION_REPORT_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: `pnpm run check:boundaries` and focused GLB orchestration
  tests passed.
- Follow-up tasks added: `task-0669` through `task-0673`.

## task-0667 — Add GLB orchestration report diagnostics docs

Completed: 2026-05-17

Summary:

- Documented the `GltfAssetMappingReport` lifecycle, valid planned-handle flow,
  failed texture decode diagnostics, unsupported required extension diagnostics,
  and the later registry handoff point.
- Important files:
  `docs/research/GLB_ORCHESTRATION_REPORT_DIAGNOSTICS_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed after documentation formatting.
- Follow-up tasks added: none directly; continued into `task-0668`.

## task-0666 — Add GLB asset mapping report JSON tests

Completed: 2026-05-17

Summary:

- Added JSON fixture tests for `GltfAssetMappingReport`.
- Updated orchestration report JSON conversion to summarize nested texture
  payloads through JSON-safe helper values instead of embedding raw
  `Uint8Array` data.
- Important files: `packages/render/src/assets/gltf-asset-mapping.ts`,
  `test/assets/gltf-asset-mapping-json.test.ts`.
- Validation run: focused GLB asset mapping tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0667`.

## task-0665 — Add GLB asset mapping report skeleton

Completed: 2026-05-17

Summary:

- Added `createGltfAssetMappingReport`, a renderer-independent orchestration
  report that validates root JSON, maps material-referenced textures, plans
  deterministic source asset handle keys, and maps materials through the
  texture-binding resolver boundary.
- The helper preserves root, texture, and material diagnostics with source
  context and does not register assets.
- Important files: `packages/render/src/assets/gltf-asset-mapping.ts`,
  `test/assets/gltf-asset-mapping.test.ts`.
- Validation run: focused GLB asset mapping tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0666`.

## task-0664 — Plan minimal GLB asset mapping orchestration report

Completed: 2026-05-17

Summary:

- Planned a renderer-independent orchestration report that collects root,
  texture, sampler, and material mapping outputs and deterministic planned
  handle keys before any registry mutation.
- Important files:
  `docs/research/MINIMAL_GLB_ASSET_MAPPING_ORCHESTRATION_REPORT_PLAN_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed after documentation formatting.
- Follow-up tasks added: `task-0669` through `task-0673`.

## task-0663 — Audit GLB root/material/texture helper boundaries

Completed: 2026-05-17

Summary:

- Audited root, material, sampler, texture, integration, and JSON helper tests.
- Confirmed the helpers remain renderer-independent and avoid parsing, decoding,
  registry mutation, ECS authoring, and WebGPU preparation.
- Important files:
  `docs/research/GLB_ROOT_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: `pnpm run check:boundaries` and focused GLB helper tests
  passed.
- Follow-up tasks added: `task-0664` through `task-0668`.

## task-0662 — Add GLB helper report JSON fixture tests

Completed: 2026-05-17

Summary:

- Added JSON fixture tests for material, sampler, and texture helper reports.
- Confirmed texture report JSON summarizes binary payloads by byte length and
  row stride, and material diagnostics preserve dependency kind, texture index,
  sampler index, slot, and severity.
- Important files: `test/materials/gltf-report-json.test.ts`.
- Validation run: focused GLB helper tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0663`.

## task-0661 — Add GLB material/texture integration diagnostics docs

Completed: 2026-05-17

Summary:

- Documented how root, texture, sampler, and material helper reports compose
  without registry mutation.
- Added examples for successful planned handles, missing texture diagnostics,
  and missing sampler diagnostics.
- Important files:
  `docs/research/GLB_MATERIAL_TEXTURE_INTEGRATION_DIAGNOSTICS_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed after documentation formatting.
- Follow-up tasks added: none directly; continued into `task-0662`.

## task-0660 — Add glTF JSON root validation helper

Completed: 2026-05-17

Summary:

- Added `validateGltfRootForAssetMapping`, a renderer-independent root helper
  that validates `asset.version === "2.0"`, mapper array shapes, and required
  unsupported root extensions.
- Important files: `packages/render/src/assets/gltf-root.ts`,
  `test/assets/gltf-root.test.ts`, `packages/render/src/assets/index.ts`.
- Validation run: focused GLB root/helper tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0661`.

## task-0659 — Connect GLB texture reports to material resolver results

Completed: 2026-05-17

Summary:

- Added a test-only fixture that maps `GltfTextureMappingReport` outputs into
  material resolver results.
- Successful texture reports produce material texture/sampler handle bindings;
  failed texture reports produce material diagnostics distinguishing texture vs
  sampler failures.
- Important files:
  `test/materials/gltf-material-texture-integration.test.ts`,
  `packages/render/src/materials/gltf-texture.ts`.
- Validation run: focused GLB integration tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0660`.

## task-0658 — Audit GLB material and texture helper boundaries

Completed: 2026-05-17

Summary:

- Audited GLB material, sampler, and texture/image helper modules.
- Confirmed they produce source assets and diagnostics only, with image decoding
  and texture/sampler handle resolution caller-owned.
- Important files:
  `docs/research/GLB_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`.
- Validation run: `pnpm run check:boundaries` and focused GLB helper tests
  passed.
- Follow-up tasks added: `task-0659` through `task-0663`.

## task-0657 — Add GLB texture asset mapping skeleton

Completed: 2026-05-17

Summary:

- Added `createTextureAssetFromGltfTexture`, a renderer-independent helper that
  validates glTF texture/image/sampler metadata, calls a decoded-image resolver,
  and returns `TextureAsset`/`SamplerAsset` source data plus JSON-safe
  diagnostics.
- Report JSON summarizes source bytes by byte length and stride rather than raw
  binary payloads.
- Important files: `packages/render/src/materials/gltf-texture.ts`,
  `test/materials/gltf-texture.test.ts`,
  `packages/render/src/materials/index.ts`.
- Validation run: focused GLB texture tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0658`.

## task-0656 — Plan minimal GLB texture/image asset mapping

Completed: 2026-05-17

Summary:

- Planned the first GLB texture/image mapping helper, keeping image decoding,
  fetching, registry mutation, ECS authoring, and WebGPU upload out of scope.
- The plan defines slot-to-semantic/color-space mapping and resolver-owned
  decoded image inputs.
- Important files:
  `docs/research/MINIMAL_GLB_TEXTURE_IMAGE_MAPPING_PLAN_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed after documentation formatting.
- Follow-up tasks added: `task-0659` through `task-0663`.

## task-0655 — Add GLB material texture resolver diagnostic results

Completed: 2026-05-17

Summary:

- Expanded the GLB material texture resolver contract so resolver-provided
  diagnostics can be propagated alongside successful bindings.
- Missing texture and missing sampler resolver failures can now be distinguished
  through `dependencyKind`, `textureIndex`, and `samplerIndex`.
- Important files: `packages/render/src/materials/gltf-material.ts`,
  `test/materials/gltf-material.test.ts`.
- Validation run: focused GLB material tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0656`.

## task-0654 — Add GLB material alpha/cull mapping edge coverage

Completed: 2026-05-17

Summary:

- Added focused coverage for `OPAQUE`, `MASK`, `BLEND`, `doubleSided`, and
  invalid alpha/cull fields in the GLB material mapper.
- Tightened `alphaCutoff` validation to require a finite value between 0 and 1.
- Important files: `packages/render/src/materials/gltf-material.ts`,
  `test/materials/gltf-material.test.ts`.
- Validation run: focused GLB material tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0655`.

## task-0653 — Audit GLB sampler and texture-transform readiness

Completed: 2026-05-17

Summary:

- Audited the GLB sampler, texture-transform, and material-mapping helpers
  against architecture/package boundaries and reference material-loader
  patterns.
- Confirmed the helpers remain renderer-independent, JSON-safe, and free of
  WebGPU resources, ECS authoring, image decoding, and asset registry mutation.
- Fixed one audit finding: malformed `extensions` and `pbrMetallicRoughness`
  objects now produce `gltfMaterial.invalidField` diagnostics instead of
  silently defaulting.
- Important files:
  `docs/research/GLB_SAMPLER_TEXTURE_TRANSFORM_READINESS_AUDIT_2026_05_17.md`,
  `packages/render/src/materials/gltf-material.ts`,
  `test/materials/gltf-material.test.ts`.
- Validation run: `pnpm exec tsc --noEmit -p tsconfig.test.json`,
  `pnpm exec vitest run test/materials/gltf-sampler.test.ts
test/materials/gltf-material.test.ts`, `pnpm run check:boundaries`, and
  `pnpm run format:check` passed.
- Follow-up tasks added: `task-0654` through `task-0658`.

## task-0652 — Add GLB material mapping skeleton

Completed: 2026-05-17

Summary:

- Added a renderer-independent glTF material mapper that returns
  `StandardMaterialAsset` or `UnlitMaterialAsset` source data from plain
  glTF-like material JSON.
- Texture/sampler handles are supplied by a caller resolver; the mapper does not
  create GPU resources, ECS entities, or asset-registry entries.
- Added JSON-safe diagnostics for unsupported required/optional material
  extensions, malformed material fields, unresolved texture bindings, and
  unsupported texture transforms.
- Important files: `packages/render/src/materials/gltf-material.ts`,
  `test/materials/gltf-material.test.ts`,
  `packages/render/src/materials/index.ts`.
- Validation run: focused GLB material tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0653`.

## task-0651 — Plan minimal GLB material mapping

Completed: 2026-05-17

Summary:

- Added a focused plan for mapping glTF material JSON into Aperture
  `UnlitMaterialAsset` and `StandardMaterialAsset` source assets.
- The plan defines resolver inputs for texture/sampler handles, unsupported
  extension diagnostics, alpha/double-sided render-state rules, and explicit
  non-goals around WebGPU, ECS, image decoding, and asset registry mutation.
- Important files:
  `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`.
- Validation run: `pnpm run format:check` passed after the documentation edit.
- Follow-up tasks added: `task-0654` through `task-0658`.

## task-0650 — Add glTF sampler-to-SamplerAsset mapping helpers

Completed: 2026-05-17

Summary:

- Added a renderer-independent glTF sampler helper that maps wrap/filter enum
  values into Aperture `SamplerAsset` source data.
- Missing sampler fields use Aperture's documented linear/repeat defaults,
  while malformed enum values produce JSON-safe diagnostics.
- Tests cover default sampler data, repeat/linear mapping, nearest/mirror/clamp
  mapping, min/mipmap filter splitting, and invalid enum diagnostics.
- Important files: `packages/render/src/materials/gltf-sampler.ts`,
  `test/materials/gltf-sampler.test.ts`,
  `packages/render/src/materials/index.ts`.
- Validation run: focused GLB sampler tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0651`.

## task-0649 — Add StandardMaterial texture-transform diagnostics

Completed: 2026-05-17

Summary:

- Added `MaterialTextureTransform` metadata to material texture bindings.
- StandardMaterial texture readiness now emits JSON-safe diagnostics for
  non-identity texture transforms and extraction blocks those draws before
  WebGPU preparation.
- Diagnostics preserve material key, field, texture key, and authored transform
  values.
- Important files: `packages/render/src/materials/types.ts`,
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `test/materials/standard-texture-readiness.test.ts`,
  `test/rendering/extraction.test.ts`.
- Validation run: focused StandardMaterial readiness/extraction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0650`.

## task-0648 — Extract queued material adapter helpers

Completed: 2026-05-17

Summary:

- Moved the queued built-in material adapter registry contract out of the main
  WebGPU app file into a narrow internal helper module.
- The app route still starts from `RenderSnapshot`/`MaterialQueueItem` data and
  keeps texture, sampler, bind group, and pipeline resources inside
  `packages/webgpu`.
- Existing built-in material queue behavior remains unchanged.
- Important files: `packages/webgpu/src/webgpu/queued-material-adapter.ts`,
  `packages/webgpu/src/webgpu/app.ts`.
- Validation run: `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
  and `pnpm exec vitest run test/webgpu/webgpu-app.test.ts` passed.
- Follow-up tasks added: none directly; continued into `task-0649`.

## task-0647 — Audit queued material adapter integration

Completed: 2026-05-17

Summary:

- Audited the queued built-in material adapter integration against the generic
  queue contract plan, package boundaries, and focused app/browser tests.
- Confirmed `RenderSnapshot`/`MaterialQueueItem` remains the route input and
  WebGPU resources remain inside `packages/webgpu`.
- Important files:
  `docs/research/QUEUED_MATERIAL_ADAPTER_INTEGRATION_AUDIT_2026_05_17.md`.
- Validation run: `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`,
  `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts
test/e2e/materials-showcase.spec.ts`, `pnpm run check:boundaries`,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, and
  `pnpm run format:check` passed.
- Follow-up tasks added: `task-0648` through `task-0653`.

## task-0646 — Promote WebGPU validation warning guards to shared E2E helpers

Completed: 2026-05-17

Summary:

- Moved the focused WebGPU console warning/error guard into
  `test/e2e/webgpu-status.ts`.
- Applied the shared guard to both the StandardMaterial queue-phase browser
  spec and the material showcase browser spec.
- Important files: `test/e2e/webgpu-status.ts`,
  `test/e2e/standard-queue-phases.spec.ts`,
  `test/e2e/materials-showcase.spec.ts`.
- Validation run: `pnpm exec playwright test
test/e2e/standard-queue-phases.spec.ts test/e2e/materials-showcase.spec.ts`,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, and
  `pnpm run format:check` passed.
- Follow-up tasks added: none directly; continued into `task-0647`.

## task-0645 — Audit StandardMaterial PBR texture expectations

Completed: 2026-05-17

Summary:

- Audited current StandardMaterial texture behavior against glTF
  metallic-roughness expectations from three.js, PlayCanvas, and Bevy.
- Confirmed the ECS/render extraction boundary and WebGPU resource ownership
  remain intact.
- Recorded remaining GLB material mapping gaps around texture transforms,
  sampler import conversion, IBL, and shadows.
- Important files:
  `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`.
- Validation run: `pnpm run check:boundaries`, focused StandardMaterial
  readiness/extraction tests, and `pnpm run format:check` passed.
- Follow-up tasks added: `task-0648` through `task-0653`.

## task-0644 — Tighten StandardMaterial texture dependency diagnostics

Completed: 2026-05-17

Summary:

- StandardMaterial texture readiness now validates both texture and sampler
  handles/statuses for all supported PBR texture channels.
- Dependency diagnostics now include material key, field, dependency kind,
  texture key and/or sampler key when available, and status.
- Extraction now blocks StandardMaterial failed texture and missing sampler
  dependencies before queuing a draw.
- Important files:
  `packages/render/src/materials/dependency-readiness.ts`,
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `test/materials/material-dependency-readiness.test.ts`,
  `test/materials/standard-texture-readiness.test.ts`,
  `test/rendering/extraction.test.ts`.
- Validation run: focused material readiness/extraction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0645`.

## task-0643 — Add generic queued material resource adapter contract

Completed: 2026-05-17

Summary:

- Added an internal queued built-in material adapter contract in the WebGPU app
  route.
- Queue item resource preparation now dispatches texture/sampler preparation,
  frame-resource creation, and family bucket insertion through adapters for
  unlit, MatcapMaterial, and StandardMaterial.
- The contract remains internal to `packages/webgpu` and does not move GPU
  handles into `packages/render`.
- Important files: `packages/webgpu/src/webgpu/app.ts`.
- Validation run: `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`,
  `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`,
  `pnpm run check:boundaries`, and `pnpm run format:check` passed.
- Follow-up tasks added: none directly; continued into `task-0644`.

## task-0642 — Plan generic material-family queue contract

Completed: 2026-05-17

Summary:

- Added a focused plan for moving the WebGPU app queue route from
  family-specific preparation branches toward an internal queued material-family
  adapter contract.
- The plan preserves `RenderSnapshot`/`MaterialQueueItem` as the boundary,
  keeps GPU handles in `packages/webgpu`, and avoids adding new material
  behavior in the same implementation slice.
- Important files:
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: `pnpm run format:check` passed after the documentation edit.
- Follow-up tasks added: `task-0647`; next recommended task is `task-0643`.

## task-0641 — Add Standard queue-phase WebGPU validation warning guard

Completed: 2026-05-17

Summary:

- Added a focused Playwright console guard to the StandardMaterial queue-phase
  browser test so WebGPU command-buffer and auto-layout validation warnings fail
  the spec before pixel assertions.
- This protects against the browser-only bind-group layout issue found during
  `task-0640`, where Aperture's synchronous diagnostics reported success while
  Chrome invalidated the command buffer.
- Important files: `test/e2e/standard-queue-phases.spec.ts`.
- Validation run: `pnpm exec playwright test
test/e2e/standard-queue-phases.spec.ts` and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: backlog corrected to avoid duplicate PBR texture work;
  next recommended task is `task-0642`.

## task-0640 — Audit expanded queue phase consumption

Completed: 2026-05-17

Summary:

- Audited the expanded StandardMaterial opaque, alpha-test, and transparent
  queue route against the North Star and architecture constraints.
- Confirmed phase consumption remains `RenderSnapshot`/`MaterialQueueItem`
  driven, with no renderer-owned scene graph and no WebGL fallback.
- Found and fixed one browser-only WebGPU drift: StandardMaterial light bind
  groups now get pipeline-scoped resource keys so auto-layout pipelines do not
  reuse bind groups created from another pipeline's group-3 layout.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`,
  `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`.
- Validation run: `pnpm run check:boundaries`, focused WebGPU app tests,
  Standard queue-phase Playwright spec, and final `pnpm run check` passed.
- Follow-up tasks added: `task-0641` through `task-0645`.

## task-0639 — Add browser pixel coverage for StandardMaterial queue phases

Completed: 2026-05-17

Summary:

- Added a browser example that renders overlapping StandardMaterial opaque,
  alpha-test, and transparent alpha-blend queue phases through `createWebGpuApp`.
- Added Playwright pixel coverage for the alpha-test cutout and transparent
  blend regions, plus JSON-safe status checks for queues, pipeline keys, and
  draw counts.
- Included the new example in `check:examples`.
- Important files: `examples/standard-queue-phases.html`,
  `examples/standard-queue-phases.js`,
  `test/e2e/standard-queue-phases.spec.ts`, `package.json`.
- Validation run: `pnpm exec playwright test
test/e2e/standard-queue-phases.spec.ts`, `pnpm run check:examples`,
  targeted WebGPU tests, and final `pnpm run check` passed.
- Follow-up tasks added: none directly; continued into `task-0640`.

## task-0638 — Consume StandardMaterial transparent alpha-blend queue items

Completed: 2026-05-17

Summary:

- Allowed the WebGPU app queue route to consume StandardMaterial transparent
  items when the material uses alpha blending without depth writes.
- Preserved opaque, alpha-test, then transparent order and changed transparent
  snapshot sorting so depth ordering wins before pipeline/material grouping.
- Added JSON-safe diagnostics for unsupported transparent material families and
  unsupported transparent blend presets.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `test/rendering/snapshot.test.ts`, `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused render snapshot/material queue/WebGPU app tests,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, and final
  `pnpm run check` passed.
- Follow-up tasks added: none directly; continued into `task-0639`.

## task-0637 — Consume StandardMaterial alpha-test queue items

Completed: 2026-05-17

Summary:

- Allowed the WebGPU app queue route to consume StandardMaterial `alpha-test`
  items after opaque items.
- Kept unsupported alpha-test material families diagnostic-only and
  JSON-safe without submitting partial frames.
- Added focused app tests for mixed opaque plus alpha-test StandardMaterial
  frames and pipeline/resource reuse across frames.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests,
  `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`, and final
  `pnpm run check` passed.
- Follow-up tasks added: none directly; continued into `task-0638`.

## task-0636 — Make built-in WebGPU pipelines render-state aware

Completed: 2026-05-17

Summary:

- Added shared WebGPU material render-state helpers that parse built-in material
  pipeline keys into depth, cull, and blend descriptor state.
- Updated StandardMaterial, UnlitMaterial, MatcapMaterial, and debug-normal
  descriptor plans/browser pipeline descriptors to derive cull mode, depth
  compare/write behavior, and alpha blend targets from render-state tokens.
- Added focused cache-key and browser-descriptor tests for opaque, mask, and
  alpha-blend StandardMaterial keys.
- Important files: `packages/webgpu/src/webgpu/material-render-state.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline.ts`,
  `packages/webgpu/src/webgpu/unlit-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`.
- Validation run: focused pipeline descriptor/resource tests,
  `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`, and final
  `pnpm run check` passed.
- Follow-up tasks added: none directly; continued into `task-0637`.

## task-0630 — Route single-family app frames through material queue

Completed: 2026-05-17

Summary:

- Routed supported single-family unlit, MatcapMaterial, and StandardMaterial
  app frames through the same material queue path used by mixed built-in
  frames, while preserving the optimized multi-unlit shared-mesh path.
- Same-resource multi-draw frames now exercise the queue route and continue to
  reuse stable prepared mesh/material resources.
- Updated app and browser example status tests for the queued resource shape so
  Matcap and StandardMaterial status still reports material/light bind-group
  readiness correctly.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`, `examples/matcap-app.js`,
  `examples/spinning-cube.js`, `test/e2e/app-diagnostics.spec.ts`.
- Validation run: focused WebGPU app tests, focused material/extraction/WebGPU
  tests, `pnpm run check`, targeted failing Playwright specs, and full
  `pnpm run test:e2e` passed.
- Follow-up tasks added: none directly; continue with `task-0636`.

## task-0631 — Plan alpha-test and transparent app queue consumption

Completed: 2026-05-17

Summary:

- Added a focused phase-consumption plan for moving alpha-test and transparent
  material queue items from app diagnostics to real WebGPU submission.
- The plan confirms the smallest safe route: render-state-aware built-in
  pipeline descriptors first, then StandardMaterial alpha-test, then
  StandardMaterial transparent alpha blend, followed by browser pixel coverage
  and an audit.
- Important files:
  `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: `pnpm run format:check` and `pnpm exec tsc --noEmit -p
tsconfig.test.json` passed before final stop-hook validation.
- Follow-up tasks added: `task-0636`, `task-0637`, `task-0638`, `task-0639`,
  and `task-0640`.

## task-0635 — Add StandardMaterial TEXCOORD_1 shader variants

Completed: 2026-05-17

Summary:

- Added StandardMaterial pipeline-key specialization for `uv1` texture
  variants and shader support for sampling authored texture bindings from
  `TEXCOORD_1`.
- Added extraction readiness checks so `texCoord: 1` requires mesh
  `TEXCOORD_1` metadata and reports JSON-safe missing-attribute diagnostics.
- Updated StandardMaterial browser pipeline descriptors/layout selection for
  UV1-only and tangent+UV1 primitive layouts.
- Important files: `packages/render/src/materials/pipeline-key.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline.ts`.
- Validation run: focused StandardMaterial material/extraction/WebGPU tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0631`.

## task-0634 — Diagnose unsupported StandardMaterial texture UV sets

Completed: 2026-05-17

Summary:

- Added StandardMaterial readiness diagnostics for unsupported texture UV sets,
  initially blocking unsupported bindings and then narrowing the unsupported
  case to `texCoord > 1` after `TEXCOORD_1` shader support landed.
- Diagnostics include material key, field, texture key when present, requested
  `texCoord`, and supported UV sets.
- Extraction surfaces unsupported UV-set diagnostics before WebGPU resource
  preparation.
- Important files:
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `test/materials/standard-texture-readiness.test.ts`,
  `test/rendering/extraction.test.ts`.
- Validation run: focused StandardMaterial readiness/extraction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0635`.

## task-0632 — Add StandardMaterial texture semantic/color-space diagnostics

Completed: 2026-05-17

Summary:

- Added StandardMaterial texture readiness diagnostics for semantic and
  color-space mismatches across base-color, emissive, metallic-roughness,
  normal, and occlusion texture bindings.
- Extraction now blocks invalid StandardMaterial texture metadata before
  WebGPU preparation and emits JSON-safe diagnostics with material key, texture
  key, field, expected values, and actual values.
- Important files:
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `test/materials/standard-texture-readiness.test.ts`.
- Validation run: focused StandardMaterial readiness/extraction tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0634`.

## task-0625 — Add generic prepared material resource contracts

Completed: 2026-05-17

Summary:

- Added renderer-independent prepared material resource descriptors for built-in
  material families, including pipeline key input, material/bind-group resource
  keys, texture dependencies, and dependency readiness.
- Updated render-asset preparation to pass the asset registry into adapters and
  prepare material descriptors instead of minimal metadata.
- Reused the shared material pipeline-key serializer for batch compatibility
  keys and prepared descriptors.
- Important files:
  `packages/render/src/materials/prepared-resource.ts`,
  `packages/render/src/assets/preparation.ts`,
  `packages/render/src/materials/pipeline-key.ts`,
  `docs/RENDER_ASSET_PREPARATION.md`,
  `test/materials/prepared-material-resource.test.ts`.
- Validation run: focused prepared-resource/render-asset tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up tasks added: none directly; continued into `task-0632`.

## task-0633 — Plan StandardMaterial UV-set and texture-transform handling

Completed: 2026-05-17

Summary:

- Added a focused plan for handling `MaterialTextureBinding.texCoord` and
  future texture transform metadata without letting GLB import silently sample
  the wrong UV coordinates.
- The plan recommends renderer-independent metadata/diagnostics first, then
  separate `TEXCOORD_1` shader variants, and only later transform uniform
  support.
- Important files:
  `docs/research/STANDARD_MATERIAL_UV_TEXTURE_TRANSFORM_PLAN_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: `pnpm run format:check`, `pnpm exec tsc --noEmit -p
tsconfig.test.json`, final `pnpm run check`, and `pnpm run test:e2e` passed.
- Follow-up tasks added: `task-0634` and `task-0635`.

## task-0627 — Audit StandardMaterial glTF PBR texture expectations

Completed: 2026-05-17

Summary:

- Audited Aperture's StandardMaterial base-color, metallic-roughness, normal,
  occlusion, and emissive texture behavior against glTF expectations from
  three.js, PlayCanvas, and Bevy reference implementations.
- Confirmed the current renderer now covers the main texture channels, while
  GLB material mapping should remain deferred until UV-set selection, texture
  transforms, sampler import policy, and texture semantic/color-space
  diagnostics are explicit.
- Important files:
  `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: `pnpm run check:boundaries`, focused StandardMaterial/WebGPU
  app tests, and full workspace validation listed in the latest handoff passed.
- Follow-up tasks added: `task-0632` and `task-0633`.

## task-0624 — Add StandardMaterial normal-map shader support

Completed: 2026-05-17

Summary:

- Added tangent-space StandardMaterial normal-map shader specialization,
  including normal texture/sampler binding metadata, normal-map variant keys,
  group-2 layout keys, tangent vertex-buffer metadata, and browser pipeline
  layout selection.
- Updated WebGPU app StandardMaterial texture preparation so normal maps create
  and reuse texture/sampler GPU resources.
- Promoted `normalTexture` from deferred proof-point metadata to supported
  StandardMaterial proof scope while keeping extraction tangent-readiness
  diagnostics as the renderer-independent gate.
- Added focused shader, pipeline, app, proof-point, dependency, and extraction
  tests covering ready tangent-space rendering metadata/resource reuse and
  blocked readiness paths.
- Important files: `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/materials/standard-proof-point.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused StandardMaterial/WebGPU app tests,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, and full workspace
  validation listed in the latest handoff passed.
- Follow-up tasks added: none directly; continued into `task-0627`.

## task-0629 — Add queue app routing unsupported-family diagnostics tests

Completed: 2026-05-17

Summary:

- Added app-level coverage for unsupported material queue families using a
  mixed unlit/DebugNormalMaterial frame.
- Added app-level coverage for unsupported non-opaque queue phases using a
  mixed opaque/alpha-test unlit frame.
- Verified both cases return JSON-safe diagnostics and do not submit WebGPU
  command buffers.
- Important files: `test/webgpu/webgpu-app.test.ts`,
  `packages/webgpu/src/webgpu/app.ts`.
- Validation run: `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
  passed.
- Follow-up tasks added: none directly; transparent/alpha-test consumption
  planning is captured in `task-0631`.

## task-0628 — Add reusable queue app routing scratch state

Completed: 2026-05-17

Summary:

- Added reusable queue-route scratch maps and arrays to `WebGpuAppFrameScratch`
  for source asset lookup, prepared resource keys, pipeline results, mesh
  resources, bind groups, and per-family frame resources.
- Updated queue-driven app routing to clear and reuse scratch state across
  frames instead of allocating fresh collector maps/arrays on the successful
  multi-resource path.
- Extended the mixed queue app test to render a second frame, verifying scratch
  reuse does not leak stale resource keys and still reuses pipelines,
  textures, and samplers.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
  passed.
- Follow-up tasks added: `task-0630` and `task-0631`.

## task-0626 — Audit queue-driven app routing

Completed: 2026-05-17

Summary:

- Audited the queue-driven WebGPU app routing added for `task-0621` against the
  North Star, architecture, decision log, package boundaries, and Bevy-style
  render phase queue/sort patterns.
- Confirmed mixed built-in app routing now uses one queue consumer instead of
  pairwise/three-family branches, keeps ECS authoritative, keeps WebGPU
  resources backend-owned, and emits JSON-safe diagnostics.
- Recorded follow-ups for reusable app-frame queue scratch, generic prepared
  material descriptors, and deferred transparent/alpha-test app routing.
- Important files:
  `docs/research/QUEUE_DRIVEN_APP_ROUTING_AUDIT_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: focused material queue/render-frame/app tests,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, `pnpm run build`,
  `pnpm run check:examples`, `pnpm run check:boundaries`, `pnpm run lint`, and
  `pnpm run format:check` passed. Full `pnpm run check` passed: 169 test files
  / 813 tests.
- Follow-up tasks added: `task-0628` and `task-0629`.

## task-0621 — Integrate opaque material queue app routing

Completed: 2026-05-17

Summary:

- Replaced the narrow mixed unlit/Matcap/StandardMaterial app routing branches
  with one opaque built-in material queue consumer in `createWebGpuApp.render()`.
- The route consumes snapshot-derived material queue items, prepares per-family
  WebGPU resources, resolves prepared mesh/material resource keys, and feeds
  the existing render-frame plan without moving GPU resources into
  renderer-independent packages.
- Added app coverage for a shared frame containing unlit, MatcapMaterial,
  scalar StandardMaterial, and textured StandardMaterial queue items.
- Important files:
  `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused material queue/render-frame/app tests,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, `pnpm run build`,
  `pnpm run check:examples`, `pnpm run check:boundaries`, `pnpm run lint`, and
  `pnpm run format:check` passed. Full `pnpm run check` passed: 169 test files
  / 813 tests.
- Follow-up tasks added: none directly; continued into `task-0626`.

## task-0623 — Add transparent material queue sorting

Completed: 2026-05-17

Summary:

- Added focused material-queue coverage proving phase ordering keeps opaque
  first, alpha-test second, and transparent last.
- Locked transparent ordering to back-to-front depth sorting while preserving
  input order for otherwise identical transparent sort keys.
- Confirmed the existing opaque grouping behavior from `task-0619` remains
  unchanged.
- Important files: `test/rendering/material-queue.test.ts`.
- Validation run: `pnpm exec vitest run test/rendering/material-queue.test.ts`
  and `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up task added: none.

## task-0622 — Audit material queue and PBR texture drift

Completed: 2026-05-17

Summary:

- Audited the new material-family queue contract and StandardMaterial
  emissive/occlusion texture path against the North Star, architecture,
  decision log, and Bevy/three.js/PlayCanvas reference patterns.
- Confirmed queue items remain snapshot-derived and JSON-safe, with no WebGPU
  handles, renderer-owned gameplay state, or hidden scene graph ownership.
- Confirmed StandardMaterial emissive/occlusion support stays in
  `@aperture-engine/webgpu`; renderer-independent packages expose only source
  handles, dependency data, and serializable diagnostics.
- Important files:
  `docs/research/MATERIAL_QUEUE_PBR_TEXTURE_AUDIT_2026_05_17.md`,
  `agent/BACKLOG.md`.
- Validation run: `pnpm run check:boundaries` passed; full `pnpm run check`
  passed after `task-0620`.
- Follow-up tasks added: `task-0623`, `task-0624`, `task-0625`, and
  `task-0626`.

## task-0620 — Render StandardMaterial emissive and occlusion textures

Completed: 2026-05-17

Summary:

- Promoted StandardMaterial emissive and occlusion textures from deferred proof
  point features to supported WebGPU-rendered features.
- Added shader generation, binding metadata, pipeline/cache-key layout
  specialization, app texture/sampler preparation, resource reuse tests, and
  blocked dependency diagnostics for emissive and occlusion textures.
- Updated the material showcase Standard cube to use base-color,
  metallic-roughness, occlusion, and emissive textures, giving the browser app
  path Playwright pixel coverage.
- Important files: `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/materials/standard-proof-point.ts`,
  `examples/materials-showcase.js`, `test/webgpu/webgpu-app.test.ts`,
  `test/e2e/materials-showcase.spec.ts`.
- Validation run: focused StandardMaterial/WebGPU app tests,
  `pnpm run check:examples`,
  `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`,
  `pnpm run build`, `pnpm run lint`, `pnpm run format:check`, and
  `pnpm run check` passed: 169 test files / 811 tests.
- Follow-up tasks added: none directly; continue with `task-0621`.

## task-0619 — Add a generic material-family render queue contract

Completed: 2026-05-17

Summary:

- Added a snapshot-level material queue contract in `@aperture-engine/render`
  that identifies material family, pipeline key, mesh/material source keys,
  prepared resource keys, phase, draw index, depth, and sort data without
  carrying WebGPU handles.
- Queue building consumes `RenderSnapshot.meshDraws` plus prepared
  resource-key resolvers and emits JSON-safe diagnostics for unknown material
  families and missing prepared resources.
- Added stable opaque sorting by pipeline, material resource, mesh resource,
  depth, stable ID, and draw index.
- Important files:
  `packages/render/src/rendering/material-queue.ts`,
  `packages/render/src/rendering/index.ts`,
  `test/rendering/material-queue.test.ts`.
- Validation run: focused material queue tests, `pnpm exec tsc --noEmit -p
tsconfig.test.json`, `pnpm run build`, `pnpm run lint`,
  `pnpm run format:check`, and `pnpm run check` passed.
- Follow-up tasks added: `task-0621`.

## task-0618 — Add StandardMaterial normal-map tangent diagnostics

Completed: 2026-05-17

Summary:

- Added renderer-independent StandardMaterial normal-map tangent readiness
  reporting with JSON helpers and diagnostics for authored normal maps on
  meshes without tangent data.
- Render extraction now blocks StandardMaterial normal-map draws that lack
  required tangents and emits JSON-safe render diagnostics.
- StandardMaterial pipeline planning records the normal-map specialization key
  while keeping actual normal-map rendering deferred.
- Important files:
  `packages/render/src/materials/standard-normal-map-readiness.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `test/materials/standard-normal-map-readiness.test.ts`,
  `test/rendering/extraction.test.ts`.
- Validation run: focused readiness/extraction/pipeline tests,
  `pnpm run build`, `pnpm exec tsc --noEmit -p tsconfig.test.json`, and
  `pnpm run check` passed: 168 test files / 800 tests.
- Follow-up task added: `task-0624`.

## task-0617 — Render StandardMaterial metallic-roughness textures

Completed: 2026-05-17

Summary:

- Added StandardMaterial metallic-roughness texture sampling using roughness
  from the green channel and metallic from the blue channel, multiplied by
  authored scalar factors.
- Added factor-only/base-color/metallic-roughness/base+metallic-roughness
  shader and pipeline specialization, group-2 binding/layout keys, app
  texture/sampler preparation, and dependency diagnostics.
- Updated the material showcase Standard cube and Playwright expectations for
  the metallic-roughness texture path.
- Important files: `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/materials/standard-proof-point.ts`,
  `examples/materials-showcase.js`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused StandardMaterial/WebGPU app tests,
  `pnpm run build`, `pnpm run check:examples`, `pnpm run lint`,
  `pnpm run format:check`,
  `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`, and
  `pnpm run check` passed: 167 test files / 795 tests.
- Follow-up task added: none; continued into `task-0618`.

## task-0616 — Implement GLB container parser diagnostics

Completed: 2026-05-16

Summary:

- Added a renderer-independent GLB 2.0 container parser in
  `@aperture-engine/render` that accepts `ArrayBuffer` or `Uint8Array` source
  data.
- Validates header magic/version/length, JSON-first chunk order, chunk header
  bounds, chunk byte ranges, empty JSON, UTF-8/JSON decoding, and non-object
  JSON roots without throwing on malformed user content.
- Returns plain source data only: parsed JSON object/text, optional BIN
  `Uint8Array`, chunk metadata, and JSON-safe diagnostics with stable codes,
  severity, offsets, lengths, and chunk type.
- Preserves unknown chunks as metadata and warning diagnostics without creating
  WebGPU resources, image decoders, ECS authoring commands, or scene/material
  mapping.
- Important files:
  `packages/render/src/assets/glb-container.ts`,
  `packages/render/src/assets/index.ts`,
  `test/assets/glb-container.test.ts`.
- Validation run: focused GLB/assets tests, `pnpm run build`,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, `pnpm run format:check`, and
  `pnpm run check` passed.
- Follow-up task added: none; continue with `task-0617`.

## task-0615 — Render StandardMaterial base-color textures

Completed: 2026-05-16

Summary:

- Added a base-color-textured StandardMaterial WGSL variant that samples the
  prepared texture/sampler and multiplies it by `baseColorFactor`.
- Specialized StandardMaterial pipeline descriptor selection so factor-only and
  base-color-textured variants use distinct shader variants, bind group layout
  keys, and pipeline cache keys.
- Routed StandardMaterial base-color texture/sampler preparation through the
  WebGPU app resource cache for single-family and mixed built-in material
  frames, including JSON-safe reuse counters and dependency diagnostics.
- Updated the material showcase so the browser StandardMaterial cube uses a
  real base-color texture, giving the path Playwright pixel coverage alongside
  app-level resource tests.
- Moved `baseColorTexture` from deferred to supported StandardMaterial proof
  point metadata while leaving metallic-roughness, normal maps, IBL, and shadows
  deferred.
- Important files:
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/materials/standard-proof-point.ts`,
  `examples/materials-showcase.js`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused StandardMaterial/WebGPU app tests,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, `pnpm run lint`,
  `pnpm run format:check`,
  `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`, and
  `pnpm run check` passed.
- Follow-up task added: none; continue with `task-0616`, then `task-0617`.

## task-0614 — Add DebugNormalMaterial WebGPU shader metadata contracts

Completed: 2026-05-16

Summary:

- Added DebugNormalMaterial WGSL metadata that declares view, world-transform,
  and material uniform bindings and visualizes world-space normals as RGB.
- Added a descriptor planner/cache-key contract for the debug-normal material
  family that uses renderer-independent batch/material pipeline keys and rejects
  unsupported topology, missing vertex attributes, unsupported families, and
  unsupported features with JSON-safe diagnostics.
- Added public WebGPU exports and pipeline-family selection metadata without
  creating frame resources, bind groups, or app-facade activation.
- Important files:
  `packages/webgpu/src/webgpu/debug-normal-shader.ts`,
  `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/material-pipeline-selection.ts`,
  `test/webgpu/debug-normal-shader.test.ts`,
  `test/webgpu/debug-normal-pipeline-descriptor.test.ts`.
- Validation run: focused DebugNormal shader/descriptor tests,
  `pnpm exec tsc --noEmit -p tsconfig.test.json`, and `pnpm run lint` passed.
- Follow-up task added: none.

## task-0613 — Add package-boundary import guard coverage

Completed: 2026-05-16

Summary:

- Added a dependency-free package-boundary guard script that scans headless
  package source and package manifests for forbidden WebGPU backend imports,
  package dependencies, browser WebGPU globals, and `navigator.gpu`.
- Wired the guard into `pnpm run check` through the new
  `pnpm run check:boundaries` script.
- Added focused Vitest coverage proving headless violations fail while
  `packages/webgpu` usage is allowed.
- Important files: `scripts/check-package-boundaries.mjs`, `package.json`,
  `test/tooling/package-boundary-guard.test.mjs`.
- Validation run: `pnpm run check:boundaries`,
  `pnpm exec vitest run test/tooling/package-boundary-guard.test.mjs`, and
  `pnpm run lint` passed.
- Follow-up task added: none.

## task-0612 — Audit post-showcase material route specialization

Completed: 2026-05-16

Summary:

- Audited the app-facade mixed material routing after the material showcase
  promotion and confirmed the current branches remain a safe narrow bridge.
- Verified package-boundary search, pipeline-scoped shared bind groups,
  material resource-key resolution, resource reuse reports, and app report JSON
  safety.
- Captured the drift risk that additional mixed-family branch shapes should be
  replaced by a generic material-family render queue after the next
  StandardMaterial PBR slices.
- Important files:
  `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`,
  `agent/BACKLOG.md`.
- Validation run: documentation/task-log update; `pnpm run format:check` should
  cover final formatting before stop.
- Follow-up tasks added: `task-0617`, `task-0618`, and `task-0619`.

## task-0611 — Plan the first renderer-independent GLB container slice

Completed: 2026-05-16

Summary:

- Planned a narrow GLB 2.0 container parser slice covering header validation,
  JSON/BIN chunk extraction, chunk bounds, JSON-safe diagnostics, and explicit
  non-goals.
- Kept GLB material mapping and viewer work deferred until StandardMaterial PBR
  and the generic material queue are stronger.
- Recorded local reference patterns from PlayCanvas, three.js, Bevy, and the
  existing Aperture asset-loader coverage note.
- Important files:
  `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`,
  `agent/BACKLOG.md`.
- Validation run: documentation planning only; `pnpm run format:check` should
  cover final formatting before stop.
- Follow-up task added: `task-0616`.

## task-0610 — Document app facade as the default example path

Completed: 2026-05-16

Summary:

- Updated README development/example guidance to identify `createWebGpuApp`,
  ECS-authored entities, typed assets, and systems as the preferred browser
  application path.
- Clarified that direct WebGPU helpers are backend/test surfaces, not the
  default user API.
- Updated architecture package-boundary text so WebGPU app orchestration belongs
  in `@aperture-engine/webgpu` while `@aperture-engine/core` remains
  headless-safe.
- Important files: `README.md`, `docs/ARCHITECTURE.md`.
- Validation run: `pnpm run format:check` and `pnpm run check:examples`
  passed.
- Follow-up task added: `task-0615`.

## task-0609 — Add DebugNormalMaterial source/preparation contracts

Completed: 2026-05-16

Summary:

- Added `createDebugNormalMaterialPreparationPlan()` for renderer-independent
  DebugNormalMaterial preparation metadata.
- The plan includes material key, label, material kind, render state, stable
  pipeline key input, and JSON-safe dependency readiness with no WebGPU/browser
  objects.
- Preparation rejects non-debug-normal materials and incompatible render states
  using the existing material validation rules.
- Important files:
  `packages/render/src/materials/debug-normal-preparation.ts`,
  `packages/render/src/materials/index.ts`,
  `test/materials/debug-normal-preparation.test.ts`.
- Validation run: focused DebugNormal/material tests and
  `pnpm exec tsc --noEmit -p tsconfig.test.json` passed.
- Follow-up task added: `task-0614`.

## task-0608 — Add StandardMaterial texture dependency app diagnostics

Completed: 2026-05-16

Summary:

- Added app-facade coverage proving StandardMaterial base-color texture/sampler
  source dependencies block mixed-material app rendering before command
  submission.
- Extended the app diagnostics browser example with a
  `standard-material-dependencies` scenario that publishes failed material kind,
  failed dependency fields, failed resource keys, and JSON-safe report data.
- Important files: `examples/app-diagnostics.js`,
  `test/e2e/app-diagnostics.spec.ts`, `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests, focused Playwright app diagnostics
  test, and `pnpm run check` passed.
- Follow-up task added: `task-0613`.

## task-0605 — Audit material showcase app-path promotion

Completed: 2026-05-16

Summary:

- Audited the promoted material showcase against the North Star, architecture
  package boundaries, built-in material contracts, and Bevy material/render-asset
  patterns.
- Confirmed the showcase now uses ECS-authored entities/components, typed source
  assets, and `createWebGpuApp`, with WebGPU resources remaining in
  `@aperture-engine/webgpu`.
- Tightened the Playwright material-region sampler to the app-facade cube
  positions after the promotion changed the CSS-space layout.
- Recorded the audit in
  `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`.
- Important files:
  `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`,
  `test/e2e/materials-showcase.spec.ts`.
- Validation run: focused app tests, focused browser diagnostics/materials
  showcase tests, `pnpm run check`, and `pnpm run test:e2e` passed.
- Follow-up tasks added: `task-0608`, `task-0609`, `task-0610`, `task-0611`,
  and `task-0612`.

## task-0583 — Promote material showcase onto built-in material paths

Completed: 2026-05-16

Summary:

- Replaced the direct WebGPU material showcase shader with an app-facade example
  that renders unlit, StandardMaterial, and MatcapMaterial cubes from
  ECS-authored mesh/material entities.
- The example now creates typed mesh/material/texture/sampler source assets,
  registers `SpinSystem`, uses ECS cameras/lights, and publishes JSON-safe app
  render reports.
- Playwright verifies all three material families, draw counts, animation, and
  visible non-clear material regions.
- Important files: `examples/materials-showcase.html`,
  `examples/materials-showcase.js`, `test/e2e/materials-showcase.spec.ts`.
- Validation run: `pnpm run check`, focused Playwright material showcase test,
  and full `pnpm run test:e2e` passed.

## task-0607 — Render all three built-in material families in one app frame

Completed: 2026-05-16

Summary:

- Added a three-family app-facade route that renders one unlit,
  one StandardMaterial, and one MatcapMaterial draw in one shared-mesh frame.
- Shared view/world bind groups are now scoped by pipeline key for mixed-family
  frames so render-frame resource lookup does not reuse the wrong pipeline's
  bind group.
- Tests cover successful three-family rendering, missing Standard lights, and
  resource reuse across frames.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests, `pnpm run check`, focused
  Playwright diagnostics/materials tests, and full `pnpm run test:e2e` passed.

## task-0606 — Audit mixed material app routing

Completed: 2026-05-16

Summary:

- Audited mixed built-in app material routing after StandardMaterial,
  MatcapMaterial, and textured UnlitMaterial routes were added.
- Confirmed source assets remain ECS/render-owned inputs while GPU resources,
  pipelines, bind groups, and submission stay in `@aperture-engine/webgpu`.
- Captured the pipeline-scoped shared bind group correction and follow-up
  showcase audit direction.
- Important files:
  `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`,
  `packages/webgpu/src/webgpu/app.ts`.
- Validation run: focused WebGPU app tests, focused Playwright app diagnostics
  test, and `pnpm run check` passed.

## task-0604 — Support textured unlit in mixed unlit/Matcap frames

Completed: 2026-05-16

Summary:

- Relaxed the mixed unlit/Matcap route so textured unlit materials can
  participate when their texture and sampler source dependencies are ready.
- Browser diagnostics now cover blocked textured unlit dependencies and a
  successful mixed textured-unlit/Matcap frame.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `examples/app-diagnostics.js`, `test/e2e/app-diagnostics.spec.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests, focused Playwright app diagnostics
  test, `pnpm run check`, and full `pnpm run test:e2e` passed.

## task-0603 — Add app diagnostics coverage for mixed material-family rendering

Completed: 2026-05-16

Summary:

- Updated the app diagnostics browser example from unsupported mixed-family
  routing to material dependency readiness failures and success paths.
- Playwright verifies JSON-safe diagnostics for blocked mixed material
  dependencies and verifies successful mixed material pixels.
- Important files: `examples/app-diagnostics.js`,
  `test/e2e/app-diagnostics.spec.ts`.
- Validation run: focused Playwright app diagnostics test, `pnpm run check`,
  and full `pnpm run test:e2e` passed.

## task-0602 — Render StandardMaterial in mixed app resource sets

Completed: 2026-05-16

Summary:

- Added mixed StandardMaterial app resource routes for Standard plus unlit and
  Standard plus Matcap shared-mesh frames.
- StandardMaterial frames now fail clearly without required light resources and
  reuse prepared mesh/material resources across frames.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests, `pnpm run check`, focused
  Playwright diagnostics/materials tests, and full `pnpm run test:e2e` passed.

## task-0599 — Audit multi-resource app rendering boundaries

Completed: 2026-05-16

Summary:

- Audited the app-facade multi-resource path after mixed unlit/Matcap support.
- Confirmed `simulation`, `render`, and `runtime` still do not own WebGPU or
  browser resources, and app routing keeps GPU preparation in `packages/webgpu`.
- Recorded the audit in
  `docs/research/MULTI_RESOURCE_APP_RENDERING_BOUNDARY_AUDIT_2026_05_16.md`.
- Important files:
  `docs/research/MULTI_RESOURCE_APP_RENDERING_BOUNDARY_AUDIT_2026_05_16.md`,
  `agent/BACKLOG.md`, `agent/HANDOFF.md`.
- Validation run: boundary search, `pnpm run check`, and
  `pnpm run test:e2e` passed.

## task-0598 — Render mixed unlit and Matcap app resource sets

Completed: 2026-05-16

Summary:

- Added a narrow mixed unlit/Matcap app-facade rendering path for two material
  resource sets sharing a mesh.
- Pipeline routing now provides both unlit and Matcap pipeline resources to the
  render frame planner, while group-2 material bind groups resolve by material
  resource key per draw.
- Material dependency diagnostics now block whole-frame app submission when any
  extracted entity reports an unresolved material texture/sampler dependency,
  preventing partial mixed-frame submits.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests, `pnpm run check`, and
  `pnpm run test:e2e` passed.

## task-0601 — Align architecture docs for texture source data

Completed: 2026-05-16

Summary:

- Updated `docs/ARCHITECTURE.md` to state that texture source assets may carry
  uploadable texel bytes and row-layout metadata as renderer-independent source
  data.
- Clarified that WebGPU turns that payload into `GPUQueue.writeTexture` work and
  prepared texture views.
- Important files: `docs/ARCHITECTURE.md`.
- Validation run: `pnpm run check` passed.

## task-0600 — Add app texture upload diagnostics to reports

Completed: 2026-05-16

Summary:

- Added app-facade tests proving invalid texture upload row layout and too-small
  texture source data surface as JSON-safe render diagnostics.
- Verified failed texture uploads do not submit a frame.
- Important files: `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app tests, `pnpm run check`, and focused Playwright
  app diagnostics test passed.

## task-0597 — Render multiple same-family unlit app resource sets

Completed: 2026-05-16

Summary:

- Added app-facade rendering for multiple unlit material resource sets sharing a
  mesh in one frame.
- Added draw resource-set resolution for multiple material resource keys and
  kept mixed-family frames on `webGpuApp.additionalDrawResourceUnsupported`.
- Updated the app diagnostics example so its unsupported scenario uses mixed
  material families instead of two unlit materials.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`, `examples/app-diagnostics.js`.
- Validation run: focused app tests, focused Playwright app diagnostics test,
  and `pnpm run check` passed.

## task-0596 — Plan app multi-resource draw sets

Completed: 2026-05-16

Summary:

- Added `createWebGpuAppDrawResourceSetPlan()` to group snapshot mesh draws by
  source mesh/material keys.
- Updated unsupported additional-resource diagnostics to use the resource-set
  plan and include `resourceSetIndex`.
- Tests cover same-set and mixed-set planning while keeping unsupported mixed
  families diagnostic-only.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app tests and `pnpm run check` passed.

## task-0595 — Add source texture upload data for Matcap app pixels

Completed: 2026-05-16

Summary:

- Added optional renderer-independent `TextureAsset.sourceData` with bytes and
  row layout metadata.
- `createWebGpuApp.render()` now passes ready texture source data to the
  WebGPU-owned texture resource upload path.
- The Matcap app example now supplies deterministic 2x2 texture bytes and uses
  `copy-dst` texture usage for upload.
- Important files: `packages/render/src/materials/types.ts`,
  `packages/webgpu/src/webgpu/app.ts`, `examples/matcap-app.js`,
  `test/assets/typed-collections.test.ts`, `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused typed asset/app tests, `pnpm run check`, and focused
  Playwright Matcap app test passed.

## task-0594 — Audit material-family activation boundaries

Completed: 2026-05-16

Summary:

- Audited the Matcap app activation path, source/prepared resource ownership,
  package dependency direction, app diagnostics, and browser status JSON.
- Confirmed `simulation` and `render` remain free of WebGPU/browser-owned state.
- Recorded the audit and the source texture upload follow-up/resolution.
- Important files:
  `docs/research/MATCAP_APP_ACTIVATION_BOUNDARY_AUDIT_2026_05_16.md`.
- Validation run: boundary search, `pnpm run check`, and focused Playwright
  Matcap app test passed.

## task-0593 — Publish app report JSON helper output in examples

Completed: 2026-05-16

Summary:

- The new Matcap app example publishes
  `webGpuAppRenderReportToJsonValue()` output in browser status.
- Playwright verifies the successful status remains JSON-safe and includes
  report counts, diagnostics, and resource reuse.
- Important files: `examples/matcap-app.js`,
  `test/e2e/matcap-app.spec.ts`.
- Validation run: `pnpm run check` and focused Playwright Matcap app test
  passed.

## task-0592 — Add browser Matcap app example coverage

Completed: 2026-05-16

Summary:

- Added `examples/matcap-app.html` and `examples/matcap-app.js` using
  ECS-authored mesh/material/texture/sampler assets and `createWebGpuApp`.
- Added nav links and example syntax coverage.
- Added Playwright coverage for non-background Matcap pixels, animation,
  resource reuse, and JSON-safe app report status.
- Important files: `examples/matcap-app.html`,
  `examples/matcap-app.js`, `test/e2e/matcap-app.spec.ts`, `package.json`.
- Validation run: `pnpm run check`, focused Playwright Matcap app test, and
  in-app browser verification passed.

## task-0591 — Wire single-material Matcap app-facade rendering

Completed: 2026-05-16

Summary:

- `createWebGpuApp.render()` now supports a narrow single-source-resource
  MatcapMaterial path using the existing Matcap pipeline, frame-resource, and
  texture/sampler prepared-resource helpers.
- Matcap app texture/sampler resources use the same source-handle/version cache
  pattern as unlit textures.
- Mixed mesh/material source-resource frames still fail with
  `webGpuApp.additionalDrawResourceUnsupported`.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app/Matcap tests, `pnpm run check`, and
  focused Playwright Matcap app test passed.

## task-0590 — Add MatcapMaterial frame GPU resource assembly

Completed: 2026-05-16

Summary:

- Added Matcap frame GPU resource assembly for mesh buffers, view uniforms,
  world transforms, Matcap material buffer, shared view/world bind groups, and
  Matcap material texture/sampler bind group.
- Missing mesh/view/world/material inputs and missing prepared texture/sampler
  resources produce resource-key diagnostics without returning partial complete
  resources.
- No app-facade activation, browser example, or material showcase route was
  introduced.
- Important files: `packages/webgpu/src/webgpu/matcap-frame-resources.ts`,
  `test/webgpu/matcap-frame-resources.test.ts`.
- Validation run: focused Matcap frame-resource tests, `pnpm exec tsc --noEmit
-p tsconfig.test.json`, and `pnpm run check` passed.

## task-0589 — Add MatcapMaterial render pipeline resource creation

Completed: 2026-05-16

Summary:

- Added browser-facing Matcap render pipeline descriptor/resource creation from
  the Matcap shader metadata and pipeline descriptor plan.
- The helper creates the WGSL shader module and render pipeline through an
  injected WebGPU-like device, returning cache keys and JSON-safe diagnostics.
- No app-facade activation or render pass path was introduced.
- Important files:
  `packages/webgpu/src/webgpu/matcap-pipeline.ts`,
  `test/webgpu/matcap-pipeline.test.ts`.
- Validation run: focused Matcap WebGPU tests, `pnpm exec tsc --noEmit -p
tsconfig.test.json`, and `pnpm run check` passed.

## task-0588 — Add MatcapMaterial bind group resource creation

Completed: 2026-05-16

Summary:

- Added Matcap group-2 layout metadata, descriptor planning, stable bind group
  keys, and bind group resource creation for material buffer, texture view, and
  sampler bindings.
- Missing material/texture/sampler resources report resource-key diagnostics
  without creating fallback GPU state.
- No app-facade activation or render pass path was introduced.
- Important files:
  `packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`,
  `packages/webgpu/src/webgpu/matcap-bind-group.ts`,
  `test/webgpu/matcap-bind-group.test.ts`.
- Validation run: focused Matcap WebGPU tests, `pnpm exec tsc --noEmit -p
tsconfig.test.json`, and `pnpm run check` passed.

## task-0587 — Add MatcapMaterial GPU material-buffer preparation

Completed: 2026-05-16

Summary:

- Added Matcap material uniform packing, texture/sampler dependency key
  extraction, buffer descriptor planning, GPU buffer creation, and resource
  summary participation.
- The material buffer contains the shader's `baseColorFactor` layout and keeps
  texture/sampler dependencies as stable resource keys only.
- No app-facade activation or render pass path was introduced.
- Important files:
  `packages/webgpu/src/webgpu/matcap-material-buffer.ts`,
  `packages/webgpu/src/webgpu/matcap-material-buffer-resource.ts`,
  `packages/webgpu/src/webgpu/resource-summary.ts`,
  `test/webgpu/matcap-material-buffer.test.ts`.
- Validation run: focused Matcap WebGPU tests, `pnpm exec tsc --noEmit -p
tsconfig.test.json`, and `pnpm run check` passed.

## task-0586 — Audit app diagnostics and Matcap WebGPU boundaries

Completed: 2026-05-16

Summary:

- Audited app texture/sampler prepared-resource caching, app report JSON,
  browser diagnostic scenarios, and Matcap WebGPU material/pipeline contracts.
- Confirmed WebGPU resources remain derived renderer-owned state and
  `simulation`/`render` still expose source handles and metadata, not browser or
  GPU objects.
- Added next Matcap frame/app/example follow-up tasks.
- Important files:
  `docs/research/APP_DIAGNOSTICS_AND_MATCAP_METADATA_AUDIT_2026_05_16.md`,
  `agent/BACKLOG.md`, `agent/COMPLETED.md`, `agent/HANDOFF.md`.
- Validation run: audit covered code that passed `pnpm run check`.

## task-0582 — Add browser-facing app diagnostics coverage for mixed materials

Completed: 2026-05-16

Summary:

- Added `examples/app-diagnostics.html` and
  `examples/app-diagnostics.js` to publish browser-visible JSON-safe app
  diagnostics for mixed source resources and blocked material dependencies.
- Added Playwright coverage for
  `webGpuApp.additionalDrawResourceUnsupported` and
  `webGpuApp.materialDependenciesNotReady`.
- Important files: `examples/app-diagnostics.html`,
  `examples/app-diagnostics.js`, `test/e2e/app-diagnostics.spec.ts`,
  `package.json`.
- Validation run: focused Playwright app diagnostics test and `pnpm run check`
  passed.

## task-0581 — Add MatcapMaterial WebGPU shader metadata contracts

Completed: 2026-05-16

Summary:

- Added Matcap WGSL shader metadata, validation, material pipeline-family
  selection, and descriptor planning for the `matcap` material family.
- The metadata declares view, world transform, material, texture, and sampler
  bindings but did not activate rendering by itself.
- Important files: `packages/webgpu/src/webgpu/matcap-shader.ts`,
  `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/material-pipeline-selection.ts`,
  `test/webgpu/matcap-shader.test.ts`,
  `test/webgpu/matcap-pipeline-descriptor.test.ts`,
  `test/webgpu/material-pipeline-selection.test.ts`.
- Validation run: focused Matcap WebGPU tests and `pnpm run check` passed.

## task-0580 — Add WebGpuAppRenderReport JSON serialization helper

Completed: 2026-05-16

Summary:

- Added `WebGpuAppRenderReportJsonValue`,
  `webGpuAppRenderReportToJsonValue()`, and
  `webGpuAppRenderReportToJson()` for JSON-safe app render summaries.
- The serializer includes counts, diagnostics, resource reuse, and optional
  material dependency readiness while omitting snapshots and raw WebGPU/browser
  objects.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app tests and `pnpm run check` passed.

## task-0585 — Add texture/sampler resource reuse diagnostics for app reports

Completed: 2026-05-16

Summary:

- Extended app resource reuse reports with texture and sampler created/reused
  counters.
- Reuse diagnostics are count/key based and avoid exposing raw GPU handles.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app tests and `pnpm run check` passed.

## task-0584 — Add app-facade texture/sampler prepared-resource cache

Completed: 2026-05-16

Summary:

- Added app-facade preparation and caching for ready unlit base-color texture
  and sampler source dependencies, keyed by source handle and asset version.
- The app frame cache now includes versioned texture/sampler keys before reusing
  bind groups, preventing stale resource reuse after source dependency changes.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `packages/webgpu/src/webgpu/texture-resources.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app/texture tests and `pnpm run check` passed.

## task-0577 — Add texture/sampler resource reuse diagnostics for app reports

Completed: 2026-05-16

Summary:

- Checked whether texture/sampler resource reuse diagnostics can be reported by
  the app facade today.
- Found the app facade does not yet prepare or cache texture/sampler GPU
  resources from source material dependencies, even though lower-level unlit
  frame resources can bind prepared texture/sampler resources.
- Recorded the blocker in
  `docs/research/APP_TEXTURE_SAMPLER_REUSE_BLOCKER_2026_05_16.md`.
- Added enabling `task-0584` for the app-facade prepared-resource cache and
  follow-up `task-0585` for the actual reuse counters.
- Important files:
  `docs/research/APP_TEXTURE_SAMPLER_REUSE_BLOCKER_2026_05_16.md`,
  `agent/BACKLOG.md`, `agent/COMPLETED.md`, `agent/HANDOFF.md`.
- Validation run: documentation/backlog blocker resolution only; no code
  validation needed beyond the earlier successful `pnpm run check` and browser
  E2E validation.

## task-0579 — Audit material showcase, view uniforms, and app diagnostics

Completed: 2026-05-16

Summary:

- Audited the direct WebGPU material showcase, camera-position view uniform
  layout, built-in unlit/standard shader alignment, app material dependency
  diagnostics, mixed source-resource draw diagnostics, and MatcapMaterial
  preparation metadata.
- Confirmed render/source contracts remain GPU-free outside
  `@aperture-engine/webgpu`, app diagnostics are JSON-safe, and the showcase's
  local shader is a temporary demo path rather than a replacement for built-in
  material shaders.
- Added follow-up `task-0583` to promote the showcase onto built-in
  material/app-facade paths once multi-material rendering and matcap WebGPU
  support exist.
- Important files:
  `docs/research/MATERIAL_SHOWCASE_BOUNDARY_AUDIT_2026_05_16.md`,
  `agent/BACKLOG.md`, `agent/COMPLETED.md`, `agent/HANDOFF.md`.
- Validation run: audit-only docs/backlog update; earlier `pnpm run check`,
  focused Playwright, and full `pnpm run test:e2e` passed for the audited code.

## task-0578 — Add material readiness report JSON serialization helper

Completed: 2026-05-16

Summary:

- Added `MaterialAssetDependencyReadinessReportJsonValue` plus JSON value/string
  helpers for material dependency readiness reports.
- Updated app material dependency diagnostics to embed the serialized JSON-safe
  readiness value instead of the raw report type.
- Important files:
  `packages/render/src/materials/dependency-readiness.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `test/materials/material-dependency-readiness.test.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused material/app tests, `pnpm run check`, focused
  Playwright showcase/spinning-cube tests, and `pnpm run test:e2e` passed.

## task-0576 — Diagnose app facade single-draw resource limitation

Completed: 2026-05-16

Summary:

- Added an early app-facade diagnostic for multi-draw frames that require
  additional source mesh/material resource sets beyond the first draw.
- Same mesh/material multi-draw frames continue rendering through the current
  app resource set.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app tests, `pnpm run check`, focused Playwright
  showcase/spinning-cube tests, and `pnpm run test:e2e` passed.

## task-0575 — Add MatcapMaterial render-preparation metadata plan

Completed: 2026-05-16

Summary:

- Added a renderer-independent MatcapMaterial preparation metadata plan with
  material key, texture/sampler dependency keys, render state, pipeline key, and
  dependency readiness JSON.
- Blocked matcap dependencies report the existing material dependency readiness
  diagnostics.
- No WGSL, WebGPU resource creation, bind groups, pipelines, or active matcap
  rendering path was introduced.
- Important files: `packages/render/src/materials/matcap-preparation.ts`,
  `packages/render/src/materials/index.ts`,
  `test/materials/matcap-preparation.test.ts`.
- Validation run: focused matcap/material/app tests, `pnpm run check`, focused
  Playwright showcase/spinning-cube tests, and `pnpm run test:e2e` passed.

## task-0574 — Surface material asset dependency readiness in app render failures

Completed: 2026-05-16

Summary:

- `WebGpuAppRenderReport` now includes JSON-safe material dependency readiness
  diagnostics when app rendering is blocked by missing/loading/failed material
  texture or sampler source dependencies.
- App render failures preserve material field names, dependency handle keys, and
  readiness statuses without exposing raw WebGPU handles.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app/material tests, `pnpm run check`, focused
  Playwright showcase/spinning-cube tests, and `pnpm run test:e2e` passed.

## task-0573 — Audit post-cleanup diagnostics and material-source boundaries

Completed: 2026-05-16

Summary:

- Audited app scratch/cache/reuse diagnostics, MatcapMaterial source contracts,
  and material dependency readiness reports after the post-proof-point cleanup
  sequence.
- Verified WebGPU-owned resource caches remain derived renderer state, render
  material readiness remains source-asset diagnostics, and MatcapMaterial does
  not imply active shader support.
- Recorded findings in
  `docs/research/POST_CLEANUP_DIAGNOSTICS_AUDIT_2026_05_16.md`.
- Important files:
  `docs/research/POST_CLEANUP_DIAGNOSTICS_AUDIT_2026_05_16.md`,
  `agent/BACKLOG.md`, `agent/COMPLETED.md`, `agent/HANDOFF.md`.
- Validation run: `pnpm run check` and `pnpm run test:e2e` passed.

## task-0567 — Audit post-proof-point resource reuse and shader metadata boundaries

Completed: 2026-05-16

Summary:

- Audited package boundaries, app resource cache ownership, render-frame phase
  boundaries, scratch-backed view packing, and light shader JSON/raw-handle
  boundaries after the proof-point follow-ups.
- Recorded findings in
  `docs/research/POST_PROOF_POINT_BOUNDARY_AUDIT_2026_05_16.md`.
- Corrected stale README text that still described the project as
  identity-only and the spinning cube as textured unlit.
- Important files:
  `docs/research/POST_PROOF_POINT_BOUNDARY_AUDIT_2026_05_16.md`,
  `README.md`, `agent/BACKLOG.md`, `agent/COMPLETED.md`,
  `agent/HANDOFF.md`.
- Validation run: `pnpm run check`; preceding spinning-cube Playwright route
  passed.

## task-0568 — Add WebGPU app frame scratch object for packing and planning

Completed: 2026-05-16

Summary:

- Added a reusable app-frame scratch object owned by `createWebGpuApp`.
- The app facade now uses scratch-backed view-uniform packing, transform
  packing, render-world package planning, draw command descriptors, draw-list
  planning, render-pass resource resolution, and render-pass command planning.
- Existing public `app.render()` and `app.stepAndRender()` APIs are unchanged.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused app tests, test typecheck, `pnpm run check`, and the
  spinning-cube Playwright route passed.

## task-0569 — Add scratch-backed app resource binding planner

Completed: 2026-05-16

Summary:

- Added `createInjectedRenderFrameSnapshotResourceBindingPlanScratch()` and
  `writeInjectedRenderFrameSnapshotResourceBindings()`.
- Render-frame planning now uses the writer, reusing duplicate-id tracking,
  binding records, update records, diagnostics, and the plan shell.
- Kept the allocation-friendly planner for tests and one-shot diagnostics.
- Important files:
  `packages/webgpu/src/webgpu/renderer-frame-summary.ts`,
  `packages/webgpu/src/webgpu/render-frame-plan.ts`,
  `test/webgpu/render-frame-snapshot-binding-planner.test.ts`.
- Validation run: focused planner/app/frame-plan tests, test typecheck,
  `pnpm run check`, and the spinning-cube Playwright route passed.

## task-0570 — Add MatcapMaterial source asset contract and validation

Completed: 2026-05-16

Summary:

- Added renderer-independent `MatcapMaterialAsset` with label, base color
  factor, required matcap texture/sampler binding, unsupported-feature list,
  and render state.
- Added `createMatcapMaterialAsset()`, material validation coverage, pipeline
  feature participation, and `assets.materials.matcap`.
- No WebGPU shader, pipeline, bind group, or active rendering path was added.
- Important files: `packages/render/src/materials/*`,
  `packages/render/src/assets/collections.ts`,
  `test/materials/materials.test.ts`,
  `test/assets/typed-collections.test.ts`.
- Validation run: focused material/collection tests, test typecheck,
  `pnpm run check`, and the spinning-cube Playwright route passed.

## task-0571 — Add app-facade resource reuse diagnostics

Completed: 2026-05-16

Summary:

- Added JSON-safe `WebGpuAppResourceReuseReport` counters to
  `WebGpuAppRenderReport`.
- Reports now count pipeline hits/misses, mesh/material buffer creation and
  reuse, bind group creation and reuse, light buffer creation and reuse, and
  dynamic buffer writes.
- The spinning cube example status includes the reuse report, and the E2E test
  verifies it remains JSON-safe.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `examples/spinning-cube.js`, `test/webgpu/webgpu-app.test.ts`,
  `test/e2e/spinning-cube.spec.ts`.
- Validation run: focused app tests, test typecheck, `pnpm run check`, and the
  spinning-cube Playwright route passed.

## task-0572 — Add material dependency readiness report for app rendering

Completed: 2026-05-16

Summary:

- Added a renderer-independent source-asset dependency readiness report for
  material texture/sampler slots.
- The report accepts a material handle plus `AssetRegistry`, distinguishes
  missing, registered, loading, failed, and ready dependencies, and omits
  WebGPU resources.
- Covered unlit, standard, and matcap material dependency states in tests.
- Important files:
  `packages/render/src/materials/dependency-readiness.ts`,
  `packages/render/src/materials/index.ts`,
  `test/materials/material-dependency-readiness.test.ts`,
  `test/materials/materials.test.ts`.
- Validation run: focused material readiness tests and `pnpm run check` passed.

## task-0566 — Reuse WebGPU app prepared resources across frames

Completed: 2026-05-16

Summary:

- Added a private `createWebGpuApp` resource cache that reuses unlit/standard
  pipelines, bind group layouts, mesh buffers, material buffers, bind groups,
  and standard light bind groups on unchanged frames.
- Dynamic view, world-transform, and light buffers are refreshed with
  `queue.writeBuffer` while preserving renderer-owned GPU resources.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: focused WebGPU app tests, `pnpm run check`, and the spinning
  cube Playwright route passed.
- Follow-up tasks added: `task-0567`, `task-0568`, `task-0569`,
  `task-0570`, `task-0571`.

## task-0542 — Split render frame planning into extract, prepare, queue, sort phases

Completed: 2026-05-16

Summary:

- Added render-frame phase descriptors for extract, asset-change collection,
  prepare, queue, sort, and submit.
- Split queue record writing so callers can write unsorted queue records and
  run an explicit sort phase while preserving existing sorted convenience
  behavior.
- Important files: `packages/render/src/rendering/render-frame-phases.ts`,
  `packages/render/src/rendering/render-queue.ts`,
  `test/rendering/render-frame-phases.test.ts`.
- Validation run: focused render queue/phase tests and `pnpm run check` passed.

## task-0557 — Add view-uniform pack scratch writer

Completed: 2026-05-16

Summary:

- Added `PackedSnapshotViewUniformsScratch` and
  `writePackedSnapshotViewUniforms` to reuse duplicate-view tracking, view
  records, diagnostics, result shell, and typed backing storage.
- Kept `packSnapshotViewUniforms` as the allocation-friendly convenience helper.
- Updated WebGPU view-uniform buffer descriptors to respect scratch-backed
  logical `floatCount`.
- Important files: `packages/render/src/rendering/view-pack.ts`,
  `packages/webgpu/src/webgpu/view-uniform-buffer.ts`,
  `test/rendering/view-pack.test.ts`,
  `test/webgpu/view-uniform-buffer.test.ts`.
- Validation run: focused view-pack/view-uniform tests and `pnpm run check`
  passed.

## task-0534 — Add light shader WGSL data contract

Completed: 2026-05-16

Summary:

- Added `LIGHT_SHADER_WGSL_DECLARATION` and
  `createLightShaderWgslDeclarationContract()` for packed light float/metadata
  storage bindings.
- The declaration records group/binding numbers, read-only storage access,
  packing strides, and field order.
- Important files: `packages/webgpu/src/webgpu/light-shader-metadata.ts`,
  `test/webgpu/light-shader-metadata.test.ts`.
- Validation run: focused light/standard shader tests and `pnpm run check`
  passed.

## task-0535 — Add light shader declaration JSON helper

Completed: 2026-05-16

Summary:

- Added JSON-safe serialization helpers for the light shader WGSL declaration
  contract.
- The helper serializes metadata, declaration text, and strides without shader
  modules, pipelines, buffers, or bind groups.
- Important files: `packages/webgpu/src/webgpu/light-shader-metadata.ts`,
  `test/webgpu/light-shader-metadata.test.ts`.
- Validation run: focused light shader metadata tests and `pnpm run check`
  passed.

## task-0536 — Add unlit shader metadata variant with light bindings

Completed: 2026-05-16

Summary:

- Added `UNLIT_MESH_WITH_LIGHT_BINDINGS_SHADER` as a metadata-only unlit
  variant that preserves unlit WGSL source while recording group-3 light buffer
  bindings.
- Important files: `packages/webgpu/src/webgpu/unlit-shader.ts`,
  `test/webgpu/unlit-shader.test.ts`.
- Validation run: focused unlit/light shader metadata tests and `pnpm run check`
  passed.

## task-0537 — Document light shader WGSL contract boundary

Completed: 2026-05-16

Summary:

- Added `docs/LIGHT_SHADER_WGSL_CONTRACT.md` and linked it from architecture.
- Documented that the declaration and JSON helpers are inspection metadata, do
  not expose raw GPU handles, and do not activate new lighting paths.
- Important files: `docs/LIGHT_SHADER_WGSL_CONTRACT.md`,
  `docs/ARCHITECTURE.md`.
- Validation run: `pnpm run check` passed.

## task-0538 — Run consolidated light shader contract validation

Completed: 2026-05-16

Summary:

- Ran the consolidated validation after the light shader contract and metadata
  variant slices.
- Fixed a browser-only `GPUQueue.writeBuffer` invocation issue found by the
  spinning cube Playwright route.
- Validation run: `pnpm run check` passed; `pnpm exec playwright test
test/e2e/spinning-cube.spec.ts` passed.

## task-0540 — Add typed asset collection API over AssetRegistry

Completed: 2026-05-16

Summary:

- Added generic `TypedAssetCollection` in simulation and render-facing mesh /
  material collection helpers via `createRenderAssetCollections`.
- Material typed collections derive texture/sampler dependencies into the
  underlying `AssetRegistry`.
- Important files: `packages/simulation/src/assets/collections.ts`,
  `packages/render/src/assets/collections.ts`,
  `test/assets/typed-collections.test.ts`.
- Validation run: `pnpm run check` passed.

## task-0541 — Define renderer-independent render asset preparation contract

Completed: 2026-05-16

Summary:

- Added `RenderAssetAdapter`, `PreparedRenderAssetStore`, prepare/unload
  bookkeeping, mesh/material metadata stores, and metadata adapters outside the
  WebGPU backend.
- Documented the Bevy mapping in `docs/RENDER_ASSET_PREPARATION.md`.
- Important files: `packages/render/src/assets/preparation.ts`,
  `docs/RENDER_ASSET_PREPARATION.md`,
  `test/assets/render-asset-preparation.test.ts`.
- Validation run: `pnpm run check` passed.

## task-0543 — Implement minimal user-facing ECS spawn/component API

Completed: 2026-05-16

Summary:

- Added `spawn` to simulation/extraction app facades, component initializer
  helpers for transform, mesh, material, camera, light, visibility/layer, and
  metadata, plus a small `Spin` component/system for proof-point examples.
- Important files: `packages/runtime/src/index.ts`,
  `packages/simulation/src/ecs/index.ts`, `test/runtime/runtime.test.ts`.
- Validation run: `pnpm run check` passed.

## task-0558 — Add WebGPU app facade over existing unlit render path

Completed: 2026-05-16

Summary:

- Added `createWebGpuApp` in the WebGPU package. It initializes WebGPU, exposes
  world/assets/spawn/step/extract/render methods, and renders the existing
  unlit path from extracted snapshots/render-world data.
- The facade keeps WebGPU package imports limited to simulation/render and does
  not import runtime or core.
- Important files: `packages/webgpu/src/webgpu/app.ts`,
  `test/webgpu/webgpu-app.test.ts`.
- Validation run: `pnpm run check` passed.

## task-0544 — Audit Bevy bridge and package-boundary drift

Completed: 2026-05-16

Summary:

- Verified package dependency direction, ECS/render ownership, stable
  mesh/material handle authoring, and the lack of scene-graph or WebGL drift
  after the bridge/facade work.
- Recorded the audit in
  `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`.
- Validation run: `pnpm run check` passed.

## task-0559 — Add StandardMaterial proof-point render contract

Completed: 2026-05-16

Summary:

- Added explicit StandardMaterial proof-point scope and validation that
  distinguishes deferred texture/IBL/shadow features from invalid scalar inputs.
- Added extraction coverage proving standard material packets carry a distinct
  pipeline key without raw WebGPU handles in render package data.
- Important files: `packages/render/src/materials/standard-proof-point.ts`,
  `test/materials/standard-proof-point.test.ts`.
- Validation run: `pnpm run check` passed.

## task-0560 — Prepare StandardMaterial GPU data and bind layout

Completed: 2026-05-16

Summary:

- Added WebGPU StandardMaterial uniform packing for scalar proof-point fields,
  feature flags, texture dependency keys, and 80-byte layout metadata.
- Added standard material buffer descriptor/GPU resource creation, material
  group bind descriptor/layout metadata, and resource summary support for
  standard material buffers.
- Important files: `packages/webgpu/src/webgpu/standard-material-buffer.ts`,
  `packages/webgpu/src/webgpu/standard-bind-group.ts`,
  `packages/webgpu/src/webgpu/standard-bind-group-layout.ts`,
  `packages/webgpu/src/webgpu/standard-material-buffer-resource.ts`.
- Validation run: targeted StandardMaterial WebGPU tests and `pnpm run check`
  passed.

## task-0175 — Stabilize browser WebGPU pixel verification baseline

Completed: 2026-05-16

Summary:

- Added Playwright canvas presentation sampling that detects when screenshots expose the canvas CSS background instead of WebGPU-presented pixels.
- Updated clear and triangle pixel specs to skip with an explicit presentation diagnostic in that unsupported capture case.
- Added status/presentation attachments so skipped or failed pixel tests retain JSON-safe diagnostics.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass; e2e pixel specs skip under the CSS-background presentation diagnostic in this environment.

## task-0176 — Add multi-entity browser status smoke test

Completed: 2026-05-16

Summary:

- Added Playwright status-only coverage for `/examples/multi-entity.html`.
- The test asserts two extracted mesh draws, two applied bindings, two ready render-world draws, two draw packages, and two submitted draw calls.
- The test attaches the published status JSON for blank-canvas and resource-binding diagnosis.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0172 — Document browser E2E rendering workflow

Completed: 2026-05-16

Summary:

- Added `docs/BROWSER_E2E_RENDERING.md`.
- Documented the ECS authoring to render snapshot to render-world resources to WebGPU submission workflow.
- Documented local browser commands, WebGPU unsupported skips, CSS-background screenshot skips, status-only tests, and pixel tests.
- Linked the new doc from `README.md`.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0174 — Add static example server tests

Completed: 2026-05-16

Summary:

- Refactored `scripts/serve-examples.mjs` so path resolution, MIME mapping, and request handling can be imported without starting a listener.
- Added no-TCP Vitest coverage for root/example/dist/node_modules path resolution, traversal denial, MIME types, request handling, redirects, HEAD, 404, 400, and 405 behavior.
- Hardened traversal handling so paths such as `/examples/../package.json` cannot escape the selected allowed static root.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0177 — Share browser E2E status helpers

Completed: 2026-05-16

Summary:

- Added shared Playwright helpers for waiting on `window.__APERTURE_EXAMPLE_STATUS__`, attaching status JSON, and skipping explicit unsupported WebGPU statuses.
- Updated clear, triangle, and multi-entity specs to use the shared helpers.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0178 — Add no-TCP example server request tests

Completed: 2026-05-16

Summary:

- Exported `createExamplesRequestHandler` from the example server.
- Added fake request/response tests for GET, HEAD, `/examples` redirect, unsupported methods, and traversal rejection without binding a TCP port.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0179 — Harden malformed static URL handling

Completed: 2026-05-16

Summary:

- Added server handling for malformed percent-encoded static paths.
- The request handler now returns `400 Bad request` for malformed URL encodings instead of allowing a `URIError` rejection.
- Added no-TCP regression coverage.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0180 — Serve `/examples/` as the harness index

Completed: 2026-05-16

Summary:

- Updated static path resolution so `/examples/` serves `examples/index.html`.
- Preserved the `/examples` to `/examples/` redirect.
- Added resolver and request-handler tests for the directory URL.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0181 — Add examples server port parser tests

Completed: 2026-05-16

Summary:

- Added tests for `parsePort` valid values and invalid CLI/env inputs.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0182 — Lint scripts and JS server tests

Completed: 2026-05-16

Summary:

- Extended ESLint flat config to cover `scripts/**/*.mjs` and `test/**/*.mjs`.
- Verified the example server script and JS server tests pass linting.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0183 — Add browser harness syntax checks to `npm run check`

Completed: 2026-05-16

Summary:

- Added `npm run check:examples` for `node --check` validation of the example server and browser example modules.
- Included `check:examples` in the standard `npm run check` pipeline.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0184 — Document the standard check command

Completed: 2026-05-16

Summary:

- Updated `README.md` so local validation starts with `npm run check`.
- Noted that `npm run check` now includes TypeScript checks, browser harness syntax checks, lint, format checking, and Vitest.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0185 — Lint browser example modules

Completed: 2026-05-16

Summary:

- Extended ESLint flat config to cover `examples/**/*.js` with browser globals.
- Verified the browser example modules pass linting.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0186 — Attach canvas presentation samples in pixel specs

Completed: 2026-05-16

Summary:

- Clear and triangle pixel specs now attach the sampled canvas presentation diagnostic before skipping or asserting pixels.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0187 — Document browser syntax validation hook

Completed: 2026-05-16

Summary:

- Updated `docs/BROWSER_E2E_RENDERING.md` to document `npm run check:examples` and its inclusion in `npm run check`.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0188 — Add static server edge-case coverage

Completed: 2026-05-16

Summary:

- Expanded no-TCP server coverage for query strings, allowed `node_modules` ESM paths, missing files, and additional path resolution cases.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass.

## task-0171 — Add Playwright multi-entity scene verification

Completed: 2026-05-16

Summary:

- Added multi-entity pixel verification that proves red and blue regions when WebGPU-presented pixels are capturable.
- The test reuses the CSS-background presentation diagnostic and skips in the current headless environment when screenshots do not expose presented WebGPU pixels.
- Multi-entity status verification remains a separate passing smoke test.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass; e2e reports three status passes and three expected pixel-capture skips in this environment.

## task-0189 — Add clear and triangle status-only e2e smoke tests

Completed: 2026-05-16

Summary:

- Added status-only Playwright smoke tests for the root clear example and ECS triangle example.
- Status coverage now passes independently from pixel-capture availability.
- Validation run: `npm run build`, `npm run check`, and `npm run test:e2e` pass; e2e reports three passed status tests and three skipped pixel tests in this environment.

## task-0192 — Define shared browser example status types

Completed: 2026-05-16

Summary:

- Added shared test-side status types for clear, single-draw, and multi-entity browser examples.
- Updated Playwright status and pixel specs to import those types instead of duplicating local interfaces.
- Validation run: `npm run typecheck:test` and `npm run test:e2e` pass.

## task-0194 — Document browser status payloads and failure phases

Completed: 2026-05-16

Summary:

- Expanded `docs/BROWSER_E2E_RENDERING.md` with common status fields and example-specific payload sections.
- Documented which fields are ECS-derived, render-world-derived, and WebGPU submission-derived.
- Reiterated that status payloads are JSON-safe diagnostics, not source-of-truth state.
- Validation run: `npm run format:check` passes.

## task-0195 — Add import-map dependency server coverage

Completed: 2026-05-16

Summary:

- Expanded no-TCP server tests for the concrete `elics`, `wgpu-matrix`, and `@preact/signals-core` import-map dependency paths.
- Asserted JavaScript MIME types and browser isolation headers for dependency responses.
- Added raw request-path traversal rejection before `new URL()` normalization can rewrite encoded dot segments.
- Validation run: targeted server tests pass.

## task-0193 — Add browser harness navigation smoke coverage

Completed: 2026-05-16

Summary:

- Added navigation links between the clear, triangle, and multi-entity browser example pages.
- Added static tests that verify each example page includes the expected local hrefs.
- Validation run: targeted navigation test, `npm run check:examples`, and `npm run lint` pass.

## task-0196 — Add static HTML structure tests for browser examples

Completed: 2026-05-16

Summary:

- Expanded static example-page tests to assert required canvas, status, JSON, import-map, stylesheet, and module-script wiring.
- Covered root, triangle, and multi-entity example pages without opening a server.
- Validation run: targeted navigation/structure test passes.

## task-0201 — Add browser example HTML title and label consistency tests

Completed: 2026-05-16

Summary:

- Expanded static example-page tests to assert each page's title, canvas label, and visible example name.
- Covered root, triangle, and multi-entity pages without opening a server.
- Validation run: targeted navigation/structure test passes.

## task-0190 — Prototype WebGPU current-texture readback for clear pixels

Completed: 2026-05-16

Summary:

- Added `clearWebGpuCanvasWithReadback` and canvas `textureUsage` initialization support.
- The clear browser example now opts into `COPY_SRC` when available and publishes JSON-safe current-texture readback pixels or explicit diagnostics.
- Added injected tests for success, missing usage flags, map failures, mapped-range failures, RGBA/BGRA decoding, and invalid origins.
- Validation run: `npm run check` and full `npm run test:e2e -- --reporter=line` pass.

## task-0191 — Use GPU readback in triangle and multi-entity pixel tests

Completed: 2026-05-16

Summary:

- Added shared browser readback helpers for examples.
- Triangle and multi-entity examples now publish optional current-texture readback samples after render pass commands and before command submission.
- Pixel specs prefer readback samples and retain screenshot fallback diagnostics when readback is unavailable.
- Validation run: `npm run check` and full `npm run test:e2e -- --reporter=line` pass.

## task-0202 — Add browser example import-map parsing helper

Completed: 2026-05-16

Summary:

- Added `test/examples/import-map.mjs`.
- Static example tests now parse import-map JSON and assert exact imports for root, triangle, and multi-entity pages.
- Parser tests cover missing, duplicate, invalid JSON, and invalid `imports` cases.
- Validation run: `npm run check` passes.

## task-0197 — Add unsupported WebGPU status smoke coverage

Completed: 2026-05-16

Summary:

- Added a Playwright smoke test that removes `navigator.gpu` before example startup.
- The clear example now has coverage for publishing `navigator-gpu-unavailable` with `ok: false`.
- Shared browser override helpers keep controlled environment overrides reusable.
- Validation run: full `npm run test:e2e -- --reporter=line` passes.

## task-0198 — Add example server invalid-port CLI smoke test

Completed: 2026-05-16

Summary:

- Added a child-process server test for invalid CLI port input.
- The test verifies the process exits non-zero and prints the actionable invalid-port message without binding a TCP port.
- Validation run: `npm run check` passes.

## task-0199 — Add import-map consistency checks

Completed: 2026-05-16

Summary:

- Added explicit consistency checks across parsed root, triangle, and multi-entity import maps.
- The tests assert `elics`, `wgpu-matrix`, and `@preact/signals-core` remain mapped to the same server paths.
- Validation run: `npm run check` passes.

## task-0200 — Add browser e2e artifact guide

Completed: 2026-05-16

Summary:

- Expanded `docs/BROWSER_E2E_RENDERING.md` with artifact locations, status attachments, presentation samples, screenshots, videos, traces, and trace-opening commands.
- Documented readback payload shape and reiterated that raw WebGPU handles must not be serialized.
- Validation run: `npm run check` passes.

## task-0203 — Add readback buffer-usage diagnostic smoke

Completed: 2026-05-16

Summary:

- Added Playwright coverage for missing `GPUBufferUsage`.
- The clear example still reaches `ok: true` while publishing `readback.reason: "buffer-usage-unavailable"`.
- Validation run: full `npm run test:e2e -- --reporter=line` passes.

## task-0204 — Add static coverage for the browser readback helper module

Completed: 2026-05-16

Summary:

- Static tests now assert example modules import `examples/webgpu-readback.js`.
- Server tests now verify the shared helper module is served with JavaScript MIME type.
- `npm run check:examples` syntax-checks the helper module.
- Validation run: `npm run check` passes.

## task-0205 — Share controlled browser override helpers

Completed: 2026-05-16

Summary:

- Added `test/e2e/browser-overrides.ts` for reusable `navigator.gpu`, `GPUBufferUsage`, and `GPUMapMode` overrides.
- Updated readback diagnostic and unsupported-WebGPU e2e specs to use the shared helpers.
- Validation run: full `npm run test:e2e -- --reporter=line` passes.

## task-0206 — Document readback status payload fields

Completed: 2026-05-16

Summary:

- Updated the browser e2e guide's status payload section with clear, triangle, and multi-entity `readback` fields.
- Clarified that readback data is copied JSON-safe pixel bytes, not raw GPU state.
- Validation run: `npm run check` passes.

## task-0207 — Add browser readback helper unit coverage

Completed: 2026-05-16

Summary:

- Added Vitest coverage for `examples/webgpu-readback.js`.
- Tests cover COPY_SRC initialization fallback, sample copy planning, JSON-safe mapped pixels, missing buffer usage, and readback failure marking.
- Validation run: `npm run check` passes.

## task-0208 — Add status-only readback shape assertions

Completed: 2026-05-16

Summary:

- Added shared e2e assertions for clear and scene readback status shapes.
- Status-only clear, triangle, and multi-entity tests now verify readback payloads or explicit readback diagnostics.
- Validation run: full `npm run test:e2e -- --reporter=line` passes.

## task-0209 — Add import-map parser edge coverage

Completed: 2026-05-16

Summary:

- Expanded parser tests for duplicate import maps and invalid `imports` payloads.
- Preserved parse error causes for invalid JSON.
- Validation run: `npm run check` passes.

## task-0210 — Add clear-readback helper edge coverage

Completed: 2026-05-16

Summary:

- Added TypeScript helper tests for RGBA byte decoding and invalid readback origins.
- Verified invalid origins keep the clear submission while reporting `texture-size-invalid`.
- Validation run: `npm run check` passes.

## task-0211 — Add readback map-mode diagnostic smoke

Completed: 2026-05-16

Summary:

- Added Playwright coverage for missing `GPUMapMode`.
- The clear example still reaches `ok: true` while publishing `readback.reason: "map-mode-unavailable"`.
- Validation run: full `npm run test:e2e -- --reporter=line` passes.

## task-0216 — Add readback diagnostics for command-copy failure modes

Completed: 2026-05-16

Summary:

- Added helper tests for missing and throwing `copyTextureToBuffer` paths.
- Verified the TypeScript clear-readback helper preserves clear submission while reporting `copy-texture-to-buffer-unavailable`.
- Verified the browser example helper reports the same diagnostic without production behavior changes.
- Validation run: targeted readback helper tests pass.

## task-0217 — Add browser artifact guide links from failure output docs

Completed: 2026-05-16

Summary:

- Updated `README.md` to make the browser E2E artifact guide discoverable.
- The link text now mentions Playwright artifacts, readback diagnostics, screenshots, videos, and traces.
- Validation run: `npm run format:check` passes.

## task-0163 — Add browser example harness

Completed: 2026-05-15

Summary:

- Added `examples/` browser harness files that import the built package from `dist`.
- Added `scripts/serve-examples.mjs`, a Node-built-in static server for `examples/`, `dist/`, and local ESM dependency paths.
- Added `examples:build` and `examples:serve` npm scripts plus README run instructions.
- Validation run: `npm run build`, `npm run lint`, `npm run format:check`, `node --check scripts/serve-examples.mjs`, and `node --check examples/main.js` pass.
- Follow-up tasks added: none directly.

## task-0164 — Add browser WebGPU clear smoke example

Completed: 2026-05-15

Summary:

- Updated the browser harness to initialize WebGPU against a canvas and clear to a distinctive color through `initializeWebGpu` and `clearWebGpuCanvas`.
- Exposes JSON-safe status on `window.__APERTURE_EXAMPLE_STATUS__`, including unsupported WebGPU reasons from existing initialization diagnostics.
- Validation run: covered by full `npm run check`, `npm run build`, and JS syntax checks.
- Follow-up tasks added: none directly.

## task-0165 — Add Playwright browser smoke verification

Completed: 2026-05-15

Summary:

- Added Playwright web-server config and the clear smoke E2E spec.
- Added a PNG screenshot sampler to verify clear pixels without adding dependencies.
- Added `vitest.config.ts` so Vitest excludes Playwright specs from `npm test`.
- Validation run: full non-browser validation passes; `npm run test:e2e` could not run in this sandbox because local server binding fails with `listen EPERM: operation not permitted 127.0.0.1:4173`.
- Follow-up tasks added: `task-0174` for non-listening static server tests.

## task-0166 — Create real unlit WebGPU pipeline bridge

Completed: 2026-05-15

Summary:

- Added `src/webgpu/unlit-pipeline.ts` to create `UNLIT_MESH_WGSL` shader modules and browser-valid unlit render pipeline descriptors with explicit primitive interleaved vertex layouts.
- Added injected-device tests for shader module creation, pipeline descriptor shape, pipeline creation, and missing pipeline support diagnostics.
- Validation run: targeted unlit pipeline tests pass and full `npm run check` / `npm run build` pass.
- Follow-up tasks added: none directly.

## task-0167 — Upload simple mesh and frame GPU resources

Completed: 2026-05-15

Summary:

- Added world-transform storage buffer descriptors/resources.
- Added actual-buffer unlit bind group creation using `{ buffer }` resources while preserving placeholder resource-key bind group planning.
- Added `createUnlitFrameGpuResources` for one mesh, packed views, packed transforms, one unlit material, and unlit bind groups.
- Added tests for missing buffers, successful resource creation, and stable resource keys.
- Validation run: focused WebGPU resource tests pass and full `npm run check` / `npm run build` pass.
- Follow-up tasks added: `task-0173` for a multi-material unlit resource helper.

## task-0168 — Render ECS-extracted triangle scene in browser

Completed: 2026-05-15

Summary:

- Added `examples/triangle.html` and `examples/triangle.js`.
- The example authors camera and mesh entities in ECS, extracts a `RenderSnapshot`, applies it to `RenderWorld`, plans bindings, uploads unlit GPU resources, creates a real unlit pipeline, plans draw commands, and submits a WebGPU render pass.
- The example exposes JSON-safe frame status for extraction, binding, render-world readiness, draw planning, commands, and submission counts.
- Validation run: JS syntax, full `npm run check`, and `npm run build` pass; browser execution could not be verified in this sandbox due local listener `EPERM`.
- Follow-up tasks added: none directly.

## task-0169 — Add Playwright triangle scene pixel verification

Completed: 2026-05-15

Summary:

- Added `test/e2e/ecs-triangle.spec.ts` to verify triangle frame status counts and non-background canvas pixels.
- Shared the PNG screenshot sampler across clear and triangle E2E tests.
- Failure assertions include serialized page status to help explain blank canvas, missing resources, or unsupported WebGPU.
- Validation run: `npm run typecheck:test`, `npm run lint`, `npm run format:check`, full `npm run check`, and `npm run build` pass; `npm run test:e2e` is blocked by sandbox local server `EPERM`.
- Follow-up tasks added: none directly.

## task-0170 — Render multi-entity simple scene in browser

Completed: 2026-05-16

Summary:

- Added `examples/multi-entity.html` and `examples/multi-entity.js`.
- The example authors two ECS mesh entities sharing one mesh with distinct world transforms and unlit materials, extracts two draw packets, applies them to `RenderWorld`, uploads GPU resources, plans two draw packages/commands, and publishes JSON-safe frame status.
- Updated draw command planning so packed transform offsets map to `firstInstance`, allowing the unlit shader to select the correct world transform per draw.
- Fixed root browser harness asset URLs and made clear/triangle/multi examples wait for `queue.onSubmittedWorkDone()` when available before publishing ready status.
- Validation run: `npm run check`, `npm run build`, and JS syntax checks pass. `npm run test:e2e` reaches the pages but fails because screenshots still sample the canvas CSS background rather than WebGPU-presented pixels; follow-up `task-0175` added.

## task-0173 — Add multi-material unlit resource helper

Completed: 2026-05-16

Summary:

- Added `createMultiMaterialUnlitFrameGpuResources` for one shared mesh/view/world-transform resource set plus one material buffer and group-2 bind group per unlit material.
- Preserved stable resource-key ordering: shared group 0/1 bind groups first, then material group-2 bind groups in input material order.
- Added tests for two materials, missing material data, and deterministic bind group ordering.
- Fixed the WebGPU buffer upload boundary to pass underlying buffers with byte offsets and pad unaligned initial data writes to 4-byte WebGPU alignment.
- Validation run: `npm run check` and `npm run build` pass; `npm run test:e2e` still fails on pixel presentation baseline and is tracked by `task-0175`.

## task-0001 — Initialize TypeScript package

Completed: 2026-05-15

Summary:

- Added a minimal ESM TypeScript package foundation for Aperture.
- Created `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `src/index.ts`, `test/index.test.ts`, `README.md`, `.gitignore`, and `.prettierignore`.
- Added build, test, lint, format, and format-check scripts.
- Exported placeholder project identity metadata only; no ECS or renderer implementation was started.
- Validation run: `npm install`, `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog already has enough concrete ECS foundation tasks.

## task-0002 — Add repository documentation layout

Completed: 2026-05-15

Summary:

- Verified the required docs and agent files already exist: `AGENTS.md`, `docs/NORTH_STAR.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `agent/BACKLOG.md`, `agent/HANDOFF.md`, and `agent/STATUS.json`.
- Left the existing docs and agent layout intact except for normal end-of-run updates to backlog, completed, handoff, and status files.
- Validation run: covered by the same setup validation from `task-0001`.
- Follow-up tasks added: none.

## task-0003 — Implement entity allocator

Completed: 2026-05-15

Summary:

- Added `Entity`, `EntityAllocator`, `EntityAllocatorStats`, and `entitiesEqual` as the first ECS core primitive.
- Implemented stable numeric entity IDs, generation counters, destroy/reuse behavior, stale reference detection, and allocator stats.
- Exported the entity allocator API from the public entrypoint.
- Added Vitest coverage for create, destroy, ID reuse, stale/malformed references, and handle comparison.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0016 — Adopt EliCS as the ECS foundation

Completed: 2026-05-15

Summary:

- Verified the latest stable `elics` npm version as `3.4.2` with `npm view elics version`.
- Added `elics` as a runtime dependency.
- Replaced the public custom `EntityAllocator` export with a small EliCS-backed ECS entrypoint: `createWorld`, `defineComponent`, `EcsType`, and typed ECS aliases.
- Added Vitest coverage for world creation, entity lifecycle, component registration, add/get/remove/has behavior, stale entity references resolving to `null`, and destroyed entity mutation behavior as supported by EliCS.
- Updated `docs/DECISIONS.md` to reflect the completed EliCS adoption.
- Validation run: `npm run build`, targeted `npm test -- test/ecs/world.test.ts`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0017 — Complete transform and spatial primitive coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md` with source-cited coverage for three.js `Object3D` and spatial primitives, Babylon.js `TransformNode`/culling primitives, PlayCanvas `GraphNode`/shape primitives, `wgpu-matrix`, and EliCS vector storage.
- Confirmed the accepted `wgpu-matrix` direction and specified the MVP wrapper surface for vectors, quaternions, matrices, projections, TRS composition, bounds, rays, planes, and frustums.
- Mapped `LocalTransform`, `Parent`, `WorldTransform`, `HierarchyIndex`, `Ray`, `Aabb`, `BoundingSphere`, `Plane`, and `Frustum` into Aperture's ECS-first model.
- Decided that `WorldTransform.matrix` should be represented in EliCS as four `Vec4` column fields (`col0` through `col3`) rather than an object-valued matrix field.
- Updated `docs/MVP_3D_CONCEPTS.md` to point at the detailed transform/spatial coverage and record the four-column `WorldTransform` storage direction.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0018 — Complete mesh, geometry, and primitive builder coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/MESH_GEOMETRY_COVERAGE.md` with source-cited coverage for three.js `BufferGeometry`/`BufferAttribute`, geometry builders, `Mesh`, `Line`, `Points`, `InstancedMesh`, `BatchedMesh`, `LOD`, and `SkinnedMesh`; Babylon.js `Geometry`, `VertexData`, `Mesh`, `SubMesh`, `MeshBuilder`, builder files, instances/thin instances, LOD, morph targets, and skeletons; and PlayCanvas `Mesh`, `MeshInstance`, `Model`, primitive geometry, render component, batching, skin, and morph files.
- Proposed an Aperture mesh asset schema covering vertex streams, attribute semantics, index formats, submeshes/material slots, primitive topology, local bounds, morph placeholders, skin placeholders, and instancing compatibility keys.
- Classified primitive builders into MVP, soon, and later buckets and specified the ECS binding plan for `MeshHandle`, `MeshRenderer`, material slots, bounds, and render extraction.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the mesh/builder/extraction design direction.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0019 — Complete material, texture, sampler, and render-state coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md` with source-cited coverage for three.js material/texture/render-state files, Babylon.js material/PBR/texture/WebGPU paths, and PlayCanvas material/standard/lit/shader/texture/graphics state files.
- Proposed an Aperture MVP material schema covering `UnlitMaterialAsset`, glTF-style `MetallicRoughnessMaterialAsset`, `DebugNormalMaterialAsset`, texture descriptors, sampler descriptors, alpha/cull/depth/blend defaults, pipeline-key inputs, and structured validation diagnostics.
- Explicitly deferred physical material extensions, shader graph/chunk/plugin systems, arbitrary GLSL, advanced transparency, render-target/video/procedural textures, arrays/3D textures, stencil workflows, and non-MVP material families.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record material pipeline-key and diagnostics requirements.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0020 — Complete camera, view, layer, and render target coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md` with source-cited coverage for three.js camera classes, layers, render targets, and common/WebGPU render context paths; Babylon.js camera/render target/rendering group/layer/post-process paths; and PlayCanvas camera component, layer composition, render action, render target, render pass, and WebGPU target files.
- Proposed an Aperture MVP camera/view schema covering `Camera`, perspective and orthographic projection data, normalized viewport/scissor, clear state, layer masks, priority ordering, `RenderTargetHandle`, `RenderTargetAsset`, and extracted `ViewPacket` data.
- Defined camera ordering as all enabled cameras sorted by priority and stable entity id, while allowing a future primary/active camera resource for API convenience.
- Explicitly deferred camera controls, stereo/XR/cube cameras, post effects, custom projections, advanced camera stacks, and MRT/cube/array/3D render targets.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record camera extraction, render-target, diagnostics, and ordering requirements.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0021 — Complete lighting, environment, and shadow coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md` with source-cited coverage for three.js light/shadow/environment files, Babylon.js light/shadow/clustered/environment files, and PlayCanvas light component, clustered lighting, shadow renderer, skybox, and environment files.
- Proposed an Aperture MVP lighting schema covering ambient, directional, point, and spot lights; linear color/intensity/range/cone fields; layer masks; environment lighting handles; shadow caster/receiver settings; and future shadow request data.
- Defined flat `LightPacket`, `EnvironmentPacket`, and `ShadowRequestPacket` extraction shapes, plus structured diagnostics for missing transforms, invalid light fields, zero masks, unsupported shadows, and missing environment handles.
- Classified lighting and shadow capabilities into MVP, soon, and later buckets and included future implementation acceptance tests.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record light/environment/shadow extraction boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0022 — Complete asset, loader, scene import, and handle coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md` with source-cited coverage for three.js loading manager, core loaders, `GLTFLoader`, `KTX2Loader`, `DRACOLoader`, and texture loaders; Babylon.js scene loader, asset container, glTF loader/validation/material adapters/compression paths; and PlayCanvas asset registry, handlers, GLB parsers, material parsers, texture compression paths, and scene/template handlers.
- Proposed an Aperture asset model covering typed handles, registry status lifecycle, mesh/material/texture/sampler/scene/prefab/animation asset kinds, GLB/glTF MVP subset, import reports, ECS authoring commands, missing/failed asset diagnostics, and agent-readable manifests.
- Defined explicit MVP exclusions for glTF 1.0, Draco/Meshopt compression, KTX/KTX2/Basis/WebP/AVIF texture paths, sparse accessors, non-triangle primitives, advanced glTF extensions, and non-glTF formats.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the asset/import/manifest boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0023 — Complete animation, skinning, morph, and playback coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/ANIMATION_SKINNING_MORPH_COVERAGE.md` with source-cited coverage for three.js animation clips/tracks/mixer/action/property binding/skeleton/skinned mesh/morph paths, Babylon.js animation/runtime/group/bones/skeleton/IK/morph/baked vertex animation paths, and PlayCanvas anim evaluator/controller/component/handler/skeleton/skin/morph paths.
- Proposed an Aperture animation design covering `AnimationClipAsset`, transform and morph tracks, `AnimationPlayer`, `SkinAsset`, `SkinnedMeshBinding`, `MorphTargetSetAsset`, `MorphWeights`, `SkinPalettePacket`, and `MorphWeightsPacket`.
- Defined that transform animation writes ECS `LocalTransform`, while skin palettes and morph weights are derived extraction data consumed by the renderer without making the renderer authoritative.
- Classified simple transform playback and skin/morph extraction as soon, with state graphs, blend trees, layered masks, IK, root motion, baked vertex animation, GPU morph texture packing, and retargeting deferred.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the animation/pose extraction boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass after formatting the new doc.
- Follow-up tasks added: none; backlog still has more than five ready tasks.

## task-0024 — Complete interaction, picking, input, collision, and physics-boundary coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md` with source-cited coverage for three.js raycasting/layers/object raycast hooks/spatial math, Babylon.js picking/bounds/input/collision/physics/XR boundaries, and PlayCanvas shape helpers/picker IDs/input/collision/rigid-body/XR files.
- Proposed Aperture interaction schemas for `Ray`, `Aabb`, `BoundingSphere`, `Pickable`, `PickQuery`, `PickHit`, `PickReport`, `Collider`, `RigidBody`, and frame-local input events.
- Defined MVP, soon, and later interaction buckets, structured diagnostics, future XR controller compatibility, and implementation acceptance tests.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record interaction, picking, collider, rigid-body, input, and XR boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass after formatting the new doc.
- Follow-up tasks added: none; continuing with task-0025.

## task-0025 — Complete render extraction, render world, diagnostics, and WebGPU boundary coverage

Completed: 2026-05-15

Summary:

- Added `docs/research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md` with source-cited coverage for three.js render lists/render objects/WebGPU backend/resource caches, Babylon.js rendering groups/frame graph/WebGPU engine/pipeline and bind-group caches, and PlayCanvas layers/render actions/frame graph/WebGPU renderer resources.
- Proposed Aperture extraction schemas for `RenderSnapshot`, `ViewPacket`, `MeshDrawPacket`, light/environment/shadow/bounds packets, skip diagnostics, reports, sort keys, batching keys, and renderer resource lifecycle.
- Defined `RenderWorld` as a renderer-owned GPU cache derived from snapshots and asset registries, not an owner of ECS/game state.
- Added worker-thread compatibility notes and future implementation acceptance tests for packet serialization, sorting, diagnostics, and GPU resource ownership.
- Updated `docs/MVP_3D_CONCEPTS.md` to link the focused coverage doc and record the render snapshot, render-world, diagnostics, sorting, and report boundaries.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; continuing with task-0026.

## task-0026 — Synthesize MVP feature contract and rewrite implementation backlog

Completed: 2026-05-15

Summary:

- Read the completed concept coverage set for tasks 0017-0025 and used it to finalize the MVP implementation contract in `docs/MVP_3D_CONCEPTS.md`.
- Added required MVP concepts, explicitly deferred concepts, ECS component/resource list, asset/material/render packet list, validation/diagnostics list, and proof examples.
- Rewrote `agent/BACKLOG.md` from research-gate tasks into ordered implementation slices `task-0027` through `task-0036`.
- Marked the pre-gate custom-ECS-shaped tasks `task-0004` through `task-0015` as superseded or rewritten.
- Recommended `task-0027 — Add Aperture math module foundation` as the first implementation task after the planning gate.
- Validation run: `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: ready implementation tasks `task-0027` through `task-0036`.

## task-0027 — Add Aperture math module foundation

Completed: 2026-05-15

Summary:

- Added `wgpu-matrix` as a declared runtime dependency and implemented an Aperture-owned array-first math module with vectors, quaternions, matrices, colors, rays, AABBs, spheres, planes, frustums, TRS/projection/matrix/bounds/ray helpers.
- Exported the math API from the public entrypoint.
- Added focused tests for WebGPU projection depth, TRS composition, matrix inverse/multiply, transformed bounds, and ray intersections.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item; later backlog refill added tasks `task-0037` through `task-0041`.

## task-0028 — Define transform and metadata ECS components

Completed: 2026-05-15

Summary:

- Added EliCS-backed `LocalTransform`, `Parent`, `WorldTransform`, `Enabled`, `Name`, and `DebugMetadata` components.
- Stored `WorldTransform` as four `Vec4` columns and added root/default transform helpers plus per-world component registration helpers.
- Added tests for attach/read/update/remove/query behavior and generation-checked parent references.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0029 — Implement deterministic transform resolution

Completed: 2026-05-15

Summary:

- Added `resolveWorldTransforms`, `TransformResolutionSystem`, resolution reports, and diagnostics for stale parents, missing parent transforms, cycles, and unresolved parents.
- Implemented root, child, multi-level, and reparent world-transform composition from ECS-owned local transforms.
- Added tests for system update, hierarchy composition, reparenting, missing/stale parents, and cycle behavior.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0030 — Add asset handle and registry foundation

Completed: 2026-05-15

Summary:

- Added branded asset handles and factories for mesh, material, texture, sampler, render target, scene, prefab, animation clip, skin, morph target set, and environment map.
- Added `AssetRegistry` with registered/loading/ready/failed status transitions, versions, labels, dependencies, diagnostics, handle serialization, and kind-separated lookups.
- Added tests for handle creation/comparison/serialization, status transitions, missing lookups, diagnostics, version changes, and handle-kind separation.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0031 — Define mesh asset schema and primitive builders

Completed: 2026-05-15

Summary:

- Added `MeshAsset` schema with vertex streams, attributes, index buffers, submeshes, material slots, local AABB/sphere bounds, and skin/morph placeholder fields.
- Added box and plane primitive builders with interleaved position/normal/UV data and uint16 indices.
- Added mesh validation diagnostics for missing position attributes, missing bounds, invalid ranges, unsupported topology, and missing material slots.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0032 — Define material, texture, sampler, and render-state schemas

Completed: 2026-05-15

Summary:

- Added `UnlitMaterialAsset`, `StandardMaterialAsset`, `DebugNormalMaterialAsset`, `TextureAsset`, `SamplerAsset`, render-state descriptors, sampler keys, and material pipeline-key input generation.
- Added validation diagnostics for missing texture/sampler handles, invalid alpha cutoff, unsupported features, invalid texture color space, and incompatible render states.
- Added tests for valid unlit/standard materials, stable sampler keys, invalid texture color space, and representative invalid material state.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0033 — Add render authoring ECS components

Completed: 2026-05-15

Summary:

- Added EliCS-backed `MeshRenderer`, `Camera`, `Visibility`, `RenderLayer`, `RenderOrder`, `Light`, `ShadowCaster`, and `ShadowReceiver` components.
- Added camera/light helper initializers, per-world component registration, and validation helpers for invalid camera/light fields.
- Added tests for component attach/read/update/remove/query behavior and invalid camera/light diagnostics.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none in this item.

## task-0034 — Define render snapshot and packet types

Completed: 2026-05-15

Summary:

- Added `RenderSnapshot`, view/mesh/light/environment/shadow/bounds packet types, sort keys, batch compatibility keys, diagnostics, reports, and worker-compatibility comments.
- Added deterministic stable render ID, sort-key, and batch-key helpers.
- Added tests for stable render IDs, queue/depth sorting, batch keys, and structured-clone-friendly snapshot shape.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0037` covers tightening view-projection matrix extraction and diagnostics.

## task-0035 — Implement initial render extraction system

Completed: 2026-05-15

Summary:

- Added `extractRenderSnapshot` to read ECS world transforms, mesh renderers, cameras, visibility, layers, render order, and lights into snapshot packets using asset registry metadata.
- Added initial diagnostics for disabled/invisible entities, missing transforms, missing/not-ready assets, invalid meshes, zero masks, and layer mismatches.
- Added tests for successful extraction, camera ordering, layer filtering, skipped renderables, missing handles, and report counts.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0037` addresses known extraction hardening gaps.

## task-0036 — Add WebGPU support detection boundary

Completed: 2026-05-15

Summary:

- Added a WebGPU-only capability and initialization boundary with injected navigator/canvas/context-like objects.
- Distinguished missing `navigator.gpu`, adapter failure, device request failure, context failure, and device loss.
- Added tests for unsupported paths, injected success, context configuration, and device-loss promise handling.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0039` covers the first clear-pass scaffolding on top of this boundary.

## task-0037 — Harden render extraction matrices and diagnostics

Completed: 2026-05-15

Summary:

- Updated view extraction so `viewProjectionMatrixOffset` stores a real projection-view matrix.
- Added extraction diagnostics/tests for loading/failed mesh and material assets, invalid mesh submesh codes, and material slots outside the MVP `material0Id` through `material3Id` fields.
- Preserved mesh validation diagnostic codes in render diagnostics.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0045` covers render-target extraction from camera authoring data.

## task-0038 — Add render world lifecycle foundation

Completed: 2026-05-15

Summary:

- Added `RenderWorld` as an ECS-free render cache that consumes `RenderSnapshot` mesh draw packets.
- Implemented create/update/remove behavior keyed by stable render IDs with GPU-resource placeholders and duplicate render ID diagnostics.
- Added tests for lifecycle transitions, idempotent repeated snapshots, removal, and duplicate IDs.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0042` covers resource binding updates on top of this foundation.

## task-0039 — Add WebGPU canvas clear pass scaffolding

Completed: 2026-05-15

Summary:

- Added `clearWebGpuCanvas` using injected device/context-like objects to get the current texture, create a view, encode a clear render pass, finish, and submit.
- Clear color/depth/stencil values come from plain render data and the module has no ECS imports.
- Added tests for successful command ordering and failure modes for missing queue, command encoder, current texture, and texture view.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0043` covers the next WebGPU resource boundary for buffers.

## task-0040 — Add asset dependency diagnostics and manifest report

Completed: 2026-05-15

Summary:

- Added asset dependency inspection for missing, loading, failed, and circular dependency paths.
- Added an agent-readable manifest report with counts by kind/status and dependency edges.
- Added tests for ready dependency chains, missing/loading/failed dependencies, circular dependencies, and manifest summaries.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none directly; later asset loader work should build on these diagnostics.

## task-0041 — Add extraction validation for cameras and lights

Completed: 2026-05-15

Summary:

- Wired camera and light authoring validators into render extraction.
- Invalid cameras now emit diagnostics for projection fields, clip range, viewport/scissor rectangles, and zero layer masks before being skipped.
- Invalid lights now emit diagnostics for intensity, range, spot cone, and zero layer masks before being skipped.
- Added tests showing invalid cameras/lights are skipped deterministically while valid views, mesh draws, and lights still extract.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none directly; `task-0045` continues camera extraction work with render targets.

## task-0042 — Add render-world resource binding updates

Completed: 2026-05-15

Summary:

- Added `RenderWorld.updateResourceBindings` to attach, replace, and clear renderer-owned mesh/material resource keys by stable render ID.
- Binding updates now return structured success/failure results with diagnostics for missing render IDs.
- Existing bindings are preserved across matching snapshots and removed when render objects are removed.
- Added tests for attach/replace/clear behavior, missing render IDs, and snapshot preservation/removal.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0050` covers draw readiness planning from render-world resource bindings.

## task-0043 — Add WebGPU buffer creation boundary

Completed: 2026-05-15

Summary:

- Added `createWebGpuBuffer` with typed descriptors for label, size, usage, mapping, and optional initial data.
- Buffer creation uses injected device and queue-like objects and reports invalid sizes, missing `createBuffer`, missing upload support, and zero-length initial data.
- Added tests for successful creation, initial data upload ordering, invalid data, and missing device support.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0048` and `task-0049` can feed upload/packing data into this boundary later.

## task-0044 — Add shader module creation diagnostics

Completed: 2026-05-15

Summary:

- Added `createWebGpuShaderModule` with WGSL source, label, expected entry point validation, and injected `createShaderModule` support.
- Reads `compilationInfo` when available and maps warning/error/info diagnostics with line and column metadata.
- Returns compilation errors as structured failures while allowing warning-only results to succeed.
- Added tests for successful module creation, warning diagnostics, error diagnostics, missing device support, and missing entry points.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0051` covers the first built-in unlit shader source.

## task-0045 — Extract camera render target handles

Completed: 2026-05-15

Summary:

- Camera extraction now parses non-empty `renderTargetId` values with the `render-target:<id>` handle convention.
- Valid render target ids populate `ViewPacket.renderTarget`; empty ids keep canvas targeting with `renderTarget: null`.
- Invalid non-empty ids emit `render.camera.invalidRenderTargetHandle` and are treated as canvas targets without changing view ordering.
- Added tests for default canvas cameras, valid render targets, invalid ids, and stable priority ordering.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: render-target asset validation can be added when render-target assets are introduced.

## task-0046 — Add transform buffer packing from render snapshots

Completed: 2026-05-15

Summary:

- Added `packSnapshotTransforms` to pack mesh draw world matrices from `RenderSnapshot.transforms` into a contiguous `Float32Array`.
- The packer returns per-render-id source and packed offsets, reusing packed data when multiple draws share the same source transform.
- Missing or out-of-range transform offsets produce diagnostics without querying ECS.
- Added tests for stable draw order, shared transform offsets, missing transform data, and empty snapshots.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0048` and `task-0050` can consume packed transform/resource readiness data.

## task-0052 — Refactor module folder organization

Completed: 2026-05-15

Summary:

- Split broad `assets`, `mesh`, `materials`, `math`, `rendering`, and `transform` implementation buckets into focused files while preserving public barrel exports.
- Split the broad math test into projection, matrix, and bounds/ray test files so tests mirror the new module layout where most useful.
- Preserved architecture boundaries: transform logic remains ECS-owned, render extraction remains WebGPU-free, WebGPU modules remain ECS-free, and no scene graph or WebGL fallback was introduced.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: none directly; this cleared the source tree for the renderer slices below.

## task-0047 — Add WebGPU render pipeline cache scaffold

Completed: 2026-05-15

Summary:

- Added `WebGpuRenderPipelineCache` with stable keys derived from shader label, color/depth formats, primitive topology, and render batch compatibility data.
- Pipeline creation is injected through a `createRenderPipeline`-like device and only occurs on cache misses.
- Results distinguish cache hits, misses, and missing `createRenderPipeline` support.
- Added tests for stable keys, reuse, format/topology differences, and missing device support.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0048 — Add mesh GPU upload planning descriptors

Completed: 2026-05-15

Summary:

- Added `createMeshGpuUploadPlan` to convert `MeshAsset` data into WebGPU-independent vertex/index upload descriptors with stable labels, byte lengths, usage hints, source views, and submesh ranges.
- Added structured diagnostics for missing vertex stream data, invalid vertex stream data, and invalid index data.
- Added tests for box and plane upload plans, stable labels, source preservation, missing stream data, and invalid index data.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0049 — Add unlit material uniform packing

Completed: 2026-05-15

Summary:

- Added `packUnlitMaterial` with documented RGBA `Float32Array` layout for unlit material uniforms.
- Returned texture and sampler dependency keys for later renderer resource binding.
- Added diagnostics for missing texture/sampler handles and unsupported material kinds.
- Added tests for default, tinted, textured, missing-binding, and unsupported material cases.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0050 — Add render-world draw readiness planning

Completed: 2026-05-15

Summary:

- Added render-world draw readiness reporting that classifies active render objects as ready or blocked by missing mesh/material resource keys.
- Ready records preserve render ID, draw packet, resource keys, and batch key; blocked records preserve render ID, packet, and missing resource reasons.
- Added diagnostics for empty render worlds, missing mesh resources, and missing material resources.
- Added tests for all-ready, partially blocked, all-blocked, and empty render-world states.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0051 — Add minimal unlit WGSL shader source module

Completed: 2026-05-15

Summary:

- Added built-in unlit mesh WGSL source as data with expected `vs_main` and `fs_main` entry point metadata.
- Added shader metadata for view-projection, world-transform, and unlit-material bindings without creating GPU objects.
- Added metadata validation diagnostics for missing label, code, entry points, and required bindings.
- Added tests that validate metadata and use the existing injected shader module helper to check entry points.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0053` through `task-0057` continue toward draw submission planning without encoding render passes yet.

## task-0053 — Add camera uniform packing from render snapshots

Completed: 2026-05-15

Summary:

- Added `packSnapshotViewUniforms` to pack `ViewPacket.viewProjectionMatrixOffset` matrices from `RenderSnapshot.viewMatrices` into contiguous camera uniform data.
- Added per-view source/packed offset records keyed by `viewId`.
- Added diagnostics for empty snapshots, duplicate view IDs, missing matrix data, and out-of-range matrix offsets.
- Added tests for one view, multiple ordered views, missing/out-of-range data, duplicates, and empty snapshots.
- Validation run: `npm run lint`, targeted view-pack tests, and `npm test` all pass during the continued run.

## task-0054 — Map mesh upload plans to buffer descriptors

Completed: 2026-05-15

Summary:

- Added `createMeshUploadBufferDescriptors` to map `MeshGpuUploadPlan` data to `WebGpuBufferDescriptor` values without creating buffers.
- Added typed default WebGPU buffer usage constants for vertex, index, uniform, and copy-destination flags.
- Preserved stable labels, byte lengths, usage flags, and source data views for later buffer creation.
- Added diagnostics for null plans, empty vertex uploads, and invalid usage flag configuration.
- Added tests for box meshes, non-indexed plane meshes, custom usage flags, null plans, empty uploads, and invalid usage flags.
- Validation run: `npm run lint`, targeted mesh buffer descriptor tests, and `npm test` all pass during the continued run.

## task-0055 — Add unlit material buffer descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitMaterialBufferDescriptor` to convert packed unlit material uniform data to `WebGpuBufferDescriptor` values.
- Preserved texture and sampler dependency keys for later bind group/resource binding work.
- Added diagnostics for null packed material input, invalid uniform data, and invalid usage flags.
- Added tests for default unlit, tinted unlit, textured dependencies, null input, invalid uniform data, and invalid usage flags.
- Validation run: `npm run lint`, targeted unlit material buffer tests, and `npm test` all pass during the continued run.

## task-0056 — Add render-world draw package planning

Completed: 2026-05-15

Summary:

- Added `planRenderWorldDrawPackages` to combine ready render-world draws with packed transform offsets into serializable draw package records.
- Draw packages preserve render ID, packet, resource keys, batch key, sort key, and packed transform offset.
- Added diagnostics for blocked draw inputs and ready draws missing packed transform offsets while preserving transform pack diagnostics.
- Added tests for ready packages, missing transforms, blocked inputs, transform diagnostics, and stable sort order.
- Validation run: `npm run lint`, targeted draw package tests, and `npm test` all pass during the continued run.

## task-0057 — Add unlit pipeline descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitPipelineDescriptorPlan` to produce `WebGpuRenderPipelineCreateDescriptor`-compatible data and cache keys from unlit shader metadata, formats, topology, and batch keys.
- Added diagnostics for missing shader metadata, missing color format, unsupported topology, and missing batch key fields.
- Added tests for descriptor shape, cache key content, format/topology differences, invalid shader metadata, missing color format, and missing batch fields.
- Validation run: `npm run lint`, targeted unlit pipeline descriptor tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0058` through `task-0062` continue renderer resource creation and frame assembly readiness.

## task-0058 — Add mesh GPU buffer creation helper

Completed: 2026-05-15

Summary:

- Added `createMeshGpuBuffers` to consume mesh buffer descriptor plans and create vertex/index resources through the injected `createWebGpuBuffer` boundary.
- Returned renderer-owned mesh, vertex, and index resource keys plus created buffer handles.
- Added diagnostics for null descriptor plans, vertex buffer creation failures, index buffer creation failures, and partial failures.
- Added tests for indexed meshes, non-indexed meshes, null plans, vertex failures, and index failures.
- Validation run: `npm run lint`, targeted mesh buffer resource tests, and `npm test` all pass during the continued run.

## task-0059 — Add unlit material uniform buffer creation helper

Completed: 2026-05-15

Summary:

- Added `createUnlitMaterialGpuBuffer` to create unlit material uniform resources through the injected `createWebGpuBuffer` boundary.
- Returned renderer-owned material buffer keys, created uniform buffer handles, and preserved texture/sampler dependency keys.
- Added diagnostics for null descriptor plans and buffer creation failure.
- Added tests for default unlit material resources, textured dependency preservation, null plans, and buffer failures.
- Validation run: `npm run lint`, targeted unlit material buffer resource tests, and `npm test` all pass during the continued run.

## task-0060 — Add renderer resource key conventions

Completed: 2026-05-15

Summary:

- Added stable renderer resource key helpers for mesh buffers, mesh vertex/index buffers, material buffers, shader modules, and render pipelines.
- Updated mesh/material buffer resource helpers to use the shared key conventions.
- Added tests for stable keys, resource-kind separation, and invalid empty ids.
- Validation run: `npm run lint`, targeted resource key/resource helper tests, and `npm test` all pass during the continued run.

## task-0061 — Add pipeline cache descriptor integration helper

Completed: 2026-05-15

Summary:

- Added `getOrCreateRenderPipelineFromPlan` to connect unlit pipeline descriptor plans to `WebGpuRenderPipelineCache`.
- Added `keyInput` to unlit pipeline descriptor plans so cache integration does not parse serialized cache keys.
- Results preserve cache hit/miss status and report null descriptor plans or missing pipeline device support.
- Added tests for cache miss creation, cache hit reuse, missing device support, and null descriptor plans.
- Validation run: `npm run lint`, targeted pipeline cache integration tests, and `npm test` all pass during the continued run.

## task-0062 — Add frame assembly readiness report

Completed: 2026-05-15

Summary:

- Added `createFrameAssemblyReadinessReport` to aggregate draw package counts, view uniform packing diagnostics, mesh/material resource creation results, and pipeline cache outcomes.
- Reports ready state, blocked count, warning/error totals, view counts, resource counts, and pipeline hit/miss counts.
- Added tests for all-ready inputs, missing mesh/material resources, pipeline failures, and empty-frame inputs.
- Validation run: `npm run lint`, targeted frame readiness tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0063` through `task-0067` continue view/shader resource helpers and resource summaries.

## task-0063 — Add view uniform buffer descriptor planning

Completed: 2026-05-15

Summary:

- Added `createViewUniformBufferDescriptor` to convert packed view uniform data into `WebGpuBufferDescriptor` values without creating buffers.
- Preserved per-view packed offset records for later resource binding.
- Added diagnostics for empty packed data, invalid usage flags, and carried view-pack diagnostics.
- Added tests for one view, multiple views, empty data, invalid usage flags, and carried diagnostics.
- Validation run: `npm run lint`, targeted view uniform buffer descriptor tests, and `npm test` all pass during the continued run.

## task-0064 — Add view uniform GPU buffer creation helper

Completed: 2026-05-15

Summary:

- Added `createViewUniformGpuBuffer` to create view uniform resources through the injected `createWebGpuBuffer` boundary.
- Added a renderer-owned view uniform resource key helper and preserved per-view offset records in created resources.
- Added diagnostics for null descriptor plans and buffer creation failure.
- Added tests for successful creation and buffer failure.
- Validation run: `npm run lint`, targeted view uniform buffer resource tests, and `npm test` all pass during the continued run.

## task-0065 — Add shader module resource helper

Completed: 2026-05-15

Summary:

- Added `createShaderModuleResource` to create shader module resources through the injected shader module helper.
- Returned renderer-owned shader module keys, module handles, and expected entry points.
- Preserved shader compilation diagnostics and added diagnostics for null descriptors and shader creation failures.
- Added tests for built-in unlit shader success, null descriptor input, missing device support, and warning diagnostics.
- Validation run: `npm run lint`, targeted shader resource tests, and `npm test` all pass during the continued run.

## task-0066 — Add material texture dependency readiness report

Completed: 2026-05-15

Summary:

- Added `checkMaterialDependencyReadiness` to validate packed material texture/sampler dependency keys against available renderer resource key sets.
- Added diagnostics for missing texture resources and missing sampler resources.
- Added tests for no-texture materials, all dependencies available, missing texture, missing sampler, and both missing.
- Validation run: `npm run lint`, targeted material dependency readiness tests, and `npm test` all pass during the continued run.

## task-0067 — Add render resource summary report

Completed: 2026-05-15

Summary:

- Added `createRenderResourceSummaryReport` to summarize mesh, material, view uniform, shader, and pipeline resources.
- Reports counts by resource kind plus warning/error totals while preserving source diagnostic codes/messages.
- Added tests for all-ready resources, partial failures, and empty resource inputs.
- Validation run: `npm run lint`, targeted resource summary tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0068` through `task-0072` continue diagnostics, batching, and inspection reports.

## task-0068 — Add diagnostic summary helpers

Completed: 2026-05-15

Summary:

- Added `summarizeDiagnostics` with total counts, severity counts, code counts, and configurable default severity.
- Exported the diagnostics helper from the public entrypoint.
- Added tests for empty diagnostics, mixed severities, repeated codes, and default severity override behavior.
- Validation run: `npm run lint`, targeted diagnostic summary tests, and `npm test` all pass during the continued run.

## task-0069 — Add draw package batching report

Completed: 2026-05-15

Summary:

- Added `createDrawPackageBatchingReport` to group draw packages by batch compatibility key.
- Reports draw count, batch count, stable groups, render IDs, and unique mesh/material resource keys.
- Added diagnostics for empty package input.
- Added tests for single batch grouping, multiple batches, feature/topology grouping, stable ordering, and empty input.
- Validation run: `npm run lint`, targeted batching report tests, and `npm test` all pass during the continued run.

## task-0070 — Add frame report data type

Completed: 2026-05-15

Summary:

- Added `createFrameReport` to combine frame assembly readiness, resource summary, and batching reports into a serializable frame report.
- Frame reports include ready state, frame id, draw count, batch count, resource counts, and diagnostic summary.
- Added tests for ready frames, blocked frames, empty frames, and diagnostic totals.
- Validation run: `npm run lint`, targeted frame report tests, and `npm test` all pass during the continued run.

## task-0071 — Add render packet inspection report

Completed: 2026-05-15

Summary:

- Added `inspectRenderSnapshot` to summarize render snapshot packet counts, transform/view matrix float counts, unique mesh/material/render-target handle keys, and diagnostics.
- Added diagnostics for empty snapshots while preserving snapshot diagnostics.
- Added tests for populated snapshots, empty snapshots, snapshot diagnostics, and handle uniqueness.
- Validation run: `npm run lint`, targeted snapshot inspection tests, and `npm test` all pass during the continued run.

## task-0072 — Add render package inspection report

Completed: 2026-05-15

Summary:

- Added `inspectRenderPackages` to summarize package count, render IDs, mesh/material resource keys, batch keys, and packed transform offsets.
- Added diagnostics for empty package input and duplicate render IDs.
- Added tests for populated packages, duplicate render IDs, and empty package input.
- Validation run: `npm run lint`, targeted package inspection tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0073` through `task-0077` continue cloneability, JSON, and summary merge helpers.

## task-0073 — Add render snapshot cloneability validation

Completed: 2026-05-15

Summary:

- Added `validateRenderSnapshotCloneability` to verify `RenderSnapshot` structured-clone compatibility with injectable clone behavior.
- Added diagnostics for clone failures and invalid `Float32Array` buffer shapes.
- Added tests for valid snapshots, injected clone failures, invalid transform buffers, and invalid view matrix buffers.
- Validation run: `npm run lint`, targeted snapshot clone tests, and `npm test` all pass during the continued run.

## task-0074 — Add frame report JSON helper

Completed: 2026-05-15

Summary:

- Added `frameReportToJsonValue` and `frameReportToJson` for stable JSON-safe frame report output.
- Preserved frame id, ready state, draw count, batch count, resource counts, and diagnostic summary.
- Added tests for JSON-safe values, blocked reports, and stable repeated string output.
- Validation run: `npm run lint`, targeted frame report JSON tests, and `npm test` all pass during the continued run.

## task-0075 — Add render snapshot diagnostic summary report

Completed: 2026-05-15

Summary:

- Added `summarizeRenderSnapshotDiagnostics` to summarize `RenderSnapshot.diagnostics` with the shared diagnostic summary helper.
- Included frame id and packet counts in the summary report.
- Added tests for snapshots without diagnostics and snapshots with mixed severity/repeated diagnostic codes.
- Validation run: `npm run lint`, targeted snapshot diagnostic tests, and `npm test` all pass during the continued run.

## task-0076 — Add render resource summary merge helper

Completed: 2026-05-15

Summary:

- Added `mergeRenderResourceSummaryReports` to aggregate multiple render resource summary reports.
- Recomputes warning/error totals from merged diagnostics instead of trusting source counts.
- Added tests for empty inputs, all-ready count summing, and diagnostics preservation/recomputed totals.
- Validation run: `npm run lint`, targeted resource summary merge tests, and `npm test` all pass during the continued run.

## task-0077 — Add draw batching summary merge helper

Completed: 2026-05-15

Summary:

- Added `mergeDrawPackageBatchingReports` to aggregate draw and batch counts across batching reports.
- Preserves diagnostics and reports contributing report count.
- Added tests for empty inputs, multiple reports, and diagnostics preservation.
- Validation run: `npm run lint`, targeted batching report merge tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0078` through `task-0082` continue bind group planning, draw descriptors, and renderer assembly reports.

## task-0078 — Add unlit bind group layout descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitBindGroupLayoutPlan` to produce data-only bind group layout descriptors for view, transform, and material bindings.
- Layout metadata matches `UNLIT_MESH_SHADER.bindings`.
- Added diagnostics for missing binding metadata and unsupported binding resource kinds.
- Added tests for descriptor shape, metadata mismatch, and unsupported resource kind.
- Validation run: `npm run lint`, targeted unlit bind group layout tests, and `npm test` all pass during the continued run.

## task-0079 — Add unlit bind group descriptor planning

Completed: 2026-05-15

Summary:

- Added `createUnlitBindGroupDescriptorPlan` to produce data-only bind group entries from view, transform, and material resource keys.
- Added diagnostics for missing view, transform, and material resources.
- Added tests for all resources present and all missing resource diagnostics.
- Validation run: `npm run lint`, targeted unlit bind group descriptor tests, and `npm test` all pass during the continued run.

## task-0080 — Add draw command descriptor planning

Completed: 2026-05-15

Summary:

- Added `createDrawCommandDescriptors` to create serializable draw descriptors from render packages and mesh GPU buffer resources.
- Draw descriptors include render ID, topology, mesh/material resource keys, vertex buffer keys, optional index buffer key/count, and packed transform offset.
- Added diagnostics for missing mesh resources.
- Added tests for indexed draws, non-indexed draws, missing mesh resources, and stable render ID ordering.
- Validation run: `npm run lint`, targeted draw command descriptor tests, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0081` through `task-0085` continue resource lifecycle, bind group cache/creation, and render-pass draw list planning.

## task-0081 — Add render resource lifecycle clear report

Completed: 2026-05-15

Summary:

- Added `createRenderResourceLifecycleReport` to diff previous/next renderer-owned resource key sets for mesh, material, view, shader, and pipeline resources.
- Reports retained, created, and removed keys by resource kind plus total counts and a `hasChanges` flag.
- Added tests for unchanged resources, added resources, removed resources, and mixed replacement.
- Validation run: targeted lifecycle tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0082 — Add renderer assembly smoke report

Completed: 2026-05-15

Summary:

- Added `createRendererAssemblySmokeReport` to combine snapshot inspection, cloneability validation, package inspection, resource summary, and frame report outputs.
- Reports section presence/readiness, summary counts, and actionable `rendererAssembly.*` diagnostics for missing or incomplete sections.
- Added tests for all sections present, missing snapshot, missing packages, and missing resources.
- Validation run: targeted smoke report tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0083 — Add bind group layout cache scaffold

Completed: 2026-05-15

Summary:

- Added `WebGpuBindGroupLayoutCache` and `createWebGpuBindGroupLayoutCacheKey` for descriptor-like bind group layout entries.
- Cache keys normalize entry order and ignore labels; layouts are created through an injected `createBindGroupLayout` boundary only on misses.
- Added tests for key stability, cache reuse, descriptor differences, and missing device support.
- Validation run: targeted bind group layout cache tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0084 — Add bind group creation helper

Completed: 2026-05-15

Summary:

- Added `createUnlitBindGroups` to create renderer-owned unlit bind group resources from descriptor plans and injected layout resources.
- Added `bindGroupResourceKey` and diagnostics for null plans, invalid descriptor plans, missing layouts, and missing `createBindGroup` support.
- Added tests for successful creation, null plans, missing layouts, and missing device support.
- Validation run: targeted unlit bind group/resource key tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.

## task-0085 — Add render pass draw list planning

Completed: 2026-05-15

Summary:

- Added `planRenderPassDrawList` to combine draw command descriptors, render pipeline resources, and unlit bind group resources into ordered render-pass draw records.
- Extended draw command descriptors with a per-draw `pipelineKey`.
- Added diagnostics for missing pipeline resources and missing bind group resources.
- Added tests for all-ready draw lists, missing pipeline, missing bind group, and stable ordering.
- Validation run: targeted render pass draw list tests, `npm run build`, `npm run lint`, `npm test`, and final `npm run format:check` all pass.
- Follow-up tasks added: `task-0086` through `task-0090` continue draw counts, render-pass resource resolution, command planning, command execution, and submission-path smoke reporting.

## task-0086 — Carry vertex draw counts into mesh GPU resources

Completed: 2026-05-15

Summary:

- Preserved vertex counts from mesh upload plans into WebGPU mesh buffer descriptor plans.
- Added vertex counts to mesh GPU vertex buffer resources, mesh GPU buffer resources, draw command descriptors, and render-pass draw list records.
- Added/updated tests for indexed meshes, non-indexed meshes, draw descriptors, resource summaries, and draw-list records.
- Validation run: targeted mesh/draw tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0087 — Add render pass resource resolver

Completed: 2026-05-15

Summary:

- Added `resolveRenderPassResources` to resolve render-pass draw list keys into pipeline handles, bind group handles, vertex buffers, and optional index buffers.
- Added diagnostics for missing pipeline handles, bind group handles, vertex buffers, and index buffers.
- Added tests for all-ready indexed draws and each missing-resource diagnostic path.
- Validation run: targeted render-pass resource tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0088 — Add render pass command planning

Completed: 2026-05-15

Summary:

- Added `planRenderPassCommands` to produce data-only pass command records for pipelines, bind groups, vertex/index buffers, and indexed/non-indexed draws.
- Added invalid index/vertex draw count diagnostics.
- Added tests for indexed commands, non-indexed commands, multiple bind groups, stable ordering, and invalid counts.
- Validation run: targeted command planning tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0089 — Add injected render pass command executor

Completed: 2026-05-15

Summary:

- Added `executeRenderPassCommands` to execute planned pass command records against an injected pass-encoder-like object.
- Reports command counts, executed/skipped counts, draw call counts, and missing-method diagnostics.
- Added tests for indexed execution, non-indexed execution, and missing encoder methods.
- Validation run: targeted command executor tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0090 — Add render pass assembly smoke report

Completed: 2026-05-15

Summary:

- Added `createRenderPassAssemblySmokeReport` to combine draw-list, resource-resolution, command-planning, and command-execution reports.
- Reports section presence/readiness, source diagnostics, and actionable `renderPassAssembly.*` diagnostics.
- Added tests for all sections ready, missing resolved resources, missing command plan, and failed execution.
- Validation run: targeted render-pass assembly smoke tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0091` through `task-0095` continue render-pass attachment planning, begin/end, command-buffer finish, queue submit, and submission smoke reporting.

## task-0091 — Add render pass attachment descriptor planning

Completed: 2026-05-15

Summary:

- Added `createRenderPassAttachmentPlan` for data-only color/depth attachment descriptors.
- Supports clear/load/store settings, clear color conversion, and optional depth clear settings.
- Added diagnostics for missing color targets, invalid clear colors, and invalid depth clear values.
- Added tests for color-only, color+depth, missing color target, invalid color clear, and invalid depth clear.
- Validation run: targeted attachment tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0092 — Add injected render pass begin/end helper

Completed: 2026-05-15

Summary:

- Added `beginPlannedRenderPass` and `endPlannedRenderPass` for injected command-encoder/pass-encoder boundaries.
- Added diagnostics for null attachment plans, missing `beginRenderPass`, and missing `end`.
- Added tests for begin success, null plans, missing begin support, end success, and missing end support.
- Validation run: targeted lifecycle tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0093 — Add frame command encoder finish helper

Completed: 2026-05-15

Summary:

- Added `finishCommandEncoder` to finish an injected command encoder into a renderer-owned command buffer resource.
- Added `commandBufferResourceKey`.
- Added diagnostics for missing `finish` support.
- Added tests for successful finish, missing finish support, and command buffer resource key generation.
- Validation run: targeted command-buffer tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0094 — Add queue submission helper

Completed: 2026-05-15

Summary:

- Added `submitCommandBuffers` for injected queue submission of renderer-owned command buffer resources.
- Reports submitted/skipped counts, command buffer keys, and diagnostics.
- Added diagnostics for missing `submit` support and empty command buffer input.
- Added tests for ordered submission, missing submit support, and empty input.
- Validation run: targeted queue submit tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0095 — Add frame submission smoke report

Completed: 2026-05-15

Summary:

- Added `createFrameSubmissionSmokeReport` to combine attachment planning, pass begin, command execution, pass end, command-buffer finish, and queue submit reports.
- Reports section presence/readiness, source diagnostics, and actionable `frameSubmission.*` diagnostics.
- Added tests for ready submission, missing attachment plan, failed begin, failed finish, and failed submit.
- Validation run: targeted frame submission smoke tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0096` through `task-0100` continue command encoder creation, texture view acquisition, frame boundary assembly, smoke reporting, and clear helper compatibility.

## task-0096 — Add command encoder creation helper

Completed: 2026-05-15

Summary:

- Added `createCommandEncoderResource` for injected command encoder creation.
- Added `commandEncoderResourceKey`.
- Added diagnostics for missing `createCommandEncoder` support.
- Added tests for successful creation, missing device support, and command encoder resource key generation.
- Validation run: targeted command encoder tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0097 — Add current texture view acquisition helper

Completed: 2026-05-15

Summary:

- Added `createCurrentTextureColorTarget` to acquire current texture views through injected context/texture-like objects.
- Returns color attachment target inputs for render-pass attachment planning.
- Added diagnostics for missing current textures and missing texture view support.
- Added tests for success, missing texture, and missing view support.
- Validation run: targeted current texture tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0098 — Add frame boundary assembly helper

Completed: 2026-05-15

Summary:

- Added `assembleFrameBoundary` to compose current texture acquisition, attachment planning, command encoder creation, pass begin, command execution, pass end, command-buffer finish, and queue submit helpers.
- Returns all intermediate reports for inspection and stops dependent steps after failed boundaries.
- Added tests for all-ready assembly and failures in texture view, begin, execution, finish, and submit.
- Validation run: targeted frame boundary tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0099 — Add frame boundary smoke report

Completed: 2026-05-15

Summary:

- Added `createFrameBoundarySmokeReport` to summarize full frame-boundary assembly section readiness.
- Reports section readiness for texture, attachments, encoder, begin, execution, end, finish, and submit.
- Added tests for all-ready, missing texture/attachments, missing encoder, failed execution, and failed submit.
- Validation run: targeted frame-boundary smoke tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0100 — Add clear helper compatibility report

Completed: 2026-05-15

Summary:

- Added `createClearCompatibilityReport` to verify frame-boundary helper coverage for clear-pass requirements.
- Reports missing texture view, command encoder, pass begin/end, command buffer finish, and queue submit capabilities.
- Added tests for all-ready compatibility, missing texture view, missing command encoder, missing queue submit, and missing pass end.
- Validation run: targeted clear compatibility tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0101` through `task-0105` continue frame-boundary diagnostics, JSON summaries, fixtures, clear parity, and aggregate validation.

## task-0101 — Add frame boundary diagnostic summary

Completed: 2026-05-15

Summary:

- Added `summarizeFrameBoundaryDiagnostics` to summarize diagnostics from the full frame-boundary assembly path.
- Uses the shared diagnostic summary helper and treats source diagnostics without severity as warnings.
- Added tests for all-ready boundaries, mixed diagnostics, and repeated diagnostic codes.
- Validation run: targeted frame-boundary diagnostics tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0102 — Add frame boundary JSON helper

Completed: 2026-05-15

Summary:

- Added `frameBoundaryReportToJsonValue` and `frameBoundaryReportToJson`.
- JSON-safe summaries omit GPU handles and include section readiness, command/submission counts, and diagnostic summary.
- Added tests for ready reports, failed reports without handle leakage, and stable repeated JSON output.
- Validation run: targeted frame-boundary JSON tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0103 — Add frame boundary fixture factory

Completed: 2026-05-15

Summary:

- Added a test-only `frameBoundaryFixture` helper for frame-boundary report fixtures.
- Consolidated duplicated local fixtures in clear compatibility and frame-boundary diagnostic tests.
- Validation run: targeted fixture-using tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0104 — Add clear helper parity report

Completed: 2026-05-15

Summary:

- Added `createClearParityReport` to compare `clearWebGpuCanvas` outcomes with clear compatibility reports.
- Reports matching success, matching failure, and mismatch diagnostics.
- Added tests for matching success, matching failure, clear-failed/boundary-ready, and clear-ready/boundary-failed cases.
- Validation run: targeted clear parity tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.

## task-0105 — Add frame boundary validation aggregate

Completed: 2026-05-15

Summary:

- Added `createFrameBoundaryValidationReport` to aggregate frame-boundary smoke, clear compatibility, and diagnostic summary outputs.
- Reports overall readiness, diagnostic counts, and aggregate failure diagnostics.
- Added tests for all-ready, smoke failure, compatibility failure, and diagnostic warning/error cases.
- Validation run: targeted frame-boundary validation tests, `npm run build`, `npm run lint`, and `npm test` all pass during the continued run.
- Follow-up tasks added: `task-0106` through `task-0110` continue clear helper integration, clear parity JSON, diagnostic summary merging, submission metrics, and MVP frame readiness aggregation.

## task-0106 — Refactor clear helper through frame boundary helpers

Completed: 2026-05-15

Summary:

- Routed `clearWebGpuCanvas` through the injected frame-boundary helpers while preserving its public `WebGpuClearResult` contract.
- Preserved the clear pass call order: texture view, command encoder, pass begin, pass end, command buffer finish, queue submit.
- Added/updated tests for successful clear behavior and missing command encoder support.
- Validation run: targeted clear/frame-boundary tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0107 — Add clear parity JSON helper

Completed: 2026-05-15

Summary:

- Added JSON-safe clear parity report helpers: `clearParityReportToJsonValue` and `clearParityReportToJson`.
- Included clear readiness, boundary readiness, overall readiness, and diagnostics in stable output.
- Added tests for matching success, matching failure, mismatch cases, and stable repeated JSON output.
- Validation run: targeted clear parity JSON tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0108 — Add frame boundary report merge helper

Completed: 2026-05-15

Summary:

- Added `mergeFrameBoundaryDiagnosticSummaryReports` to merge frame-boundary diagnostic summary reports.
- Sums diagnostic totals and severity/code counts while tracking contributing report count.
- Added tests for empty input, multiple ready reports, mixed diagnostics, and repeated diagnostic codes.
- Validation run: targeted frame-boundary diagnostic merge tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0109 — Add command submission metrics report

Completed: 2026-05-15

Summary:

- Added `createCommandSubmissionMetricsReport` to summarize command execution, command-buffer finish, and queue submission reports.
- Reports commands, draw calls, command buffers, submitted buffers, skipped commands, and skipped submissions.
- Added diagnostics for failed execution, failed finish, and failed submit paths.
- Validation run: targeted command submission metrics tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## task-0110 — Add MVP frame readiness aggregate

Completed: 2026-05-15

Summary:

- Added `createMvpFrameReadinessReport` to aggregate renderer assembly, render-pass assembly, frame submission, and frame-boundary validation reports.
- Reports overall readiness, key counts, and diagnostics for each non-ready major section.
- Added tests for all-ready input plus renderer assembly, render-pass, submission, and boundary validation failures.
- Validation run: targeted MVP frame readiness tests, `npm run build`, `npm run lint`, and `npm test` passed during the interrupted automation run; final validation after the math migration also passed.

## manual-math-wgpu-matrix-migration — Migrate math layer to wgpu-matrix

Completed: 2026-05-15

Summary:

- Replaced hand-rolled vector/matrix/quaternion/projection implementation paths with `wgpu-matrix` wrappers while preserving Aperture's public math API.
- Kept WebGPU projection depth `[0, 1]`, quaternion `[x, y, z, w]`, destination reuse, and `invertMat4` null-on-singular behavior.
- Updated bounds and ray helpers to use `wgpu-matrix` vector operations where practical.
- Added constructor, TRS, matrix operation, projection, quaternion, bounds, and ray tests that compare Aperture wrappers against `wgpu-matrix`.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass after formatting touched files.
- Follow-up tasks added: `task-0111` through `task-0115` continue renderer readiness summaries and documentation.

## task-0111 — Add MVP frame readiness JSON helper

Completed: 2026-05-15

Summary:

- Added section readiness to `MvpFrameReadinessReport`.
- Added `mvpFrameReadinessReportToJsonValue` and `mvpFrameReadinessReportToJson`.
- Covered ready reports, blocked reports, diagnostics, and stable repeated JSON output.
- Validation run: targeted MVP frame readiness tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0112 — Add renderer frame summary aggregate

Completed: 2026-05-15

Summary:

- Added `createRendererFrameSummaryReport` to combine renderer assembly, render-pass assembly, frame submission, frame-boundary validation, MVP readiness, and command-submission metrics.
- Reports section presence/readiness, draw/command/submission counts, source diagnostics with stable top-level section labels, and diagnostic summaries.
- Added tests for all-ready input, missing sections, and mixed diagnostics.
- Validation run: targeted renderer frame summary tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0113 — Add renderer frame summary JSON helper

Completed: 2026-05-15

Summary:

- Added `rendererFrameSummaryReportToJsonValue` and `rendererFrameSummaryReportToJson`.
- JSON output includes section readiness, counts, and diagnostic summary while omitting detailed source diagnostic payloads that may mention injected handles.
- Added tests for JSON shape, stable repeated output, and handle-leak prevention.
- Validation run: targeted renderer frame summary JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0114 — Add frame execution smoke fixture

Completed: 2026-05-15

Summary:

- Added `createFrameExecutionSmokeFixture` for ready injected frame execution and texture, begin, execute, finish, and submit failure injection.
- Fixture derives frame-boundary smoke and frame submission smoke reports from the real frame-boundary assembly path.
- Updated frame-boundary and submission smoke ready-path tests to use the fixture.
- Validation run: targeted fixture/smoke tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0115 — Add render frame readiness docs

Completed: 2026-05-15

Summary:

- Added `docs/RENDER_FRAME_READINESS.md` describing renderer assembly, render-pass assembly, frame submission, frame-boundary validation, MVP readiness, and renderer frame summary reports.
- Documented that these reports are data-only and that renderer-owned GPU state remains outside ECS.
- Linked the note from `docs/ARCHITECTURE.md`.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0116` through `task-0120` continue frame execution aggregation and renderer frame diagnostics.

## task-0116 — Add frame execution aggregate report

Completed: 2026-05-15

Summary:

- Added `createFrameExecutionReport` to derive boundary smoke, clear compatibility, diagnostic summary, boundary validation, frame submission smoke, and command-submission metrics from a `FrameBoundaryAssemblyReport`.
- Reports section readiness, command/submission counts, and diagnostics for missing execution, finish, or submit inputs.
- Added tests for ready execution plus texture, execution, finish, and submit failures.
- Validation run: targeted frame execution report tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0117 — Add frame execution aggregate JSON helper

Completed: 2026-05-15

Summary:

- Added `frameExecutionReportToJsonValue` and `frameExecutionReportToJson`.
- JSON output includes section readiness, command/submission counts, and diagnostic summary while omitting nested report payloads and injected handle details.
- Added tests for ready output, stable repeated JSON output, and handle-leak prevention.
- Validation run: targeted frame execution JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0118 — Add renderer frame summary builder from execution report

Completed: 2026-05-15

Summary:

- Added `createRendererFrameSummaryFromExecutionReport`.
- Derives MVP frame readiness and renderer frame summary from renderer assembly, render-pass assembly, and frame execution aggregate reports.
- Added tests for all-ready input, missing execution aggregates, and mixed renderer/render-pass failures.
- Validation run: targeted renderer frame summary builder tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0119 — Add injected renderer frame summary fixture

Completed: 2026-05-15

Summary:

- Added `createRendererFrameSummaryFixture` for test-only ready renderer frame summary and JSON generation.
- Supports injected renderer, render-pass, texture, execution, finish, and submit failures.
- Updated a renderer frame summary JSON test to use the fixture where practical.
- Validation run: targeted renderer frame summary fixture/JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0120 — Add renderer frame summary diagnostics grouping helper

Completed: 2026-05-15

Summary:

- Added `summarizeRendererFrameSummaryDiagnosticsBySection`.
- Groups renderer frame summary diagnostics by renderer assembly, render-pass assembly, frame submission, frame boundary, MVP readiness, and command submission metrics.
- Added tests for missing-section diagnostics, source diagnostics, and stable repeated JSON-safe output.
- Validation run: targeted renderer frame summary diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0121` through `task-0125` continue frame execution diagnostics, JSON helpers, docs, and injected runner helpers.

## task-0121 — Add frame execution diagnostics grouping helper

Completed: 2026-05-15

Summary:

- Added `summarizeFrameExecutionDiagnosticsBySection`.
- Groups frame execution diagnostics by boundary smoke, clear compatibility, source diagnostic summary, boundary validation, submission smoke, and command submission metrics.
- Added tests for missing command-metric inputs, source diagnostics, and stable JSON-safe repeated output.
- Validation run: targeted frame execution diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0122 — Add command submission metrics JSON helper

Completed: 2026-05-15

Summary:

- Added `commandSubmissionMetricsReportToJsonValue` and `commandSubmissionMetricsReportToJson`.
- JSON output includes readiness, command/draw/command-buffer/submission counts, and diagnostic summaries.
- Added tests for ready reports, execution/finish/submit failures, and stable repeated JSON output.
- Validation run: targeted command submission metrics JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0123 — Add render frame readiness docs update

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for `FrameExecutionReport`, JSON helpers, diagnostics grouping, and the renderer frame summary builder.
- Clarified which helpers derive reports from frame-boundary assembly and which remain summary-only.
- Reiterated that JSON helpers omit WebGPU handles, command encoders, command buffers, queues, contexts, devices, and detailed injected objects.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0124 — Add injected frame execution runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedFrameExecution`.
- The helper consumes the same injected inputs as `assembleFrameBoundary` and returns both the boundary assembly report and derived frame execution report.
- Added tests for ready execution plus texture, execution, finish, and submit failures.
- Validation run: targeted frame execution runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0125 — Add injected renderer frame summary runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRendererFrameSummary`.
- The helper combines renderer assembly, render-pass assembly, and injected frame execution inputs into a boundary assembly, frame execution report, renderer frame summary, and JSON summary.
- Added tests for all-ready input plus renderer, render-pass, texture, execution, and submit failures.
- Validation run: targeted renderer frame summary runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0126` through `task-0130` continue render-pass runners, JSON helpers, fixtures, and runner docs.

## task-0126 — Add injected render pass assembly runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRenderPassAssembly`.
- The helper resolves render-pass resources, plans commands, executes those commands against an injected pass encoder, and derives a render-pass assembly smoke report.
- Sanitized render-pass resource summaries so report summaries carry resource keys and counts instead of raw pipeline, bind-group, or buffer handles.
- Added tests for ready draws, missing pipeline resources, invalid draw counts, missing pass methods, and summary handle boundaries.
- Validation run: targeted render-pass runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0127 — Add render pass assembly JSON helper

Completed: 2026-05-15

Summary:

- Added `renderPassAssemblySmokeReportToJsonValue` and `renderPassAssemblySmokeReportToJson`.
- JSON output includes section readiness, draw/resource/command/execution summaries, and diagnostic summaries.
- Added tests for ready output, resource failures, command planning failures, execution failures, stable JSON, and raw-handle omission.
- Validation run: targeted render-pass assembly JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0128 — Add renderer assembly JSON helper

Completed: 2026-05-15

Summary:

- Added `rendererAssemblySmokeReportToJsonValue` and `rendererAssemblySmokeReportToJson`.
- JSON output includes section readiness, snapshot/resource/frame counts, package counts, cloneability diagnostic summaries, and renderer assembly diagnostic summaries.
- Added tests for ready reports, missing sections, source diagnostics, stable JSON, and omission of detailed package/handle payloads.
- Validation run: targeted renderer assembly JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0129 — Add injected render frame smoke fixture

Completed: 2026-05-15

Summary:

- Added `createInjectedRenderFrameSmokeFixture`.
- The fixture wires renderer assembly, `runInjectedRenderPassAssembly`, and `runInjectedRendererFrameSummary` into one test-only smoke path with event logging.
- Supports injected renderer, render-pass resource, command execution, texture, finish, and submit failures.
- Validation run: targeted injected render frame fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0130 — Update render frame readiness docs for runners

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` to document render-pass assembly, frame execution, renderer summary runners, and the test-only injected render frame fixture.
- Clarified which runner returns may contain renderer-side handles and which JSON helpers are safe to serialize.
- Reiterated that runner helpers do not query ECS or make the renderer authoritative.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0131` through `task-0135` continue diagnostics grouping and runner JSON surfaces.

## task-0131 — Add render pass assembly diagnostics grouping helper

Completed: 2026-05-15

Summary:

- Added `summarizeRenderPassAssemblyDiagnosticsBySection`.
- Groups render-pass assembly diagnostics by draw list, resources, commands, and execution, including inferred grouping for source diagnostic code prefixes.
- Added tests for missing resources, command planning failures, execution failures, and stable JSON-safe repeated output.
- Validation run: targeted render-pass assembly diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0132 — Add renderer assembly diagnostics grouping helper

Completed: 2026-05-15

Summary:

- Added `summarizeRendererAssemblyDiagnosticsBySection`.
- Groups renderer assembly diagnostics by snapshot, cloneability, packages, resources, and frame.
- Added tests for missing sections, source diagnostics, and stable JSON-safe repeated output.
- Validation run: targeted renderer assembly diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0133 — Add injected render frame runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRenderFrame`.
- The helper composes renderer assembly, `runInjectedRenderPassAssembly`, and `runInjectedRendererFrameSummary`, using the render-pass command plan as the frame execution command input.
- Added tests for ready output plus renderer, render-pass resource, render-pass execution, texture, finish, and submit failures.
- Validation run: targeted render frame runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0134 — Update injected render frame fixture to use production runner

Completed: 2026-05-15

Summary:

- Refactored `createInjectedRenderFrameSmokeFixture` to delegate to `runInjectedRenderFrame`.
- Preserved the fixture return shape, event logs, and failure injection behavior.
- Validation run: targeted injected render frame fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0135 — Update render frame readiness docs for full frame runner

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for `runInjectedRenderFrame`.
- Clarified caller-owned injected handles, renderer-side raw outputs, and the JSON-safe summary boundary.
- Documented that the test fixture now delegates to the production full-frame runner.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0136` through `task-0140` continue full-frame runner JSON and diagnostics surfaces.

## task-0136 — Add injected render frame runner JSON helper

Completed: 2026-05-15

Summary:

- Added `injectedRenderFrameRunnerReportToJsonValue` and `injectedRenderFrameRunnerReportToJson`.
- JSON output includes render-pass assembly JSON, frame execution JSON, renderer frame summary JSON, boundary validity, and aggregate readiness.
- Added tests for ready output, render-pass failures, frame execution failures, stable repeated JSON, and raw-handle omission.
- Validation run: targeted render frame runner JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0137 — Add injected render frame diagnostics grouping helper

Completed: 2026-05-15

Summary:

- Added `summarizeInjectedRenderFrameDiagnosticsByPhase`.
- Groups full injected render frame diagnostics by renderer assembly, render-pass assembly, frame execution, and renderer frame summary phases.
- Reuses existing render-pass, frame execution, and renderer frame summary diagnostic grouping helpers.
- Added tests for renderer, render-pass, frame execution failures, and stable JSON-safe repeated output.
- Validation run: targeted render frame diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0138 — Add multi-draw injected render frame fixture coverage

Completed: 2026-05-15

Summary:

- Extended `createInjectedRenderFrameSmokeFixture` with `drawCount`.
- Added stable two-draw coverage with intentionally unsorted draw-list input to lock command planning by render id.
- Added tests for multi-draw command counts, summary counts, and missing-resource diagnostics.
- Validation run: targeted injected render frame fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0139 — Add runner handle-boundary regression tests

Completed: 2026-05-15

Summary:

- Added focused JSON handle-boundary regression tests across render-pass assembly, renderer assembly, frame execution, renderer summary, and full injected render frame helpers.
- Tests use recognizable injected handle strings and assert JSON outputs omit those raw handles while keeping stable counts/keys.
- Validation run: targeted handle-boundary tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0140 — Update render frame readiness docs for JSON and diagnostics

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` with a helper inspection guide.
- Documented render-pass, frame execution, renderer assembly, renderer summary, and full-frame JSON/diagnostics helper choices.
- Reiterated that JSON and diagnostics are derived inspection surfaces, not ECS/game state or renderer-owned source of truth.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0141` through `task-0145` move the full runner up from draw-list records to draw-command descriptors.

## task-0141 — Add injected render frame draw-command runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRenderFrameFromDrawCommands`.
- The helper plans a render-pass draw list from draw-command descriptors, preserves draw-list diagnostics, and feeds draw records into `runInjectedRenderFrame`.
- Added tests for ready multi-draw output, missing bind groups, missing pipeline resources, command execution failures, and submit failures.
- Validation run: targeted draw-command runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0142 — Add injected render frame draw-command JSON helper

Completed: 2026-05-15

Summary:

- Added `injectedRenderFrameDrawCommandRunnerReportToJsonValue` and `injectedRenderFrameDrawCommandRunnerReportToJson`.
- JSON output includes draw-list readiness/counts/diagnostics plus the full injected render frame JSON.
- Added tests for ready output, draw-list failures, render-frame failures, stable JSON, and raw-handle omission.
- Validation run: targeted draw-command JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0143 — Add injected render frame draw-command diagnostics helper

Completed: 2026-05-15

Summary:

- Added `summarizeInjectedRenderFrameDrawCommandDiagnosticsByPhase`.
- Groups draw-command runner diagnostics by draw-list planning plus the existing full-frame phases.
- Added tests for draw-list, render-pass, frame execution, and renderer failures.
- Validation run: targeted draw-command diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0144 — Add draw-package injected render frame fixture

Completed: 2026-05-15

Summary:

- Added `createDrawPackageRenderFrameFixture`.
- The fixture starts from render-world draw packages, creates draw-command descriptors, and runs the draw-command injected render frame helper.
- Added tests for ready multi-draw output, missing mesh resource descriptor diagnostics, and submit failures.
- Validation run: targeted draw-package fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0145 — Update render frame readiness docs for draw-command runner

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for `runInjectedRenderFrameFromDrawCommands`.
- Documented draw-list, draw-command descriptor, and render-world draw-package boundaries.
- Clarified that descriptors and draw-list records are render-side products derived from ECS snapshots/render packages, not direct ECS queries or scene graph state.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0146` through `task-0150` move the production runner up from draw-command descriptors to draw packages.

## task-0146 — Add injected render frame draw-package runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRenderFrameFromDrawPackages`.
- The helper creates draw-command descriptors from render-world draw packages, then delegates to `runInjectedRenderFrameFromDrawCommands`.
- Added tests for ready multi-draw output, missing mesh resources, missing bind groups, command execution failures, and submit failures.
- Validation run: targeted draw-package runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0147 — Add injected render frame draw-package JSON helper

Completed: 2026-05-15

Summary:

- Added `injectedRenderFrameDrawPackageRunnerReportToJsonValue` and `injectedRenderFrameDrawPackageRunnerReportToJson`.
- JSON output includes descriptor readiness/counts/diagnostics plus the draw-command runner JSON.
- Added tests for ready output, descriptor failures, frame failures, stable JSON, and raw-handle omission.
- Validation run: targeted draw-package JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0148 — Add injected render frame draw-package diagnostics helper

Completed: 2026-05-15

Summary:

- Added `summarizeInjectedRenderFrameDrawPackageDiagnosticsByPhase`.
- Groups draw-package runner diagnostics by descriptor planning plus downstream draw-command/full-frame phases.
- Added tests for descriptor failures, frame failures, and stable JSON-safe repeated output.
- Validation run: targeted draw-package diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0149 — Update draw-package render frame fixture to use production runner

Completed: 2026-05-15

Summary:

- Refactored `createDrawPackageRenderFrameFixture` to delegate to `runInjectedRenderFrameFromDrawPackages`.
- Preserved ready multi-draw, missing mesh resource, and submit failure behavior.
- Validation run: targeted draw-package fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0150 — Update render frame readiness docs for draw-package runner

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for `runInjectedRenderFrameFromDrawPackages`.
- Documented render-world draw packages as the current earliest runner entry point.
- Clarified that render-world draw packages, draw-command descriptors, and draw-list records are render-side products derived from ECS snapshots.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0151` through `task-0155` move the runner up to render-world readiness plus packed transforms.

## task-0151 — Add injected render frame render-world package runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRenderFrameFromRenderWorldPackages`.
- The helper plans render-world draw packages from draw readiness plus packed transforms, then delegates to `runInjectedRenderFrameFromDrawPackages`.
- Added tests for ready output, blocked draws, missing packed transforms, missing mesh resources, and submit failures.
- Validation run: targeted render-world package runner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0152 — Add injected render frame render-world package JSON helper

Completed: 2026-05-15

Summary:

- Added `injectedRenderFrameRenderWorldPackageRunnerReportToJsonValue` and `injectedRenderFrameRenderWorldPackageRunnerReportToJson`.
- JSON output includes package readiness/counts/diagnostics plus downstream draw-package runner JSON.
- Added tests for ready output, package failures, downstream frame failures, stable JSON, and raw-handle omission.
- Validation run: targeted render-world package JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0153 — Add injected render frame render-world package diagnostics helper

Completed: 2026-05-15

Summary:

- Added `summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase`.
- Groups render-world package runner diagnostics by package planning plus downstream draw-package/draw-command/full-frame phases.
- Added tests for package, descriptor, draw-list, render-pass, frame execution, and renderer failures.
- Validation run: targeted render-world package diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0154 — Add render-world package injected render frame fixture

Completed: 2026-05-15

Summary:

- Added `createRenderWorldPackageFrameFixture`.
- The fixture starts from render-world draw readiness plus packed transforms and delegates to `runInjectedRenderFrameFromRenderWorldPackages`.
- Added tests for ready multi-draw output, blocked draw diagnostics, missing packed transform diagnostics, missing mesh resource diagnostics, and submit failure.
- Validation run: targeted render-world package fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0155 — Update render frame readiness docs for render-world package runner

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for `runInjectedRenderFrameFromRenderWorldPackages`.
- Documented render-world draw readiness plus packed transforms as the earliest current runner entry point.
- Clarified that render-world readiness and packed transforms are derived from snapshots/render-world state, not direct ECS queries.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.
- Follow-up tasks added: `task-0156` through `task-0160` move the runner up to render snapshots and render-world binding.

## task-0156 — Add injected render frame snapshot runner helper

Completed: 2026-05-15

Summary:

- Added `runInjectedRenderFrameFromSnapshot`.
- The helper applies a snapshot to a `RenderWorld`, updates resource bindings, packs transforms, derives draw readiness, and delegates to `runInjectedRenderFrameFromRenderWorldPackages`.
- Added tests for ready output, duplicate render ids, missing bindings, missing transforms, and submit failures.
- Validation run: targeted snapshot runner tests pass.

## task-0157 — Add injected render frame snapshot JSON helper

Completed: 2026-05-15

Summary:

- Added `injectedRenderFrameSnapshotRunnerReportToJsonValue` and `injectedRenderFrameSnapshotRunnerReportToJson`.
- JSON output includes apply, binding, transform packing, readiness, and downstream render-world package runner counts and diagnostic summaries.
- Omitted raw render-world objects and injected WebGPU handles from snapshot runner JSON output.
- Added tests for ready output, apply failures, binding failures, transform failures, downstream failures, stable JSON, and raw-handle omission.
- Validation run: targeted snapshot JSON tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0158 — Add injected render frame snapshot diagnostics helper

Completed: 2026-05-15

Summary:

- Added `summarizeInjectedRenderFrameSnapshotDiagnosticsByPhase`.
- Grouped snapshot runner diagnostics by apply, bindings, transform packing, draw readiness, and downstream render-world package phases.
- Reused `summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase` for downstream grouping.
- Added tests for apply, binding, transform, readiness, downstream submit failures, stable JSON-safe output, and raw-handle omission.
- Validation run: targeted snapshot diagnostics tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0159 — Add snapshot injected render frame fixture

Completed: 2026-05-15

Summary:

- Added `createSnapshotRenderFrameFixture`.
- Fixture starts from a render snapshot and delegates to `runInjectedRenderFrameFromSnapshot`.
- Tests cover ready multi-draw output, duplicate render ids, missing resource bindings, missing transforms, and submit failure.
- Validation run: targeted snapshot fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0160 — Update render frame readiness docs for snapshot runner

Completed: 2026-05-15

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for the snapshot injected render frame runner.
- Documented when to use snapshots versus render-world readiness, draw packages, draw-command descriptors, and draw-list records.
- Clarified that snapshot application updates render-world state without querying ECS directly or making rendering authoritative.
- Validation run: `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0161 — Add snapshot resource binding planner

Completed: 2026-05-15

Summary:

- Added `planInjectedRenderFrameSnapshotResourceBindings`.
- Planner consumes a `RenderSnapshot` plus typed mesh/material resource-key resolvers and emits ordered binding updates for `runInjectedRenderFrameFromSnapshot`.
- Diagnostics cover missing mesh resources, missing material resources, and duplicate render ids without mutating `RenderWorld`.
- Added tests for ready output, missing resources, duplicate render ids, and stable output order.
- Validation run: targeted binding planner tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0162 — Add ECS-extracted snapshot render frame fixture

Completed: 2026-05-15

Summary:

- Added `createEcsSnapshotRenderFrameFixture`.
- Fixture builds camera and mesh entities through ECS components, extracts a render snapshot, plans resource bindings, and runs `runInjectedRenderFrameFromSnapshot`.
- Tests assert extraction, apply, binding, transform, readiness, package, descriptor, draw-list, frame execution, and summary counts.
- Tests cover skipped invalid renderable diagnostics and submit failure while keeping production WebGPU code free of ECS queries.
- Validation run: targeted ECS snapshot fixture tests, `npm run build`, `npm run lint`, `npm test`, and `npm run format:check` all pass.

## task-0212 — Add built-in primitive geometry browser readback coverage

Completed: 2026-05-16

Summary:

- Updated the multi-entity browser example to use Aperture's built-in `createPlaneMeshAsset` instead of inline triangle vertex data.
- Status now reports primitive geometry metadata and diagnostic counts across extraction, resources, draw planning, submission, and readback.
- Playwright asserts the primitive path and verifies rendered pixels through GPU readback.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0213 — Add unlit material variant browser readback coverage

Completed: 2026-05-16

Summary:

- Expanded the multi-entity scene to render three visible unlit material variants: red, green, and blue.
- Status reports three materials, five bind groups, three extracted draws, three ready render-world objects, and nine readback sample points.
- Playwright verifies each visible material color with readback tolerances and keeps screenshot fallback diagnostics.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0214 — Add visibility and layer browser readback coverage

Completed: 2026-05-16

Summary:

- Added a fourth ECS-authored primitive renderable with a magenta material and `Visibility.visible = false`.
- Status reports four authored renderables, three extracted draws, one skipped renderable, and the JSON-safe `render.invisible` diagnostic.
- Playwright verifies the hidden magenta material is absent from readback samples while the visible colors still render.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0215 — Add missing-resource browser diagnostic smoke

Completed: 2026-05-16

Summary:

- Added `?scenario=missing-resource` to the multi-entity browser page.
- The scenario extracts a valid ECS renderable, intentionally withholds the renderer-side material resource binding, reports binding/readiness diagnostics, and submits no draws.
- Added Playwright coverage for `renderFrameSnapshotBinding.missingMaterialResource` and `renderWorld.missingMaterialResource` JSON-safe payloads.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0218 — Add layer-mismatch browser diagnostic scenario

Completed: 2026-05-16

Summary:

- Added `?scenario=layer-mismatch` to the multi-entity browser page.
- The scenario authors a renderable on a layer outside the camera mask, reports `render.layerMismatch`, and performs no resource binding or draw submission.
- Added Playwright coverage for the layer-filtering status payload and zero-submission counts.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0219 — Add missing ECS mesh asset browser diagnostic scenario

Completed: 2026-05-16

Summary:

- Added `?scenario=missing-mesh-asset` to the multi-entity browser page.
- The scenario authors a renderable with an unavailable mesh asset handle, reports `render.missingMeshHandle`, and performs no resource binding or draw submission.
- Added Playwright coverage for the extraction failure status payload and zero-submission counts.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0220 — Add box primitive browser readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=box-primitive` to render a built-in `createBoxMeshAsset` through ECS extraction and WebGPU submission.
- Status reports box geometry metadata with 24 vertices, 36 indices, resource counts, draw counts, and readback diagnostics.
- Added Playwright readback coverage for the center box pixel.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0221 — Add orthographic camera browser readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=orthographic-camera` with an ECS-authored orthographic `Camera`.
- Status reports camera projection details plus geometry/resource/draw/readback data.
- Added Playwright readback coverage for the orthographic primitive center pixel.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0222 — Add render-order overlap browser coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=render-order-overlap` with two overlapping primitive planes and explicit `RenderOrder` values.
- Status reports render-order metadata and the expected top material.
- Added Playwright readback coverage for the overlap center pixel.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0223 — Add missing mesh resource-binding smoke

Completed: 2026-05-16

Summary:

- Added `?scenario=missing-mesh-resource`.
- The scenario extracts a valid ECS renderable, intentionally withholds the renderer-side mesh resource binding, reports binding/readiness diagnostics, and submits no draws.
- Added Playwright coverage for `renderFrameSnapshotBinding.missingMeshResource` and `renderWorld.missingMeshResource` JSON-safe payloads.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0224 — Add missing ECS material asset smoke

Completed: 2026-05-16

Summary:

- Added `?scenario=missing-material-asset`.
- The scenario authors a ready mesh with an unavailable material asset handle, reports `render.missingMaterialHandle`, and submits no draws.
- Added Playwright coverage for the extraction failure status payload and zero-submission counts.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0225 — Add unknown browser scenario diagnostic

Completed: 2026-05-16

Summary:

- Added explicit unknown-scenario handling for unsupported multi-entity query modes.
- Status reports `phase: "scenario"`, `reason: "unknown-scenario"`, accepted scenario ids, and zero extraction/resource/draw/submission counts.
- Added Playwright coverage for the unknown scenario payload.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0226 — Add loading and failed mesh asset browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=loading-mesh-asset` and `?scenario=failed-mesh-asset`.
- The scenarios author renderables with loading/failed mesh asset registry states, report `render.mesh.loading` / `render.mesh.failed`, and submit no draws.
- Added Playwright coverage for both asset-state payloads.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0227 — Add loading and failed material asset browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=loading-material-asset` and `?scenario=failed-material-asset`.
- The scenarios author renderables with loading/failed material asset registry states, report `render.material.loading` / `render.material.failed`, and submit no draws.
- Added Playwright coverage for both asset-state payloads.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0232 — Add disabled renderable browser diagnostic scenario

Completed: 2026-05-16

Summary:

- Added `?scenario=disabled-renderable`.
- The scenario authors a ready renderable with `Enabled.value = false`, reports `render.disabled`, and submits no draws.
- Added Playwright coverage for the disabled-renderable extraction payload and zero-submission counts.
- Validation run: `npm run build`, `npm run check`, and full `npm run test:e2e -- --reporter=line` pass.

## task-0228 — Preserve render sort order through draw planning

Completed: 2026-05-16

Summary:

- Preserved render package order through draw command descriptors, draw-list records, resource resolution, and render pass command planning.
- Updated unit and runner fixture tests so sort order can differ from render id order.
- Validation run: focused Vitest coverage, `npm run build`, `npm run check`, and `npm run test:e2e -- test/e2e/render-order-overlap.spec.ts --reporter=line` pass.

## task-0229 — Refactor browser diagnostic scenario status builders

Completed: 2026-05-16

Summary:

- Added shared extraction-failure and resource-binding-failure status builders for multi-entity zero-submission browser scenarios.
- Kept existing JSON-safe payload shapes for missing resources, layer mismatch, asset states, unknown scenario, and disabled renderable cases.
- Validation run: targeted diagnostic Playwright specs and `npm run check` pass.

## task-0230 — Add perspective camera FOV browser readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=perspective-fov-camera` with a non-default perspective `fovYRadians`.
- Added Playwright readback coverage for the rendered primitive and camera status payload.
- Validation run: targeted Playwright spec and `npm run check` pass.

## task-0231 — Add mesh asset failed-diagnostic payload coverage

Completed: 2026-05-16

Summary:

- Failed mesh/material browser scenarios now expose sanitized registry diagnostic code/message/severity fields.
- Playwright asserts failed asset diagnostic details stay JSON-safe and extraction/submission counts remain unchanged.
- Validation run: targeted asset-status Playwright specs and `npm run check` pass.

## task-0233 — Add render layer positive/negative browser scenario

Completed: 2026-05-16

Summary:

- Added `?scenario=render-layer-filter` with one matching render layer and one skipped mismatched peer.
- Status reports one extracted draw plus `render.layerMismatch`; readback verifies the visible color and absence of skipped color.
- Validation run: targeted Playwright spec and `npm run check` pass.

## task-0234 — Add disabled renderable with visible peer browser coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=disabled-visible-peer` with one enabled renderable and one disabled peer.
- Status reports one extracted draw plus `render.disabled`; readback verifies the enabled color and absence of disabled color.
- Validation run: targeted Playwright spec and `npm run check` pass.

## task-0235 — Add sphere primitive mesh builder

Completed: 2026-05-16

Summary:

- Added `createSphereMeshAsset` with interleaved position/normal/UV data, indexed triangle-list geometry, bounds, and material slot support.
- Added unit tests for counts, representative vertices, UVs, bounds, clamping, and validation.
- Validation run: primitive Vitest coverage and `npm run check` pass.

## task-0236 — Add cylinder and cone primitive mesh builders

Completed: 2026-05-16

Summary:

- Added `createCylinderMeshAsset` and `createConeMeshAsset` via shared frustum generation with caps, bounds, and material slot support.
- Added unit tests for representative vertices, index ranges, bounds, and validation.
- Validation run: primitive Vitest coverage and `npm run check` pass.

## task-0237 — Add capsule and torus primitive mesh builders

Completed: 2026-05-16

Summary:

- Added `createCapsuleMeshAsset` and `createTorusMeshAsset` with interleaved primitive vertex layout, indexed triangles, bounds, and material slot support.
- Added unit tests for representative vertices, index ranges, bounds, and validation.
- Validation run: primitive Vitest coverage and `npm run check` pass.

## task-0238 — Add browser primitive readback coverage for curved primitives

Completed: 2026-05-16

Summary:

- Added `?scenario=sphere-primitive` rendering `createSphereMeshAsset` through the ECS-to-WebGPU path.
- Playwright verifies a non-clear sphere pixel through GPU readback.
- Validation run: targeted Playwright spec and `npm run check` pass.

## task-0239 — Add depth-tested 3D overlap browser coverage

Completed: 2026-05-16

Summary:

- Added optional depth target support to the multi-entity browser render path.
- Added `?scenario=depth-overlap`, with a depth-enabled unlit pipeline and a farther object submitted after the nearer object.
- Playwright verifies the nearer object wins through depth testing.
- Validation run: targeted Playwright spec and `npm run check` pass.

## task-0240 — Add a narrow render-frame orchestration helper

Completed: 2026-05-16

Summary:

- Added `planRenderFrameFromSnapshot` to package snapshot application, resource binding, draw package planning, descriptor planning, draw-list/resource resolution, and command planning.
- The helper returns JSON-safe counts/diagnostics plus the render pass command plan and is used by the multi-entity browser example.
- Unit tests cover success and missing-resource diagnostics.
- Validation run: helper Vitest coverage, targeted browser smoke, and `npm run check` pass.

## task-0241 — Add initial texture-backed unlit material design task

Completed: 2026-05-16

Summary:

- Added `docs/UNLIT_TEXTURED_MATERIAL_PLAN.md`.
- Documented the ECS/asset/render-world boundary, minimal WebGPU resource/bind-group/shader changes, diagnostics policy, and browser scenario for texture-backed unlit materials.
- Added follow-up backlog tasks `task-0242` through `task-0246`.
- Validation run: `npm run check` passes.

## task-0242 — Add texture and sampler GPU resource helpers

Completed: 2026-05-16

Summary:

- Added renderer-owned texture and sampler GPU resource helper APIs.
- Texture resources accept explicit descriptors plus optional byte uploads; sampler resources map `SamplerAsset` fields to WebGPU sampler descriptors.
- Diagnostics stay JSON-safe and cover missing device support plus texture/sampler creation, upload, and view failures.
- Validation run: targeted texture-resource Vitest coverage and `npm run check` pass.

## task-0243 — Extend unlit bind group planning for base-color textures

Completed: 2026-05-16

Summary:

- Extended unlit group-2 bind group planning so factor-only materials keep the material-buffer path while textured materials include material uniform, texture view, and sampler entries.
- Added resource resolution diagnostics for missing texture and sampler GPU resources.
- Threaded optional texture/sampler resources through unlit frame resource creation.
- Validation run: focused bind-group/frame-resource tests and `npm run check` pass.

## task-0244 — Add unlit texture shader feature and pipeline key

Completed: 2026-05-16

Summary:

- Added a textured unlit WGSL shader variant that samples `baseColorTexture` and multiplies by `baseColorFactor`.
- Pipeline descriptor/resource creation now selects the textured shader when the batch pipeline key contains `baseColorTexture`.
- Added tests for unlit material feature flags, shader metadata, pipeline descriptor/cache separation, and render pipeline resource creation.
- Validation run: focused material/shader/pipeline tests and `npm run check` pass.

## task-0245 — Add extraction diagnostics for unlit texture asset states

Completed: 2026-05-16

Summary:

- Render extraction now validates ready unlit material texture and sampler dependencies before emitting draw packets.
- Diagnostics cover missing handles, unregistered assets, loading assets, and failed assets with stable asset keys.
- Ready texture/sampler dependencies extract textured draw packets with the expected batch feature key.
- Validation run: focused extraction tests and `npm run check` pass.

## task-0246 — Add texture-backed unlit browser readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=textured-unlit` to the multi-entity browser example with a 2x2 uploaded texture and nearest sampler.
- Browser status reports texture/sampler resource counts and JSON-safe texture metadata.
- Added Playwright coverage that verifies two UV-separated readback samples, proving real texture sampling.
- Validation run: targeted Playwright spec and `npm run check` pass.

## task-0247 — Add texture and sampler resource summary counts

Completed: 2026-05-16

Summary:

- Render resource summaries now optionally include texture and sampler resource creation results.
- Summary counts report textures and samplers separately, and diagnostics stay JSON-safe.
- Merge/report tests cover valid resources, failed resources, and backward-compatible callers that omit texture resources.
- Validation run: focused resource summary tests and `npm run check` pass.

## task-0248 — Add browser texture dependency asset-status scenarios

Completed: 2026-05-16

Summary:

- Added browser scenarios for missing, loading, and failed texture/sampler dependencies referenced by texture-backed unlit materials.
- Status payloads include stable texture/sampler keys, dependency status, and JSON-safe extraction diagnostics.
- Added Playwright status coverage for six no-submission scenarios.
- Validation run: targeted Playwright spec passes.

## task-0249 — Add browser missing texture resource-binding diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=missing-texture-sampler-resources`, which extracts a valid textured draw and then withholds renderer-owned texture/sampler GPU resources.
- The browser status reports texture/sampler resource counts, stable texture metadata, and JSON-safe missing resource diagnostics.
- Added Playwright coverage that verifies no draw submission happens when texture/sampler GPU resources are missing.
- Validation run: targeted Playwright spec passes.

## task-0250 — Add cylinder and cone browser primitive readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=cylinder-primitive` and `?scenario=cone-primitive` to the multi-entity browser example.
- Browser status reports primitive source, mesh label, vertex/index counts, extraction counts, and draw/submission counts for both primitives.
- Added Playwright coverage that verifies non-clear center pixels for cylinder and cone, and reran the existing box/sphere primitive browser specs.
- Validation run: targeted Playwright specs pass.

## task-0251 — Add capsule and torus browser primitive readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=capsule-primitive` and `?scenario=torus-primitive` to the multi-entity browser example.
- Browser status reports primitive source, mesh label, vertex/index counts, extraction counts, and draw/submission counts for both primitives.
- Added Playwright coverage that verifies non-clear center pixels for capsule and torus, then reran all primitive browser specs together.
- Validation run: targeted Playwright specs pass.

## task-0252 — Add render-frame textured draw planning unit coverage

Completed: 2026-05-16

Summary:

- Added unit coverage proving `planRenderFrameFromSnapshot` accepts a textured unlit group-2 bind group whose entries include material, texture, and sampler resource keys.
- Verified draw-list/resource resolution keeps the textured material bind group associated with the draw and command plan.
- Added missing textured group-2 coverage for the existing JSON-safe `renderPassDrawList.missingBindGroupResource` diagnostic path.
- Validation run: targeted Vitest coverage passes.

## task-0253 — Add mixed unlit pipeline browser planning

Completed: 2026-05-16

Summary:

- The multi-entity browser path now creates one unlit pipeline resource per distinct snapshot batch pipeline key.
- Multi-material unlit frame resource creation can use per-material bind group layouts, allowing factor-only and texture-backed group-2 layouts in one frame.
- Shared group 0/1 bind groups are created per pipeline layout with pipeline-scoped resource keys so auto-layout bind groups resolve to the matching pipeline.
- Added `?scenario=mixed-unlit-pipelines` and Playwright coverage for factor-only plus texture-backed pixels in one frame.
- Validation run: targeted render-pass draw-list/unit coverage and mixed-pipeline Playwright spec pass.

## task-0254 — Add quadrant texture UV browser readback coverage

Completed: 2026-05-16

Summary:

- Expanded `?scenario=textured-unlit` to publish and read back four quadrant samples from a 2x2 texture.
- Playwright now verifies upper/lower and left/right UV orientation with distinct colors.
- Validation run: targeted textured-unlit Playwright spec, build, typecheck, and example syntax checks pass.

## task-0255 — Add multi-pipeline render-frame planning unit coverage

Completed: 2026-05-16

Summary:

- Added `planRenderFrameFromSnapshot` coverage for factor-only and textured unlit pipeline keys in one frame.
- Tightened shared bind group resolution so pipeline-scoped groups do not silently fall back to another pipeline.
- Validation run: targeted render-frame-plan/render-pass-draw-list tests, build, and test typecheck pass.

## task-0256 — Add sampler filter and address browser readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=sampler-filter-address` with mirror-repeat U addressing and linear filtering.
- Status reports sampler settings, expected sample ids, and comparison colors; Playwright verifies the blended pixel.
- Validation run: targeted sampler Playwright spec, build, typecheck, and example syntax checks pass.

## task-0257 — Add texture upload row-stride diagnostics coverage

Completed: 2026-05-16

Summary:

- `createTextureGpuResource` now validates `bytesPerRow` and `rowsPerImage` before `queue.writeTexture`.
- Added unit coverage for invalid row-stride inputs plus valid tightly packed and padded uploads.
- Validation run: texture resource tests, texture browser specs, build, typecheck, and example syntax checks pass.

## task-0258 — Add textured unlit tint browser coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=textured-unlit-tint` for a texture-backed unlit material with non-white `baseColorFactor`.
- Playwright verifies the rendered pixel matches texture color multiplied by tint.
- Validation run: targeted texture Playwright specs, build, typecheck, and example syntax checks pass.

## task-0259 — Add texture upload data-size diagnostics

Completed: 2026-05-16

Summary:

- Added `textureResource.uploadDataTooSmall` validation for upload data shorter than the required row/layer layout.
- Unit tests cover tightly packed, padded, and layered minimum byte counts.
- Validation run: texture resource tests, texture browser specs, build, typecheck, and example syntax checks pass.

## task-0260 — Add texture format row-byte coverage

Completed: 2026-05-16

Summary:

- Added row-byte validation coverage for `r8unorm`, `rg8unorm`, `rgba8unorm`, `bgra8unorm`, and `rgba16float`.
- Unknown formats still require positive integer `bytesPerRow` without false minimum-byte diagnostics.
- Validation run: texture resource tests, build, and test typecheck pass.

## task-0261 — Add invalid texture upload browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=invalid-texture-upload` for invalid upload row stride.
- Browser status reports `textureResource.invalidBytesPerRow` and no submission when resource creation fails.
- Validation run: invalid texture upload Playwright spec, build, typecheck, and example syntax checks pass.

## task-0262 — Add vertical sampler address browser readback coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=sampler-v-address` with mirror-repeat V addressing and linear filtering.
- Playwright verifies the vertical sampler behavior through readback against rejected clamp/repeat/nearest colors.
- Validation run: sampler-v Playwright spec, build, typecheck, and example syntax checks pass.

## task-0263 — Add multi-textured unlit browser coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=multi-textured-unlit` for two texture-backed unlit draws with distinct textures and samplers.
- Playwright verifies both readback colors and resource counts for two textures/two samplers.
- Validation run: multi-textured Playwright spec, build, typecheck, and example syntax checks pass.

## task-0264 — Add invalid texture upload data-size browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=short-texture-upload` for intentionally short texture upload data.
- Browser status reports `textureResource.uploadDataTooSmall`, expected/received byte counts, and no submission.
- Validation run: invalid texture upload Playwright spec, build, typecheck, and example syntax checks pass.

## task-0265 — Add shared-sampler multi-textured browser coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-sampler-multi-textured` using two textures and one shared sampler.
- Playwright verifies both texture colors and resource counts for two textures/one sampler.
- Validation run: multi-textured Playwright spec, build, typecheck, and example syntax checks pass.

## task-0266 — Add layered texture upload validation coverage

Completed: 2026-05-16

Summary:

- Added valid layered texture upload coverage with padded `rowsPerImage`.
- Existing invalid layered byte-count coverage verifies exact minimum bytes.
- Validation run: texture resource tests, build, and test typecheck pass.

## task-0267 — Add texture resource summary diagnostics coverage

Completed: 2026-05-16

Summary:

- Added resource summary coverage for texture upload validation diagnostics.
- Counts now explicitly prove failed texture uploads do not increment valid texture totals.
- Validation run: resource summary tests, build, and test typecheck pass.

## task-0268 — Add multi-textured resource-missing browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=multi-textured-missing-texture-resource` withholding one texture GPU resource from two textured draws.
- Missing unlit bind group diagnostics now include structured `resourceKey`.
- Validation run: missing texture resource Playwright spec, build, typecheck, and example syntax checks pass.

## task-0269 — Add bind-group missing resource-key unit coverage

Completed: 2026-05-16

Summary:

- Added unit assertions that missing buffer, texture, and sampler bind-group diagnostics carry `resourceKey`.
- Existing diagnostic code expectations continue to pass.
- Validation run: unlit bind-group/frame-resource tests, build, and test typecheck pass.

## task-0270 — Add browser available-scenario coverage for texture cases

Completed: 2026-05-16

Summary:

- Unknown-scenario Playwright coverage now asserts representative texture scenarios appear in `availableScenarios`.
- The assertion remains partial so the test is not brittle as scenarios grow.
- Validation run: unknown-scenario Playwright spec and test typecheck pass.

## task-0271 — Add texture upload failure resource summary merge coverage

Completed: 2026-05-16

Summary:

- Added resource summary merge coverage for texture upload validation diagnostic codes.
- Merged warning counts and diagnostic ordering are covered.
- Validation run: resource summary tests, build, and test typecheck pass.

## task-0272 — Add material texture dependency report coverage for multiple textures

Completed: 2026-05-16

Summary:

- Added unit coverage for one ready textured material and one missing texture dependency in the same test flow.
- Diagnostics identify only the missing texture resource key.
- Validation run: material dependency readiness tests, build, and test typecheck pass.

## task-0273 — Add browser texture scenario docs index

Completed: 2026-05-16

Summary:

- Added a compact texture/sampler scenario index to `docs/BROWSER_E2E_RENDERING.md`.
- The index maps scenario query names to the readback or diagnostic behavior they verify.
- Validation run: formatting pass completed.

## task-0274 — Add invalid rows-per-image browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=invalid-texture-rows-per-image` for invalid texture upload `rowsPerImage`.
- Browser status reports `textureResource.invalidRowsPerImage`, the texture key, and no submission.
- Validation run: invalid texture upload Playwright spec, build, typecheck, and example syntax checks pass.

## task-0275 — Add shared-texture tinted materials browser coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-tinted-unlit` for two materials sharing one texture/sampler pair with different tints.
- Playwright verifies both multiplied readback colors and resource counts for one texture/one sampler.
- Validation run: textured tint Playwright spec, build, typecheck, and example syntax checks pass.

## task-0276 — Add texture upload validation JSON report coverage

Completed: 2026-05-16

Summary:

- Added `renderResourceSummaryReportToJsonValue` and `renderResourceSummaryReportToJson`.
- Resource summaries now preserve diagnostic `resourceKey` values for JSON-safe diagnostics.
- Added JSON coverage for invalid bytes-per-row, invalid rows-per-image, and too-small texture upload data.

## task-0277 — Add multi-textured dependency browser status coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=multi-textured-missing-texture-asset`.
- Browser status reports `render.texture.missing` for one missing texture asset among two textured materials.
- Playwright verifies extraction stops before resource creation and submission.

## task-0278 — Add texture scenario status schema cleanup

Completed: 2026-05-16

Summary:

- Added shared test-side status interfaces for RGBA tuples, texture samples, material texture samples, tinted samples, and sampler behavior.
- Reduced repeated texture/sampler status shapes in `test/e2e/example-status-types.ts`.
- Validation run: test typecheck passes.

## task-0279 — Add shared-texture missing sampler browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-missing-sampler-resource`.
- Browser status reports missing shared sampler resource diagnostics for two shared-texture tinted materials.
- Focused Playwright coverage verifies no draw submission and no raw GPU handles.

## task-0280 — Add texture upload validation unit coverage for `rowsPerImage` padding

Completed: 2026-05-16

Summary:

- Added unit coverage for `rowsPerImage > height` on single-layer uploads without requiring extra bytes.
- Added stable non-integer `rowsPerImage` diagnostic coverage.
- Clarified invalid `rowsPerImage` messages to require an integer minimum.

## task-0281 — Add shared-texture missing texture browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-missing-texture-resource`.
- Browser status reports the shared missing texture resource key for two material bind groups.
- Focused Playwright coverage verifies resource setup stops before submission.

## task-0282 — Add multi-textured missing sampler browser diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=multi-textured-missing-sampler-resource`.
- Browser status reports one missing sampler GPU resource among two textured draws.
- Focused Playwright coverage verifies stable diagnostics and no raw GPU handles.

## task-0283 — Add multi-textured missing sampler asset extraction coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=multi-textured-missing-sampler-asset`.
- Browser status reports `render.sampler.missing` for one unregistered sampler asset among two textured materials.
- Playwright verifies extraction stops before resource creation and submission.

## task-0284 — Add texture resource diagnostic message browser assertions

Completed: 2026-05-16

Summary:

- Strengthened invalid texture upload Playwright assertions to lock browser-visible diagnostic messages.
- Covered invalid bytes-per-row, invalid rows-per-image, and too-small upload data messages.
- Focused Playwright coverage for `test/e2e/invalid-texture-upload.spec.ts` passes.

## task-0285 — Add texture resource failure status schema cleanup

Completed: 2026-05-16

Summary:

- Added shared test-side interfaces for missing texture resources, missing sampler resources, missing asset metadata, and upload validation metadata.
- Updated multi-entity status typing to include resource-key diagnostics.
- Validation run: test typecheck passes.

## task-0286 — Add multi-textured missing texture and sampler resource diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=multi-textured-missing-texture-sampler-resources`.
- Browser status reports one material missing both texture and sampler GPU resources.
- Focused Playwright coverage verifies both resource keys and no submission.

## task-0287 — Add shared-texture missing texture and sampler resource diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-missing-texture-sampler-resources`.
- Browser status reports both shared texture and sampler resources missing across two material bind groups.
- Focused Playwright coverage verifies all four stable diagnostics.

## task-0288 — Add resource summary JSON coverage for sampler diagnostics

Completed: 2026-05-16

Summary:

- Added resource-summary JSON tests for missing sampler creation support and sampler creation failure.
- JSON output preserves stable sampler resource keys and messages.
- The JSON helper omits raw sampler handles.

## task-0289 — Add texture dependency readiness shared-resource coverage

Completed: 2026-05-16

Summary:

- Added unit coverage for multiple materials sharing ready texture/sampler resource keys.
- Added missing shared dependency coverage that reports one diagnostic per checked material.
- Focused material dependency readiness tests pass.

## task-0290 — Add texture scenario availability coverage

Completed: 2026-05-16

Summary:

- Unknown-scenario Playwright coverage now advertises representative new texture/sampler asset and resource diagnostic scenarios.
- The assertion remains partial rather than exact-list brittle.
- Focused unknown-scenario Playwright coverage passes.

## task-0291 — Add resource summary JSON coverage for buffer resource keys

Completed: 2026-05-16

Summary:

- Added resource-summary JSON coverage for mesh, material, and view-uniform diagnostics carrying resource keys.
- JSON output includes codes, messages, severities, and resource keys without raw buffer handles.
- Focused resource summary JSON tests pass.

## task-0292 — Add resource summary merge resource-key coverage

Completed: 2026-05-16

Summary:

- Added merge coverage for texture and sampler diagnostics carrying resource keys.
- Merged summaries preserve diagnostic order/resource keys and recompute warning totals.
- Focused resource summary merge tests pass.

## task-0293 — Document resource summary JSON helper

Completed: 2026-05-16

Summary:

- Updated `docs/RENDER_FRAME_READINESS.md` for the resource summary JSON helper.
- Documented stable diagnostic resource keys and the no-raw-GPU-handle boundary.

## task-0294 — Add texture diagnostics assertion helper for Playwright tests

Completed: 2026-05-16

Summary:

- Added a local `diagnosticResourcePairs` helper in missing texture resource Playwright coverage.
- Reused the helper for repeated texture/sampler resource-key diagnostic assertions.
- Validation run: test typecheck passes.

## task-0295 — Add sampler resource unit coverage for descriptor labels

Completed: 2026-05-16

Summary:

- Expanded sampler GPU resource tests for descriptor label propagation.
- Added stable creation-failure diagnostics with resource key and message assertions.
- Focused texture resource tests pass.

## task-0296 — Add shared-sampler missing sampler asset extraction coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-sampler-missing-sampler-asset`.
- Browser status reports two `render.sampler.missing` diagnostics for two materials sharing one unregistered sampler asset.
- Focused Playwright coverage verifies extraction stops before resource creation and submission.

## task-0297 — Add shared-sampler missing sampler resource diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-sampler-missing-sampler-resource`.
- Browser status reports the shared missing sampler GPU resource key for two material bind groups.
- Focused Playwright coverage verifies resource setup stops before submission.

## task-0298 — Add shared-sampler missing texture resource diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-sampler-missing-texture-resource`.
- Browser status reports one missing texture GPU resource in a shared-sampler two-material scene.
- Focused Playwright coverage verifies the affected texture key and no submission.

## task-0299 — Add texture diagnostics matrix docs table

Completed: 2026-05-16

Summary:

- Added a texture/sampler diagnostic matrix to `docs/BROWSER_E2E_RENDERING.md`.
- The matrix groups missing asset, missing GPU resource, and upload-validation scenarios by phase and primary diagnostic.

## task-0300 — Add texture asset diagnostic assertion helper

Completed: 2026-05-16

Summary:

- Added a local asset diagnostic pair helper in texture dependency Playwright coverage.
- Texture/sampler asset dependency tests now use the helper for code/asset-key assertions.
- Focused texture dependency Playwright coverage passes.

## task-0301 — Add shared-sampler missing texture and sampler resource diagnostics

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-sampler-missing-texture-sampler-resources`.
- Browser status reports one missing texture resource and the shared missing sampler resource without raw GPU handles.
- Focused Playwright coverage verifies resource setup stops before submission.

## task-0302 — Add shared-sampler missing texture asset extraction coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-sampler-missing-texture-asset`.
- Browser status reports `render.texture.missing` for the missing right texture asset while both materials share one sampler asset.
- Focused Playwright coverage verifies extraction stops before GPU resource creation or draw submission.

## task-0303 — Add texture diagnostics availability coverage for shared-sampler cases

Completed: 2026-05-16

Summary:

- Unknown-scenario Playwright coverage now advertises representative shared-sampler asset and resource diagnostics scenarios.
- The assertion remains partial and stable.
- Focused unknown-scenario Playwright coverage passes.

## task-0304 — Add texture diagnostic matrix coverage for shared-sampler rows

Completed: 2026-05-16

Summary:

- Updated `docs/BROWSER_E2E_RENDERING.md` to include the shared-sampler missing texture asset scenario.
- The texture/sampler diagnostic matrix now includes shared-sampler missing texture asset, missing sampler asset, missing texture resource, missing sampler resource, and combined resource rows.
- Formatting validation passes.

## task-0305 — Add multi-textured asset diagnostic assertion helper

Completed: 2026-05-16

Summary:

- Added a local `assetDiagnosticPairs` helper in multi-textured Playwright coverage.
- Multi-textured and shared-sampler missing asset assertions now compare stable code/asset-key pairs.
- The affected Playwright file passes.

## task-0306 — Add combined shared-sampler availability coverage

Completed: 2026-05-16

Summary:

- Unknown-scenario Playwright coverage now advertises `shared-sampler-missing-texture-sampler-resources`.
- Scenario availability assertions remain partial.
- Focused unknown-scenario Playwright coverage passes.

## task-0307 — Add shared-texture missing texture asset extraction coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-missing-texture-asset`.
- Browser status reports two `render.texture.missing` diagnostics for two materials sharing one unregistered texture asset.
- Focused Playwright coverage verifies extraction stops before GPU resource creation or draw submission.

## task-0308 — Add shared-texture missing sampler asset extraction coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-missing-sampler-asset`.
- Browser status reports two `render.sampler.missing` diagnostics for two materials sharing one unregistered sampler asset.
- Focused Playwright coverage verifies extraction stops before GPU resource creation or draw submission.

## task-0309 — Add shared-texture combined missing asset extraction coverage

Completed: 2026-05-16

Summary:

- Added `?scenario=shared-texture-missing-texture-sampler-assets`.
- Browser status reports texture-then-sampler diagnostics for each renderable sharing the missing texture/sampler pair.
- Focused Playwright coverage verifies no resource creation or draw submission.

## task-0310 — Add shared-texture asset diagnostics availability coverage

Completed: 2026-05-16

Summary:

- Unknown-scenario Playwright coverage now advertises the shared-texture missing asset scenarios.
- Scenario availability assertions remain partial.
- Focused unknown-scenario Playwright coverage passes.

## task-0311 — Add shared-texture asset diagnostic docs

Completed: 2026-05-16

Summary:

- Updated browser E2E docs with shared-texture missing asset smokes, scenario index entries, and diagnostic matrix rows.
- Documented that shared texture/sampler assets fail during extraction before renderer resource creation.
- Formatting validation passes.

## task-0312 — Add shared-texture asset status typing

Completed: 2026-05-16

Summary:

- Added test-side status types for missing shared texture and shared sampler asset metadata.
- Multi-entity status typing now exposes `missingSharedTextureAsset` and `missingSharedSamplerAsset`.
- Test typechecking passes.

## task-0313 — Add shared dependency missing texture extraction unit coverage

Completed: 2026-05-16

Summary:

- Added render extraction unit coverage for two renderables sharing a missing texture dependency.
- Assertions verify no mesh draws, per-renderable diagnostics, and report diagnostic counts.
- Focused render extraction tests pass.

## task-0314 — Add shared dependency missing sampler extraction unit coverage

Completed: 2026-05-16

Summary:

- Added render extraction unit coverage for two renderables sharing a missing sampler dependency.
- Assertions verify stable diagnostic order and report diagnostic counts.
- Focused render extraction tests pass.

## task-0315 — Add shared dependency combined missing extraction unit coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for two renderables sharing both missing texture and sampler dependencies.
- Diagnostics are asserted texture-before-sampler per affected renderable.
- Focused render extraction tests pass.

## task-0316 — Add shared dependency loading texture extraction coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for two renderables sharing a loading texture dependency.
- Assertions verify blocked draws and per-renderable `render.texture.loading` diagnostics.
- Focused render extraction tests pass.

## task-0317 — Add shared dependency failed sampler extraction coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for two renderables sharing a failed sampler dependency.
- Assertions verify blocked draws and per-renderable `render.sampler.failed` diagnostics.
- Focused render extraction tests pass.

## task-0318 — Add shared dependency mixed texture/sampler asset-state coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for shared loading texture plus failed sampler dependencies.
- Assertions verify deterministic texture-before-sampler diagnostics per renderable.
- Focused render extraction tests pass.

## task-0319 — Add shared dependency failed texture extraction coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for two renderables sharing a failed texture dependency.
- Assertions verify per-renderable `render.texture.failed` diagnostics and report counts.
- Focused render extraction tests pass.

## task-0320 — Add shared dependency loading sampler extraction coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for two renderables sharing a loading sampler dependency.
- Assertions verify per-renderable `render.sampler.loading` diagnostics and report counts.
- Focused render extraction tests pass.

## task-0321 — Add shared dependency failed texture/loading sampler coverage

Completed: 2026-05-16

Summary:

- Added extraction coverage for shared failed texture plus loading sampler dependencies.
- Assertions verify deterministic diagnostic order and report counts.
- Focused render extraction tests pass.

## task-0322 — Add shared dependency fixture helper

Completed: 2026-05-16

Summary:

- Added a render extraction fixture helper for two renderables sharing texture/sampler dependencies.
- Reused the helper across shared dependency asset-state tests.
- Focused render extraction tests pass.

## task-0323 — Add shared dependency diagnostic pair helper

Completed: 2026-05-16

Summary:

- Added a unit-test helper that maps extraction diagnostics to code/asset-key pairs.
- Shared dependency tests now assert compact diagnostic order without duplicating full diagnostic objects.
- Focused render extraction tests pass.

## task-0324 — Add shared dependency report count assertions

Completed: 2026-05-16

Summary:

- Shared dependency extraction tests now assert `snapshot.report.diagnostics`.
- The report count matches the number of emitted extraction diagnostics.
- Focused render extraction tests pass.

## task-0325 — Document texture dependency extraction diagnostic order

Completed: 2026-05-16

Summary:

- Updated render-frame readiness docs to state texture validation runs before sampler validation for texture-backed materials.
- The note is scoped to extraction diagnostics and does not prescribe renderer behavior.
- Formatting validation passes.

## task-0326 — Add shared texture browser diagnostic helper coverage

Completed: 2026-05-16

Summary:

- Added repeated per-renderable asset diagnostic assertions for shared texture browser statuses.
- Shared texture asset Playwright coverage verifies stable duplicated asset-key diagnostics.
- The affected Playwright file passes.

## task-0327 — Add blocked texture dependency assertion helper

Completed: 2026-05-16

Summary:

- Added a local helper that asserts blocked dependency snapshots have no mesh draws, expected diagnostic pairs, and matching report counts.
- Shared texture/sampler dependency unit tests use the helper where practical.
- Targeted render extraction tests pass.

## task-0328 — Add single dependency report count assertions

Completed: 2026-05-16

Summary:

- Existing single-renderable texture/sampler dependency tests now assert `snapshot.report.diagnostics`.
- Assertions use local helpers where practical.
- Targeted render extraction tests pass.

## task-0329 — Add extraction dependency diagnostic order docs

Completed: 2026-05-16

Summary:

- Render readiness docs now document texture-before-sampler diagnostic order for texture-backed material extraction.
- The note stays tied to extraction diagnostics and does not change implementation behavior.
- Formatting validation passes.

## task-0330 — Add browser status assertion for shared texture combined asset diagnostic order

Completed: 2026-05-16

Summary:

- The combined shared-texture missing asset Playwright test now asserts texture-then-sampler diagnostic order per renderable.
- The assertion uses the repeated per-renderable diagnostic helper.
- The affected Playwright file passes.

## task-0331 — Add route coverage for shared texture asset scenarios

Completed: 2026-05-16

Summary:

- Added lightweight Playwright route coverage for shared-texture missing asset scenarios.
- The tests assert `phase: "extract"`, zero draw submission, and focused status shape.
- Targeted route coverage passes.

## task-0332 — Add route coverage for shared sampler asset scenarios

Completed: 2026-05-16

Summary:

- Added lightweight Playwright route coverage for shared-sampler missing asset scenarios.
- The tests assert extraction-phase status and no draw submission.
- Targeted route coverage passes.

## task-0333 — Add browser E2E route coverage documentation

Completed: 2026-05-16

Summary:

- Documented that shared texture/sampler route specs are narrow URL dispatch guards.
- Clarified that deeper multi-textured tests own duplicate diagnostic order assertions.
- Formatting validation passes.

## task-0334 — Add shared asset route assertion helper

Completed: 2026-05-16

Summary:

- Added a shared Playwright helper for texture/sampler asset route status assertions.
- Shared texture and shared sampler route specs now use the helper.
- Targeted route coverage passes.

## task-0335 — Add extraction failure diagnostic count status

Completed: 2026-05-16

Summary:

- Extraction failure browser statuses now include `diagnosticCounts`.
- Route helper coverage asserts non-zero extraction counts and zero downstream counts.
- Targeted route coverage passes.

## task-0336 — Add extraction failure diagnostic count documentation

Completed: 2026-05-16

Summary:

- Browser E2E docs now describe extraction-failure diagnostic count summaries.
- The note keeps failed-route summaries comparable with successful frame summaries.
- Formatting validation passes.

## task-0337 — Add unknown scenario diagnostic count status

Completed: 2026-05-16

Summary:

- Unknown scenario browser statuses now include zeroed `diagnosticCounts`.
- Unknown-scenario Playwright coverage asserts the zero-count summary.
- Targeted unknown-scenario coverage passes.

## task-0338 — Add resource-binding failure diagnostic counts

Completed: 2026-05-16

Summary:

- Resource-binding failure browser statuses now include `diagnosticCounts`.
- Missing mesh/material resource Playwright coverage asserts binding-plan and readiness diagnostic buckets.
- `npm run check` and full Playwright coverage pass.

## task-0339 — Add extraction diagnostic count assertions for non-texture failures

Completed: 2026-05-16

Summary:

- Missing mesh asset, missing material asset, layer mismatch, and disabled renderable Playwright tests now assert extraction-failure `diagnosticCounts`.
- Assertions stay focused on status shape and downstream zero counts.
- `npm run check` and full Playwright coverage pass.

## task-0340 — Add no-raw-GPU assertion helper for texture failures

Completed: 2026-05-16

Summary:

- Added `expectStatusJsonSafeForGpu` for JSON-safe browser status assertions.
- Texture/sampler asset, resource, routing, and upload failure specs use the helper.
- Targeted Playwright coverage passed.

## task-0341 — Split multi-entity scenario dispatch into a lookup table

Completed: 2026-05-16

Summary:

- Replaced the nested multi-entity scenario ternary with `scenarioRenderers`.
- Added small dispatch helper factories without moving ECS state into renderer-owned structures.
- `check:examples` and full Playwright coverage passed.

## task-0342 — Document browser diagnostic count phases

Completed: 2026-05-16

Summary:

- Documented `diagnosticCounts` buckets and phase interpretation in `docs/BROWSER_E2E_RENDERING.md`.
- Preserved ECS/render extraction and JSON-safe status boundaries.
- Docs-only change.

## task-0343 — Add route guard coverage for resource-binding scenarios

Completed: 2026-05-16

Summary:

- Added lightweight route coverage for missing material and mesh resource scenarios.
- The guard asserts `phase: "resource-bindings"` without duplicating detailed diagnostics.
- Targeted Playwright coverage passed.

## task-0344 — Add diagnostic count assertions for asset-state failures

Completed: 2026-05-16

Summary:

- Mesh and material loading/failed asset specs now assert extraction `diagnosticCounts`.
- Registry diagnostic assertions remain focused on failure bodies.
- Targeted Playwright coverage passed.

## task-0345 — Add diagnostic counts for texture resource failures

Completed: 2026-05-16

Summary:

- Texture/sampler GPU resource failure statuses now include resource-phase `diagnosticCounts`.
- Missing texture resource coverage asserts resource counts and zero downstream buckets.
- Targeted Playwright coverage passed.

## task-0346 — Add diagnostic counts for texture upload validation

Completed: 2026-05-16

Summary:

- Invalid texture upload statuses now include resource-phase `diagnosticCounts`.
- Bytes-per-row, short data, and rows-per-image specs assert the count summaries.
- Targeted Playwright coverage passed.

## task-0347 — Guard multi-entity scenario registry alignment

Completed: 2026-05-16

Summary:

- Added a no-browser Vitest guard comparing `knownScenarios` with `scenarioRenderers`.
- The guard catches missing or extra scenario dispatch entries.
- Targeted Vitest coverage passed.

## task-0348 — Add route guard coverage for texture upload failures

Completed: 2026-05-16

Summary:

- Added lightweight route coverage for invalid texture upload scenarios.
- The guard asserts `phase: "resources"`, diagnostic code, and no draw submission.
- Targeted Playwright coverage passed.

## task-0349 — Share zero-submission browser assertions

Completed: 2026-05-16

Summary:

- Added `expectNoDrawSubmissionStatus` for browser failure status checks.
- Texture dependency and texture resource failure specs use the helper.
- Targeted typecheck and Playwright coverage passed.

## task-0350 — Share browser diagnostic count helpers

Completed: 2026-05-16

Summary:

- Added `expectedDiagnosticCounts` for shared diagnostic count expectations.
- Texture resource and invalid upload specs use the shared helper.
- Targeted typecheck and Playwright coverage passed.

## task-0351 — Add texture dependency diagnostic count assertions

Completed: 2026-05-16

Summary:

- Texture dependency asset status coverage now asserts extraction `diagnosticCounts`.
- Missing, loading, and failed texture/sampler dependency rows are covered.
- Targeted Playwright coverage passed.

## task-0352 — Add multi-textured asset diagnostic count assertions

Completed: 2026-05-16

Summary:

- Multi-textured texture/sampler asset failure specs now assert diagnostic count summaries.
- Shared texture/sampler cases lock one-draw and two-draw extraction totals.
- Targeted Playwright coverage passed.

## task-0353 — Add resource-binding route count assertions

Completed: 2026-05-16

Summary:

- Resource-binding route guards now assert binding and draw diagnostic count buckets.
- Route/status scope remains lightweight.
- Targeted Playwright coverage passed.

## task-0354 — Add zero-submission helper coverage to asset status specs

Completed: 2026-05-16

Summary:

- Mesh and material asset status specs now use `expectNoDrawSubmissionStatus`.
- Registry diagnostic checks remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0355 — Share asset-status diagnostic count helpers

Completed: 2026-05-16

Summary:

- Mesh and material asset status specs now use `expectedDiagnosticCounts`.
- Extraction count expectations remain unchanged.
- Targeted Playwright coverage passed.

## task-0356 — Share missing-asset diagnostic count helpers

Completed: 2026-05-16

Summary:

- Missing mesh and material asset specs now use `expectedDiagnosticCounts`.
- Stable diagnostic code assertions remain unchanged.
- Targeted Playwright coverage passed.

## task-0357 — Use no-submit helper in missing-asset specs

Completed: 2026-05-16

Summary:

- Missing mesh and material asset specs now call `expectNoDrawSubmissionStatus`.
- Existing diagnostic assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0358 — Use no-submit helper in multi-textured asset failures

Completed: 2026-05-16

Summary:

- Multi-textured asset failure specs now use the shared no-submit helper.
- Asset diagnostic order and key assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0359 — Use no-submit helper in route guard specs

Completed: 2026-05-16

Summary:

- Resource-binding and texture-upload route guards now call `expectNoDrawSubmissionStatus`.
- Route phase assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0360 — Share helpers in missing resource specs

Completed: 2026-05-16

Summary:

- Missing material and mesh resource specs now use shared count and no-submit helpers.
- Detailed diagnostic assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0361 — Share helpers in extraction skip specs

Completed: 2026-05-16

Summary:

- Layer mismatch and disabled renderable specs now use shared count and no-submit helpers.
- Diagnostic body assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0362 — Share helpers in unknown scenario spec

Completed: 2026-05-16

Summary:

- Unknown scenario coverage now uses shared count and no-submit helpers.
- Available scenario assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0363 — Share no-submit helper in texture asset routes

Completed: 2026-05-16

Summary:

- Texture asset route guard helper now calls `expectNoDrawSubmissionStatus`.
- Route/status assertions remain focused.
- Targeted typecheck and Playwright coverage passed.

## task-0364 — Share count helper in route guards

Completed: 2026-05-16

Summary:

- Texture asset route guard helper now uses `expectedDiagnosticCounts`.
- Shared sampler/texture route coverage still passes.
- Targeted typecheck and Playwright coverage passed.

## task-0365 — Name ordered multi-entity scenario ids

Completed: 2026-05-16

Summary:

- Added `knownScenarioIds` and derived `knownScenarios` from it.
- Unknown-scenario `availableScenarios` now uses the ordered id array directly.
- Scenario guard, example syntax, and unknown-scenario Playwright coverage passed.

## task-0366 — Use helper counts in core e2e status smoke specs

Completed: 2026-05-16

Summary:

- ECS multi-entity status smoke now uses `expectedDiagnosticCounts`.
- Triangle/basic status checks were left unchanged because they do not publish the same count summary.
- Targeted typecheck and Playwright coverage passed.

## task-0367 — Use helper counts in texture success specs

Completed: 2026-05-16

Summary:

- Successful texture, sampler, mixed unlit, and multi-textured specs now use `expectedDiagnosticCounts`.
- Pixel/readback assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0368 — Use helper counts in primitive/camera specs

Completed: 2026-05-16

Summary:

- Primitive and camera specs now use `expectedDiagnosticCounts`.
- Geometry and readback assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0369 — Document browser e2e helper conventions

Completed: 2026-05-16

Summary:

- Documented the shared browser e2e status helpers in `docs/BROWSER_E2E_RENDERING.md`.
- The note reinforces JSON-safe count/no-submit/GPU-handle boundaries.
- `npm run check` and full Playwright coverage pass.

## task-0370 — Share count helpers in visibility specs

Completed: 2026-05-16

Summary:

- Visibility, disabled-peer, render-order, and depth specs now use `expectedDiagnosticCounts`.
- Readback and scenario-specific status assertions remain unchanged.
- Targeted typecheck and Playwright coverage passed.

## task-0371 — Remove repeated zero fields from route guards

Completed: 2026-05-16

Summary:

- Resource-binding and texture asset route guards now rely on shared no-submit/count helpers.
- Route assertions remain focused on phase, scenario, and stable status fields.
- Targeted typecheck and Playwright coverage passed.

## task-0372 — Add static scenario coverage guard for e2e routes

Completed: 2026-05-16

Summary:

- Extended the no-browser scenario guard to scan literal route URLs and simple fixture scenarios.
- Intentional negative fixtures are explicitly excluded.
- Targeted Vitest coverage passed.

## task-0373 — Add successful route smoke for primitive scenarios

Completed: 2026-05-16

Summary:

- Added lightweight Playwright route/status coverage for built-in primitive scenarios.
- The guard asserts submitted frames and matching primitive status without duplicating pixel tests.
- Targeted typecheck and Playwright coverage passed.

## task-0374 — Add successful route smoke for camera scenarios

Completed: 2026-05-16

Summary:

- Added lightweight Playwright route/status coverage for perspective and orthographic camera scenarios.
- The guard asserts submitted frames and expected projection status without duplicating readback tests.
- Targeted typecheck and Playwright coverage passed.

## task-0375 — Add route smoke for visibility/order scenarios

Completed: 2026-05-16

Summary:

- Added lightweight Playwright route/status coverage for render-layer, disabled-peer, render-order, and depth scenarios.
- The guard asserts submitted frames and representative scenario status fields without duplicating pixel tests.
- Targeted typecheck and Playwright coverage passed.

## task-0376 — Add route smoke for texture success scenarios

Completed: 2026-05-16

Summary:

- Added lightweight Playwright route/status coverage for texture, sampler, shared-texture, multi-textured, and mixed pipeline scenarios.
- The guard asserts submitted frames and representative texture/sampler/pipeline status fields without duplicating readback tests.
- Targeted typecheck and Playwright coverage passed.

## task-0377 — Extend static route guard to fixture scenarios

Completed: 2026-05-16

Summary:

- Extended the no-browser route guard to check simple `scenario: "..."` fixtures in e2e specs.
- The guard keeps intentional unknown-scenario fixtures excluded.
- Targeted Vitest coverage passed.

## task-0378 — Document scenario route guard coverage

Completed: 2026-05-16

Summary:

- Documented the no-browser scenario registry/route guard in `docs/BROWSER_E2E_RENDERING.md`.
- The note explains that the static guard complements browser coverage rather than replacing it.
- No implementation behavior changed.

## task-0379 — Add route smoke docs entries for new guards

Completed: 2026-05-16

Summary:

- Documented primitive, camera, visibility/order/depth, and texture route smoke specs.
- The entries keep route/status guards separate from detailed pixel/readback assertions.
- No implementation behavior changed.

## task-0380 through task-0419 — Browser E2E route and loader cleanup

Completed: 2026-05-16

Completed task ids:

- `task-0380` — Add route smoke for extraction failure scenarios.
- `task-0381` — Add route smoke for texture asset failure scenarios.
- `task-0382` — Extract shared multi-entity route loader helper.
- `task-0383` — Add route smoke coverage table to docs.
- `task-0384` — Add route smoke status attachments.
- `task-0385` — Add route smoke for texture resource failures.
- `task-0386` — Document texture resource route guards.
- `task-0387` — Add route smoke for unknown scenario dispatch.
- `task-0388` — Extract shared route failure assertion helper.
- `task-0389` — Document route helper conventions.
- `task-0390` — Use route loader in extraction failure specs.
- `task-0391` — Use route loader in texture dependency specs.
- `task-0392` — Use route loader in texture resource specs.
- `task-0393` — Use route loader in upload/resource binding specs.
- `task-0394` — Document detailed-spec loader reuse.
- `task-0395` — Use route loader in primitive and camera specs.
- `task-0396` — Use route loader in visibility and ordering specs.
- `task-0397` — Use route loader in texture success specs.
- `task-0398` — Use route loader in core multi-entity status spec.
- `task-0399` — Audit remaining multi-entity e2e loaders.
- `task-0400` — Extract generic example status loader.
- `task-0401` — Use generic loader in clear status specs.
- `task-0402` — Use generic loader in triangle status specs.
- `task-0403` — Use generic loader in clear pixel specs.
- `task-0404` — Document generic example loader helper.
- `task-0405` — Use generic loader in readback diagnostics.
- `task-0406` — Document unsupported-WebGPU loader exception.
- `task-0407` — Audit generic loader adoption.
- `task-0408` — Run consolidated route Playwright suite.
- `task-0409` — Run full browser Playwright suite.
- `task-0410` — Extend static guard to route loader calls.
- `task-0411` — Document loader-aware static route guard.
- `task-0412` — Add direct multi-entity navigation audit.
- `task-0413` — Run full standard check.
- `task-0414` — Refill next browser verification tasks.
- `task-0415` — Guard direct multi-entity navigation.
- `task-0416` — Document direct navigation guard.
- `task-0417` — Add route helper import audit.
- `task-0418` — Refresh browser route docs after audits.
- `task-0419` — Run full validation after guard audits.

Summary:

- Added route smoke specs for extraction failures, texture/sampler dependency failures, texture/sampler GPU resource failures, and unknown scenario dispatch.
- Added `loadExampleStatus`, `loadMultiEntityScenarioStatus`, and `expectMultiEntityRouteFailureStatus` browser e2e helpers.
- Migrated multi-entity, clear, triangle, texture, resource, primitive, camera, visibility, ordering, depth, and readback diagnostic specs to shared loader helpers where practical.
- Added no-browser static guards for helper-call scenario registration, direct multi-entity navigation regressions, and route smoke helper usage.
- Expanded `docs/BROWSER_E2E_RENDERING.md` with a route guard coverage table, helper conventions, detailed-spec reuse notes, unsupported-WebGPU loader exception, and static guard behavior.
- Validation run: targeted Playwright/Vitest throughout, consolidated route suite passed with 57 tests, full `npm run test:e2e -- --reporter=line` passed with 123 tests, and `npm run check` passed with 129 Vitest files / 563 tests.

## task-0420 through task-0424 — Failure route helper cleanup

Completed: 2026-05-16

Completed task ids:

- `task-0420` — Use failure helper in resource route specs.
- `task-0421` — Use failure helper in texture resource routes.
- `task-0422` — Use failure helper in scenario route guard.
- `task-0423` — Document failure helper route coverage.
- `task-0424` — Audit route helper docs and static guards.

Summary:

- Migrated resource-binding, texture-upload, texture-resource, and unknown
  scenario route guards to `expectMultiEntityRouteFailureStatus`.
- Added an explicit helper opt-out for early resource-upload failures that stop
  before `renderingBackend` metadata is published.
- Documented `expectMultiEntityRouteFailureStatus` as the standard shallow
  failure route helper and clarified that route specs can keep count/code checks
  while detailed specs own diagnostic bodies and ordering.
- Audited the route-helper static guard behavior; the no-browser guard enforces
  shared route loading for `*-routing.spec.ts`, while failure-helper usage is
  still a follow-up task.
- Validation run: targeted `typecheck:test`, Playwright route specs for the
  migrated route families, `npm run format:check`, and
  `npm test -- test/examples/multi-entity-scenarios.test.mjs` passed.

## task-0425 through task-0429 — Failure helper guard and route-suite validation

Completed: 2026-05-16

Completed task ids:

- `task-0425` — Use failure helper in texture asset route helper.
- `task-0426` — Add static guard for failure route helpers.
- `task-0427` — Document failure helper static guard.
- `task-0428` — Run consolidated failure route suite.
- `task-0429` — Run full route smoke suite.

Summary:

- Routed `expectTextureAssetRouteStatus` through
  `expectMultiEntityRouteFailureStatus` while preserving shared asset
  render-world/resource summary assertions.
- Added a no-browser static guard that checks known shallow failure route specs
  use the shared failure helper directly or through the approved texture asset
  helper.
- Documented the static guard behavior and intentional submitted-frame route
  exceptions.
- Validation run: targeted `typecheck:test`, shared asset route Playwright
  coverage, static scenario guard tests, formatting validation, consolidated
  failure route Playwright coverage with 37 tests, and full route smoke
  Playwright coverage with 57 tests passed.

## task-0430 through task-0434 — Browser light status coverage

Completed: 2026-05-16

Completed task ids:

- `task-0430` — Add browser route smoke for light extraction.
- `task-0431` — Add browser diagnostics for invalid light extraction.
- `task-0432` — Document browser light status coverage.
- `task-0433` — Add static scenario guard coverage for light routes.
- `task-0434` — Run consolidated light browser checks.

Summary:

- Added `directional-light-extraction` and `invalid-light-extraction`
  multi-entity browser scenarios.
- Browser status now includes `extraction.lights` from the render snapshot and
  a light summary for light-specific route assertions.
- Successful submitted statuses now include JSON-safe extraction diagnostics
  when extraction emits warnings before the unlit draw path still submits.
- Added `test/e2e/lighting-routing.spec.ts` for valid directional light
  extraction and invalid spot-light diagnostics.
- Documented that current browser light coverage proves ECS-owned extraction
  data only; the current WebGPU shader path remains unlit.
- Validation run: targeted `typecheck:test`, `check:examples`, static scenario
  guard tests, `format:check`, and light route Playwright coverage passed.

## task-0435 through task-0439 — Transformless light extraction

Completed: 2026-05-16

Completed task ids:

- `task-0435` — Extract transformless ambient lights.
- `task-0436` — Add browser route for ambient light extraction.
- `task-0437` — Add browser route for missing light transform diagnostics.
- `task-0438` — Document transformless light extraction.
- `task-0439` — Run consolidated light extraction validation.

Summary:

- Changed `extractRenderSnapshot` light extraction to query all ECS `Light`
  entities instead of only lights with `WorldTransform`.
- Ambient and environment lights now extract without `WorldTransform` using an
  identity transform packet; directional, point, and spot lights without
  `WorldTransform` emit `render.lightMissingTransform` and no light packet.
- Added core extraction tests for transformless ambient/environment lights and
  transformless directional/point/spot diagnostics.
- Added `ambient-light-extraction` and `missing-light-transform` browser
  scenarios and expanded `lighting-routing.spec.ts` to cover both.
- Updated browser and architecture docs with the transformless global-light rule
  and the transform-required directional/local-light diagnostic.
- Validation run: `typecheck`, `typecheck:test`, `check:examples`, targeted
  render extraction tests, static scenario guard tests, `format:check`, and
  lighting route Playwright coverage passed.

## task-0440 through task-0444 — Point and spot light extraction coverage

Completed: 2026-05-16

Completed task ids:

- `task-0440` — Cover point and spot light packet fields.
- `task-0441` — Add browser route for spot light extraction.
- `task-0442` — Document point and spot light extraction coverage.
- `task-0443` — Run consolidated lighting route suite.
- `task-0444` — Refill next MVP verification slice.

Summary:

- Added core extraction coverage for valid point and spot light packet fields,
  including entity-order stability, range, cone angles, intensity, and layer
  masks.
- Added `spot-light-extraction` to the browser multi-entity example and
  verified spot kind/range/cone fields in `lighting-routing.spec.ts`.
- Extended browser light status with range and cone-angle arrays from extracted
  packets.
- Documented spot-light route coverage while keeping shader lighting deferred.
- Refilled the backlog with remaining light-kind route slices for environment
  and point lights, followed by route-suite validation and next lighting
  resource planning.
- Validation run: targeted render extraction tests, `typecheck:test`,
  `check:examples`, static scenario guard tests, `format:check`, and lighting
  route Playwright coverage passed.

## task-0445 through task-0449 — Full light-kind browser coverage

Completed: 2026-05-16

Completed task ids:

- `task-0445` — Add browser route for environment light extraction.
- `task-0446` — Add browser route for point light extraction.
- `task-0447` — Document full light-kind route coverage.
- `task-0448` — Run full route smoke after light additions.
- `task-0449` — Plan next lighting resource slice.

Summary:

- Added `environment-light-extraction` and `point-light-extraction` browser
  scenarios.
- Expanded `lighting-routing.spec.ts` to cover directional, ambient,
  environment, point, spot, missing-transform, and invalid-light scenarios.
- Browser light status now exposes range and cone-angle arrays from extracted
  packets for point/spot route assertions.
- Updated browser e2e docs to list full light-kind route coverage while keeping
  shader lighting deferred.
- Refilled the backlog with the next environment-packet slice so environment
  authoring can map to `RenderSnapshot.environments`.
- Validation run: `typecheck:test`, `check:examples`, static scenario guard
  tests, `format:check`, lighting route Playwright coverage with 7 tests, and
  full route smoke Playwright coverage with 64 tests passed.

## task-0450 through task-0454 — Environment packet extraction

Completed: 2026-05-16

Completed task ids:

- `task-0450` — Promote environment light extraction to environment packets.
- `task-0451` — Update browser environment light route status.
- `task-0452` — Document environment packet extraction.
- `task-0453` — Run consolidated environment/light validation.
- `task-0454` — Plan next shadow schema slice.

Summary:

- Changed `LightKind.Environment` extraction to emit `EnvironmentPacket`
  entries with stable ids, color, intensity, layer masks, and `handle: null`.
- Environment authoring no longer increments `snapshot.lights`; browser status
  now exposes `extraction.environments` and an `environment` summary.
- Updated the environment browser route to expect zero light packets and one
  environment packet.
- Updated browser and architecture docs to distinguish ambient `LightPacket`
  extraction from environment `EnvironmentPacket` extraction.
- Refilled the backlog with shadow authoring schema and extraction tasks.
- Validation run: `typecheck`, `typecheck:test`, `check:examples`, targeted
  render extraction tests, static scenario guard tests, `format:check`, and
  lighting route Playwright coverage passed.

## task-0455 through task-0459 — Shadow authoring schema and diagnostics

Completed: 2026-05-16

Completed task ids:

- `task-0455` — Add LightShadowSettings authoring schema.
- `task-0456` — Validate LightShadowSettings inputs.
- `task-0457` — Extract basic shadow request packets.
- `task-0458` — Add browser route for shadow request diagnostics.
- `task-0459` — Document shadow schema boundary.

Summary:

- Added renderer-independent ECS `LightShadowSettings` authoring with stable
  defaults, validation, and render authoring registration.
- Added extraction of flat `ShadowRequestPacket`s for enabled directional
  lights and diagnostics for unsupported ambient/environment shadow requests.
- Added browser status fields for `extraction.shadowRequests` and a `shadow`
  summary.
- Added the `unsupported-shadow-request` browser scenario and Playwright route
  coverage for JSON-safe unsupported-shadow diagnostics.
- Documented that shadow settings are ECS authoring data while shadow maps,
  passes, cameras, atlases, and GPU resources remain renderer-owned future
  work.
- Validation run: `typecheck`, `typecheck:test`, `check:examples`, targeted
  component and extraction tests, `format:check`, and lighting route Playwright
  coverage passed.

## task-0460 through task-0464 — Shadow browser route coverage

Completed: 2026-05-16

Completed task ids:

- `task-0460` — Add browser route for directional shadow requests.
- `task-0461` — Add invalid shadow settings browser diagnostics.
- `task-0462` — Document supported shadow request routes.
- `task-0463` — Run consolidated shadow route validation.
- `task-0464` — Plan next environment-map handle slice.

Summary:

- Added `directional-shadow-request` browser scenario coverage for one
  extracted `ShadowRequestPacket` with stable light/shadow ids and layer masks.
- Added `invalid-shadow-settings` browser scenario coverage for
  `render.shadow.invalidMapSize`, `render.shadow.invalidBias`, and
  `render.shadow.zeroLayerMask` extraction diagnostics.
- Extended browser shadow status with request ids and caster/receiver layer
  masks.
- Documented supported, invalid, and unsupported shadow route expectations while
  keeping actual shadow rendering deferred.
- Refilled the backlog with the next environment-map handle extraction slice.
- Validation run: targeted `typecheck:test`, `check:examples`, static scenario
  guard tests, lighting route Playwright coverage, full `npm run check`, and
  full route smoke Playwright coverage passed.

## task-0465 through task-0494 — Environment-map handles and lighting resource planning

Completed: 2026-05-16

Completed task ids:

- `task-0465` — Add environment map handle authoring.
- `task-0466` — Validate environment map asset dependency.
- `task-0467` — Add browser route for environment map diagnostics.
- `task-0468` — Add browser route for environment map handle extraction.
- `task-0469` — Document environment map handle boundary.
- `task-0470` — Add loading/failed environment-map browser diagnostics.
- `task-0471` — Expose environment-map keys in snapshot inspection.
- `task-0472` — Cover environment-map handles in snapshot cloneability.
- `task-0473` — Document environment-map readiness diagnostics.
- `task-0474` — Diagnose malformed environment-map handles.
- `task-0475` — Add malformed environment-map browser diagnostics.
- `task-0476` — Document complete environment-map route matrix.
- `task-0477` — Expose diagnostic environment-map keys in browser status.
- `task-0478` — Keep renderer assembly JSON handle-safe.
- `task-0479` — Plan next renderer lighting resource slices.
- `task-0480` — Add light packet packing helper.
- `task-0481` — Add light buffer descriptor planning data.
- `task-0482` — Add environment resource planning.
- `task-0483` — Count light/environment resource planning summaries.
- `task-0484` — Document light/environment planning boundary.
- `task-0485` — Add snapshot lighting resource plan.
- `task-0486` — Add snapshot lighting resource plan JSON helper.
- `task-0487` — Adapt lighting plans into resource summary input.
- `task-0488` — Add browser status for lighting resources.
- `task-0489` — Document snapshot lighting resource plan.
- `task-0490` — Run consolidated lighting resource validation.
- `task-0491` — Add light buffer WebGPU descriptor plans.
- `task-0492` — Add light buffer GPU resource creation.
- `task-0493` — Count actual light GPU buffer resources.
- `task-0494` — Document light GPU buffer resource boundary.

Summary:

- Added ECS environment-map handle authoring, extraction validation, malformed
  handle diagnostics, cloneability coverage, snapshot inspection keys, and
  browser routes for ready, missing, loading, failed, and malformed
  environment-map handles.
- Added browser status diagnostics for environment-map asset keys while keeping
  renderer assembly JSON free of raw or secret handle payloads.
- Added renderer-side light packet packing, light buffer descriptors, WebGPU
  descriptor plans, and injected light GPU buffer resource creation for float
  and metadata buffers.
- Added environment resource planning and snapshot-level lighting resource
  plans with JSON helpers and browser status summaries.
- Extended renderer resource summaries to distinguish planned light buffers,
  created light GPU buffers, and environment-map requirements.
- Documented the light/environment resource boundary: derived from snapshots,
  renderer-owned on the WebGPU side, and still deferring bind groups, shader
  lighting consumption, skybox/IBL, and shadows.
- Validation run: targeted component/extraction/cloneability/inspection tests,
  static browser scenario tests, lighting Playwright route coverage, targeted
  WebGPU resource tests, `typecheck`, `typecheck:test`, `format:check`, full
  `npm run check`, and lighting route Playwright coverage passed during the run.

## task-0495 through task-0499 — Light GPU buffer snapshot adapter

Completed: 2026-05-16

Completed task ids:

- `task-0495` — Add light GPU buffer resource JSON helper.
- `task-0496` — Add snapshot light GPU buffer creation adapter.
- `task-0497` — Cover light GPU buffers in renderer assembly JSON.
- `task-0498` — Document snapshot light GPU buffer creation.
- `task-0499` — Run consolidated light GPU buffer validation.

Summary:

- Added JSON-safe serialization for light GPU buffer creation results, including
  validity, stable resource keys, light/GPU-buffer counts, diagnostics, and no
  raw GPU buffer handles.
- Added `createSnapshotLightGpuBuffers` to derive light GPU buffers from
  `RenderSnapshot` data with an injected device while treating empty light
  snapshots as valid no-ops.
- Preserved descriptor-plan diagnostics and buffer-creation diagnostics across
  the snapshot adapter.
- Extended renderer assembly JSON coverage so created light GPU buffer counts
  are visible while raw light buffer handles remain omitted.
- Documented that snapshot light GPU buffer creation derives renderer-owned
  buffers from snapshots and still defers bind groups, shader lighting, shadows,
  skybox, and IBL.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`,
  `format:check`, full `npm run check`, and lighting route Playwright coverage
  passed.

## task-0500 through task-0504 — Snapshot light JSON and bind group planning

Completed: 2026-05-16

Completed task ids:

- `task-0500` — Add snapshot light GPU buffer JSON helper.
- `task-0501` — Adapt snapshot light GPU buffers into resource summaries.
- `task-0502` — Add light bind group layout resource contract.
- `task-0503` — Add light bind group descriptor planning.
- `task-0504` — Document light bind group planning boundary.

Summary:

- Added JSON-safe serialization for snapshot light GPU buffer adapter results,
  including planned counts, descriptor-plan status, created resource keys, and
  diagnostics without raw buffers or packed typed arrays.
- Added a summary-input adapter for snapshot-created light GPU buffers so
  renderer resource summaries can count planned buffers and attempted GPU buffer
  creation.
- Added renderer-owned light bind group layout descriptor/resource creation for
  two read-only storage buffer bindings.
- Added light bind group descriptor planning from renderer-owned light GPU
  buffer resources plus stable layout keys, with JSON-safe summaries that omit
  raw buffers.
- Documented that light bind group planning derives from renderer-owned
  resources and still defers actual bind group creation, shader lighting,
  shadows, skybox, and IBL.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`, and
  `format:check` passed.

## task-0505 through task-0509 — Light bind group resources and summaries

Completed: 2026-05-16

Completed task ids:

- `task-0505` — Add light bind group resource creation.
- `task-0506` — Add light bind group resource JSON helper.
- `task-0507` — Count light bind group resources in summaries.
- `task-0508` — Document light bind group resource creation.
- `task-0509` — Run consolidated light bind group validation.

Summary:

- Added renderer-owned light bind group resource creation from descriptor plans,
  layout resources, and injected `createBindGroup` devices.
- Added diagnostics for null/invalid descriptor plans, missing layouts, missing
  device support, and bind group creation failure.
- Added JSON-safe inspection for light bind group resource creation results,
  omitting raw bind group, layout, and buffer handles.
- Extended renderer resource summaries and JSON output with `lightBindGroups`
  counts and diagnostics while preserving existing resource counts.
- Documented that light bind group resources derive from renderer-owned light
  buffer/layout resources while shader lighting, shadows, skybox, and IBL remain
  deferred.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`,
  `format:check`, full `npm run check`, and lighting route Playwright coverage
  passed.

## task-0510 through task-0514 — Snapshot light bind group composition

Completed: 2026-05-16

Completed task ids:

- `task-0510` — Add snapshot light bind group creation adapter.
- `task-0511` — Add snapshot light bind group JSON helper.
- `task-0512` — Cover snapshot light bind groups in renderer assembly JSON.
- `task-0513` — Document snapshot light bind group creation.
- `task-0514` — Run consolidated snapshot light bind group validation.

Summary:

- Added `createSnapshotLightBindGroupResources` to compose `RenderSnapshot`
  light data into light GPU buffers, light bind group layout resources,
  descriptor plans, and renderer-owned light bind group resources.
- Preserved diagnostics across light GPU buffer creation, layout creation,
  descriptor planning, and bind group creation while keeping empty light
  snapshots valid no-ops.
- Added JSON-safe inspection for snapshot light bind group composition results,
  including phase readiness, stable resource keys, counts, and diagnostics
  without raw buffers/layouts/bind groups or typed arrays.
- Extended renderer assembly JSON coverage with light bind group counts while
  keeping raw handles omitted.
- Documented the snapshot-to-light-bind-group resource path and reiterated that
  shader lighting, shadows, skybox, and IBL remain deferred.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`,
  `format:check`, full `npm run check`, and lighting route Playwright coverage
  passed.

## task-0515 through task-0519 — Snapshot light resource summary adapters

Completed: 2026-05-16

Completed task ids:

- `task-0515` — Adapt snapshot light bind groups into resource summaries.
- `task-0516` — Add snapshot light bind group resource summary JSON coverage.
- `task-0517` — Cover snapshot light bind group summaries in renderer assembly.
- `task-0518` — Document snapshot light bind group summary adapter.
- `task-0519` — Run consolidated light summary adapter validation.

Summary:

- Added `snapshotLightBindGroupResourcesToSummaryInput` so snapshot-derived
  planned light buffers, created light GPU buffers, and light bind group
  resources can feed standard renderer resource summaries.
- Added resource summary JSON coverage using actual snapshot light bind group
  creation results while keeping raw buffers, layouts, and bind groups omitted.
- Updated renderer assembly JSON fixtures to derive light resource counts from
  the snapshot summary adapter.
- Documented the summary adapter as inspection/readiness data, with shader
  lighting, shadows, skybox, and IBL still deferred.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`,
  `format:check`, full `npm run check`, and lighting route Playwright coverage
  passed.

## task-0520 through task-0523 — Focused snapshot light summaries

Completed: 2026-05-16

Completed task ids:

- `task-0520` — Add snapshot light resource summary report helper.
- `task-0521` — Add snapshot light resource summary JSON helper.
- `task-0522` — Document snapshot light resource summary helper.
- `task-0523` — Plan next shader-lighting boundary tasks.

Summary:

- Added `createSnapshotLightResourceSummaryReport` to wrap snapshot light bind
  group resource results in a standard `RenderResourceSummaryReport`.
- Added `snapshotLightResourceSummaryReportToJsonValue` and
  `snapshotLightResourceSummaryReportToJson`, delegating to the existing
  JSON-safe renderer resource summary format.
- Documented the focused summary helper as inspection/readiness plumbing for
  diagnostics, tests, and future browser status work.
- Refilled the ready backlog with small shader-lighting boundary tasks that do
  not enable full lighting shaders in one step.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`, and
  `format:check` passed.

## task-0524 through task-0528 — Light shader binding readiness boundary

Completed: 2026-05-16

Completed task ids:

- `task-0524` — Run consolidated snapshot light summary validation.
- `task-0525` — Add light shader binding metadata contract.
- `task-0526` — Validate light bind group layout against shader metadata.
- `task-0527` — Add light shader resource readiness diagnostics.
- `task-0528` — Document light shader binding boundary.

Summary:

- Ran consolidated validation after the snapshot light summary helpers.
- Added stable metadata for the future light shader bind group: packed light
  float storage at binding 0 and packed light metadata storage at binding 1.
- Added validation that compares light bind group layout descriptors against the
  light shader binding metadata.
- Added light shader resource readiness diagnostics for light GPU buffers,
  layout, bind group, and metadata validation.
- Documented that metadata/readiness helpers are inspection contracts only and
  do not activate shader lighting, shadows, skybox, or IBL.
- Validation run: targeted WebGPU tests, `typecheck`, `typecheck:test`, and
  `format:check` passed.

## task-0529 through task-0533 — Light shader readiness reporting boundary

Completed: 2026-05-16

Completed task ids:

- `task-0529` — Run consolidated light shader boundary validation.
- `task-0530` — Add light shader readiness JSON helper.
- `task-0531` — Add light shader readiness resource-summary bridge.
- `task-0532` — Document light shader readiness JSON/reporting.
- `task-0533` — Plan next minimal shader implementation tasks.

Summary:

- Ran consolidated validation after the light shader metadata/readiness slices.
- Added JSON-safe serialization for light shader readiness reports, including
  section readiness and stable diagnostics without raw buffers, layouts, bind
  groups, or shader modules.
- Added a resource-summary diagnostic bridge that exposes light shader readiness
  failures as stable warnings without changing resource counts.
- Documented the readiness JSON/reporting helpers as inspection surfaces only,
  with shader lighting, shadows, skybox, and IBL still deferred.
- Refilled the ready backlog with minimal WGSL/light shader contract tasks that
  do not enable full lighting in one slice.
- Validation run: full `npm run check`, lighting route Playwright coverage,
  focused light shader metadata tests, `typecheck`, `typecheck:test`, and
  `format:check` passed.

## task-0539 plus pnpm package split — Mesh/Material authoring and workspace boundaries

Completed: 2026-05-16

Completed task ids:

- `task-0539` — Replace MeshRenderer with mesh/material components.

Summary:

- Converted the repository to a pnpm workspace with
  `@aperture-engine/simulation`, `@aperture-engine/render`,
  `@aperture-engine/webgpu`, `@aperture-engine/runtime`, and
  `@aperture-engine/core`.
- Moved simulation, render-contract, and WebGPU implementation code under
  package-scoped `src` directories and updated tests/examples to import through
  package names.
- Made `@aperture-engine/core` the headless-safe umbrella package that excludes
  WebGPU APIs; `@aperture-engine/webgpu` is now the explicit backend import.
- Replaced the combined `MeshRenderer` authoring component with separate `Mesh`
  and `Material` ECS components and updated extraction, examples, fixtures, and
  tests.
- Decoupled primitive mesh asset builders from material handles; primitives now
  expose material slot labels only, while ECS `Material` selects the material
  asset for a renderable entity.
- Added the first runtime facade for headless simulation and extraction:
  `createSimulationApp` and `createExtractionApp`.
- Updated architecture, roadmap, Bevy-alignment, and monorepo-plan docs to
  reflect the implemented package boundaries and authoring model.
- Validation run: `pnpm run check`, focused spinning cube/primitive Playwright
  slice, and full `pnpm exec playwright test --reporter=line` all pass.

## task-0545 — Audit render pipeline against Three.js and PlayCanvas

Completed: 2026-05-16

Summary:

- Used `/Users/felixz/Projects/aperture/references/engine` as the canonical
  local PlayCanvas reference and
  `/Users/felixz/Projects/aperture/references/three.js` as the local Three.js
  reference.
- Added `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`.
- Compared Aperture's current render pipeline against reference patterns for
  render object identity, render lists/queues, pipeline caching, bind group
  contracts, render passes/frame graph, resource lifetime, draw command
  execution, and diagnostics.
- Refilled the ready backlog with follow-up tasks `task-0546` through
  `task-0550`.
- No render pipeline code was changed in this audit task.
- Validation run: `pnpm run format:check`.

## task-0546 through task-0550 — Render pipeline reference follow-ups

Completed: 2026-05-16

Completed task ids:

- `task-0546` — Add render frame phase model and report.
- `task-0547` — Expand WebGPU render pipeline cache keys.
- `task-0548` — Add bind group layout metadata and validation.
- `task-0549` — Introduce view/pass-scoped render queues.
- `task-0550` — Add renderer resource lifetime and version inspection.

Summary:

- Added explicit render-frame phase reports for apply, prepare, queue, resolve,
  command, and submit boundaries.
- Expanded WebGPU pipeline cache keys to include shader family/variant, render
  targets, vertex and bind group layouts, primitive/depth/blend state, material
  variants, and batch compatibility fields.
- Added unlit bind group layout metadata and validation for required groups,
  duplicate bindings, missing required bindings, and resource kind mismatches.
- Added renderer-independent view/pass queue records with reusable scratch and
  record-pool APIs for allocation-conscious frame-loop use.
- Added resource inspection records for live, missing, stale, and
  pending-destroy renderer resources and bridged those diagnostics into resource
  summaries.
- Recorded the no steady-state render hot-path allocation rule in architecture
  docs and decision 0009.
- Validation run: focused render/WebGPU tests, `pnpm run typecheck`,
  `pnpm run typecheck:test`, `pnpm run check`, and focused Playwright render
  routes passed.

## task-0551 — Audit frame hot-path allocations and scratch APIs

Completed: 2026-05-16

Summary:

- Added `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md` to classify current
  frame-loop helpers as hot-path, setup/preparation, or diagnostic/reporting
  surfaces.
- Added `createRenderWorldDrawPackageScratch` and
  `writeRenderWorldDrawPackages` so draw package planning can reuse package
  records, diagnostics, and its result shell.
- Kept `planRenderWorldDrawPackages` as the allocation-friendly convenience
  wrapper for tests and one-shot use.
- Added tests proving draw package records and result object identity are reused
  across repeated successful writes.
- Recorded remaining allocation risks for transform packing, draw commands, draw
  lists, resource resolution, command planning, and render-frame summaries.
- Validation run: focused draw-package/render-queue tests passed.

## task-0552 through task-0553 — Frame planner, draw command, and draw-list scratch writers

Completed: 2026-05-16

Completed task ids:

- `task-0552` — Add non-allocating render-frame planner writer.
- `task-0553` — Add draw command and draw-list scratch writers.

Summary:

- Added `createRenderFramePlanScratch` and
  `writeRenderFramePlanFromSnapshot` so callers can reuse the top-level
  frame-plan result shell and phase summary report shells.
- Added `createDrawCommandDescriptorScratch` and `writeDrawCommandDescriptors`
  so draw command descriptor planning can reuse mesh lookup, descriptor records,
  and per-descriptor vertex-buffer key arrays.
- Added `createRenderPassDrawListScratch` and `writeRenderPassDrawList` so draw
  list planning can reuse pipeline key sets, resolved bind-group scratch, draw
  records, and per-draw key arrays.
- Updated `RenderFramePlanScratch` to own and reuse draw command and draw-list
  scratch objects.
- Updated the hot-path allocation audit with the new scratch-backed surfaces and
  the remaining resource-resolution/command-planning gaps.
- Validation run: focused render-frame-plan, draw-command, and draw-list tests
  passed with `pnpm run typecheck` and `pnpm run typecheck:test`.

## task-0554 — Resource-resolution and command-plan scratch writers

Completed: 2026-05-16

Summary:

- Added `createResolveRenderPassResourcesScratch` and
  `writeResolveRenderPassResources` so resource resolution can reuse pipeline,
  bind group, vertex-buffer, and index-buffer lookup maps plus resolved draw and
  nested resource records.
- Added `createRenderPassCommandScratch` and `writeRenderPassCommands` so
  command planning can reuse command records, diagnostics, sorted bind-group
  scratch, and its result shell.
- Updated `RenderFramePlanScratch` to own draw-package, draw-command,
  draw-list, resource-resolution, command-plan, and phase-summary scratch.
- Updated the hot-path allocation audit to show the current WebGPU frame planner
  now has scratch-backed writers for the obvious planning stages.
- Validation run: focused render-pass-resources, render-pass-commands, and
  render-frame-plan tests passed with `pnpm run typecheck` and
  `pnpm run typecheck:test`.

## task-0555 — Audit extraction and transform hot-path allocations

Completed: 2026-05-16

Summary:

- Audited `extractRenderSnapshot`, `packSnapshotTransforms`,
  `packSnapshotViewUniforms`, `planInjectedRenderFrameSnapshotResourceBindings`,
  and `RenderWorld.applySnapshot` for remaining frame-cadence allocations.
- Documented that snapshot creation is the explicit worker-friendly copy
  boundary for now, but should later choose between reusable snapshot builders
  and delta transport.
- Identified `packSnapshotTransforms` as the smallest next code candidate for a
  scratch writer because it currently allocates a `Map`, number array, offset
  records, diagnostics, output `Float32Array`, and uses `slice`/spread for each
  unique transform.
- Updated `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md` with extraction
  and packing findings.
- Replaced the next backlog item with `task-0556 — Add transform-pack scratch
writer`.
- Validation run: no behavior-changing code was added in this audit slice;
  prior `pnpm run check` and focused Playwright render routes passed.

## task-0556 — Transform-pack scratch writer

Completed: 2026-05-16

Summary:

- Added `createPackedSnapshotTransformsScratch` and
  `writePackedSnapshotTransforms` to reuse source-offset lookup, offset records,
  diagnostics, result shell, and backing transform storage.
- Kept `packSnapshotTransforms` as the allocation-friendly convenience helper
  and added `floatCount` to packed transform results so scratch-backed buffers
  can expose used length without slicing.
- Replaced `slice`/spread matrix copies in the writer with direct indexed
  copies.
- Added tests proving result identity, offset record identity, and backing
  buffer reuse across repeated successful writes.
- Updated the allocation audit and next backlog task to move view-uniform
  packing next.
- Validation run: focused transform-pack, draw-package, and render-frame-plan
  tests passed with `pnpm run typecheck` and `pnpm run typecheck:test`.

## task-0561 through task-0564 — Lit StandardMaterial proof point

Completed: 2026-05-16

Completed task ids:

- `task-0561` — Add direct-lit StandardMaterial WGSL and pipeline.
- `task-0562` — Route standard materials through render selection.
- `task-0563` — Add user-facing lit spinning cube example and Playwright E2E.
- `task-0564` — Audit lit proof point against architecture and references.

Summary:

- Added a direct-lit StandardMaterial WGSL shader and WebGPU pipeline path for a
  narrow metallic/roughness MVP with ambient and directional light support.
- Routed standard material draws through pipeline selection, required group-3
  light bind groups, standard material bind group resources, and mixed
  unlit/standard draw tests.
- Extended `createWebGpuApp.render()` to support standard materials and added a
  standard frame resource helper that prepares mesh, view, transform, material,
  and light GPU resources from extracted snapshots.
- Reworked `examples/spinning-cube.js` into a user-facing lit StandardMaterial
  app facade example using typed asset collections, ECS entity authoring,
  camera/light components, and `SpinSystem`.
- Updated Playwright coverage to verify a nonblank lit cube, animation/frame
  progress, and JSON-safe status for the route.
- Audited package boundaries and example code against the North Star,
  architecture docs, Bevy alignment notes, and StandardMaterial proof-point
  scope; core/runtime remain headless and WebGPU objects remain backend-owned.
- Added `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md` to record
  the audit findings and follow-up.
- Added `task-0566` to address the main audit follow-up: `createWebGpuApp` still
  prepares pipelines/resources per frame and needs steady-state resource reuse.
- Validation run: `pnpm run check` and
  `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed.

## task-0565 — Standard material resource inspection records

Completed: 2026-05-16

Summary:

- Added StandardMaterial-specific inspection adapters that create generic
  renderer resource inspection records for live, missing, stale, and
  pending-destroy material buffer resources.
- Kept the records JSON-safe by exposing stable asset/resource keys and version
  metadata without raw GPU buffer handles.
- Verified the records compose with the existing renderer resource summary
  diagnostics as material inspection data rather than a parallel diagnostics
  format.
- Validation run: focused standard material resource inspection tests passed
  with package/test typechecking.

## task-0810 through task-0814 — Prepared mesh/material app-route cache handoff

Completed: 2026-05-17

Completed task ids:

- `task-0810` — Wire prepared mesh cache into scalar unlit app route.
- `task-0811` — Audit textured unlit and mesh cache boundaries.
- `task-0812` — Wire textured unlit prepared cache into the app route.
- `task-0813` — Add prepared cache app-route invalidation counters.
- `task-0814` — Extend prepared mesh cache to the Matcap app route.

Summary:

- Wired WebGPU-private prepared mesh resources into scalar unlit and Matcap app
  frame-resource misses while preserving public ECS/source-asset authoring APIs.
- Routed textured unlit group-2 material buffer/bind-group resources through the
  existing prepared unlit material cache once texture and sampler dependencies
  are ready.
- Added JSON-safe prepared mesh/material and prepared material bind-group reuse
  counters to app render reports.
- Added app regressions for frame-resource misses, source mesh/material version
  invalidation, texture/sampler dependency version invalidation, and Matcap
  prepared mesh reuse.
- Added
  `docs/research/TEXTURED_UNLIT_AND_MESH_CACHE_BOUNDARY_AUDIT_2026_05_17.md`;
  no boundary drift was found.
- Validation run: focused WebGPU app/prepared-cache tests, WebGPU package
  typecheck, test typecheck, and package boundary checks passed. Final
  `pnpm run check` passed.

## task-0815 through task-0824 — Standard prepared material cache handoff

Completed: 2026-05-17

Completed task ids:

- `task-0815` — Audit prepared route counters and ownership boundaries.
- `task-0816` — Wire prepared mesh cache into StandardMaterial app route.
- `task-0817` — Extract shared prepared mesh app-route helper.
- `task-0818` — Plan StandardMaterial scalar prepared material cache handoff.
- `task-0819` — Add StandardMaterial scalar prepared material cache helper.
- `task-0820` — Wire scalar StandardMaterial prepared cache into app route.
- `task-0821` — Audit scalar Standard prepared material app-route boundary.
- `task-0822` — Add Standard prepared material app-route invalidation tests.
- `task-0823` — Plan textured Standard prepared dependency key handoff.
- `task-0824` — Add Standard base-color texture dependency key helper.

Summary:

- Wired WebGPU-private prepared mesh resources into the StandardMaterial app
  frame-resource route and extracted the shared prepared app mesh helper used by
  unlit, Matcap, and Standard routes.
- Added a scalar StandardMaterial prepared material cache helper and routed
  scalar Standard app frame-resource misses through prepared group-2 material
  buffer/bind-group resources.
- Added JSON-safe app report coverage for scalar Standard prepared material
  reuse, source material version invalidation, and full frame-resource cache
  hits after transform/light-only changes.
- Added boundary audits for prepared route counters and scalar Standard prepared
  app-route ownership.
- Added textured Standard dependency planning and a direct base-color
  texture/sampler source-version key helper with ready, version-changed,
  missing texture, and loading sampler coverage.
- Validation run: focused WebGPU app/prepared-cache tests, WebGPU package
  typecheck, test typecheck, package boundary checks, and final `pnpm run check`
  passed.

## task-0825 through task-0829 — Textured Standard base-color prepared route

Completed: 2026-05-17

Completed task ids:

- `task-0825` — Extend Standard texture dependency keys to all texture
  families.
- `task-0826` — Add base-color textured Standard prepared material cache
  helper.
- `task-0827` — Wire base-color Standard prepared cache into the app route.
- `task-0828` — Audit textured Standard base-color prepared boundaries.
- `task-0829` — Add base-color Standard prepared app-route invalidation tests.

Summary:

- Extended Standard texture dependency key derivation to base-color,
  metallic-roughness, normal, occlusion, and emissive texture families with
  stable binding-order cache segments and JSON-safe diagnostics.
- Added direct base-color textured Standard prepared material resources that
  create/reuse group-2 material buffers and bind groups from ready source
  material, texture, and sampler versions.
- Wired base-color textured Standard app frame-resource misses through prepared
  material resources while keeping other textured Standard variants on the
  existing frame-resource path.
- Added app regressions for base-color prepared material reuse across
  frame-resource misses and for texture/sampler source-version invalidation.
- Added
  `docs/research/TEXTURED_STANDARD_BASE_COLOR_PREPARED_BOUNDARY_AUDIT_2026_05_17.md`;
  no source-asset ownership, texture/sampler ownership, or light-resource drift
  was found.
- Validation run: focused prepared Standard and WebGPU app tests, WebGPU package
  typecheck, test typecheck, package boundary checks, and final `pnpm run check`
  passed.

## task-0863 through task-0885 — Prepared material facade and backend cache handoff

Completed: 2026-05-17

Completed task ids:

- `task-0863` — Add prepared material store app summary regression matrix.
- `task-0864` — Extract prepared material texture/sampler dependency input.
- `task-0865` — Add prepared material facade JSON report helper.
- `task-0866` — Audit prepared material texture/sampler dependency input.
- `task-0867` — Bind prepared material resource keys into render world.
- `task-0868` — Prepare material facade entries from snapshots.
- `task-0869` — Add prepared material facade queue resource resolver.
- `task-0870` — Combine snapshot preparation and render-world material binding.
- `task-0871` — Plan WebGPU prepared material facade summary handoff.
- `task-0872` — Audit prepared material facade snapshot and queue helpers.
- `task-0873` — Add WebGPU app prepared material facade summary.
- `task-0874` — Add prepared material facade summary invalidation matrix.
- `task-0875` — Plan WebGPU app queue handoff to prepared material facade keys.
- `task-0876` — Audit WebGPU prepared material facade summary boundary.
- `task-0877` — Add prepared material facade stale-entry cleanup plan.
- `task-0878` — Route app material queue through prepared facade keys.
- `task-0879` — Prune snapshot-stale prepared material facade entries.
- `task-0880` — Add facade stale-cleanup app summary regression.
- `task-0881` — Audit prepared facade queue-key handoff boundary.
- `task-0882` — Plan WebGPU prepared material backend cache eviction.
- `task-0883` — Track last-used frames for prepared material backend caches.
- `task-0884` — Add prepared material backend cache eviction report.
- `task-0885` — Plan prepared mesh facade queue-key handoff.

Summary:

- Added renderer-independent prepared material facade summaries, snapshot
  preparation, render-world binding, material queue resource key resolution, and
  combined prepare/apply/bind helpers.
- Routed the first WebGPU app material queue pass through prepared material
  facade keys while keeping concrete buffers, bind groups, textures, samplers,
  pipelines, and lights WebGPU-owned.
- Added snapshot-scoped facade pruning and an app regression proving facade
  summaries prune hidden materials while backend prepared material caches remain
  retained.
- Added WebGPU-private `lastUsedFrame` metadata for prepared material backend
  cache entries and an internal eviction report/helper that removes stale cache
  map entries by family.
- Added plans/audits for facade summaries, queue-key handoff, stale facade
  cleanup, backend cache eviction, and prepared mesh facade queue-key handoff.
- Validation run: focused render/WebGPU tests passed, full `pnpm test` passed
  with 230 files / 1082 tests, and broad `pnpm run check` passed after the
  unrelated `.mcp.json` and `docs/render-pipeline-comparison.html` files were
  added to `.prettierignore` per the user's instruction to ignore unrelated
  files.

## task-1127 through task-1141 — Queued frame-resource split and GLB diagnostics

Completed: 2026-05-18

Completed task ids:

- `task-1127` — Extract queued built-in frame-resource preparation set.
- `task-1128` — Add GLB invalid texture/sampler diagnostics matrix tests.
- `task-1129` — Add GLB delayed dependency browser diagnostics fixture.
- `task-1132` — Plan GLB alpha-mask backface visual fixture.
- `task-1136` — Audit StandardMaterial alpha-mask coverage alignment.
- `task-1137` — Add GLB alpha-mask backface visual fixture.
- `task-1138` — Add queued built-in frame-resource reuse regression test.
- `task-1139` — Audit GLB delayed dependency browser status.
- `task-1140` — Extract standard GLB texture scenario status helpers.
- `task-1141` — Add StandardMaterial delayed dependency texture-readiness
  status.

Summary:

- Added `queued-built-in-frame-resource-set.ts` and moved queued built-in
  frame-resource scratch/result assembly out of WebGPU app orchestration while
  keeping pipeline, layout, texture/sampler, and frame-resource callbacks
  injected from `app.ts`.
- Added successful, failed, and scratch-reuse frame-resource set tests.
- Preserved GLB dependency-kind context in top-level asset mapping diagnostics
  and added invalid texture/image plus invalid sampler matrix coverage across
  base-color, metallic-roughness, normal, occlusion, and emissive slots.
- Added a GLB delayed dependency browser fixture with loading/failed texture
  and sampler source assets, material dependency readiness, and slot-level
  StandardMaterial texture-readiness status.
- Planned and implemented a scalar alpha-mask backface browser fixture proving
  `doubleSided: true` reaches the no-cull pipeline with visible backface pixels.
- Added alpha-mask and delayed-dependency audits, refreshed public progress
  tracker pages, and refilled the backlog with `task-1142` through `task-1146`.
- Validation run: targeted Vitest suites, full `standard-gltf-texture`
  Playwright spec, `pnpm run check:progress`, and final `pnpm run check` passed
  with 250 Vitest files / 1168 tests.
