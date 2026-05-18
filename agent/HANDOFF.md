# Handoff

## Current Run Update — 2026-05-18T07:33:09Z

Completed `task-1222` through `task-1242`, plus `task-1244` through
`task-1246`. Recommended next task is `task-1243`.

Completed task ids:

- `task-1222` — Plan next StandardMaterial sampler/color-space or route slice.
- `task-1223` — Audit prepared-resource lifetime pressure after UV1.
- `task-1224` — Plan lighting-boundary readiness contract.
- `task-1225` — Add StandardMaterial texture format/color-space diagnostics.
- `task-1226` — Audit selected sampler/color-space or route slice.
- `task-1227` — Add environment-map readiness report.
- `task-1228` — Audit environment-map readiness report.
- `task-1229` — Add texture fidelity summary coverage for format diagnostics.
- `task-1230` — Audit texture fidelity summary coverage.
- `task-1231` — Plan the next material route or PBR fidelity slice.
- `task-1232` — Add StandardMaterial format/color-space browser diagnostic fixture.
- `task-1233` — Audit StandardMaterial format/color-space browser diagnostic fixture.
- `task-1234` — Plan the next generic material route cleanup.
- `task-1235` — Add reusable route scratch reset regression.
- `task-1236` — Audit selected generic route cleanup test.
- `task-1237` — Plan next route or fidelity slice after scratch reset.
- `task-1238` — Add generic route summary stale-state regression.
- `task-1239` — Audit generic route summary stale-state regression.
- `task-1240` — Plan next StandardMaterial glTF fidelity diagnostic.
- `task-1241` — Audit tracker/backlog alignment after diagnostics and route cleanup.
- `task-1242` — Audit material-family route migration criteria.
- `task-1244` — Audit selected StandardMaterial glTF fidelity plan.
- `task-1245` — Add unsupported required glTF material extension browser diagnostic.
- `task-1246` — Audit unsupported required glTF extension browser diagnostic.

Highlights:

- Added source-side StandardMaterial
  `standardMaterialTexture.invalidColorSpaceFormat` diagnostics when
  `TextureAsset.colorSpace` and `TextureAsset.format` disagree about sRGB
  encoding. Texture readiness slots now include `actualFormat`, and texture
  fidelity summaries group the diagnostic under color-space issues.
- Added JSON-safe `createEnvironmentMapReadinessReport()` in
  `@aperture-engine/webgpu` for extracted environment packets and optional
  renderer resource readiness without exposing raw handles or GPU objects.
- Added a browser/status regression for a glTF-shaped base-color texture
  format/color-space mismatch. The fixture blocks misleading successful draws
  and exposes the readiness diagnostic through existing app status.
- Added a reusable route scratch reset regression for the built-in app resource
  collector, proving unsupported-route diagnostics do not leak into a later
  valid StandardMaterial collection with the same scratch.
- Refilled the ready backlog with `task-1243`, `task-1247`, `task-1248`,
  `task-1249`, and `task-1250`, keeping the
  next work focused on route/fidelity planning, stale-state route summaries,
  and tracker/backlog alignment.
- Continued after the stop hook requested more work, completed `task-1237`, and
  selected `task-1238` as the next executable route summary stale-state
  regression.
- Added a reusable material queue route report shell regression that proves a
  clean routed report does not retain stale unsupported-family, skipped,
  blend-preset, diagnostic-code, or route-report state after a failed report.
- Audited that regression as generic diagnostics hygiene and recommended
  planning the next StandardMaterial/glTF fidelity diagnostic before more route
  summary group cleanup.
- Planned the next StandardMaterial/glTF fidelity diagnostic and selected an
  unsupported required material-extension browser/status fixture before
  implementation.
- Audited the selected plan and confirmed it stays source-side/fixture-side
  without WebGPU upload, app route, IBL, shadow, binary GLB, GLB viewer, or
  material-family routing changes.
- Added the unsupported required glTF material-extension browser/status fixture.
  It preserves `extensionName` in JSON-safe asset-mapping diagnostics and proves
  invalid material mapping skips registration/draw submission.
- Audited the fixture and confirmed it stays in source glTF material mapping and
  JSON-safe app/example status without renderer route or shader changes.
- Audited tracker/backlog alignment and confirmed the ready backlog is refilled
  with five concrete tasks.
- Audited material-family route migration criteria and selected route summary
  group clean-after-failed coverage as the next smallest observable route
  hygiene slice.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/RENDER_FRAME_READINESS.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/ENVIRONMENT_MAP_READINESS_REPORT_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_SUMMARY_STALE_STATE_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/NEXT_GENERIC_MATERIAL_ROUTE_CLEANUP_PLAN_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_ENVIRONMENT_READINESS_CONTRACT_PLAN_2026_05_18.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/NEXT_ROUTE_OR_FIDELITY_AFTER_SCRATCH_RESET_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_GLTF_FIDELITY_DIAGNOSTIC_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_COLOR_SPACE_FORMAT_SLICE_PLAN_2026_05_18.md`
- `docs/research/PREPARED_RESOURCE_LIFETIME_PRESSURE_AFTER_UV1_AUDIT_2026_05_18.md`
- `docs/research/REUSABLE_ROUTE_SCRATCH_RESET_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_COLOR_SPACE_FORMAT_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_FORMAT_COLOR_SPACE_BROWSER_FIXTURE_AUDIT_2026_05_18.md`
- `docs/research/TEXTURE_FIDELITY_SUMMARY_FORMAT_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DIAGNOSTICS_ROUTE_CLEANUP_AUDIT_2026_05_18.md`
- `docs/research/UNSUPPORTED_REQUIRED_GLTF_EXTENSION_DIAGNOSTIC_PLAN_AUDIT_2026_05_18.md`
- `docs/research/UNSUPPORTED_REQUIRED_GLTF_EXTENSION_BROWSER_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/environment-map-readiness.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/materials/standard-texture-sampler-alignment.test.ts`
- `test/webgpu/environment-map-readiness.test.ts`
- `test/webgpu/material-queue-route-report.test.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `test/webgpu/standard-material-texture-fidelity-summary.test.ts`

Validation:

- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts test/materials/standard-texture-sampler-alignment.test.ts test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec vitest run test/webgpu/environment-map-readiness.test.ts test/webgpu/environment-resource-planning.test.ts`
- `pnpm exec vitest run test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec vitest run test/webgpu/environment-map-readiness.test.ts test/webgpu/environment-resource-planning.test.ts test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/queued-material-route-summary-group.test.ts`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/assets/gltf-asset-mapping.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "format/color-space mismatches"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "unsupported required material extensions"`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`
- `pnpm run check:progress`
- `pnpm exec prettier --check ...` on touched files
- `git diff --check`

Additional reference files/patterns inspected:

- `references/bevy/crates/bevy_image/src/image.rs` for image asset texture
  format and sRGB view-format separation.
- `references/engine/src/extras/render-passes/frame-pass-camera-frame.js` for
  renderer-owned skybox/pass placement.
- `references/three.js/src/extras/PMREMGenerator.js` and
  `references/three.js/src/renderers/WebGLRenderer.js` for renderer-side
  environment/PMREM handling.
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/environment-resource-planning.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/reusable-route-collector.ts`

Known issues / follow-ups:

- `task-1243` should add route summary group clean-after-failed coverage.
- IBL shader sampling, skyboxes, environment texture upload, shadows, binary
  GLB loading, and broad material route rewrites remain deferred.
- Stop-hook attempts requested continuation while the time window was still
  open; the run continued through `task-1242` before final handoff.

## Current Run Update — 2026-05-18T07:18:58Z

Completed `task-1222` through `task-1231`. Recommended next task is
`task-1232`.

Completed task ids:

- `task-1222` — Plan next StandardMaterial sampler/color-space or route slice.
- `task-1223` — Audit prepared-resource lifetime pressure after UV1.
- `task-1224` — Plan lighting-boundary readiness contract.
- `task-1225` — Add StandardMaterial texture format/color-space diagnostics.
- `task-1226` — Audit selected sampler/color-space or route slice.
- `task-1227` — Add environment-map readiness report.
- `task-1228` — Audit environment-map readiness report.
- `task-1229` — Add texture fidelity summary coverage for format diagnostics.
- `task-1230` — Audit texture fidelity summary coverage.
- `task-1231` — Plan the next material route or PBR fidelity slice.

Highlights:

- Added source-side StandardMaterial
  `standardMaterialTexture.invalidColorSpaceFormat` diagnostics when
  `TextureAsset.colorSpace` and `TextureAsset.format` disagree about sRGB
  encoding. Texture readiness slots now include `actualFormat`.
- Audited transformed UV1 prepared-resource pressure; no new cache-key,
  bind-group, prepared-resource, app-route, or diagnostics pressure needs
  cleanup.
- Added JSON-safe `createEnvironmentMapReadinessReport()` in `@aperture-engine/webgpu`.
  It reports extracted environment counts, null-handle counts, required
  environment-map resource keys, optional renderer resource readiness, and
  missing-resource diagnostics without raw handles or GPU objects.
- Updated StandardMaterial texture fidelity summaries so
  `invalidColorSpaceFormat` contributes to `colorSpaceIssueCount`.
- Planned the next vertical slice: a StandardMaterial browser/status fixture
  for the format/color-space diagnostic.
- Refreshed tracker docs, diagnostics docs, backlog, completed log, handoff,
  and automation memory.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/RENDER_FRAME_READINESS.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/ENVIRONMENT_MAP_READINESS_REPORT_AUDIT_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_ENVIRONMENT_READINESS_CONTRACT_PLAN_2026_05_18.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_COLOR_SPACE_FORMAT_SLICE_PLAN_2026_05_18.md`
- `docs/research/PREPARED_RESOURCE_LIFETIME_PRESSURE_AFTER_UV1_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_COLOR_SPACE_FORMAT_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `docs/research/TEXTURE_FIDELITY_SUMMARY_FORMAT_DIAGNOSTIC_AUDIT_2026_05_18.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/environment-map-readiness.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/materials/standard-texture-sampler-alignment.test.ts`
- `test/webgpu/environment-map-readiness.test.ts`
- `test/webgpu/standard-material-texture-fidelity-summary.test.ts`

Validation:

- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts test/materials/standard-texture-sampler-alignment.test.ts test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec vitest run test/webgpu/environment-map-readiness.test.ts test/webgpu/environment-resource-planning.test.ts`
- `pnpm exec vitest run test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec vitest run test/webgpu/environment-map-readiness.test.ts test/webgpu/environment-resource-planning.test.ts test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`
- `pnpm run check:progress`
- `pnpm exec prettier --check ...` on touched files
- `git diff --check`

Additional reference files/patterns inspected:

- `references/bevy/crates/bevy_image/src/image.rs` for image asset texture
  format and sRGB view-format separation.
- `references/engine/src/extras/render-passes/frame-pass-camera-frame.js` for
  renderer-owned skybox/pass placement.
- `references/three.js/src/extras/PMREMGenerator.js` and
  `references/three.js/src/renderers/WebGLRenderer.js` for renderer-side
  environment/PMREM handling.
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/environment-resource-planning.ts`

Known issues / follow-ups:

- `task-1232` should add the StandardMaterial browser/status fixture for
  `standardMaterialTexture.invalidColorSpaceFormat`.
- `task-1234` should plan the next narrow generic material route cleanup after
  the browser diagnostic fixture and audit.
- IBL shader sampling, skyboxes, environment texture upload, shadows, binary
  GLB loading, and broad material route rewrites remain deferred.
- The first stop-hook attempt requested continuation because the work window was
  still open; subsequent work completed through `task-1231` before this handoff
  update.

## Current Run Update — 2026-05-18T07:11:37Z

Completed `task-1222` through `task-1226`. Recommended next task is
`task-1227`.

Completed task ids:

- `task-1222` — Plan next StandardMaterial sampler/color-space or route slice.
- `task-1223` — Audit prepared-resource lifetime pressure after UV1.
- `task-1224` — Plan lighting-boundary readiness contract.
- `task-1225` — Add StandardMaterial texture format/color-space diagnostics.
- `task-1226` — Audit selected sampler/color-space or route slice.

Highlights:

- Selected StandardMaterial texture format/color-space readiness diagnostics as
  the next narrow source-side material fidelity slice.
- Audited prepared-resource lifetime pressure after transformed UV1 and found
  no new cache-key, bind-group, prepared-resource, app-route, or diagnostics
  pressure requiring cleanup.
- Planned the next lighting boundary as a JSON-safe environment-map readiness
  report derived from extracted environment packets and environment resource
  planning, while keeping IBL, skyboxes, shadows, environment texture upload,
  app route changes, and GLB viewer behavior deferred.
- Implemented
  `standardMaterialTexture.invalidColorSpaceFormat` in StandardMaterial texture
  readiness. Ready texture slots now include `actualFormat`, and diagnostics
  include `actualFormat` plus `expectedFormatSrgb` when source
  `TextureAsset.colorSpace` and `TextureAsset.format` disagree about sRGB
  encoding.
- Updated typed texture-readiness fixtures, public tracker pages, diagnostics
  docs, backlog, and completed-task records.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/NEXT_LIGHTING_ENVIRONMENT_READINESS_CONTRACT_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_COLOR_SPACE_FORMAT_SLICE_PLAN_2026_05_18.md`
- `docs/research/PREPARED_RESOURCE_LIFETIME_PRESSURE_AFTER_UV1_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_COLOR_SPACE_FORMAT_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/materials/standard-texture-sampler-alignment.test.ts`
- `test/webgpu/standard-material-texture-fidelity-summary.test.ts`

Validation:

- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/materials/standard-texture-readiness.test.ts test/materials/standard-texture-sampler-alignment.test.ts test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`
- `pnpm run check:progress`
- `pnpm exec prettier --check ...` on touched files
- `git diff --check`

Additional reference files/patterns inspected:

- `references/bevy/crates/bevy_image/src/image.rs` for the image asset texture
  format / sRGB view-format split.
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/environment-resource-planning.ts`

Known issues / follow-ups:

- `task-1227` should add the environment-map readiness report.
- `task-1229` should add focused texture fidelity summary coverage for
  `standardMaterialTexture.invalidColorSpaceFormat`.
- IBL shader sampling, skyboxes, shadows, environment texture upload, binary
  GLB loading, and broader material route rewrites remain deferred.
- No stop-hook failures were observed before final hook execution in this
  handoff update.

## Current Run Update — 2026-05-18T06:50:00Z

Completed `task-1203` through `task-1221`. Recommended next task is
`task-1222`.

Completed task ids:

- `task-1203` — Plan follow-up StandardMaterial texture transform coverage.
- `task-1204` — Implement normalTexture transform support on TEXCOORD_0.
- `task-1205` — Audit normalTexture transform support.
- `task-1206` — Add direct-light readiness diagnostics report.
- `task-1207` — Audit direct-light readiness diagnostics report.
- `task-1208` — Plan next StandardMaterial fidelity or route-audit slice.
- `task-1209` — Implement occlusionTexture transform support on TEXCOORD_0.
- `task-1210` — Audit occlusionTexture transform support.
- `task-1211` — Audit generic route/prepared-resource pressure.
- `task-1212` — Plan next post-transform material/lighting boundary.
- `task-1213` — Implement emissiveTexture transform support on TEXCOORD_0.
- `task-1214` — Audit emissiveTexture transform support.
- `task-1215` — Plan StandardMaterial route/prepared-resource cleanup.
- `task-1216` — Add the selected route/prepared-resource cleanup regression.
- `task-1217` — Audit route/prepared-resource cleanup.
- `task-1218` — Plan transformed UV1 or lighting boundary after cleanup.
- `task-1219` — Audit tracker and backlog alignment after transform work.
- `task-1220` — Implement transformed TEXCOORD_1 support.
- `task-1221` — Audit transformed TEXCOORD_1 support.

Highlights:

- Added JSON-safe direct-light readiness diagnostics for StandardMaterial app
  routes. The report summarizes light counts, light GPU buffer readiness, light
  bind group readiness, shader metadata, and resource keys without exposing raw
  GPU handles.
- Completed finite `KHR_texture_transform` support on `TEXCOORD_0` for all
  currently rendered StandardMaterial texture slots: base-color,
  metallic-roughness, normal, occlusion, and emissive.
- Expanded StandardMaterial uniform packing to 52 floats / 208 bytes with
  aligned transform blocks and updated WGSL sampling for normal, occlusion, and
  emissive transforms.
- Added browser fixture scenarios and Playwright coverage for transformed
  normal, occlusion, and emissive textures.
- Added a transformed base-color texture app reuse regression that verifies
  StandardMaterial prepared material, texture, sampler, bind group, mesh, and
  light resource reuse while keeping `routedResourceSet` and direct-light
  diagnostics JSON-safe.
- Audited route/prepared-resource pressure and selected transformed
  `TEXCOORD_1` support as the next narrow implementation slice.
- Implemented transformed `TEXCOORD_1` support by allowing finite UV1
  transforms through glTF mapping/readiness and converting the browser fixture
  from expected failure to rendered/readback coverage.
- Audited the transformed UV1 slice and confirmed it did not add a new route,
  material family, prepared-resource type, IBL, shadows, or GLB viewer scope.
- Refreshed `docs/index.html`, `docs/render-pipeline-comparison.html`,
  `agent/BACKLOG.md`, and `agent/COMPLETED.md`.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/DIRECT_LIGHT_READINESS_REPORT_AUDIT_2026_05_18.md`
- `docs/research/FOLLOW_UP_STANDARD_MATERIAL_TEXTURE_TRANSFORM_PLAN_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `docs/research/NEXT_POST_TRANSFORM_MATERIAL_LIGHTING_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_FIDELITY_OR_ROUTE_AUDIT_PLAN_2026_05_18.md`
- `docs/research/NEXT_TRANSFORMED_UV1_OR_LIGHTING_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_EMISSIVE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_NORMAL_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_OCCLUSION_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TRANSFORMED_UV1_SUPPORT_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/direct-light-readiness.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

Validation:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/webgpu/direct-light-readiness.test.ts test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/standard-material-buffer.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/direct-light-readiness.test.ts test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed base-color through TEXCOORD_1"`
- `pnpm run check:progress`
- `git diff --check`

Additional reference files/patterns inspected:

- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `references/three.js/src/renderers/common/Pipelines.js` pipeline cache
  pattern.
- `references/engine/src/platform/graphics/shader-processor-glsl.js` material,
  mesh, and texture binding separation pattern.
- `references/engine/src/platform/graphics/texture.js` texture-version
  invalidation pattern.
- `references/bevy/crates/bevy_mesh/src/components.rs` mesh/material handle
  authoring pattern.
- `references/bevy/crates/bevy_render/src/render_resource/bind_group.rs`
  renderer-owned binding-resource pattern.

Known issues / follow-ups:

- `task-1222` should plan the next narrow StandardMaterial sampler/color-space
  or route/prepared-resource slice.
- `texCoord > 1`, non-finite transforms, IBL, shadows, binary GLB loading, and
  GLB viewer work remain deferred.
- No stop-hook failures were observed before final hook execution in this
  handoff update.

## Current Run Update — 2026-05-18T06:19:22Z

Completed `task-1206`, `task-1207`, `task-1203`, `task-1204`, and
`task-1205`. Recommended next task is `task-1208`.

Completed task ids:

- `task-1206` — Add direct-light readiness diagnostics report.
- `task-1207` — Audit direct-light readiness diagnostics report.
- `task-1203` — Plan follow-up StandardMaterial texture transform coverage.
- `task-1204` — Implement normalTexture transform support on TEXCOORD_0.
- `task-1205` — Audit normalTexture transform support.

Highlights:

- Added `direct-light-readiness.ts`, a JSON-safe StandardMaterial/WebGPU app
  status helper derived from `RenderSnapshot.lights` and WebGPU resource keys.
- App diagnostics summaries now include direct-light counts and readiness for
  light GPU buffers, light bind group layout, light bind group, and shader
  metadata when a StandardMaterial route is present.
- Planned the next texture-transform slice and selected finite
  `normalTexture` transforms on `TEXCOORD_0`.
- glTF mapping and StandardMaterial texture readiness now accept normal texture
  transforms on UV0 while transformed UV1, occlusion, and emissive transforms
  remain diagnostic-only.
- StandardMaterial uniform layout grew to a 144-byte aligned block with normal
  texture transform fields.
- WGSL now applies the normal texture transform before normal-map sampling.
- Added `normal-map-transform` browser fixture coverage and audited the slice.
- Refilled the backlog with `task-1208` through `task-1212`.
- Public tracker pages were refreshed for direct-light readiness and normal
  texture-transform progress.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/DIRECT_LIGHT_READINESS_REPORT_AUDIT_2026_05_18.md`
- `docs/research/FOLLOW_UP_STANDARD_MATERIAL_TEXTURE_TRANSFORM_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_NORMAL_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/direct-light-readiness.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

Validation:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/webgpu/direct-light-readiness.test.ts test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec vitest run test/webgpu/direct-light-readiness.test.ts test/webgpu/app-diagnostics-summary.test.ts test/webgpu/webgpu-app.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts test/webgpu/direct-light-readiness.test.ts test/webgpu/app-diagnostics-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed normal texture"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec prettier --check` on touched implementation, tests, docs, and
  agent files
- `pnpm run check:progress`
- `git diff --check`

Additional reference files/patterns inspected:

- `docs/research/NEXT_LIGHTING_BOUNDARY_AFTER_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_PLAN_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_METALLIC_ROUGHNESS_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- PlayCanvas `references/engine/src/scene/layer.js` split-light tracking
  pattern.
- three.js `references/three.js/src/renderers/shaders/UniformsLib.js` light
  family grouping pattern.

Known issues / follow-ups:

- `task-1208` should decide whether the next slice is occlusion/emissive UV0
  transform support or a route/prepared-resource audit.
- Transformed `TEXCOORD_1`, occlusion transforms, and emissive transforms remain
  diagnostic-only.
- IBL, shadows, clustered lighting, render targets, and binary GLB viewer work
  remain deferred.

## Current Run Update — 2026-05-18T05:36:02Z

Completed `task-1178` through `task-1202`. Recommended next task is
`task-1206`.

Completed task ids:

- `task-1178` — Route app diagnostics through generic bucket summary.
- `task-1179` — Audit app diagnostics summary after bucket routing.
- `task-1180` — Plan non-built-in material family adapter spike.
- `task-1181` — Add test-only non-built-in material route adapter.
- `task-1182` — Audit test-only adapter before real family work.
- `task-1183` — Plan app-level generic material adapter route boundary.
- `task-1184` — Add generic app material route boundary helper.
- `task-1185` — Audit generic app route item helper.
- `task-1186` — Plan built-in route migration on generic app boundary.
- `task-1187` — Add built-in route compatibility assertions.
- `task-1188` — Audit built-in wrapper generic-boundary compatibility.
- `task-1189` — Define real material-family app route migration criteria.
- `task-1190` — Audit real material-family route criteria.
- `task-1191` — Plan StandardMaterial route cleanup.
- `task-1192` — Audit StandardMaterial route cleanup plan.
- `task-1193` — Add generic route criteria fixture.
- `task-1194` — Audit generic route criteria fixture.
- `task-1195` — Add StandardMaterial route cleanup compatibility test.
- `task-1196` — Audit StandardMaterial route compatibility test.
- `task-1197` — Plan next StandardMaterial PBR fidelity slice.
- `task-1198` — Audit next StandardMaterial PBR fidelity plan.
- `task-1199` — Add StandardMaterial metallic-roughness texture transforms.
- `task-1200` — Audit StandardMaterial metallic-roughness transform support.
- `task-1201` — Plan next lighting boundary after StandardMaterial fidelity.
- `task-1202` — Audit next lighting boundary plan.

Highlights:

- App diagnostics family counts now flow through generic queued material
  frame-resource bucket summaries while keeping the public `routedResourceSet`
  JSON field stable.
- Added a generic app route item helper and compatibility tests so built-in
  wrappers can expose generic route fields without adding product-facing
  material-family APIs.
- Added route migration criteria, cleanup plans, and audits to keep real
  material-family work behind explicit boundaries.
- Implemented the selected StandardMaterial PBR fidelity slice:
  metallic-roughness texture transforms on `TEXCOORD_0`.
- StandardMaterial uniform packing now reserves 32 floats / 128 bytes so the
  WGSL uniform struct remains 16-byte aligned after adding metallic-roughness
  transform fields.
- WGSL applies metallic-roughness texture offset/scale/rotation before
  sampling; glTF/readiness diagnostics accept that slot on `TEXCOORD_0`.
- `standard-gltf-texture?scenario=metallic-roughness-transform` now renders
  successfully instead of reporting unsupported-transform diagnostics.
- Audited the metallic-roughness transform implementation and documented the
  128-byte uniform alignment correction.
- Planned the next lighting boundary as a JSON-safe direct-light readiness
  diagnostics report, explicitly deferring IBL, shadows, clustered lighting,
  and binary GLB viewer work.
- Audited that lighting plan and confirmed `task-1206` should implement a
  report/diagnostics slice only.
- Public tracker pages were updated for the route compatibility work and the
  metallic-roughness texture-transform and lighting-boundary planning slices.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/APP_DIAGNOSTICS_BUCKET_SUMMARY_AUDIT_2026_05_18.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/BUILT_IN_ROUTE_MIGRATION_ON_GENERIC_APP_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/BUILT_IN_WRAPPER_GENERIC_BOUNDARY_COMPATIBILITY_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_APP_ROUTE_ITEM_HELPER_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_CRITERIA_FIXTURE_AUDIT_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_PLAN_AUDIT_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_AFTER_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_PLAN_AUDIT_2026_05_18.md`
- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `docs/research/REAL_MATERIAL_FAMILY_ROUTE_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_METALLIC_ROUGHNESS_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_AFTER_GENERIC_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_PLAN_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_COMPATIBILITY_TEST_AUDIT_2026_05_18.md`
- `docs/research/TEST_ONLY_ADAPTER_SPIKE_AUDIT_2026_05_18.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_MATERIAL_ADAPTER_SPIKE_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`

Validation:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec vitest run test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "metallic-roughness transforms"`
- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/app-diagnostics-summary.test.ts test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec prettier --check` on touched files
- `pnpm run check:progress`
- `git diff --check`

Additional reference files/patterns inspected:

- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/NEXT_STANDARD_MATERIAL_PBR_FIDELITY_PLAN_AUDIT_2026_05_18.md`
- `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`
- `docs/research/STANDARD_MATERIAL_METALLIC_ROUGHNESS_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/light-shader-metadata.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `examples/standard-gltf-texture.js`

Known issues / follow-ups:

- `task-1206` should add the direct-light readiness diagnostics report, then
  `task-1207` should audit it.
- Full binary `.gltf`/`.glb` scene loading is still not implemented; current
  GLB/glTF work is fixture-shaped material/texture mapping and browser
  diagnostics/rendering coverage.
- IBL and shadow-map rendering remain deferred until StandardMaterial texture
  fidelity and generic material routing are more stable.

## Current Run Update — 2026-05-18T05:12:23Z

Completed `task-1178`, `task-1179`, `task-1180`, `task-1181`, `task-1182`,
`task-1183`, and `task-1184`. Recommended next task is `task-1185`.

Completed task ids:

- `task-1178` — Route app diagnostics through generic bucket summary.
- `task-1179` — Audit app diagnostics summary after bucket routing.
- `task-1180` — Plan non-built-in material family adapter spike.
- `task-1181` — Add test-only non-built-in material route adapter.
- `task-1182` — Audit test-only adapter before real family work.
- `task-1183` — Plan app-level generic material adapter route boundary.
- `task-1184` — Add generic app material route boundary helper.

Highlights:

- App diagnostics now route family resource counts through generic queued
  material frame-resource bucket summaries while keeping the public
  `routedResourceSet` field stable.
- `createQueuedMaterialFrameResourceSetSummary()` and the built-in compatibility
  wrapper can accept caller-provided bucket family counts, copy/sort them
  deterministically, and keep the rest of the routed-resource summary shape
  unchanged.
- Added focused tests for generic and built-in routed-resource summaries,
  deterministic family ordering, JSON safety, and a test-only `custom-preview`
  route that exercises generic adapter registry lookup, generic frame-resource
  preparation, generic buckets, and folded routed-resource summaries.
- Added audits/plans:
  - `docs/research/APP_DIAGNOSTICS_BUCKET_SUMMARY_AUDIT_2026_05_18.md`
  - `docs/research/TEST_ONLY_NON_BUILT_IN_MATERIAL_ADAPTER_SPIKE_PLAN_2026_05_18.md`
  - `docs/research/TEST_ONLY_ADAPTER_SPIKE_AUDIT_2026_05_18.md`
  - `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- Added `queued-material-app-resource-item.ts`, a family-agnostic app route
  item helper exported from `@aperture-engine/webgpu`; the built-in app
  resource-set collector now constructs route items through that helper while
  preserving built-in behavior.
- Added `test/webgpu/queued-material-app-resource-item.test.ts` for a fake
  `custom-preview` route item feeding generic routed-resource summaries without
  adding a family-specific diagnostics field or compatibility array.
- Updated `docs/index.html` and `docs/render-pipeline-comparison.html` for the
  generic diagnostics route/bucket progress and next recommended task.
- Refilled the backlog with `task-1185` through `task-1189`.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/APP_DIAGNOSTICS_BUCKET_SUMMARY_AUDIT_2026_05_18.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/TEST_ONLY_ADAPTER_SPIKE_AUDIT_2026_05_18.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_MATERIAL_ADAPTER_SPIKE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`

Validation:

- `pnpm exec vitest run test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/app-diagnostics-summary.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/app-diagnostics-summary.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-app-resource-item.test.ts test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec prettier --check` on touched implementation, test, docs, and
  agent files.
- `pnpm run check:progress`
- `git diff --check`

Additional reference files/patterns inspected:

- `docs/research/GENERIC_BUCKET_MIGRATION_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_BUCKET_DIAGNOSTICS_HANDOFF_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_SUMMARY_NEXT_FAMILY_HANDOFF_2026_05_18.md`
- `docs/research/NEXT_FAMILY_ROUTE_READINESS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`

Known issues / follow-ups:

- Initial stop-hook attempt was blocked by its minute-of-hour gate; stop hook is
  still pending for this run.
- `task-1185` should audit the generic app material route boundary helper before
  planning built-in route wrapper migration.
- The fake `custom-preview` route is test-only. It is not a product material
  family, shader path, app facade route, or GLB mapping.

## Current Run Update — 2026-05-18T04:56:27Z

Completed `task-1161`, `task-1162`, `task-1163`, `task-1164`, `task-1165`,
`task-1166`, `task-1167`, `task-1168`, `task-1169`, and `task-1170`.
Then completed `task-1171`, `task-1172`, `task-1173`, `task-1174`, and
`task-1175`, then completed `task-1176` and `task-1177`. Recommended next task
is `task-1178`.

Completed task ids:

- `task-1161` — Implement base-color texture-transform rotation sampling.
- `task-1162` — Move queued resource-set summary to generic material helper.
- `task-1163` — Audit GLB missing TEXCOORD_1 browser diagnostics.
- `task-1164` — Add GLB transformed UV1 unsupported browser fixture.
- `task-1165` — Add generic collector duplicate-pipeline reuse coverage.
- `task-1166` — Audit base-color texture-transform rotation support.
- `task-1167` — Audit generic queued resource summary migration.
- `task-1168` — Plan generic material-family prepared route migration.
- `task-1169` — Add transformed non-base-color GLB diagnostic fixture.
- `task-1170` — Add generic summary compatibility test for app diagnostics.
- `task-1171` — Audit transformed texture diagnostics after UV1 fixture.
- `task-1172` — Add generic route summary handoff note for next material family.
- `task-1173` — Add generic queued material frame-resource buckets.
- `task-1174` — Audit generic bucket migration after implementation.
- `task-1175` — Plan generic bucket diagnostics handoff.
- `task-1176` — Add generic bucket diagnostics summary coverage.
- `task-1177` — Audit next-family route readiness after bucket coverage.

Highlights:

- StandardMaterial base-color texture transforms now accept finite rotation on
  `TEXCOORD_0` while transformed UV1 and transformed non-base-color slots remain
  unsupported diagnostics.
- The glTF mapping/readiness predicates accept base-color UV0 rotation, the
  StandardMaterial uniform packs `baseColorTextureRotation`, and WGSL applies
  scale, rotation, then offset in the base-color texture helper.
- Added
  `standard-gltf-texture?scenario=base-color-transform-rotation-sampling` with
  screenshot/readback assertions comparing rotated, offset-only, and
  untransformed texels.
- Kept the existing unsupported transform browser path as transformed UV1 so it
  still reports
  `render.standardMaterialTexture.unsupportedTextureTransform` before draw or
  pipeline submission.
- Added `queued-material-frame-resource-set-summary.ts`; the built-in queued
  resource-set summary helper is now a compatibility wrapper over the generic
  material frame-resource summary, and app diagnostics still expose the public
  `routedResourceSet` field.
- Added
  `docs/research/GLB_MISSING_TEXCOORD1_BROWSER_DIAGNOSTICS_AUDIT_2026_05_18.md`;
  the successful UV1 and missing-UV1 GLB-shaped browser fixtures remain paired,
  JSON-safe, and honest about not claiming binary GLB mesh import support.
- Added `standard-gltf-texture?scenario=base-color-uv1-transform`, which
  provides both `baseColorTexture.texCoord = 1` and a mesh `TEXCOORD_1`
  attribute, then verifies unsupported texture-transform diagnostics with no
  draw or pipeline submission.
- Added direct generic collector coverage for two queued items sharing one
  pipeline key; pipeline plan creation is reused once while both resource append
  paths and source resource-key maps still run.
- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_SUPPORT_AUDIT_2026_05_18.md`;
  rotation support remains limited to base-color UV0, while transformed UV1 and
  transformed non-base-color slots remain unsupported diagnostics.
- Added
  `docs/research/GENERIC_QUEUED_RESOURCE_SUMMARY_MIGRATION_AUDIT_2026_05_18.md`;
  `routedResourceSet` remains the public diagnostics field, and the generic
  summary helper stays free of app/ECS/GPU ownership.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_PREPARED_ROUTE_MIGRATION_PLAN_2026_05_18.md`;
  the next route migration should add a generic bucket store keyed by material
  family while preserving built-in compatibility arrays.
- Added `standard-gltf-texture?scenario=metallic-roughness-transform`, which
  authors a transformed `metallicRoughnessTexture` and verifies the
  non-base-color transform path reports JSON-safe unsupported-transform
  diagnostics without draw or pipeline submission.
- Added app diagnostics compatibility coverage that constructs
  `routedResourceSet` through the generic
  `createQueuedMaterialFrameResourceSetSummary` helper while keeping the public
  JSON field name stable and free of raw GPU/app payload strings.
- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_DIAGNOSTICS_AUDIT_2026_05_18.md`;
  supported base-color rotation, transformed UV1 unsupported, transformed
  non-base-color unsupported, and missing UV1 diagnostics remain distinct, with
  unsupported transform paths stopping before draw/pipeline submission.
- Added
  `docs/research/GENERIC_ROUTE_SUMMARY_NEXT_FAMILY_HANDOFF_2026_05_18.md`;
  future non-built-in material families should reuse the generic queue route,
  frame-resource, and `routedResourceSet` diagnostics contracts instead of
  copying built-in app-route wrappers.
- Added `queued-material-frame-resource-buckets.ts`, a generic family-keyed
  bucket store with deterministic summaries. Built-in frame-resource
  preparation now writes successful resources into the generic bucket store
  while preserving `unlit`, `matcap`, and `standard` compatibility arrays.
- Added `docs/research/GENERIC_BUCKET_MIGRATION_AUDIT_2026_05_18.md`; the
  bucket helper does not introduce ECS/game ownership or public raw GPU
  diagnostics, and future diagnostics should consume summaries rather than raw
  bucket maps.
- Added `docs/research/GENERIC_BUCKET_DIAGNOSTICS_HANDOFF_2026_05_18.md`;
  generic bucket counts should flow through summary rows under existing app
  diagnostics naming, not through raw bucket maps or new family-specific
  resource-set fields.
- Extended generic bucket coverage for family lookup, reset behavior,
  deterministic summaries, stale-family cleanup, and JSON-safe summary output.
- Added `docs/research/NEXT_FAMILY_ROUTE_READINESS_AUDIT_2026_05_18.md`; the
  generic route/bucket spine is ready for a test-only non-built-in adapter
  spike, but real app material-family work should wait until diagnostics
  routing uses generic summaries.
- Updated `docs/index.html` and `docs/render-pipeline-comparison.html` for the
  completed render-pipeline work and refilled the backlog with `task-1166`
  through `task-1173`.

Files touched:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `docs/index.html`
- `docs/render-pipeline-comparison.html`
- `docs/research/GLB_MISSING_TEXCOORD1_BROWSER_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_QUEUED_RESOURCE_SUMMARY_MIGRATION_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARED_ROUTE_MIGRATION_PLAN_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `examples/standard-texture-control.js`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/e2e/standard-gltf-texture.spec.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-shader.test.ts`

Validation:

- `node --check examples/standard-gltf-texture.js && node --check examples/standard-texture-control.js`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts test/rendering/extraction.test.ts`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts test/rendering/extraction.test.ts test/webgpu/app-diagnostics-summary.test.ts test/webgpu/queued-built-in-resource-set-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "rotation transforms|texture transforms before"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts test/e2e/standard-texture-control.spec.ts -g "base-color rotation transforms|base-color offset and scale transforms|texture transforms before|base-color texture transforms before"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "TEXCOORD_1"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "transformed TEXCOORD_1|TEXCOORD_1"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "non-base-color transforms"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec prettier --check docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `pnpm exec prettier --check docs/research/GENERIC_ROUTE_SUMMARY_NEXT_FAMILY_HANDOFF_2026_05_18.md`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec prettier --check docs/research/GENERIC_BUCKET_MIGRATION_AUDIT_2026_05_18.md`
- `pnpm exec prettier --check docs/research/GENERIC_BUCKET_DIAGNOSTICS_HANDOFF_2026_05_18.md`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts`
- `pnpm exec prettier --check docs/research/NEXT_FAMILY_ROUTE_READINESS_AUDIT_2026_05_18.md`
- `pnpm exec prettier --check` on touched implementation, test, example,
  docs, and agent files.
- `pnpm run check:progress`
- `git diff --check`

Additional reference files/patterns inspected:

- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`
- `docs/research/STANDARD_GLB_NON_UV0_TEXTURE_COORDINATE_FIXTURE_PLAN_2026_05_18.md`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/engine/src/scene/shader-lib/programs/lit-shader.js`
- `references/engine/src/scene/shader-lib/programs/standard.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/three.js/src/renderers/webgl/WebGLMaterials.js`
- `references/three.js/src/textures/Texture.js`

Known issues / follow-ups:

- Stop hook succeeded, checkpointed, and pushed `e41be0f`.
- `task-1178` should route app diagnostics through generic bucket summary.

## Current Run Update — 2026-05-18T03:56:07Z

Completed `task-1149`, `task-1148`, `task-1150`, `task-1152`, and
`task-1151`, then completed `task-1153`, `task-1154`, `task-1155`, and
`task-1156`, then completed `task-1157`, `task-1158`, `task-1159`, and
`task-1160`. Recommended next task is `task-1161`.

Completed task ids:

- `task-1149` — Surface app diagnostics summary in the standard GLB browser
  status.
- `task-1148` — Implement base-color texture transform offset/scale sampling.
- `task-1150` — Audit generic frame-resource collector after implementation.
- `task-1152` — Add generic collector failed-route diagnostics coverage.
- `task-1151` — Plan StandardMaterial non-UV0 texture-coordinate fixture.
- `task-1153` — Add standard GLB base-color UV1 browser fixture.
- `task-1154` — Audit StandardMaterial texture-transform support after
  sampling.
- `task-1155` — Add generic collector dependency-failure diagnostics coverage.
- `task-1156` — Plan StandardMaterial texture-transform rotation fixture.
- `task-1157` — Plan generic material-family app route summary migration.
- `task-1158` — Add GLB missing TEXCOORD_1 browser diagnostic fixture.
- `task-1159` — Add StandardMaterial texture-transform packer boundary note.
- `task-1160` — Audit generic collector dependency-failure coverage.

Highlights:

- `standard-gltf-texture` now publishes `report.diagnosticsSummary` when the
  app render report includes one. The ready StandardMaterial path asserts
  material-queue and routed-resource-set summary counts; delayed dependencies
  and unsupported transforms assert the summary remains absent before queueing.
- Added StandardMaterial base-color texture transform offset/scale support for
  UV0. The transform is preserved from glTF mapping, accepted by readiness,
  packed into the StandardMaterial uniform, and applied in WGSL before
  base-color sampling.
- Added `standard-gltf-texture?scenario=base-color-transform-sampling` with a
  two-color readback assertion that proves transformed UV sampling. The existing
  `base-color-transform` fixture now remains an unsupported-rotation diagnostic
  path.
- Added
  `docs/research/GENERIC_FRAME_RESOURCE_COLLECTOR_AUDIT_2026_05_18.md`; the
  generic collector still does not accept `WebGpuApp`, ECS world access,
  canvas/context/queue submission, or hard-coded built-in buckets.
- Added direct generic failed frame-resource route coverage in
  `test/webgpu/queued-material-frame-resource-set.test.ts`.
- Added
  `docs/research/STANDARD_GLB_NON_UV0_TEXTURE_COORDINATE_FIXTURE_PLAN_2026_05_18.md`
  and implemented the selected `base-color-uv1` browser fixture.
- Added `standard-gltf-texture?scenario=base-color-uv1`, authoring
  `baseColorTexture.texCoord = 1` with a mesh that includes `TEXCOORD_1`.
  Playwright now verifies the UV1 pipeline key, mesh layout key, readiness slot,
  JSON-safe status, and UV1-selected screenshot/readback color without claiming
  binary GLB mesh import support.
- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`.
  The current texture-transform contract remains aligned: only base-color
  offset/scale on `TEXCOORD_0` is supported, rotation/transformed UV1/non-base
  slots diagnose before app-path draw submission, and the packer is documented
  as not being the transform validation boundary.
- Added direct generic collector coverage for invalid texture/sampler dependency
  preparation. The test verifies dependency failures do not create frame-resource
  options, do not create frame resources, do not append resources, and keep
  diagnostics JSON-safe.
- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_FIXTURE_PLAN_2026_05_18.md`.
  The selected fixture uses a known UV0 sample, a nearest 4x4 texture, and a
  90-degree rotation plus offset to distinguish Khronos-ordered rotation from
  offset/scale-only and untransformed sampling.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`.
  The plan keeps the public `routedResourceSet` diagnostics field stable while
  moving its built-in-specific summary helper behind a generic queued material
  frame-resource summary contract.
- Added `standard-gltf-texture?scenario=base-color-uv1-missing`, which authors
  `baseColorTexture.texCoord = 1` while leaving the mesh UV0-only. Playwright
  verifies JSON-safe `render.standardMaterialTexture.missingTexCoord1` status,
  no pipeline keys, and zero draw calls.
- Added
  `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_PACKER_BOUNDARY_2026_05_18.md`;
  it documents that `packStandardMaterial()` serializes accepted material state
  and is not the unsupported-transform validation boundary.
- Added
  `docs/research/GENERIC_COLLECTOR_DEPENDENCY_FAILURE_COVERAGE_AUDIT_2026_05_18.md`;
  the generic collector now has direct success, failed frame-resource result,
  and invalid texture/sampler dependency coverage.
- Fixed stale extraction coverage so the unsupported-transform extraction test
  uses rotation; base-color UV0 offset/scale is now supported.
- Refilled the ready backlog with `task-1161` through `task-1165`.
- Refreshed `docs/index.html` and `docs/render-pipeline-comparison.html` for
  the completed render-pipeline work.

Validation:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-shader.test.ts test/materials/gltf-material.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "mapped base-color texture|delayed source dependencies|texture transforms"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "offset and scale transforms|texture transforms before"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "TEXCOORD_1"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec prettier --check` on touched implementation, test, and research
  files.
- `pnpm run check:progress`
- `git diff --check`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "missing TEXCOORD_1"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec vitest run test/rendering/extraction.test.ts`

Additional reference files/patterns inspected:

- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/common/RenderObject.js`
- `docs/research/GLB_TEXTURE_TRANSFORM_SAMPLING_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `docs/research/CONTROLLED_STANDARD_UV1_BROWSER_VERIFICATION_PLAN_2026_05_17.md`
- `docs/research/STANDARD_GLB_NON_UV0_TEXTURE_COORDINATE_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_SUPPORT_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_ROTATION_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_TEXTURE_TRANSFORM_PACKER_BOUNDARY_2026_05_18.md`
- `docs/research/GENERIC_COLLECTOR_DEPENDENCY_FAILURE_COVERAGE_AUDIT_2026_05_18.md`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1161` should implement the planned base-color texture-transform
  rotation sampling fixture.
- `task-1164` should add the transformed-UV1 unsupported browser fixture.

## Current Run Update — 2026-05-18T02:43:00Z

Completed `task-1142` through `task-1147`. Recommended next task is
`task-1149`.

Completed task ids:

- `task-1142` — Audit queued frame-resource extraction boundary.
- `task-1143` — Plan generic material-family frame-resource adapter interface.
- `task-1144` — Expose queued route summary in app diagnostics.
- `task-1145` — Plan GLB texture-transform sampling fixture.
- `task-1146` — Audit standard GLB texture helper extraction.
- `task-1147` — Introduce generic queued material frame-resource collector
  contracts.

Highlights:

- Added
  `docs/research/QUEUED_FRAME_RESOURCE_EXTRACTION_BOUNDARY_AUDIT_2026_05_18.md`;
  confirmed the extracted queued frame-resource set module has no `WebGpuApp`,
  canvas, ECS world, `AssetRegistry`, or render-world dependency.
- Removed the unused `snapshot` input from
  `prepareQueuedBuiltInFrameResourceSet()` and updated its app caller/tests.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`;
  next implementation slice is `task-1147`.
- Added app render-report `diagnosticsSummary` JSON for queued material routes:
  successful queued frames expose material queue and routed resource-set
  summaries; unsupported route failures expose the JSON-safe material queue
  route report.
- Added
  `docs/research/GLB_TEXTURE_TRANSFORM_SAMPLING_FIXTURE_PLAN_2026_05_18.md`
  and
  `docs/research/STANDARD_GLB_TEXTURE_HELPER_EXTRACTION_AUDIT_2026_05_18.md`.
- Refilled the ready backlog with `task-1147` through `task-1151` and refreshed
  `docs/index.html` / `docs/render-pipeline-comparison.html`.
- Added `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
  exported it, and re-routed the built-in queued frame-resource set wrapper
  through the generic collector. Added
  `test/webgpu/queued-material-frame-resource-set.test.ts` for a generic
  non-built-in success path.

Validation in this continuation:

- `pnpm exec vitest run test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/app-diagnostics-summary.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker, build,
  test typecheck, example syntax checks, lint, format check, and 251 Vitest
  files / 1169 tests.
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

Additional reference files/patterns inspected:

- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`
- `docs/ARCHITECTURE.md`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/common/RenderObject.js`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`

Known issues / follow-ups:

- First stop-hook retry at 2026-05-18T02:55:08Z failed because
  `agent/STATUS.json` still had `activePid=71520`; this was cleared before the
  next retry.
- `task-1149` should publish the app render `diagnosticsSummary` through the
  standard GLB browser status and assert the JSON-safe route/resource summary.

## Current Run Update — 2026-05-18T02:29:10Z

Completed `task-1127`, `task-1128`, `task-1129`, `task-1132`, `task-1136`,
and `task-1137` through `task-1141`. Recommended next task is `task-1142`.

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

Highlights:

- Added `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts` and
  moved queued built-in frame-resource scratch ownership/result assembly out of
  `app.ts`; app-specific pipeline/layout/texture/frame-resource behavior remains
  injected.
- Added `test/webgpu/queued-built-in-frame-resource-set.test.ts` for successful
  preparation, failed frame-resource route diagnostics, and scratch reset/reuse.
- Preserved `dependencyKind` in top-level GLB asset mapping diagnostics and
  added invalid image/texture and invalid sampler matrix tests for all five
  StandardMaterial texture slots.
- Added `standard-gltf-texture?scenario=delayed-dependencies` with GLB-derived
  loading/failed texture and sampler source dependencies, material dependency
  readiness, and StandardMaterial texture-readiness status.
- Added
  `docs/research/GLB_ALPHA_MASK_BACKFACE_VISUAL_FIXTURE_PLAN_2026_05_18.md`,
  implemented `standard-gltf-texture?scenario=alpha-mask-backface`, and verified
  a visible scalar masked backface pixel/readback sample on the no-cull pipeline.
- Added alpha-mask and delayed-dependency audits and refreshed
  `docs/index.html` / `docs/render-pipeline-comparison.html`.
- Refilled ready backlog with `task-1142` through `task-1146`; next recommended
  task is `task-1142` to audit the queued frame-resource extraction boundary.

Validation:

- `pnpm exec vitest run test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec vitest run test/webgpu/queued-built-in-app-resource-set.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/assets/gltf-source-registration-dependencies.test.ts test/materials/standard-texture-readiness.test.ts`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "delayed source dependencies"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "backface"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker, build,
  test typecheck, example syntax checks, lint, format check, and 250 Vitest
  files / 1168 tests.

Additional reference files/patterns inspected:

- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/common/RenderObject.js`
- `references/bevy/crates/bevy_asset/src/loader.rs`
- `references/bevy/crates/bevy_asset/src/render_asset.rs`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_pbr/src/lib.rs`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1142` should verify the queued frame-resource split did not introduce
  app/canvas/ECS ownership drift.
- `task-1144` and `task-1145` remain the next queue/status and texture-transform
  planning candidates after the audit.

## Current Run Update — 2026-05-18T01:52:03Z

Completed `task-1112`, `task-1119` through `task-1126`, `task-1130` through
`task-1131`, and `task-1133` through `task-1135`. Recommended next task remains
`task-1127`.

Additional completed task id:

- `task-1135` — Add StandardMaterial alpha-mask buffer flag test.

Additional highlights since the previous handoff entry:

- Added a focused StandardMaterial material-buffer packing test for a textured
  masked material.
- The test locks `BASE_COLOR_TEXTURE`, `ALPHA_MASK`, and `DOUBLE_SIDED` feature
  flags, `alphaCutoff`, and base-color texture/sampler dependency keys.
- Refilled the ready backlog with `task-1136`, an audit of alpha-mask coverage
  alignment across mapping, buffer packing, WGSL, pipeline keys, and browser
  pixels.

Additional validation:

- `pnpm exec vitest run test/webgpu/standard-material-buffer.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, example syntax checks, lint, format check,
  and 249 Vitest files / 1161 tests.

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` remains the recommended next architecture task.

## Current Run Update — 2026-05-18T01:49:41Z

Completed `task-1112`, `task-1119` through `task-1126`, `task-1130` through
`task-1131`, and `task-1133` through `task-1134`. Recommended next task remains
`task-1127`.

Additional completed task id:

- `task-1134` — Add GLB alpha-mask texture mobile viewport smoke test.

Additional highlights since the previous handoff entry:

- Added a narrow viewport Playwright smoke test for
  `standard-gltf-texture?scenario=alpha-mask-texture`.
- The test verifies JSON-safe status, one extracted draw, the textured
  alpha-test pipeline key, and the opaque/masked pixel split at a smaller
  viewport.
- Refilled the ready backlog with `task-1135` for StandardMaterial alpha-mask
  buffer flag coverage.

Additional validation:

- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "narrow viewport"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` remains the recommended next architecture task.

## Current Run Update — 2026-05-18T01:47:16Z

Completed `task-1112`, `task-1119` through `task-1126`, `task-1130` through
`task-1131`, and `task-1133`. Recommended next task remains `task-1127`.

Additional completed task id:

- `task-1133` — Add StandardMaterial textured alpha-mask shader contract test.

Additional highlights since the previous handoff entry:

- Added a focused StandardMaterial shader contract test in
  `test/webgpu/standard-shader.test.ts`.
- The test verifies the base-color-textured WGSL variant computes alpha from
  `baseColorSample.a * material.baseColorFactor.a`, applies
  `material.alphaCutoff` before `discard`, and keeps
  `standard|baseColorTexture|mask|none|less|none` stable for a textured masked
  StandardMaterial.
- Refilled the ready backlog with `task-1134` for a narrow alpha-mask texture
  mobile viewport smoke test.

Additional validation:

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:progress`

Additional reference files/patterns inspected:

- `packages/webgpu/src/webgpu/standard-shader.ts`
- `test/webgpu/standard-shader.test.ts`
- `packages/render/src/materials/pipeline-key.ts`
- `test/materials/materials.test.ts`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` remains the recommended next architecture task.

## Current Run Update — 2026-05-18T01:44:18Z

Completed `task-1112`, `task-1119` through `task-1126`, and `task-1130`
through `task-1131`. Recommended next task remains `task-1127`.

Additional completed task id:

- `task-1131` — Audit GLB texture browser status after alpha-mask pixels.

Additional highlights since the previous handoff entry:

- Added
  `docs/research/GLB_TEXTURE_BROWSER_STATUS_AFTER_ALPHA_MASK_AUDIT_2026_05_17.md`.
- Confirmed the alpha-mask texture browser status still derives from
  GLB-shaped source mapping, source asset registration, ECS-authored
  mesh/material handles, extraction, and app render reports.
- Confirmed no raw texture bytes, source asset objects, backend caches, bind
  groups, pipelines, queues, devices, or other WebGPU handles are published in
  the browser status.
- No corrective code change was needed.
- Added `task-1133` to keep the ready backlog above five tasks with a focused
  textured alpha-mask shader contract test.

Additional validation:

- `pnpm run check`
- `pnpm run check:progress`

Additional reference files/patterns inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` remains the recommended next architecture task.
- Ready GLB follow-ups are `task-1128`, `task-1129`, `task-1132`, and
  `task-1133`.

## Current Run Update — 2026-05-18T01:41:44Z

Completed `task-1112`, `task-1119` through `task-1126`, and `task-1130`.
Recommended next task remains `task-1127`.

Additional completed task id:

- `task-1130` — Add GLB alpha-mask texture pixel fixture.

Additional highlights since the previous handoff entry:

- Added `standard-gltf-texture?scenario=alpha-mask-texture`.
- The scenario maps a GLB-shaped StandardMaterial base-color texture with alpha
  values above and below `alphaCutoff`, `alphaMode: "MASK"`, and
  `doubleSided: true`.
- Browser status now reports JSON-safe alpha-mask texture expectations,
  source/mapped render-state fields, GLB-derived texture/sampler keys, sampler
  mapping, sample points, pipeline keys, draw/resource counters, and diagnostics.
- Added Playwright coverage that verifies one opaque screenshot/readback sample,
  one masked clear screenshot/readback sample, and the
  `standard|baseColorTexture|mask|none|less|none` pipeline key.
- Refilled ready backlog with `task-1131` audit coverage and `task-1132`
  planning for a future double-sided backface visual proof.

Additional validation:

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "base-color alpha"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`

Additional reference files/patterns inspected:

- `packages/webgpu/src/webgpu/standard-shader.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` remains the recommended next architecture task.
- `task-1131` should audit the browser status shape after the alpha-mask sample
  fields before further GLB fixture expansion.

## Current Run Update — 2026-05-18T01:36:02Z

Completed `task-1112` and `task-1119` through `task-1126`. Recommended next
task remains `task-1127`.

Additional completed task id:

- `task-1126` — Add GLB alpha-mask texture pixel fixture plan.

Additional highlights since the previous handoff entry:

- Added
  `docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`.
- Confirmed `STANDARD_MESH_WGSL` already discards masked StandardMaterial
  fragments using base-color texture alpha when alpha masking is enabled.
- Planned `standard-gltf-texture?scenario=alpha-mask-texture` with one opaque
  sample and one masked clear sample, using a GLB-shaped base-color texture,
  `alphaMode: "MASK"`, `alphaCutoff: 0.5`, and `doubleSided: true`.
- Added `task-1130` as the implementation follow-up with screenshot/readback
  assertions for one opaque pixel and one masked clear pixel.
- Updated public tracker pages again for the alpha-mask pixel fixture plan.

Additional validation:

- `pnpm run check:progress`

Additional reference files/patterns inspected:

- `docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` is still the recommended next architecture task.
- `task-1130` is ready when the run returns to alpha-mask pixel browser
  coverage.

## Current Run Update — 2026-05-18T01:33:18Z

Completed `task-1112` and `task-1119` through `task-1125`. Recommended next
task remains `task-1127`.

Additional completed task id:

- `task-1125` — Plan GLB StandardMaterial dependency diagnostics matrix.

Additional highlights since the previous handoff entry:

- Added
  `docs/research/GLB_STANDARD_MATERIAL_DEPENDENCY_DIAGNOSTICS_MATRIX_2026_05_17.md`.
- Confirmed current GLB-shaped StandardMaterial coverage already plans and
  registers base-color, metallic-roughness, normal, occlusion, and emissive
  texture/sampler handles with slot-specific texture semantics.
- Confirmed existing readiness APIs already diagnose missing/loading/failed
  texture and sampler states, plus StandardMaterial slot semantic/color-space
  mismatches.
- Identified the real remaining coverage gap as GLB-shaped failure/delayed
  dependency fixtures, not missing core diagnostic states.
- Added `task-1128` for invalid GLB texture/sampler diagnostics matrix tests
  and `task-1129` for GLB delayed dependency browser diagnostics.
- Updated public tracker pages to reflect the dependency diagnostics matrix
  planning and next focus.

Additional validation:

- `pnpm run check:progress`

Additional reference files/patterns inspected:

- Bevy anchors: `references/bevy/crates/bevy_asset/src/loader.rs`,
  `references/bevy/crates/bevy_asset/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/lib.rs`, and
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.
- Aperture anchors:
  `packages/render/src/assets/gltf-asset-mapping.ts`,
  `packages/render/src/assets/gltf-source-registration.ts`,
  `packages/render/src/materials/gltf-material.ts`,
  `packages/render/src/materials/gltf-texture.ts`,
  `packages/render/src/materials/dependency-readiness.ts`,
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `test/assets/gltf-asset-mapping.test.ts`,
  `test/assets/gltf-source-registration-dependencies.test.ts`,
  `test/materials/material-dependency-readiness.test.ts`,
  `test/materials/standard-texture-readiness.test.ts`, and
  `test/e2e/standard-gltf-texture.spec.ts`.

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- `task-1127` is still the recommended next task for the renderer/material
  architecture spine.
- `task-1128` and `task-1129` should follow when the run returns to GLB
  dependency diagnostics coverage.

## Current Run Update — 2026-05-18T01:24:01Z

Completed `task-1112` and `task-1119` through `task-1124`. Recommended next
task is `task-1127`.

Completed task ids:

- `task-1112` — Extract queued built-in resource-set collector.
- `task-1119` — Add GLB StandardMaterial occlusion texture browser fixture.
- `task-1120` — Add GLB StandardMaterial emissive texture browser fixture.
- `task-1121` — Add GLB alpha-mask double-sided render-state browser
  diagnostics.
- `task-1122` — Audit GLB browser helpers after occlusion/emissive expansion.
- `task-1123` — Plan generic material-family frame-resource collector split.
- `task-1124` — Add GLB render-state browser helper cleanup.

Highlights:

- Added `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts` and
  moved queue-to-resource-set collection, source asset indexing, prepare-route
  diagnostics, and route-report normalization out of `app.ts`.
- Added `test/webgpu/queued-built-in-app-resource-set.test.ts`, covering one
  successful built-in route and one unsupported `debug-normal` family route
  diagnostic without leaking raw GPU handles into JSON.
- Added `standard-gltf-texture?scenario=occlusion` and
  `standard-gltf-texture?scenario=emissive`, using GLB-style glTF mapping and
  source registration for `occlusionTexture` and `emissiveTexture` through the
  app-facade WebGPU path.
- Added `standard-gltf-texture?scenario=alpha-mask-double-sided`, publishing
  JSON-safe glTF source render-state fields and mapped StandardMaterial render
  state. The current pipeline key is
  `standard|mask|none|less|none`.
- Updated public tracker pages, moved completed tasks to `agent/COMPLETED.md`,
  and refilled the ready backlog with `task-1123` through `task-1126`.
- Added
  `docs/research/GLB_BROWSER_HELPERS_AFTER_OCCLUSION_EMISSIVE_AUDIT_2026_05_17.md`;
  no ECS/source-asset ownership drift or JSON-safety issue was found.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`,
  selecting a `queued-built-in-frame-resource-set` extraction with app/device
  callbacks injected from `app.ts`.
- Extracted local `standard-gltf-texture` status helpers for
  `standardMaterial` render-state status and optional `standardTexture` status
  without changing the published status shape.

Validation:

- `pnpm exec tsc --noEmit -p tsconfig.json`
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/queued-material-frame-resource-route.test.ts test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm run build`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "occlusion"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "emissive"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "alpha-mask"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, example syntax checks, lint, format check,
  and 249 Vitest files / 1159 tests.

Reference files/patterns inspected:

- WebGPU render anchors:
  `references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`
  and `references/three.js/src/renderers/common/RenderObject.js`.
- Aperture anchors:
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_MIGRATION_CHECKPOINT_2026_05_17.md`,
  `docs/research/GLB_OCCLUSION_EMISSIVE_BROWSER_FIXTURE_SPLIT_PLAN_2026_05_17.md`,
  `docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`,
  `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`,
  `packages/render/src/rendering/material-queue.ts`,
  `packages/render/src/assets/gltf-asset-mapping.ts`,
  `packages/render/src/assets/gltf-source-registration-orchestration.ts`,
  `packages/render/src/materials/gltf-material.ts`,
  `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
  `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `references/engine/src/scene/renderer/forward-renderer.js`,
  `references/three.js/src/renderers/common/RenderObject.js`,
  `examples/standard-gltf-texture.js`, and
  `test/e2e/standard-gltf-texture.spec.ts`.

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- The GLB browser path is still inline GLB-equivalent mapping/source
  registration, not binary `.glb` loading.
- The alpha-mask/double-sided browser slice verifies source-to-render-state and
  pipeline-key diagnostics only; it does not prove masked texture pixel
  behavior.
- Next task: `task-1127` extract the queued built-in frame-resource
  preparation set.

## Current Run Update — 2026-05-18T00:38:00Z

Completed `task-1106` through `task-1118`. Recommended next task is
`task-1112`.

Completed task ids:

- `task-1106` — Audit GLB texture browser and upload-usage boundaries.
- `task-1107` — Plan GLB metallic-roughness texture browser fixture.
- `task-1108` — Plan generic material-family queue migration checkpoint.
- `task-1109` — Add GLB base-color sampler mapping browser status coverage.
- `task-1110` — Audit StandardMaterial texture-control harness after repeat and
  GLB additions.
- `task-1111` — Add GLB StandardMaterial metallic-roughness texture browser
  fixture.
- `task-1113` — Extract GLB texture browser fixture helpers.
- `task-1114` — Plan GLB normal texture browser fixture.
- `task-1115` — Add GLB StandardMaterial normal texture browser fixture.
- `task-1116` — Plan GLB occlusion/emissive browser fixture split.
- `task-1117` — Audit GLB texture browser status after metallic/normal work.
- `task-1118` — Plan GLB alpha-mode and double-sided render-state browser
  diagnostics.

Highlights:

- Added GLB upload-usage boundary audit and confirmed `copy-dst` remains source
  metadata while WebGPU upload/resource ownership stays in
  `@aperture-engine/webgpu`.
- Added
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_MIGRATION_CHECKPOINT_2026_05_17.md`
  after inspecting PlayCanvas/three.js render object, pipeline, and material
  preparation patterns; next architecture task is extracting the built-in
  queue-to-resource-set collector out of `app.ts`.
- Added JSON-safe GLB sampler mapping status to
  `examples/standard-gltf-texture.js` and Playwright assertions that source
  glTF sampler enums map to Aperture sampler asset fields without leaking GPU
  sampler objects or backend cache data.
- Added `standard-gltf-texture?scenario=metallic-roughness`, mapping a glTF
  `metallicRoughnessTexture` through source registration and rendering it via
  the normal ECS/app-facade WebGPU path.
- Added a post-repeat/GLB harness audit, then extracted local GLB scenario and
  rendered/expected-failure assertion helpers without changing published status
  values.
- Added
  `docs/research/GLB_NORMAL_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md` and
  refilled the ready queue with concrete GLB/material-queue follow-ups.
- Added `standard-gltf-texture?scenario=normal-map`, mapping a glTF
  `normalTexture` through source registration, using a local tangent-bearing
  mesh fixture, and validating the pipeline/readback path in Playwright.
- Audited GLB browser fixture status after the normal-map addition and found no
  ECS/render/WebGPU ownership drift or JSON-safety issue.
- Added
  `docs/research/GLB_OCCLUSION_EMISSIVE_BROWSER_FIXTURE_SPLIT_PLAN_2026_05_17.md`,
  choosing separate occlusion and emissive GLB browser implementation tasks.
- Added
  `docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`,
  selecting a narrow alpha-mask/double-sided render-state browser diagnostics
  slice.
- Updated public tracker pages for the GLB metallic-roughness/sampler status
  progress and next task.

Validation:

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "mapped base-color"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "metallic-roughness"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "normal texture|normal-map"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, example syntax checks, lint, format check,
  and 248 Vitest files / 1157 tests.

Reference files/patterns inspected:

- WebGPU render anchors:
  `references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`,
  `references/engine/src/scene/renderer/forward-renderer.js`,
  `references/three.js/src/renderers/common/RenderObject.js`, and
  `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`.
- Aperture anchors:
  `packages/render/src/rendering/material-queue.ts`,
  `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
  `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
  `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `examples/standard-gltf-texture.js`, and
  `test/e2e/standard-gltf-texture.spec.ts`.

Known issues / follow-ups:

- Stop hook still needs to run after this handoff entry.
- The GLB browser path is still inline GLB-equivalent mapping/source
  registration, not binary `.glb` loading.
- Next task: `task-1112` extract the queued built-in resource-set collector
  from `packages/webgpu/src/webgpu/app.ts` into a focused internal module.

## Current Run Update — 2026-05-18T00:21:42Z

Completed `task-1099` through `task-1105`. Recommended next task is
`task-1106`.

Completed task ids:

- `task-1099` — Extract local StandardMaterial texture-control scenario helpers.
- `task-1100` — Add minimal GLB StandardMaterial base-color browser fixture.
- `task-1101` — Audit StandardMaterial texture browser coverage after transform
  diagnostics and GLB fixture work.
- `task-1102` — Plan controlled StandardMaterial address-mode sampler browser
  verification.
- `task-1103` — Plan GLB StandardMaterial unsupported texture-transform
  diagnostics browser fixture.
- `task-1104` — Add controlled StandardMaterial repeat sampler browser
  verification.
- `task-1105` — Add GLB StandardMaterial texture-transform diagnostics browser
  fixture.

Highlights:

- Refactored `examples/standard-texture-control.js` around local scenario
  helpers for flags, mesh fixture selection, texture/sampler assets, material
  bindings, and expectation metadata.
- Refactored repeated Playwright status/assertion helpers in
  `test/e2e/standard-texture-control.spec.ts`.
- Added `examples/standard-gltf-texture.html` and
  `examples/standard-gltf-texture.js`, a minimal GLB-equivalent browser fixture
  that maps one StandardMaterial base-color texture, sampler, material, and mesh
  source asset through glTF mapping/source registration into ECS-authored app
  rendering.
- Fixed `createTextureAssetFromGltfTexture()` so decoded glTF image textures
  request `["sampled", "copy-dst"]`; this keeps source assets
  renderer-independent while allowing the WebGPU backend to upload source data.
- Added GLB base-color browser coverage and GLB `KHR_texture_transform`
  expected-failure coverage in `test/e2e/standard-gltf-texture.spec.ts`.
- Added controlled StandardMaterial repeat-U sampler browser coverage via
  `standard-texture-control?scenario=base-color-repeat-sampler`.
- Added research docs for the updated texture browser coverage matrix, repeat
  address-mode sampler plan, and GLB texture-transform diagnostics plan.
- Updated public tracker pages, backlog, completed log, and `package.json`
  example syntax checks.

Validation:

- `node --check examples/standard-texture-control.js`
- `node --check examples/standard-gltf-texture.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/materials/gltf-texture.test.ts`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "texture transforms"`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts -g "repeat sampler"`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, example syntax checks, lint, format check,
  and 248 Vitest files / 1157 tests.

Reference files/patterns inspected:

- Aperture docs: `docs/NORTH_STAR.md`, `docs/ROADMAP.md`,
  `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`.
- Bevy anchors:
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`,
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/texture.rs`, and
  related material/asset-loading pattern files by search.
- Aperture anchors:
  `docs/research/GLB_STANDARD_TEXTURE_BROWSER_FIXTURE_PLAN_2026_05_17.md`,
  `docs/research/CONTROLLED_STANDARD_TEXTURE_TRANSFORM_DIAGNOSTICS_BROWSER_PLAN_2026_05_17.md`,
  `docs/research/GLB_SAMPLER_TEXTURE_TRANSFORM_READINESS_AUDIT_2026_05_17.md`,
  `packages/render/src/assets/gltf-asset-mapping.ts`,
  `packages/render/src/assets/gltf-source-registration-orchestration.ts`,
  `packages/render/src/materials/gltf-material.ts`,
  `packages/render/src/materials/gltf-texture.ts`, and the controlled
  StandardMaterial browser harness files.

Known issues / follow-ups:

- No known validation failures.
- Texture-transform sampling remains intentionally unsupported; authored and
  GLB-derived browser scenarios prove the diagnostic/no-submit path.
- The GLB browser fixture is GLB-equivalent report/source-registration replay,
  not a binary GLB parser/browser loader.
- Next task: `task-1106` audit GLB texture browser and upload-usage boundaries,
  especially after the `copy-dst` source texture usage fix.

## Current Run Update — 2026-05-17T23:44:00Z

Completed `task-1098`. Recommended next task is `task-1099`.

Completed task ids:

- `task-1098` — Add controlled StandardMaterial base-color texture-transform
  diagnostics browser scenario.

Highlights:

- Added `standard-texture-control?scenario=base-color-transform` to the
  controlled StandardMaterial browser harness.
- The scenario authors non-identity `baseColorTexture.transform` bindings on
  both controlled StandardMaterial peers so current readiness/extraction blocks
  all submitted draws rather than silently sampling an unsupported transform.
- Browser status now reports the expected
  `render.standardMaterialTexture.unsupportedTextureTransform` diagnostic,
  expected `unsupported-transform` texture status, expected transform metadata,
  empty pipeline keys, zero mesh draws, and zero draw calls.
- Added Playwright coverage proving the invalid transform frame is JSON-safe,
  submits no draw calls, and does not claim texture-transform sampling support.
- Updated `docs/index.html`, `docs/render-pipeline-comparison.html`,
  `agent/BACKLOG.md`, and `agent/COMPLETED.md`. The ready queue now starts with
  `task-1099`, followed by `task-1100`, `task-1101`, `task-1102`, and
  `task-1103`.

Validation:

- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts -g "base-color texture transforms"`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, example syntax checks, lint, format check,
  and 248 Vitest files / 1157 tests.

Reference files/patterns inspected:

- Aperture anchors:
  `docs/research/CONTROLLED_STANDARD_TEXTURE_TRANSFORM_DIAGNOSTICS_BROWSER_PLAN_2026_05_17.md`,
  `examples/standard-texture-control.js`,
  `test/e2e/standard-texture-control.spec.ts`,
  `packages/render/src/materials/standard-texture-readiness.ts`, and
  `test/rendering/extraction.test.ts`.

Known issues / follow-ups:

- No known validation failures.
- Texture-transform sampling itself remains intentionally unsupported; this
  slice proves the diagnostic/no-submit path.
- Next task: `task-1099` extract local StandardMaterial texture-control
  scenario helpers before adding more browser scenarios.

## Current Run Update — 2026-05-17T23:12:32Z

Completed `task-1077` through `task-1097`; `task-1089` was also completed.
Recommended next task is `task-1099`.

Completed task ids:

- `task-1077` — Audit StandardMaterial texture browser coverage gaps.
- `task-1078` — Plan controlled StandardMaterial metallic-roughness browser
  verification.
- `task-1079` — Add loading/failed StandardMaterial texture browser diagnostics
  variants.
- `task-1080` — Audit tracker/backlog alignment after readback planning.
- `task-1081` — Implement optional app-facade current-texture readback samples.
- `task-1082` — Add controlled StandardMaterial metallic-roughness browser
  verification.
- `task-1083` — Audit app-facade readback boundaries after implementation.
- `task-1084` — Plan controlled StandardMaterial normal-map browser
  verification.
- `task-1085` — Plan controlled StandardMaterial occlusion/emissive browser
  verification.
- `task-1086` — Add controlled StandardMaterial normal-map browser
  verification.
- `task-1087` — Audit StandardMaterial normal-map browser boundaries.
- `task-1088` — Add controlled StandardMaterial occlusion/emissive browser
  verification.
- `task-1090` — Audit StandardMaterial browser texture coverage after
  occlusion/emissive scenarios.
- `task-1091` — Add normal-map missing-tangents browser diagnostics.
- `task-1089` — Plan StandardMaterial UV1 browser verification.
- `task-1092` — Plan StandardMaterial sampler comparison browser verification.
- `task-1096` — Add controlled StandardMaterial base-color UV1 browser
  verification.
- `task-1097` — Add controlled StandardMaterial base-color linear sampler
  browser verification.
- `task-1093` — Plan StandardMaterial texture-transform diagnostics browser
  verification.
- `task-1094` — Audit StandardMaterial texture-control harness
  maintainability.
- `task-1095` — Plan GLB StandardMaterial texture browser fixture.

Highlights:

- Added opt-in app-facade current-texture readback support:
  `WebGpuApp.render({ readbackSamples })` can request JSON-safe RGBA samples
  without exposing current textures, buffers, queues, encoders, or backend
  caches. Render success remains independent from readback success.
- Extended `examples/standard-texture-control.js` and
  `test/e2e/standard-texture-control.spec.ts` with controlled browser coverage
  for base-color, base-color UV1, base-color linear sampler,
  metallic-roughness, normal-map, occlusion, and emissive positive paths, plus
  missing/loading/failed base-color and normal missing-tangent no-submission
  diagnostics.
- Added the local tangent-enriched plane fixture only inside the controlled
  browser example for `?scenario=normal-map`; no tangent generation or GPU
  ownership moved into ECS.
- Added research/audit docs for StandardMaterial texture browser gaps,
  metallic-roughness planning, app-facade readback boundaries, normal-map
  planning, occlusion/emissive planning, tracker/backlog alignment, normal-map
  browser boundaries, the post-occlusion/emissive texture coverage matrix, and
  controlled base-color UV1 and base-color linear sampler browser
  verification, plus a base-color texture-transform diagnostics browser plan.
- Audited the texture-control harness and found a concrete local refactor need
  before adding more scenarios: scenario setup is now branch-heavy and the e2e
  file repeats positive/expected-failure assertions.
- Planned the first GLB StandardMaterial browser fixture around a minimal
  base-color texture handoff, keeping exact slot behavior in authored-source
  browser tests.
- Updated `docs/index.html`, `docs/render-pipeline-comparison.html`,
  `agent/BACKLOG.md`, and `agent/COMPLETED.md`. The immediate ready queue now
  starts with `task-1099`, then `task-1098`, and `task-1100`.
- Fixed two broad-check drift tests:
  `test/webgpu/current-texture-view.test.ts` now expects the readback-visible
  current texture reference, and
  `test/examples/multi-entity-scenarios.test.mjs` ignores non-multi-entity
  scenario literals.

Validation:

- `node --check examples/standard-texture-control.js`
- `pnpm exec prettier --check examples/standard-texture-control.js test/e2e/standard-texture-control.spec.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/frame-boundary-smoke.test.ts test/webgpu/frame-boundary-json.test.ts test/webgpu/frame-boundary-diagnostics.test.ts`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm run check:progress`
- `pnpm exec vitest run test/webgpu/current-texture-view.test.ts test/examples/multi-entity-scenarios.test.mjs`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, example syntax checks, lint, format check,
  and 248 Vitest files / 1157 tests.

Stop-hook note:

- `scripts/codex-stop-hook.sh` was run after validation and returned
  `{"decision":"block","reason":"current minute is 20; keep working until minute 55 of the hour."}`.
  This was after the configured 45-minute work window had elapsed, so this run
  stopped with the repository validated and `agent/STATUS.json` idle, but
  without a stop-hook checkpoint/push.

Reference files/patterns inspected:

- Aperture anchors:
  `docs/ARCHITECTURE.md`,
  `docs/research/CONTROLLED_STANDARD_NORMAL_MAP_BROWSER_VERIFICATION_PLAN_2026_05_17.md`,
  `examples/standard-texture-control.js`,
  `test/e2e/standard-texture-control.spec.ts`,
  `packages/render/src/materials/standard-normal-map-readiness.ts`,
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `test/webgpu/webgpu-app.test.ts`, and
  `test/webgpu/current-texture-view.test.ts`.
- Earlier readback and texture-planning slices in this run also inspected the
  relevant app/frame-boundary helpers and StandardMaterial texture readiness
  paths recorded in the research docs.

Known issues / follow-ups:

- No known validation failures.
- The normal-map browser proof uses deliberately controlled lighting and a
  tilted encoded normal to prove the authored normal slot affects direct-lit
  pixels; it does not claim full glTF normal-map fidelity.
- Next task: `task-1099` extract local StandardMaterial texture-control
  scenario helpers.

## Latest Run Update

Completed `task-1046` through `task-1076`. Recommended next task is
`task-1077`.

Completed task ids:

- `task-1046` through `task-1076`

Highlights:

- Planned and audited frame-resource route shell summary consumption:
  - Kept `createQueuedMaterialFrameResourceRouteShellSummary()` helper-only for
    now.
  - Preserved failure-only `webGpuApp.frameResourceRoute` diagnostics and
    continued to omit successful route shell summaries from default app reports.
- Planned and added a render-package prepared summary consumer helper:
  - Added `createRenderWorldPreparedResourceSummaryFromReport()` in
    `packages/render/src/rendering/render-world-prepared-resource-summary.ts`.
  - The helper adapts
    `prepareAndBindSnapshotPreparedResourcesToRenderWorld()` reports into the
    existing compact `RenderWorldPreparedResourceSummary`.
  - It counts apply/preparation, binding, draw-readiness, and caller diagnostics
    once, without using the aggregate report diagnostics in a way that would
    double-count binding/readiness diagnostics.
- Added targeted render summary coverage proving the helper keeps prepared
  facade summaries separate from backend/cache details and omits missing asset
  keys/GPU strings from JSON output.
- Documented the new prepared summary consumer helper in
  `docs/DIAGNOSTICS_SUMMARIES.md`.
- Updated `docs/index.html`, `docs/render-pipeline-comparison.html`,
  `agent/BACKLOG.md`, and `agent/COMPLETED.md` with the latest completed work
  and next ready tasks.
- Added `createPreparedResourceAppReuseAlignmentSummary()` in
  `packages/webgpu/src/webgpu/prepared-resource-app-reuse-alignment-summary.ts`.
  It compares render prepared facade counts with app reuse prepared facade and
  resource counters without exposing backend cache maps.
- Added `createQueuedMaterialPrepareRouteSummary()` and
  `createQueuedMaterialRouteSummaryGroup()` in
  `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`.
  These summarize prepare-route and frame-resource-route health for explicit
  diagnostics consumers only.
- Extended `examples/app-diagnostics.js` and Playwright coverage with an
  example-owned `preparedAppReuseSummary`, keeping app report shape unchanged.
- Deferred broader route orchestration extraction until a concrete duplication,
  allocation, or diagnostics need appears.
- Added glTF asset-mapping tests for `OPAQUE`, `MASK`, `BLEND`,
  `alphaCutoff`, and `doubleSided` mapping into StandardMaterial render state.
- Planned the next StandardMaterial texture work around semantic/color-space
  readiness diagnostics and controlled browser texture verification.
- Promoted StandardMaterial texture semantic/color-space readiness details onto
  extracted `RenderDiagnostic` entries:
  - Added optional `expectedSemantic`, `actualSemantic`,
    `expectedColorSpaces`, and `actualColorSpace` fields to
    `RenderDiagnostic`.
  - Copied those fields during StandardMaterial texture-readiness diagnostic
    promotion in extraction.
  - Added focused extraction coverage for the expected/actual values.
- Planned and audited the controlled browser texture harness:
  - Corrected the first plan after confirming `examples/multi-entity.js` still
    uses the unlit frame-resource path for successful multi-entity rendering.
  - Chose a dedicated app-facade example instead of forcing StandardMaterial
    into that unlit harness.
- Added `examples/standard-texture-control.html` and
  `examples/standard-texture-control.js`:
  - Fixed camera/lights.
  - Scalar StandardMaterial baseline plus base-color textured StandardMaterial.
  - JSON-safe status with pipeline keys, resource counters, expected sample
    colors, and sample coordinates.
  - Browser link added from the harness pages.
- Added `test/e2e/standard-texture-control.spec.ts`:
  - Verifies the textured StandardMaterial pipeline key.
  - Verifies one texture/sampler resource pair and two draw submissions.
  - Uses canvas screenshot sampling to prove the textured material is visually
    distinct from the scalar baseline.
- Planned the next negative-path slice:
  `standard-texture-control?scenario=missing-texture`, with no-submission
  JSON-safe diagnostics.
- Implemented that `missing-texture` scenario:
  - Keeps the scalar StandardMaterial peer ready.
  - Leaves the textured StandardMaterial base-color texture missing with a ready
    sampler.
  - Publishes expected-failure status with
    `render.standardMaterialTexture.textureNotReady`.
  - Playwright verifies no draw submission and JSON-safe diagnostics.
- Audited tracker/backlog alignment after browser texture coverage and moved the
  next task to app-facade current-texture readback planning.
- Planned app-facade current-texture readback support:
  - Selected an opt-in `app.render({ readbackSamples })` style follow-up.
  - Kept screenshots as the current fallback.
  - Explicitly rejected exposing current textures, command encoders, queues, or
    raw WebGPU objects from `WebGpuApp`.

Validation:

- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec vitest run test/rendering/render-world-prepared-resource-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec vitest run test/webgpu/prepared-resource-app-reuse-alignment-summary.test.ts test/webgpu/prepared-resource-lifetime-alignment-summary.test.ts`
- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts test/webgpu/queued-material-frame-resource-route.test.ts test/webgpu/material-queue-route-report.test.ts`
- `node --check examples/app-diagnostics.js`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec vitest run test/assets/gltf-asset-mapping.test.ts test/assets/gltf-asset-mapping-json.test.ts test/webgpu/standard-render-state-summary.test.ts`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, examples syntax, lint, format check, and 248
  Vitest files / 1157 tests.
- `pnpm exec vitest run test/rendering/extraction.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `node --check examples/standard-texture-control.js`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec playwright test test/e2e/standard-texture-control.spec.ts`
- `pnpm exec vitest run test/examples/multi-entity-scenarios.test.mjs`
- In-app browser opened
  `http://127.0.0.1:4173/examples/standard-texture-control.html?verify=1`
  and showed ready status.

Validation note:

- The final `pnpm run check` after code/example changes passed with 248 Vitest
  files / 1157 tests. A later docs-only `task-1076` update ran
  `pnpm run check:progress`.

Validation note:

- One browser-tool sanity check created `.playwright-mcp` artifacts that caused
  `format:check` to fail; those generated artifacts were removed and
  `pnpm run check` passed afterward.

Reference files/patterns inspected:

- Aperture anchors:
  `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `examples/app-diagnostics.js`,
  `test/webgpu/queued-material-frame-resource-route.test.ts`,
  `packages/render/src/rendering/render-world-prepared-resource-summary.ts`,
  `packages/render/src/rendering/render-world-prepared-resources.ts`,
  `test/rendering/render-world-prepared-resource-summary.test.ts`,
  `packages/webgpu/src/webgpu/prepared-resource-app-reuse-alignment-summary.ts`,
  `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`,
  `packages/render/src/materials/gltf-material.ts`,
  `packages/render/src/assets/gltf-asset-mapping.ts`,
  `examples/app-diagnostics.js`,
  `test/e2e/app-diagnostics.spec.ts`,
  `test/assets/gltf-asset-mapping.test.ts`, and
  `docs/DIAGNOSTICS_SUMMARIES.md`,
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `examples/materials-showcase.js`,
  `examples/multi-entity.js`,
  `examples/webgpu-readback.js`,
  `test/e2e/multi-textured-unlit.spec.ts`,
  `test/e2e/standard-texture-control.spec.ts`, and
  `test/e2e/app-diagnostics.spec.ts`.
- Bevy anchors:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`, and
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.

Known issues / follow-ups:

- No known validation failures.
- Current `standard-texture-control` verification is screenshot-based. Exact
  app-facade current-texture readback implementation remains deferred to
  `task-1081`.
- Next task: `task-1077` audit remaining StandardMaterial texture browser
  coverage gaps.
- Keep route, prepared facade, lifetime, texture, and sampler summaries opt-in
  and outside default successful app-frame reports unless a future decision
  records a broader app report surface.

## Previous Run Update

Completed `task-1016` through `task-1045`. Recommended next task is
`task-1046`.

Completed task ids:

- `task-1016` through `task-1045`

Highlights:

- Planned, implemented, and audited generic built-in frame-resource helper app
  integration:
  - Added `appendQueuedBuiltInFrameResourceViaAdapter()` in
    `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`.
  - Updated the queued built-in app path to append valid unlit, matcap, and
    StandardMaterial frame resources through the generic adapter helper while
    preserving the existing `adapter.createFrameResources()` call site and
    failure route diagnostics.
- Added StandardMaterial sampler fidelity summary aggregation:
  - Added `createStandardMaterialSamplerFidelitySummary()` in
    `packages/webgpu/src/webgpu/standard-material-sampler-fidelity-summary.ts`.
  - The helper aggregates sampler fidelity warning reports by field and issue
    code without material, texture, sampler, or GPU handles.
- Extended `examples/app-diagnostics.js` and Playwright coverage so the example
  publishes example-owned sampler fidelity summary JSON while keeping app
  reports unchanged.
- Extracted small named helpers in `packages/webgpu/src/webgpu/app.ts` for
  queued built-in frame-resource option assembly and texture/sampler dependency
  preparation.
- Planned final queued built-in app route helper composition and intentionally
  deferred a larger composition helper until a concrete diagnostics or
  allocation need appears.
- Tightened mixed built-in WebGPU app regression coverage so successful
  helper-composed frames still omit `webGpuApp.frameResourceRoute` and
  `webGpuApp.materialQueueRouteReport` diagnostics while preserving creation and
  reuse counts.
- Planned, implemented, and audited app diagnostics example prepared/lifetime
  summaries:
  - The successful mixed-material scenario now exposes example-owned
    `preparedResourceSummary` and `preparedLifetimeSummary` fields.
  - Playwright verifies compact prepared/lifetime counts and omission of raw
    handles/GPU strings.
- Planned the next generic material-family route contract slice:
  - The next implementation should add a compact JSON-safe frame-resource route
    shell summary helper.
  - A larger `prepareQueuedBuiltInFrameResources()` orchestration extraction was
    explicitly deferred.
- Audited tracker/backlog alignment after diagnostics example updates.
- Added and audited `createQueuedMaterialFrameResourceRouteShellSummary()`:
  - The helper summarizes frame-resource route shells using validity, status,
    key-presence booleans, pipeline/frame facts, and diagnostic code counts.
  - Tests prove the summary omits facade keys, backend keys, raw diagnostic
    messages/resource keys, and GPU handles.
- Planned StandardMaterial sampler readiness alignment:
  - Keep sampler fidelity warnings separate from texture readiness blockers for
    now.
  - Next implementation should add a compact texture/sampler alignment summary
    that consumes existing JSON-safe reports without changing rendering.
- Added and audited `createStandardMaterialTextureSamplerAlignmentSummary()`:
  - It pairs texture readiness and sampler fidelity report JSON.
  - Tests verify deterministic field ordering and omission of texture/sampler
    handles and GPU strings.
- Added boundary audits for the helper app integration, sampler summary, sampler
  example usage, option helper, dependency helper, final composition plan, and
  helper-composition regression, plus the prepared/lifetime example summaries.
- Updated `docs/index.html`, `docs/render-pipeline-comparison.html`,
  `agent/BACKLOG.md`, and `agent/COMPLETED.md` with the latest completed work
  and next ready tasks.

Validation:

- `pnpm exec vitest run test/rendering/render-world-prepared-resource-summary.test.ts test/materials/standard-sampler-fidelity.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/prepared-resource-lifetime-alignment-summary.test.ts`
- `pnpm exec vitest run test/webgpu/standard-material-sampler-fidelity-summary.test.ts`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "reuses unlit, standard, and matcap app resource cache slots|standardFrameResources.missingLights|routes scalar and textured StandardMaterial queue items"`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `node --check examples/app-diagnostics.js`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec vitest run test/materials/standard-texture-sampler-alignment.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:examples`

- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, examples syntax, lint, format check, and 245
  Vitest files / 1149 tests.

Reference files/patterns inspected:

- Aperture anchors:
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
  `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`,
  `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
  `packages/render/src/rendering/render-world-prepared-resources.ts`,
  `packages/render/src/materials/standard-sampler-fidelity.ts`,
  `examples/app-diagnostics.js`, and `test/webgpu/webgpu-app.test.ts`.
- Bevy anchors:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`, and
  `references/bevy/crates/bevy_pbr/src/material_bind_groups.rs`.

Known issues / follow-ups:

- No known validation failures so far.
- Next task: `task-1046` plan frame-resource route summary diagnostics
  consumer.
- Keep prepared/lifetime/texture/sampler summaries opt-in and outside default
  successful app-frame reports unless a future decision records a new app report
  surface.

## Previous Run Update

Completed `task-1002` through `task-1015`. Recommended next task is
`task-1016`.

Completed task ids:

- `task-1002` through `task-1015`

Highlights:

- Planned, implemented, and audited render-world prepared resource summary
  alignment:
  - Added `createRenderWorldPreparedResourceSummary()` in
    `packages/render/src/rendering/render-world-prepared-resource-summary.ts`.
  - The helper reports compact prepared mesh/material facade counts,
    render-world binding counts, draw-readiness counts, and diagnostic severity
    totals without backend cache state or GPU handles.
- Planned, implemented, documented, and audited StandardMaterial sampler
  fidelity diagnostics:
  - Added `createStandardMaterialSamplerFidelityReport()` in
    `packages/render/src/materials/standard-sampler-fidelity.ts`.
  - It warns for mip filtering on single-mip textures, `lodMaxClamp` values
    outside the texture mip range, and authored anisotropy that is not yet
    reflected in StandardMaterial readiness diagnostics.
- Planned, implemented, and audited the next generic material-family preparation
  handoff slice:
  - Added `createQueuedBuiltInFrameResourceViaAdapter()` in
    `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`.
  - The helper creates frame resources through the generic built-in adapter,
    appends valid resources into family buckets, and returns a compact report
    shell without raw resources.
- Planned, implemented, documented, and audited prepared resource lifetime
  alignment summaries:
  - Added `createPreparedResourceLifetimeAlignmentSummary()` in
    `packages/webgpu/src/webgpu/prepared-resource-lifetime-alignment-summary.ts`.
  - The helper compares prepared facade counts with backend resource summary
    stale/missing/pending-destroy counts without merging ownership.
- Updated `docs/DIAGNOSTICS_SUMMARIES.md`, `docs/index.html`, and
  `docs/render-pipeline-comparison.html` for the new helpers and current next
  task.
- Refilled the ready backlog with `task-1016` through `task-1020`.

Validation:

- `pnpm exec vitest run test/rendering/render-world-prepared-resource-summary.test.ts test/materials/standard-sampler-fidelity.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/prepared-resource-lifetime-alignment-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:progress`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, examples syntax, lint, format check, and 244
  Vitest files / 1147 tests.

Reference files/patterns inspected:

- Aperture anchors:
  `packages/render/src/rendering/render-world-prepared-resources.ts`,
  `packages/render/src/rendering/render-world-prepared-meshes.ts`,
  `packages/render/src/rendering/render-world-prepared-materials.ts`,
  `packages/render/src/assets/preparation.ts`,
  `packages/render/src/materials/gltf-sampler.ts`,
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/rendering/material-queue.ts`,
  `packages/webgpu/src/webgpu/resource-summary.ts`,
  `packages/webgpu/src/webgpu/resource-lifecycle.ts`,
  `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
  `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`.
- Bevy anchors:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`,
  `references/bevy/crates/bevy_render/src/render_resource/bind_group.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_pbr/src/material_bind_groups.rs`, and
  `references/bevy/crates/bevy_pbr/src/render/mesh.rs`.
- three.js/PlayCanvas sampler anchors:
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`,
  `references/three.js/src/textures/Texture.js`,
  `references/three.js/src/renderers/webgl/WebGLTextures.js`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/platform/graphics/texture.js`, and
  `references/engine/src/scene/shader-lib/programs/standard.js`.

Known issues / follow-ups:

- No known validation failures.
- Next task: `task-1016` plan generic built-in frame-resource helper app
  integration.
- The new lifetime alignment helper intentionally accepts a compact structural
  facade summary shape so WebGPU typechecking is not coupled to fresh render
  package declarations.

## Previous Run Update

Completed `task-0969`, `task-0970`, `task-0973`, and `task-0982` through
`task-1001`. Recommended next task is `task-1002`.

Completed task ids:

- `task-0969`
- `task-0970`
- `task-0973`
- `task-0982` through `task-1001`

Highlights:

- Planned and audited the StandardMaterial texture fidelity diagnostics slice in
  `docs/research/STANDARD_MATERIAL_TEXTURE_FIDELITY_DIAGNOSTICS_PLAN_2026_05_17.md`
  and
  `docs/research/STANDARD_MATERIAL_TEXTURE_FIDELITY_PLAN_BOUNDARY_AUDIT_2026_05_17.md`.
- Added `createStandardMaterialTextureFidelitySummary()` in
  `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
  and exported it from the WebGPU package.
- Added tests proving the summary counts ready fields plus sampler,
  color-space, semantic, UV, and transform issues without leaking material,
  texture, sampler, or GPU handles.
- Added `scripts/check-progress-tracker.mjs`, `pnpm run check:progress`, and
  wired it into `pnpm run check`. The check verifies local tracker freshness and
  six render-pipeline phase-status entries without network access or exact
  percentage coupling.
- Documented the public tracker workflow in `README.md`, `AGENTS.md`, and
  `docs/index.html`.
- Planned and audited the generic frame-resource success-path migration in
  `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_MIGRATION_PLAN_2026_05_17.md`
  and
  `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_PLAN_BOUNDARY_AUDIT_2026_05_17.md`.
- Added a successful mixed-family app regression proving valid frames continue
  to omit `webGpuApp.frameResourceRoute` diagnostics by default, then audited
  that test-only slice in
  `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_OMISSION_REGRESSION_AUDIT_2026_05_17.md`.
- Extracted frame-resource route shell creation into
  `createQueuedBuiltInFrameResourceRouteShell()` inside `app.ts`, preserving the
  existing failure diagnostic and successful-report behavior.
- Audited that internal wrapper in
  `docs/research/INTERNAL_FRAME_RESOURCE_ROUTE_SHELL_BOUNDARY_AUDIT_2026_05_17.md`.
- Documented `createStandardMaterialTextureFidelitySummary()` in
  `docs/DIAGNOSTICS_SUMMARIES.md`, planned to keep app exposure manual/opt-in
  in
  `docs/research/OPTIONAL_TEXTURE_FIDELITY_APP_DIAGNOSTICS_PLAN_2026_05_17.md`,
  and audited the docs boundary in
  `docs/research/TEXTURE_FIDELITY_SUMMARY_DOCS_BOUNDARY_AUDIT_2026_05_17.md`.
- Audited the tracker validation workflow in
  `docs/research/PROGRESS_TRACKER_VALIDATION_WORKFLOW_AUDIT_2026_05_17.md`.
- Planned and added a generic frame-resource adapter result/context contract in
  `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, with
  test coverage in `test/webgpu/built-in-material-app-resource-adapter.test.ts`.
- Planned and added example-only StandardMaterial texture fidelity summary usage
  in `examples/app-diagnostics.js`; Playwright now verifies the summary counts
  sampler, color-space, semantic, UV, and transform issues without exposing
  handles.
- Audited that example boundary in
  `docs/research/STANDARD_TEXTURE_FIDELITY_EXAMPLE_USAGE_BOUNDARY_AUDIT_2026_05_17.md`.
- Updated `docs/index.html` and `docs/render-pipeline-comparison.html` to
  reflect the new diagnostics helper, tracker validation, route-shell wrapper,
  frame-resource contract, example coverage, docs/audits, and next task.
- Refilled the ready backlog with `task-1002` through `task-1006`.

Validation:

- `pnpm exec vitest run test/webgpu/standard-material-texture-fidelity-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm run check:progress`
- `node --check scripts/check-progress-tracker.mjs`
- `pnpm exec prettier --check README.md docs/index.html scripts/check-progress-tracker.mjs package.json AGENTS.md test/webgpu/standard-material-texture-fidelity-summary.test.ts packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "frameResourceRoute|routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm run check` passed: package boundaries, progress tracker validation,
  build/typecheck, test typecheck, examples syntax, lint, format check, and 241
  Vitest files / 1138 tests.
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm run check:examples`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`

Reference files/patterns inspected:

- PlayCanvas/engine anchors:
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/platform/graphics/texture.js`, and
  `references/engine/src/scene/shader-lib/programs/standard.js`.
- three.js anchors:
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`,
  `references/three.js/src/materials/MeshStandardMaterial.js`,
  `references/three.js/src/textures/Texture.js`, and
  `references/three.js/src/renderers/webgl/WebGLTextures.js`.
- Bevy/render anchors:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- Aperture local anchors:
  `packages/render/src/materials/standard-texture-readiness.ts`,
  `packages/render/src/materials/gltf-sampler.ts`,
  `packages/render/src/rendering/extraction.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`, and
  `packages/webgpu/src/webgpu/standard-shader.ts`.

Known issues / follow-ups:

- No known validation failures.
- Next task: `task-1002` plan render-world prepared resource summary alignment.

## Previous Run Update

Completed `task-0961` through `task-0981`, converted the local render pipeline
comparison into a public GitHub Pages-ready project tracker, and verified the
public root URL no longer returns 404 after push.

Completed task ids:

- `task-0961` through `task-0968`.
- `task-0971` through `task-0972`.
- `task-0974` through `task-0981`.

Highlights:

- Added StandardMaterial `TEXCOORD_1` per-field coverage for base color,
  metallic-roughness, normal, occlusion, and emissive texture readiness.
- Added WebGPU StandardMaterial pipeline/shader coverage proving every rendered
  texture field can select the `uv1` variant and matching vertex layout.
- Added `createStandardMaterialRenderStateSummary()` in
  `packages/webgpu/src/webgpu/standard-render-state-summary.ts` with JSON-safe
  source render-state, flags, pipeline-token, resolved-state, validation, and
  mismatch diagnostics.
- Planned and audited the UV1 and alpha/cull diagnostics boundaries. The helper
  is inspection-only: it does not mutate source material assets, own renderer
  state, expose raw GPU handles, prepare resources, or change queue/pipeline
  behavior.
- Added `docs/index.html` as a static project dashboard for GitHub Pages,
  covering overall progress, current/next tasks, recent completed groups, and
  render-pipeline phase status.
- Updated `docs/render-pipeline-comparison.html` with an upfront status band for
  all six render phases, rough completion estimates, and concrete missing
  pieces.
- Planned the generic material-family queue-to-prepare handoff in
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_PREPARE_HANDOFF_PLAN_2026_05_17.md`.
  The plan established the route-contract slice that landed in `task-0967`
  before any app resource preparation rewiring.
- Added/exported `queued-material-prepare-route.ts`, which defines the generic
  queued material prepare route context/result/adapter contract and
  `routeQueuedMaterialPrepare()`. The helper returns only JSON-safe strings,
  versions, frame numbers, and diagnostics; it does not expose GPU handles or
  move app resource preparation yet.
- Extended built-in queue route adapters with the generic route contract while
  preserving the existing `isMaterialAsset()` and phase/blend validation
  behavior.
- Audited the generic route contract boundary in
  `docs/research/GENERIC_MATERIAL_ROUTE_CONTRACT_BOUNDARY_AUDIT_2026_05_17.md`.
  The audit found no ECS/source ownership drift, no raw GPU handle exposure, and
  no overlap with retained backend cache summaries.
- Wired WebGPU app route reporting through `routeQueuedMaterialPrepare()` before
  built-in family resource preparation. Existing app-facing unsupported-family,
  material-mismatch, phase, and blend diagnostics remain JSON-safe and retain
  their existing codes.
- Preserved the distinction between facade queue resource keys and
  source-version backend preparation keys after a targeted app regression caught
  the risk; successful frame output and reuse counts remain unchanged.
- Audited the app route reporting boundary in
  `docs/research/GENERIC_APP_ROUTE_REPORTING_BOUNDARY_AUDIT_2026_05_17.md`.
  The audit records the facade-key/backend-key split and confirms route
  diagnostics remain separate from retained cache summaries.
- Planned the next generic app frame-resource adapter migration in
  `docs/research/GENERIC_APP_FRAME_RESOURCE_ADAPTER_MIGRATION_PLAN_2026_05_17.md`.
  The plan keeps current family helpers intact and scopes the next slice to a
  shell that preserves source-version backend keys.
- Added/exported `queued-material-frame-resource-route.ts`, a JSON-safe shell
  that records facade queue keys, backend source-version keys, pipeline key,
  frame/version, status, and diagnostics without copying the actual GPU resource
  result.
- Audited the frame-resource route shell boundary in
  `docs/research/GENERIC_FRAME_RESOURCE_ROUTE_SHELL_BOUNDARY_AUDIT_2026_05_17.md`.
  The audit confirms the shell is reporting-only, keeps key families distinct,
  and does not touch retained cache summaries.
- Planned app integration for the frame-resource route shell in
  `docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_INTEGRATION_PLAN_2026_05_17.md`.
  The plan scopes the first wiring to failure diagnostics after
  `adapter.createFrameResources()`, preserving successful frame output.
- Wired failure diagnostics for frame-resource route shells into
  `prepareQueuedBuiltInFrameResources()`. Failed frame resource preparation now
  emits `webGpuApp.frameResourceRoute` with facade keys, backend keys,
  pipeline/frame/version, status, and diagnostics, without raw GPU handles.
- Audited the frame-resource route shell app diagnostics boundary in
  `docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`.
  The audit confirms the diagnostic is failure-only and does not change
  successful frame output or retained cache reports.
- Planned successful-frame route shell reporting policy in
  `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_REPORTING_POLICY_PLAN_2026_05_17.md`.
  The policy keeps successful-frame shells omitted for now to preserve report
  shape and valid-frame allocation discipline.
- Audited the successful-frame route shell policy in
  `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_POLICY_BOUNDARY_AUDIT_2026_05_17.md`.
  The audit confirms the policy avoids hidden valid-frame diagnostic allocation
  and keeps retained cache summaries separate.
- Updated `AGENTS.md` and `agent/WAKE.md` so future project-status updates touch
  `docs/index.html`, and render-pipeline work also updates
  `docs/render-pipeline-comparison.html`.
- Enabled GitHub Pages for `main` `/docs`. The public URL is
  `https://felixtrz.github.io/aperture/`; it returned 404 before this run's
  files were pushed because `docs/index.html` was still local. A cache-busted
  request for the pushed commit returned HTTP 200.
- Updated `docs/index.html` and `docs/render-pipeline-comparison.html` again
  after `task-0981` so the public tracker now lists `task-0969` as the
  recommended next step and records the queue phase at roughly 68% complete.
- Refilled the ready backlog with `task-0966` through `task-0970`; recommended
  next task is `task-0966`.

Validation:

- Targeted Vitest passed for StandardMaterial UV1 readiness/pipeline coverage
  and render-state summaries.
- Targeted Vitest passed for queued material prepare routes and existing
  built-in route/app-resource adapter behavior.
- Targeted WebGPU app route tests passed for successful mixed-family routing,
  unsupported families, unsupported alpha-test/transparent routes, asset
  mismatch route reports, route shell reset, Standard alpha-test, and Standard
  transparent alpha-blend paths.
- Targeted frame-resource route shell tests passed for source-version backend
  key preservation and no raw handle leakage in JSON output.
- Targeted app diagnostics tests passed for the failure-only
  `webGpuApp.frameResourceRoute` diagnostic and unchanged successful route
  behavior.
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json` passed.
- Browser smoke checks passed for `http://127.0.0.1:4173/index.html` and
  `http://127.0.0.1:4173/render-pipeline-comparison.html`.
- `pnpm run check` passed: package boundaries, build/typecheck, test typecheck,
  examples syntax, lint, format check, and 238 Vitest files / 1128 tests.

Reference files/patterns inspected:

- WebGPU/render anchors:
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/scene/shader-lib/programs/standard.js`,
  `references/three.js/src/textures/Texture.js`, and
  `references/three.js/src/renderers/webgl/WebGLProgram.js`.
- Aperture docs and local boundaries:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `docs/research/STANDARD_MATERIAL_UV_COORDINATE_SUPPORT_BOUNDARY_AUDIT_2026_05_17.md`,
  `docs/research/STANDARD_MATERIAL_ALPHA_CULL_DIAGNOSTICS_PLAN_2026_05_17.md`,
  `packages/webgpu/src/webgpu/material-render-state.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`, and
  `packages/webgpu/src/webgpu/standard-material-buffer.ts`.
- Generic material handoff anchors:
  `packages/webgpu/src/webgpu/queued-material-adapter.ts`,
  `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
  `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`,
  `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
  `packages/render/src/rendering/material-queue.ts`,
  `references/bevy/crates/bevy_pbr/src/material.rs`, and
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.

Known issues / follow-ups:

- The public Pages site is configured from `main` `/docs`; if
  `https://felixtrz.github.io/aperture/` appears stale immediately after a push,
  wait for the Pages rebuild/cache or check the Pages build status in GitHub.
- `docs/render-pipeline-comparison.html` remains intentionally listed in
  `.prettierignore`; update it manually when render-pipeline state changes.
- Next task: `task-0969` plan StandardMaterial texture fidelity diagnostics
  slice.

## Previous Run Update

Completed the diagnostics summary and StandardMaterial UV audit run from
`task-0924` through `task-0960`.

Completed task ids:

- `task-0924` through `task-0960`.

Highlights:

- Added `createMaterialQueuePhaseSummary()` in
  `packages/render/src/rendering/material-queue.ts` with tests for empty,
  mixed phase/family, and JSON-safe summaries.
- Added `RenderWorldDrawPackageScratchSummary` to draw package planning with
  package-pool reuse counts, missing packed transform counts, and diagnostic
  code totals.
- Added reusable queued route collector arrays for the WebGPU app material
  queue route path.
- Added `createRenderFrameQueueDiagnosticsSummary()`,
  `createQueuedBuiltInResourceSetSummary()`,
  `createWebGpuAppDiagnosticsSummary()`, and
  `createMaterialDependencyDiagnosticsSummary()` with focused tests.
- Updated `examples/app-diagnostics.js` to publish an aggregate
  `dependencySummary` for failure scenarios and expanded
  `test/e2e/app-diagnostics.spec.ts` to verify it in browser status output.
- Added `docs/DIAGNOSTICS_SUMMARIES.md`, README wording for aggregate
  dependency summaries, and plans/audits for each new diagnostics surface.
- Planned and audited StandardMaterial UV coordinate support; current behavior
  supports `TEXCOORD_0`/`TEXCOORD_1`, diagnoses `TEXCOORD_2+`, and needs
  focused per-field `uv1` test coverage.
- Refilled the ready backlog with `task-0961` through `task-0965`; recommended
  next task is `task-0961`.

Validation:

- Targeted Vitest runs passed for material queue, draw packages/frame readiness,
  reusable route collector, render-frame plan summaries, queued resource-set
  summaries, app diagnostics summaries, and material dependency diagnostics
  summaries.
- Targeted Playwright passed:
  `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`.
- `pnpm run check` passed: package boundaries, build/typecheck, test typecheck,
  examples syntax, lint, format check, and 237 Vitest files / 1121 tests.

Reference files/patterns inspected:

- Bevy anchors:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs` and
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- WebGPU/render diagnostics anchors:
  `references/three.js/src/renderers/webgl/WebGLInfo.js` and
  `references/engine/src/extras/mini-stats/mini-stats.js`.
- Aperture docs and local boundaries:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `packages/webgpu/src/webgpu/app.ts`, and app report JSON tests.

Known issues / follow-ups:

- No known validation failures.
- New diagnostics summary helpers are intentionally inspection helpers. Do not
  wire the allocating helpers into every successful frame without adding
  scratch/stable result shells.
- Next task: `task-0961` add StandardMaterial UV1 per-field coverage.

## Previous Run Update

Completed `task-0886` through `task-0900` in this automation run. This moved
prepared mesh metadata through the render facade/render-world/app-report path
and added WebGPU-private prepared mesh backend cache reporting while preserving
the facade/backend ownership split.

Completed task ids:

- `task-0886` through `task-0900`.

Highlights:

- Added backend prepared material cache `lastUsedFrame` boundary audit and
  stale-cache regressions for unlit, Matcap, Standard, and app facade behavior.
- Added renderer-independent `PreparedMeshStore` facade metadata and JSON-safe
  summaries in `@aperture-engine/render`.
- Routed queued built-in app mesh resource keys through prepared mesh facade
  descriptors while keeping source-version mesh keys for WebGPU backend buffer
  preparation.
- Added snapshot mesh preparation/pruning and render-world prepared mesh
  binding helpers. `RenderWorld` receives logical string mesh keys only and
  clears stale keys on missing prepared mesh entries.
- Added app regressions proving snapshot-pruned prepared mesh/material facades
  can shrink while backend prepared material and prepared mesh caches remain
  retained.
- Added `PreparedMeshGpuResourceCacheSummary` plus `preparedMeshCache` in app
  `resourceReuse`, separate from `preparedMeshFacade`, material cache counts,
  texture/sampler counters, light counters, and pipeline counters.
- Added plans/audits for generic prepared-resource report shape and prepared
  mesh backend cache summary boundaries.
- Refilled the ready backlog with `task-0901` through `task-0905`; recommended
  next task is `task-0901`.

Validation:

- Focused Vitest runs for prepared material caches, render asset preparation,
  material queue/snapshot preparation, render-world prepared mesh/material
  binding, prepared mesh cache, and WebGPU app regressions.
- Focused typechecks: `packages/render`, `packages/webgpu`, and
  `tsconfig.test.json`.
- `pnpm --filter @aperture-engine/render build`.
- Final `pnpm run check` passed: package boundaries, build/typecheck, test
  typecheck, examples syntax, lint, format check, and 231 Vitest files / 1094
  tests.

Reference files/patterns inspected:

- Aperture docs: `docs/NORTH_STAR.md`, `docs/ROADMAP.md`,
  `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`.
- Bevy mesh/render asset anchors:
  `references/bevy/crates/bevy_render/src/erased_render_asset.rs`,
  `references/bevy/crates/bevy_render/src/mesh/mod.rs`, and
  `references/bevy/crates/bevy_render/src/mesh/allocator.rs`.
- WebGPU-render anchors:
  `references/engine/src/scene/materials/material.js`,
  `references/three.js/src/renderers/webgl/WebGLPrograms.js`, and
  `references/three.js/src/renderers/WebGLRenderer.js`.

Known issues / follow-ups:

- `.mcp.json` and `docs/render-pipeline-comparison.html` remain unrelated,
  ignored local files from prior user direction.
- A transient `packages/webgpu` typecheck failure occurred mid-run because
  `@aperture-engine/render` declarations were stale after adding render exports;
  running `pnpm --filter @aperture-engine/render build` fixed it and all later
  typechecks passed.
- Next task: `task-0901` plan the combined render-world prepared resource
  binding helper.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/APP_PREPARED_FACADE_REPORT_SHAPE_AUDIT_2026_05_17.md`
- `docs/research/BACKEND_PREPARED_MATERIAL_LAST_USED_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GENERIC_QUEUED_PREPARED_RESOURCE_REPORT_PLAN_2026_05_17.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_SUMMARY_PLAN_2026_05_17.md`
- `docs/research/PREPARED_MESH_FACADE_QUEUE_KEY_HANDOFF_AUDIT_2026_05_17.md`
- `docs/research/RENDER_WORLD_PREPARED_MESH_BINDING_AUDIT_2026_05_17.md`
- `docs/research/RENDER_WORLD_PREPARED_MESH_BINDING_PLAN_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/index.ts`
- `packages/render/src/rendering/prepared-mesh-queue-resolver.ts`
- `packages/render/src/rendering/render-world-prepared-meshes.ts`
- `packages/render/src/rendering/snapshot-prepared-meshes.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `test/assets/render-asset-preparation.test.ts`
- `test/rendering/material-queue.test.ts`
- `test/rendering/render-world-prepared-meshes.test.ts`
- `test/rendering/snapshot-prepared-materials.test.ts`
- `test/webgpu/prepared-matcap-material-cache.test.ts`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/prepared-unlit-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the prepared material facade and backend cache handoff run after the
user explicitly instructed the automation to ignore `.mcp.json` and unrelated
working-tree files.

Completed task ids:

- `task-0863` through `task-0885`.

Highlights:

- Added renderer-independent prepared material facade reporting, snapshot
  preparation, render-world binding, queue resource key resolution, and combined
  prepare/apply/bind helpers.
- Routed the first WebGPU app material queue pass through prepared material
  facade keys while keeping WebGPU buffers, bind groups, textures, samplers,
  pipelines, and light resources backend-owned.
- Added snapshot-scoped prepared material facade pruning and app regressions
  proving facade summaries drop hidden/unreferenced materials while backend
  prepared material cache counts remain retained.
- Added WebGPU-private `lastUsedFrame` metadata to prepared material backend
  cache entries plus an internal eviction report/helper that removes stale
  backend cache map entries by family.
- Added plans/audits for WebGPU facade summaries, queue-key handoff, stale
  facade cleanup, backend cache eviction, and prepared mesh facade queue-key
  handoff.
- Refilled the ready backlog with `task-0886` through `task-0890`; recommended
  next task is `task-0886`.

Validation:

- `pnpm exec vitest run test/webgpu/prepared-built-in-material-store.test.ts test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/prepared-matcap-material-cache.test.ts test/webgpu/prepared-standard-material-cache.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/prepared-matcap-material-cache.test.ts test/webgpu/prepared-standard-material-cache.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/snapshot-prepared-materials.test.ts test/webgpu/webgpu-app.test.ts test/rendering/material-queue.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed, including 230 test files / 1082 tests.
- `pnpm test` passed separately before the final broad check: 230 files / 1082
  tests.
- `pnpm exec prettier --check ...` passed for all files touched by this run.

Reference files/patterns inspected:

- Aperture docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, prior prepared material plans/audits.
- Bevy: `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`, and mesh queue lookup
  patterns.
- WebGPU-render anchors: PlayCanvas bind-group/WebGPU bind-group management and
  three.js common bindings/render object cache patterns.

Known issues / follow-ups:

- `.mcp.json` and `docs/render-pipeline-comparison.html` remain unrelated,
  untracked, locally ignored for stop-hook staging, and listed in
  `.prettierignore` per the user's instruction to ignore unrelated files.
- Next task: `task-0886` audit backend cache `lastUsedFrame` metadata boundary.

## Previous Run Update

Stopped during the required safety check before implementation.

Reason:

- `agent/STATUS.json` is idle and does not indicate an active run.
- `git status --short` reported an unexpected untracked repository file:
  `.mcp.json`.
- Per `agent/STOP_CONDITIONS.md` and the wake prompt safety check, unexpected
  uncommitted changes require updating this handoff and stopping before
  selecting or implementing a task.

No backlog task was started. The recommended next task remains `task-0867` once
the working tree is made safe by deciding whether `.mcp.json` should be kept,
ignored, committed, or removed.

Validation:

- Safety/readiness checks only: required docs were read, `agent/STATUS.json`
  was inspected, and `git status --short` was checked.
- No build, tests, or lint were run because implementation did not begin.
- `scripts/codex-stop-hook.sh` was run at 2026-05-17T15:03:00Z and returned
  a continuation block: current minute was 03 and the hook requested continuing
  until minute 55. This was not actionable because continuing would violate the
  earlier unexpected-change safety stop.

Known issues / follow-ups:

- Resolve the untracked `.mcp.json` before the next autonomous implementation
  run.
- After the tree is safe, continue with `task-0867`.

## Latest Run Update

Completed `task-0845`, `task-0847` through `task-0862` in this automation run.
This moved built-in material preparation behind the internal adapter table,
added JSON-safe prepared material cache summaries and fallback diagnostics,
consolidated built-in prepared material caches into one WebGPU-private store,
audited the new boundaries, expanded app-level summary/fallback coverage, added
a render-package prepared material store facade, and planned the next
render-world/material dependency handoffs.

Highlights:

- Added a queued built-in material family adapter table and routed the
  single-material app frame-resource path through adapter callbacks instead of
  direct unlit/Matcap/Standard branching.
- Added prepared material cache summary helpers and surfaced their JSON-safe
  counts in WebGPU app resource reuse reports.
- Added
  `docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`
  to define the smallest next handoff from app-local caches toward
  render-world/prepared-asset ownership.
- Added
  `docs/research/POST_ADAPTER_BUILT_IN_MATERIAL_PREPARATION_ROUTE_AUDIT_2026_05_17.md`;
  no source-asset, render-snapshot, texture/sampler, Standard light, app report,
  or package-boundary drift was found.
- Added sanitized prepared-material fallback diagnostics for unexpected helper
  failures while expected skipped routes remain silent.
- Added `prepared-built-in-material-store.ts` so the app resource cache owns one
  WebGPU-private store with unlit, Matcap, and Standard prepared material
  buckets.
- Added
  `docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md`
  and
  `docs/research/STORE_AWARE_BUILT_IN_MATERIAL_ADAPTER_CONTEXT_AUDIT_2026_05_17.md`;
  neither audit found ownership or public API drift.
- Updated adapter frame preparation options to receive an explicit
  `preparedMaterials` store context while hiding that field from the callback
  cache view.
- Added app regressions for prepared material cache summary counts across source
  material, texture, and sampler source-version changes.
- Expanded prepared-material fallback diagnostics tests to cover Matcap and
  Standard missing-layout and missing-prepared-dependency cases.
- Added
  `docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`
  and
  `docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`
  for the next render-bridge and dependency-boundary slices.
- Added `PreparedMaterialStore` in `@aperture-engine/render`, backed by
  `PreparedRenderAssetStore`, with tests for prepare/update/remove/clear and
  render-world string material resource binding.
- Added
  `docs/research/RENDER_PREPARED_MATERIAL_STORE_FACADE_BOUNDARY_AUDIT_2026_05_17.md`
  and
  `docs/research/RENDER_WORLD_PREPARED_MATERIAL_BINDING_INTEGRATION_PLAN_2026_05_17.md`
  to audit the facade and define the next render-world binding helper.
- Refilled the ready backlog with `task-0867`, `task-0863` through
  `task-0866`; next recommended task is `task-0867`.

Validation:

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-app-material-resource.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-app-material-resource.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-built-in-material-store.test.ts test/webgpu/prepared-app-material-resource.test.ts test/webgpu/unlit-app-frame-resources.test.ts test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/prepared-built-in-material-store.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/unlit-app-frame-resources.test.ts`
- `pnpm exec vitest run test/webgpu/prepared-built-in-material-store.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec vitest run test/assets/render-asset-preparation.test.ts`
- Final `pnpm run check` passed, including 228 Vitest files / 1070 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/RENDER_ASSET_PREPARATION.md`,
  `docs/research/GENERIC_MATERIAL_FAMILY_PREPARATION_HANDOFF_PLAN_2026_05_17.md`,
  `docs/research/GENERIC_BUILT_IN_MATERIAL_PREPARATION_BOUNDARY_AUDIT_2026_05_17.md`,
  `docs/research/BUILT_IN_PREPARED_MATERIAL_FALLBACK_DIAGNOSTICS_PLAN_2026_05_17.md`,
  render-world prepared material store plans/audits, built-in material app
  resource adapter code, app frame-resource helpers, prepared material caches,
  texture/sampler resource preparation, render asset preparation contracts,
  render-world resource bindings, and WebGPU app reuse tests.
- WebGPU-render anchors: PlayCanvas/engine material variant/cache and stats
  patterns plus three.js binding preparation and render info counters.
- Bevy anchors: render asset preparation, material preparation/specialization,
  mesh material queue concepts, and `RenderAssets`-style prepared-resource
  storage.

Known issues / follow-ups:

- The multi-unlit app route still has a narrow pre-existing special path; keep
  it scoped while moving more preparation context behind family adapters.
- Standard group-3 light resources, source assets, render snapshots, and
  texture/sampler GPU resources remain outside prepared material store
  ownership.
- `task-0867` should implement the render-world helper that binds prepared
  material facade keys into `RenderWorld` string resource bindings.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/POST_ADAPTER_BUILT_IN_MATERIAL_PREPARATION_ROUTE_AUDIT_2026_05_17.md`
- `docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`
- `docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`
- `docs/research/RENDER_PREPARED_MATERIAL_STORE_FACADE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/RENDER_WORLD_PREPARED_MATERIAL_BINDING_INTEGRATION_PLAN_2026_05_17.md`
- `docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/STORE_AWARE_BUILT_IN_MATERIAL_ADAPTER_CONTEXT_AUDIT_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `test/assets/render-asset-preparation.test.ts`
- `test/webgpu/prepared-app-material-resource.test.ts`
- `test/webgpu/prepared-built-in-material-store.test.ts`
- `test/webgpu/unlit-app-frame-resources.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0815` through `task-0829` in this automation run. This moved
the StandardMaterial path from prepared mesh consumption through scalar prepared
material app-route reuse and into base-color textured Standard prepared material
app-route reuse.

Highlights:

- Added
  `docs/research/PREPARED_ROUTE_COUNTER_BOUNDARY_AUDIT_2026_05_17.md`; the
  audit found no ownership drift in prepared app-route counters.
- Wired prepared mesh resources into the StandardMaterial app route and
  extracted `prepared-app-mesh-resource.ts` so unlit, Matcap, and Standard share
  source-version prepared mesh lookup behavior.
- Added
  `docs/research/STANDARD_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
  and implemented `prepared-standard-material-cache.ts` for scalar Standard
  group-2 material buffer/bind-group reuse.
- Routed scalar Standard app frame-resource misses through the prepared
  Standard material cache, including JSON-safe reuse counters and app tests for
  source material version invalidation plus transform/light-only cache hits.
- Added
  `docs/research/SCALAR_STANDARD_PREPARED_APP_ROUTE_BOUNDARY_AUDIT_2026_05_17.md`;
  Standard textures and group-3 light resources remain outside the scalar
  prepared cache.
- Added
  `docs/research/STANDARD_TEXTURED_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
  and the first base-color Standard texture/sampler dependency key helper with
  direct tests.
- Extended Standard texture dependency key derivation to base-color,
  metallic-roughness, normal, occlusion, and emissive texture families.
- Added direct base-color textured Standard prepared material resources, wired
  them into the app route, and added app regressions for frame-resource misses
  plus base-color texture/sampler source-version invalidation.
- Added
  `docs/research/TEXTURED_STANDARD_BASE_COLOR_PREPARED_BOUNDARY_AUDIT_2026_05_17.md`;
  no texture/sampler ownership or group-3 light-resource drift was found.
- Refilled the ready backlog with `task-0830` through `task-0834`; next
  recommended task is `task-0830`.

Validation:

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/prepared-standard-material-cache.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed, including 224 Vitest files / 1040 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/RENDER_ASSET_PREPARATION.md`, prepared mesh and
  material cache helpers, Standard frame-resource helpers, app texture/sampler
  resources, Standard material buffer/bind-group helpers, and WebGPU app reuse
  tests.
- Reference anchors required for WebGPU work: PlayCanvas/engine vertex/index
  buffer and WebGPU buffer lifetime patterns, plus three.js WebGPU attribute
  buffer creation/layout and draw-time vertex-buffer binding patterns.

Known issues / follow-ups:

- Metallic-roughness Standard prepared material resources are not app-routed
  yet. `task-0830` should add direct metallic-roughness prepared resources
  before app-route integration in `task-0831`.
- Normal, occlusion, and emissive prepared-resource work still needs a scoped
  plan after the metallic-roughness route lands.
- Group-3 light resources should remain frame-derived and outside material cache
  keys.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/PREPARED_ROUTE_COUNTER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/SCALAR_STANDARD_PREPARED_APP_ROUTE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
- `docs/research/STANDARD_TEXTURED_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/TEXTURED_STANDARD_BASE_COLOR_PREPARED_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `test/webgpu/prepared-standard-material-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0810` through `task-0814` in this automation run. This moved
prepared mesh/material cache groundwork into app-route usage for scalar unlit,
textured unlit, and Matcap paths.

Highlights:

- Wired WebGPU-private prepared mesh resources into scalar unlit app
  frame-resource misses.
- Added
  `docs/research/TEXTURED_UNLIT_AND_MESH_CACHE_BOUNDARY_AUDIT_2026_05_17.md`;
  the audit found no source-asset ownership or raw GPU handle leakage.
- Routed textured unlit group-2 material buffer/bind-group resources through the
  prepared unlit material cache when texture and sampler dependencies are ready.
- Added JSON-safe prepared mesh/material and prepared material bind-group reuse
  counters to `WebGpuAppResourceReuseReport`.
- Added app regressions for frame-resource misses, source mesh/material version
  invalidation, texture/sampler version invalidation, and Matcap prepared mesh
  reuse.
- Extended prepared mesh cache consumption to the Matcap app route.
- Refilled the ready backlog with `task-0815` through `task-0819`; next
  recommended task is `task-0815`.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/prepared-unlit-material-cache.test.ts test/webgpu/prepared-mesh-cache.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/RENDER_ASSET_PREPARATION.md`,
  `docs/research/PREPARED_MESH_CACHE_HANDOFF_PLAN_2026_05_17.md`,
  `docs/research/TEXTURED_UNLIT_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`,
  current WebGPU app frame-resource helpers, prepared mesh cache, prepared unlit
  cache, texture/sampler resources, and mesh buffer resources.
- Reference anchors required for WebGPU work: PlayCanvas/engine vertex/index
  buffer and WebGPU buffer lifetime patterns, plus three.js WebGPU attribute
  buffer creation/layout and draw-time vertex-buffer binding patterns.

Known issues / follow-ups:

- StandardMaterial still creates mesh buffers inside its app frame-resource
  helper. `task-0816` should wire prepared mesh resources into the Standard app
  route next.
- Prepared mesh helper logic is duplicated between unlit and Matcap helpers for
  now. `task-0817` should extract one shared WebGPU-private helper after
  Standard is wired.
- StandardMaterial prepared material caching is not implemented yet.
  `task-0818` and `task-0819` cover the plan and first scalar helper.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/TEXTURED_UNLIT_AND_MESH_CACHE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0796` through `task-0809` in this automation run. This moved
the WebGPU resource path from app-local material/frame-resource cleanup into
direct prepared material and prepared mesh cache groundwork.

Highlights:

- Added
  `docs/research/APP_LOCAL_MATERIAL_RESOURCE_RENDER_WORLD_AUDIT_2026_05_17.md`,
  confirming proof-point app-local helpers can stay temporarily while material
  buffers, bind groups, texture/sampler dependencies, and mesh buffers move
  toward WebGPU-owned prepared resources.
- Added scratch-backed view uniform, world transform, light-packing, light
  descriptor, and queued scoped bind-group writer APIs.
- Updated unlit, Matcap, and Standard app frame-resource cache-hit paths to
  mutate cached success result shells instead of creating fresh wrappers.
- Added
  `docs/research/UNLIT_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`,
  `docs/research/SCALAR_UNLIT_PREPARED_CACHE_BOUNDARY_AUDIT_2026_05_17.md`,
  `docs/research/TEXTURED_UNLIT_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`,
  and
  `docs/research/PREPARED_MESH_CACHE_HANDOFF_PLAN_2026_05_17.md`.
- Added `prepared-unlit-material-cache.ts` with scalar prepared unlit material
  caching, texture/sampler dependency key derivation, and direct textured unlit
  prepared group-2 bind-group support.
- Wired scalar unlit app frames to consume prepared scalar material resources
  without changing public app authoring APIs.
- Added a scalar unlit frame-resource miss regression proving prepared material
  resources are reused when only frame-owned view/world buffers change.
- Added `pipeline-scoped-bind-groups.ts` and routed queued app bind-group
  scoping through caller-owned scratch records.
- Added `prepared-mesh-cache.ts`, a WebGPU-private prepared mesh cache helper
  keyed by source mesh handle/version plus upload layout signature.
- Refilled the ready backlog with `task-0810` through `task-0814`; next
  recommended task is `task-0810`.

Validation:

- Focused Vitest runs for view/world descriptor scratch writers, light packing,
  prepared unlit material cache, prepared mesh cache, scoped bind groups, and
  WebGPU app cache/reuse regressions.
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- Final `pnpm run check` passed, including 223 Vitest files / 1024 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
  `docs/RENDER_ASSET_PREPARATION.md`, current WebGPU app resource helpers,
  unlit bind-group/material-buffer helpers, texture/sampler resource helpers,
  mesh upload/buffer helpers, and render asset preparation contracts.
- three.js render-list/scoped record reuse pattern for scratch writer shape.
- PlayCanvas/engine resource preparation patterns for WebGPU-owned texture,
  sampler, and mesh resource lifetime boundaries.

Known issues / follow-ups:

- Textured unlit prepared resources are supported by the direct cache helper but
  are not yet wired into the app route. `task-0812` covers that.
- Prepared mesh resources are supported by a direct cache helper but are not yet
  consumed by app frame-resource helpers. `task-0810` should wire scalar unlit
  first.
- App report counters still mostly describe frame-resource creation/reuse.
  `task-0813` should tighten prepared material/mesh reuse counters after route
  integration.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/APP_LOCAL_MATERIAL_RESOURCE_RENDER_WORLD_AUDIT_2026_05_17.md`
- `docs/research/PREPARED_MESH_CACHE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/SCALAR_UNLIT_PREPARED_CACHE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/TEXTURED_UNLIT_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/UNLIT_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/pipeline-scoped-bind-groups.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/view-uniform-buffer.ts`
- `packages/webgpu/src/webgpu/world-transform-buffer.ts`
- `test/webgpu/light-packing.test.ts`
- `test/webgpu/pipeline-scoped-bind-groups.test.ts`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `test/webgpu/prepared-unlit-material-cache.test.ts`
- `test/webgpu/view-uniform-buffer.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/world-transform-buffer.test.ts`

## Previous Run Update

Completed `task-0773` through `task-0795` and one utility
follow-up in this automation run. This advanced the WebGPU material queue route
and app-local resource helper boundary from route-only adapters through
texture/sampler preparation, frame-resource cache slots, per-family
frame-resource helpers, shared private utilities, cache-slot regression
coverage, allocation cleanup planning, direct utility coverage, and
prepared-resource handoff planning.

Highlights:

- Added `built-in-material-queue-adapter.ts`, a route-only built-in material
  adapter factory with family/type/phase validation and focused tests.
- Updated `app.ts` to compose queued built-in routing from the route-only
  factory while keeping app-owned GPU resource closures local.
- Added a route report shell regression test that triggers two failed frames and
  verifies stale family/phase/diagnostic counts do not leak.
- Extracted app texture/sampler preparation into
  `app-texture-sampler-resources.ts` with explicit assets/device/cache/reuse
  inputs.
- Added `built-in-material-app-resource-adapter.ts`, an internal shell that
  composes route adapters with caller-provided resource callbacks.
- Replaced nullable per-family frame caches with explicit cache slots, then
  extracted unlit, Matcap, and Standard app frame-resource create/reuse helpers
  into separate WebGPU modules.
- Extracted private `app-frame-resource-utils.ts` for `sameStringList` and
  `writeBufferData`.
- Tightened the three-family app reuse regression so unlit, Matcap, and
  Standard resource cache hits are verified through second-frame app reports
  without exposing cache internals.
- Added
  `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md`
  to identify remaining steady-state helper allocations and concrete cleanup
  slices.
- Added direct tests for private app frame-resource utilities while confirming
  they remain absent from the public WebGPU package surface.
- Added
  `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
  to define the staged handoff from app-local material frame resources toward a
  WebGPU-owned prepared material resource cache.
- Added plans/audits for app-local resource splitting, texture/sampler
  boundaries, frame-resource reuse, unlit/Standard boundaries, shared utilities,
  hot-path allocation cleanup, prepared material resource handoff, and the full
  frame-resource extraction sequence.
- Refilled the ready backlog with `task-0796` through `task-0801`; next
  recommended task is `task-0796`.

Validation:

- Focused Vitest runs for built-in route adapter, app resource adapter, WebGPU
  app route/reuse/cache-slot tests, and app frame-resource utility tests.
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 220 Vitest files / 1008 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
  `docs/RENDER_ASSET_PREPARATION.md`, and current WebGPU app material queue /
  frame-resource helpers.
- three.js `WebGLRenderLists` reusable render item/list pattern.
- PlayCanvas `Layer` visible opaque/transparent list and sort-mode pattern.

Known issues / follow-ups:

- The extracted frame-resource helpers still allocate descriptor/result wrappers
  on cache-hit success paths. `task-0797` through `task-0799` split that cleanup
  into descriptor scratch, light-pack scratch, and reusable success-result
  shells.
- The app facade still owns queued resource-set assembly and pipeline/layout
  selection. That is acceptable for the proof point, and `task-0795` documented
  the handoff toward render-world/prepared-material resource contracts.
  `task-0796` should audit the current path before the implementation follow-ups
  start.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/APP_*RESOURCE*2026_05_17.md`
- `docs/research/APP_FRAME_RESOURCE_HOT_PATH_ALLOCATION_PLAN_2026_05_17.md`
- `docs/research/BUILT_IN_MATERIAL_ADAPTER_FACTORY_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/FRAME_RESOURCE_REUSE_HELPER_EXTRACTION_PLAN_2026_05_17.md`
- `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/STANDARD_APP_FRAME_RESOURCE_*2026_05_17.md`
- `docs/research/UNLIT_APP_FRAME_RESOURCE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/app-frame-resource-utils.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`
- `test/webgpu/app-frame-resource-utils.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0743` through `task-0772` in this automation run. This advanced
two tracks: GLB combined fixture diagnostics and the WebGPU material queue route
reporting/adapter-helper boundary.

Highlights:

- Added combined GLB fixture JSON coverage and unresolved-material diagnostics
  coverage without crossing into render extraction or WebGPU.
- Added
  `docs/research/GLB_COMBINED_FIXTURE_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`;
  no boundary drift was found in the combined fixture diagnostics.
- Planned the generic material-family queue contract, then added/exported the
  queued material adapter registry helper with duplicate-family diagnostics and
  JSON-safe inspection helpers.
- Added `createWebGpuAppMaterialQueueRouteReport`, JSON helpers, and diagnostic
  aggregation for queued/routed/skipped counts by material family and render
  phase.
- Extracted built-in material queue family and phase diagnostics helpers, then
  updated `createWebGpuApp` to use the shared helpers without changing the
  supported family/phase matrix.
- Wired failure-only `webGpuApp.materialQueueRouteReport` diagnostics into
  queued built-in app routing. Existing specific diagnostics remain first; the
  aggregate report is appended only on route failure.
- Added successful queued unlit/matcap/StandardMaterial assertions proving route
  reports are not emitted by default on successful renders.
- Tightened route report JSON projection so omitted optional fields stay
  omitted and `null` blend presets remain explicit.
- Added a reusable material queue route report shell writer/reset API, then
  updated app failure projection to use the shell stored in queued route scratch.
- Added app coverage for `webGpuApp.materialQueueAssetMismatch` route reports
  using a crafted snapshot that keeps ECS-authored assets real while forcing a
  mismatched pipeline family.
- Planned the route-only built-in material adapter registry factory extraction.
- Added audits/plans for queued material adapter boundaries, route report
  boundaries, built-in helper boundaries, failure-only app report wiring, app
  integration, and a future reusable route report shell.
- Refilled the ready backlog with `task-0773` through `task-0777`; next
  recommended task is `task-0773 — Add built-in material route adapter factory`.

Validation:

- Focused Vitest runs passed for GLB combined fixture JSON/unresolved-material
  coverage.
- Focused Vitest runs passed for queued material adapter helpers/JSON helpers.
- Focused Vitest runs passed for material queue route reports, route report JSON
  projection, diagnostic aggregation, shell reuse, built-in material queue
  helpers, and WebGPU app route diagnostics/successful queued paths.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 217 Vitest files / 997 tests.

Reference files/patterns inspected:

- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, current WebGPU app
  material queue routing, route report helpers, and GLB fixture helpers.
- Bevy glTF sub-asset loading and per-node primitive scene spawning from the
  earlier GLB fixture track.
- three.js `WebGLRenderLists` reusable render item/phase bucket pattern.
- PlayCanvas `Layer` opaque/transparent culled list and sort-mode pattern.

Known issues / follow-ups:

- Route report success-path summaries are still intentionally absent. Add an
  explicit diagnostics option before exposing successful route summaries.
- Built-in adapter extraction has been started with family/phase helpers and a
  route-only registry factory plan. GPU resource preparation closures still
  belong in `app.ts`; `task-0773` should add the route-only factory first.
- Combined GLB fixture work remains pre-render: it does not run transform
  resolution, render extraction, render-world preparation, or WebGPU.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/*QUEUE*2026_05_17.md`
- `docs/research/*ROUTE*2026_05_17.md`
- `docs/research/GLB_COMBINED_FIXTURE_DIAGNOSTICS_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `packages/render/src/assets/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-family.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-phase.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `test/assets/gltf-combined-import-*.test.ts`
- `test/assets/gltf-source-registration-orchestration*.test.ts`
- `test/webgpu/*material-queue*.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0675` through `task-0701` in this automation run. The latest
slice advanced the GLB mesh/material source pipeline from planning through
primitive mapping, scene traversal, accessor validation, typed-array decoding,
mesh source asset construction, primitive material resolution, JSON coverage,
boundary audits, and mesh handle-key normalization for upcoming registration.

Highlights:

- Added GLB mesh primitive mapping, scene traversal diagnostics, accessor/buffer
  validation, typed-array decoding, mesh source asset construction, and
  primitive material resolution helpers under `packages/render/src/assets`.
- Added JSON-safe report projections/tests for mesh primitive mapping, scene
  traversal, accessor validation, accessor decoding, mesh construction, and
  primitive material resolution.
- Added focused audits for mesh mapping, scene traversal, accessor validation,
  accessor decoding, mesh construction, and material resolution boundaries.
- Planned the next mesh source asset registration step and normalized mesh
  construction reports so `handleKey` is the planned mesh id while
  `registeredHandleKey` is the full `mesh:` handle key.
- Refilled the ready backlog with `task-0702` through `task-0706`.

Validation:

- Focused Vitest runs for each new GLB helper/test slice.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- Final `pnpm run check` passed, including 194 Vitest files / 913 tests.

Reference files/patterns inspected:

- Bevy glTF primitive, node/scene, and sub-asset loading patterns in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`,
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`,
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`, and
  `references/bevy/crates/bevy_gltf/src/vertex_attributes.rs`.
- three.js `GLTFLoader` accessor/geometry/material/default-material loading
  patterns.
- PlayCanvas `glb-parser` accessor flattening, primitive creation, and index
  handling patterns.
- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/research/MESH_GEOMETRY_COVERAGE.md`, existing
  `MeshAsset` contracts, and source asset registration helpers.

Known issues / follow-ups:

- Next recommended task: `task-0702 — Add GLB mesh source asset registration
helper`.
- Mesh source asset construction is source-data-only; mesh assets are not yet
  registered.
- Primitive material resolution is report-driven; it does not create default
  materials or inspect the registry directly.
- ECS authoring remains blocked until mesh source asset registration and stable
  mesh/material handle resolution are both available.
- Matrix node transforms remain diagnostic/preserved data until Aperture has a
  tested matrix decomposition helper.

Files touched in this update include:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/*GLB*2026_05_17.md`
- `packages/render/src/assets/gltf-accessor-decoding.ts`
- `packages/render/src/assets/gltf-accessor-validation.ts`
- `packages/render/src/assets/gltf-mesh-asset-construction.ts`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `packages/render/src/assets/gltf-scene-traversal.ts`
- `packages/render/src/assets/index.ts`
- `test/assets/gltf-*-json.test.ts`
- `test/assets/gltf-*.test.ts`

## Previous Run Update

Completed `task-0675` through `task-0679` in this automation run:

- `task-0675` — Added
  `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`,
  defining the smallest GLB mesh primitive mapping report, deterministic mesh
  handle ids, reference-validation vs decoding boundaries, supported
  `POSITION`/`NORMAL`/`TEXCOORD_0`/indices scope, unsupported primitive modes,
  JSON expectations, and non-goals.
- `task-0676` — Added `createGltfMeshPrimitiveMappingReport` in
  `packages/render/src/assets/gltf-mesh-primitive.ts`. The helper validates
  glTF mesh/primitive references, emits deterministic planned mesh handle keys,
  reports missing/invalid primitive data, leaves unresolved accessor data as a
  warning with `mesh: null`, and does not decode buffers or create ECS commands.
- `task-0677` — Added JSON fixture coverage for GLB mesh primitive mapping
  reports, including future `MeshAsset` summary behavior so typed arrays are not
  embedded in JSON output.
- `task-0678` — Added
  `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`,
  defining scene selection, deterministic scene/node entity keys, parent
  relationships, transform payload validation, cycle diagnostics, and matrix
  decomposition deferral before ECS authoring.
- `task-0679` — Added
  `docs/research/GLB_MESH_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`. The audit
  found no ECS/WebGPU/browser ownership drift in the new mesh mapping work.
- Refilled the ready backlog with `task-0680` through `task-0684`; next
  recommended task is `task-0680 — Add GLB scene traversal diagnostics report
skeleton`.

Validation:

- `pnpm run format:check`
- `pnpm exec vitest run test/assets/gltf-mesh-primitive.test.ts`
- `pnpm exec vitest run test/assets/gltf-mesh-primitive.test.ts test/assets/gltf-mesh-primitive-json.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed, including 184 Vitest files / 886 tests.

Reference files/patterns inspected:

- Bevy glTF primitive sub-asset loading, node asset loading, cycle checks, scene
  world spawning, and primitive topology mapping in
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs` and
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/mesh.rs`.
- Bevy scene transform helpers in
  `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/scene.rs`.
- three.js `GLTFLoader` primitive geometry loading, primitive mode handling,
  attribute/index dependency loading, and bounds behavior.
- PlayCanvas `glb-parser` mesh primitive creation, primitive mode handling, and
  index format behavior.
- Aperture anchors: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`,
  `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`,
  `docs/research/MESH_GEOMETRY_COVERAGE.md`, and
  `packages/simulation/src/transform/components.ts`.

Known issues / follow-ups:

- GLB mesh primitive mapping is reference-only for now. It does not decode
  accessors or construct ready `MeshAsset`s.
- Scene/node traversal is planned but not yet implemented.
- ECS authoring remains blocked on scene traversal diagnostics, accessor/buffer
  validation, mesh source registration, material resolution, and transform
  command planning.
- Matrix node transforms should remain diagnostic/preserved data until Aperture
  has a tested matrix decomposition helper.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/MINIMAL_GLB_MESH_PRIMITIVE_SOURCE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/GLB_SCENE_NODE_TRAVERSAL_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/GLB_MESH_MAPPING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-mesh-primitive.ts`
- `packages/render/src/assets/index.ts`
- `test/assets/gltf-mesh-primitive.test.ts`
- `test/assets/gltf-mesh-primitive-json.test.ts`

## Previous Run Update

Completed `task-0643` through `task-0674` in this automation run:

- `task-0643` — Added an internal queued built-in material adapter contract in
  the WebGPU app route. Texture/sampler preparation, frame-resource creation,
  and family bucket insertion now dispatch through adapters for unlit,
  MatcapMaterial, and StandardMaterial.
- `task-0644` — Tightened material dependency diagnostics so texture and sampler
  readiness include dependency kind, texture/sampler keys, and status. Standard
  extraction now blocks failed textures and missing samplers before queuing.
- `task-0645` — Audited StandardMaterial PBR texture expectations against
  glTF/three.js, PlayCanvas, and Bevy. The audit confirmed no ownership drift
  and identified sampler conversion and texture-transform preservation as the
  next GLB blockers.
- `task-0646` — Promoted WebGPU validation warning/error console guards into a
  shared E2E helper and applied it to Standard queue phase and material showcase
  browser specs.
- `task-0647` — Audited queued material adapter integration and confirmed the
  route remains `RenderSnapshot`/`MaterialQueueItem` driven with WebGPU-owned
  resources.
- `task-0648` — Extracted the queued material adapter registry into
  `packages/webgpu/src/webgpu/queued-material-adapter.ts`.
- `task-0649` — Added optional `MaterialTextureTransform` metadata, Standard
  readiness diagnostics for non-identity texture transforms, and extraction
  blocking before WebGPU preparation.
- `task-0650` — Added glTF sampler enum mapping into `SamplerAsset` source data
  with JSON-safe diagnostics for malformed wrap/filter values.
- `task-0651` — Added
  `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`, defining the
  smallest renderer-independent GLB material mapper contract.
- `task-0652` — Added `createMaterialAssetFromGltfMaterial`, a
  renderer-independent mapper from glTF-like material JSON into
  `StandardMaterialAsset` or `UnlitMaterialAsset` using caller-provided
  texture/sampler handle resolution.
- `task-0653` — Audited GLB sampler/material/texture-transform readiness.
  Fixed malformed `extensions` and `pbrMetallicRoughness` values so they now
  emit `gltfMaterial.invalidField` diagnostics instead of silently defaulting.
- `task-0654` — Added GLB material alpha/cull edge coverage and tightened
  `alphaCutoff` validation.
- `task-0655` — Extended the material texture resolver contract so
  resolver-provided diagnostics distinguish missing texture vs sampler
  dependencies.
- `task-0656` — Planned minimal GLB texture/image mapping, keeping image
  decoding, URI fetching, registry mutation, ECS authoring, and WebGPU upload
  out of scope.
- `task-0657` — Added `createTextureAssetFromGltfTexture`, a source-data helper
  for glTF texture/image/sampler metadata with caller-owned decoded image data.
- `task-0658` — Audited GLB material/texture helper boundaries; no drift found.
- `task-0659` — Added a test-only fixture that feeds texture mapping reports
  into material resolver results without registering assets.
- `task-0660` — Added `validateGltfRootForAssetMapping` for glTF 2.0 root
  validation, mapper array shape checks, and unsupported required root
  extension diagnostics.
- `task-0661` — Documented how root, texture, sampler, and material diagnostics
  compose before registry mutation.
- `task-0662` — Added JSON fixture tests for material, sampler, and texture
  helper reports.
- `task-0663` — Audited the root/material/texture helper set; no boundary drift
  found.
- `task-0664` — Planned the minimal GLB asset mapping orchestration report.
- `task-0665` — Added `createGltfAssetMappingReport`, which validates root JSON,
  maps material-referenced textures, plans deterministic source-asset handle
  keys, and maps materials through the resolver boundary.
- `task-0666` — Added orchestration report JSON tests and ensured nested texture
  payloads are summarized rather than embedded as raw bytes.
- `task-0667` — Documented orchestration report diagnostics and the later
  registry handoff point.
- `task-0668` — Audited the orchestration report boundary; no registry, ECS, or
  WebGPU drift found.
- `task-0669` — Planned the GLB source asset registry registration contract,
  including write order, duplicate-key behavior, partial failures, material
  dependency edges, handle normalization, and JSON report expectations.
- `task-0670` — Added `registerGltfSourceAssetsFromMappingReport`, which writes
  successful texture, sampler, and material source assets from a
  `GltfAssetMappingReport` into an `AssetRegistry` as ready source assets.
- `task-0671` — Added JSON fixture coverage for GLB source asset registration
  reports, including written/skipped handle keys, duplicate diagnostics, and
  raw-byte omission.
- `task-0674` — Added dependency edge coverage proving material registry entries
  depend on texture/sampler handles, pre-existing duplicates can satisfy those
  dependencies, and missing dependencies skip material registration.
- `task-0672` — Planned the GLB ECS authoring command handoff and explicitly
  blocked implementation until mesh handles, node traversal, transform mapping,
  and primitive/material resolution exist.
- `task-0673` — Audited the source asset registry handoff; no ECS, WebGPU,
  image decode, or renderer ownership drift found.

Validation:

- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts test/e2e/materials-showcase.spec.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/materials/gltf-sampler.test.ts test/materials/gltf-material.test.ts test/materials/material-dependency-readiness.test.ts test/materials/standard-texture-readiness.test.ts test/rendering/extraction.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/assets/gltf-asset-mapping-json.test.ts test/assets/gltf-asset-mapping.test.ts test/assets/gltf-root.test.ts test/materials/gltf-report-json.test.ts test/materials/gltf-material-texture-integration.test.ts test/materials/gltf-texture.test.ts test/materials/gltf-material.test.ts test/materials/gltf-sampler.test.ts`
- `pnpm run check:boundaries`
- `pnpm run format:check`
- `pnpm run build`
- `pnpm run lint`
- `pnpm exec vitest run test/assets/gltf-source-registration.test.ts test/assets/gltf-source-registration-json.test.ts test/assets/gltf-source-registration-dependencies.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`
- `pnpm run check` passed, including 182 Vitest files / 880 tests.

Reference files/patterns inspected:

- three.js `GLTFLoader` sampler, `KHR_materials_unlit`, material mapping, alpha,
  and texture-transform handling.
- PlayCanvas `glb-parser` sampler/material/texture-transform mapping.
- Bevy glTF material loading, `ImageSamplerDescriptor`, texture sampler mapping,
  material cull-mode behavior, image loading, asset-source pattern, and
  sub-asset labeling.
- three.js/PlayCanvas/Bevy dependency orchestration patterns for texture,
  sampler, material, and asset planning.
- Aperture anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/MEDIUM_LONG_TERM_GOALS.md`,
  `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`,
  `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`,
  `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`,
  `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`.

Recommended next task:

- `task-0675 — Plan minimal GLB mesh primitive source asset mapping`.

Known issues / follow-ups:

- Texture-transform metadata is preserved and diagnosed, but current material
  shaders do not render non-identity transforms.
- GLB material mapping depends on caller-provided texture/sampler handle
  resolution; texture/image asset mapping is still a future slice.
- GLB helpers must stay renderer-independent until broader asset loading,
  ECS authoring, and WebGPU preparation each have explicit contracts.
- Source asset registration is now implemented for material-referenced texture,
  sampler, and material plans, but mesh handles do not exist yet.
- ECS authoring remains blocked on mesh primitive source mapping, scene/node
  traversal diagnostics, and transform mapping.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/GLB_SAMPLER_TEXTURE_TRANSFORM_READINESS_AUDIT_2026_05_17.md`
- `docs/research/GLB_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_MATERIAL_TEXTURE_INTEGRATION_DIAGNOSTICS_2026_05_17.md`
- `docs/research/GLB_ORCHESTRATION_REPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_ORCHESTRATION_REPORT_DIAGNOSTICS_2026_05_17.md`
- `docs/research/GLB_ECS_AUTHORING_COMMAND_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/GLB_REGISTRY_HANDOFF_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_ROOT_MATERIAL_TEXTURE_HELPER_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GLB_SOURCE_ASSET_REGISTRY_REGISTRATION_CONTRACT_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_ASSET_MAPPING_ORCHESTRATION_REPORT_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_MATERIAL_MAPPING_PLAN_2026_05_17.md`
- `docs/research/MINIMAL_GLB_TEXTURE_IMAGE_MAPPING_PLAN_2026_05_17.md`
- `docs/research/QUEUED_MATERIAL_ADAPTER_INTEGRATION_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_PBR_TEXTURE_EXPECTATIONS_AUDIT_2026_05_17.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `packages/render/src/assets/gltf-root.ts`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/gltf-material.ts`
- `packages/render/src/materials/gltf-sampler.ts`
- `packages/render/src/materials/gltf-texture.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `test/assets/gltf-asset-mapping-json.test.ts`
- `test/assets/gltf-asset-mapping.test.ts`
- `test/assets/gltf-root.test.ts`
- `test/assets/gltf-source-registration-dependencies.test.ts`
- `test/assets/gltf-source-registration-json.test.ts`
- `test/assets/gltf-source-registration.test.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/e2e/standard-queue-phases.spec.ts`
- `test/e2e/webgpu-status.ts`
- `test/materials/gltf-material-texture-integration.test.ts`
- `test/materials/gltf-material.test.ts`
- `test/materials/gltf-report-json.test.ts`
- `test/materials/gltf-sampler.test.ts`
- `test/materials/gltf-texture.test.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`

## Previous Run Update

Completed `task-0636`, `task-0637`, `task-0638`, `task-0639`, `task-0640`,
`task-0641`, and `task-0642` in this automation run:

- `task-0636` — Built-in WebGPU pipeline descriptor plans and browser
  descriptors now derive cull mode, depth compare/write behavior, and blend
  target state from material render-state pipeline-key tokens. Added shared
  helpers in `packages/webgpu/src/webgpu/material-render-state.ts` and exported
  them from the WebGPU package.
- `task-0637` — The WebGPU app queue route now accepts StandardMaterial
  `alpha-test` items after opaque items. Unsupported alpha-test material
  families remain diagnostic-only and JSON-safe.
- `task-0638` — The WebGPU app queue route now accepts StandardMaterial
  transparent alpha-blend items when the blend preset is `alpha` and depth
  writes are disabled. Transparent snapshot sorting now prioritizes
  back-to-front depth before pipeline/material grouping.
- `task-0639` — Added `examples/standard-queue-phases.html` and Playwright
  coverage proving opaque, alpha-test, and transparent StandardMaterial queue
  phases render through `createWebGpuApp` with deterministic pixels and
  JSON-safe frame diagnostics.
- `task-0640` — Audited the expanded phase route. The route remains
  snapshot-derived and queue-driven with WebGPU-owned resources. The audit
  found and fixed a browser WebGPU auto-layout issue: StandardMaterial light
  bind groups are now scoped per pipeline key so opaque/mask/blend pipelines do
  not reuse group-3 bind groups created from another pipeline layout.
- `task-0641` — Added a focused Playwright console guard to the Standard queue
  phase spec so WebGPU command-buffer and auto-layout validation warnings fail
  the browser test before pixel assertions.
- `task-0642` — Added
  `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`,
  defining the smallest internal adapter contract for generic material-family
  queue routing while keeping `RenderSnapshot` as the boundary and GPU handles
  inside `packages/webgpu`.
- Corrected the automation work-window documentation and stop-hook continuation
  reason to the actual 55-minute gate. The hook's conditional already blocked
  before minute 55; the emitted JSON reason and local agent prompts were stale.
- Updated `agent/BACKLOG.md` to make the next higher-level focus explicit:
  finish the generic renderer/material architecture spine before prioritizing
  IBL, shadows, or GLB viewer work. The backlog now estimates roughly 18-24
  focused tasks for a credible lit glTF render pipeline, plus another 6-10 if
  "complete" includes environment-lit and shadowed PBR.
- Backlog was corrected and refilled with `task-0643` through `task-0647`,
  avoiding duplicate PBR texture work already completed in earlier runs.

Validation:

- `pnpm exec vitest run test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-pipeline.test.ts test/webgpu/unlit-pipeline-descriptor.test.ts test/webgpu/unlit-pipeline.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts test/webgpu/matcap-pipeline.test.ts test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/snapshot.test.ts test/rendering/material-queue.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json` after the browser warning
  guard
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run format:check` after the generic queue contract plan
- `bash -n scripts/codex-stop-hook.sh`
- `pnpm run check:boundaries`
- Final `pnpm run check` passed: 171 test files / 837 tests.

Reference files/patterns inspected:

- `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`.
- Bevy `references/bevy/crates/bevy_pbr/src/pbr_material.rs` and render phase
  queue/sort patterns.
- three.js `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`,
  `references/three.js/src/renderers/common/Renderer.js`, and
  `references/three.js/src/renderers/common/RenderList.js`.
- PlayCanvas `references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`
  and `references/engine/src/scene/mesh-instance.js`.
- Aperture anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `packages/render/src/rendering/material-queue.ts`,
  `packages/render/src/rendering/snapshot.ts`,
  `packages/webgpu/src/webgpu/app.ts`.

Recommended next task:

- `task-0643 — Add generic queued material resource adapter contract`.

Known issues / follow-ups:

- Non-opaque phase consumption remains intentionally limited to
  StandardMaterial. Unlit, MatcapMaterial, and DebugNormalMaterial alpha/transparent
  phases should stay diagnostic-only until each family has defined shader
  behavior and browser pixel coverage.
- Generic material-family queue routing is still future work; the current app
  route remains built-in-family specific.
- StandardMaterial PBR texture paths have prior browser coverage from earlier
  runs, but the next audit should still compare current behavior against glTF
  expectations before GLB material mapping expands.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `AGENTS.md`
- `docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`
- `agent/STOP_CONDITIONS.md`
- `agent/WAKE.md`
- `examples/standard-queue-phases.html`
- `examples/standard-queue-phases.js`
- `package.json`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-render-state.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline.ts`
- `scripts/STOP_HOOK_PROMPT.md`
- `scripts/codex-stop-hook.sh`
- `test/e2e/standard-queue-phases.spec.ts`
- `test/rendering/snapshot.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-pipeline.test.ts`
- `test/webgpu/unlit-pipeline-descriptor.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0621`, `task-0626`, `task-0629`, and `task-0628` in this
automation run:

- `task-0621` — `createWebGpuApp.render()` now routes multi-resource opaque
  built-in material frames through the generic material queue instead of the
  previous pairwise/three-family mixed route branches. The optimized multi-unlit
  fallback remains for same-mesh unlit materials, while mixed unlit, Matcap, and
  StandardMaterial frames now consume queue items, prepare WebGPU-owned
  resources per family, resolve prepared mesh/material resource keys, and feed
  the existing render-frame plan.
- Added focused app coverage for a single frame containing unlit,
  MatcapMaterial, scalar StandardMaterial, and textured StandardMaterial queue
  items.
- `task-0626` — audited the queue-driven app route in
  `docs/research/QUEUE_DRIVEN_APP_ROUTING_AUDIT_2026_05_17.md`. The audit
  confirms the route stays ECS-authoritative, snapshot-derived, WebGPU-owned
  for GPU resources, JSON-safe, and free of hidden scene graph behavior.
- Added ready follow-ups `task-0628` and `task-0629` so the backlog remains
  above five ready tasks and captures queue-route scratch reuse plus explicit
  unsupported-family/phase diagnostics coverage.
- `task-0629` — Added app-level tests for unsupported material queue families
  and unsupported non-opaque queue phases. Both cases produce JSON-safe
  diagnostics and avoid WebGPU submission.
- `task-0628` — Added reusable queue-route scratch maps/arrays to
  `WebGpuAppFrameScratch` and extended the queued mixed-material app test to
  render a second frame, proving scratch reuse does not leak stale resource
  keys.
- Added ready follow-ups `task-0630` and `task-0631` to keep queue-route cleanup
  and future alpha-test/transparent phase consumption explicit.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts test/webgpu/render-frame-plan.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run check` passed: 169 test files / 813 tests.
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts` passed after
  `task-0628`/`task-0629`: 27 tests.

Reference files/patterns inspected:

- Bevy render phase queue/sort:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- three.js render list sorting:
  `references/three.js/src/renderers/common/RenderList.js`,
  `references/three.js/src/renderers/WebGLRenderer.js`.
- PlayCanvas layer/material sorting:
  `references/engine/src/scene/layer.js`,
  `references/engine/src/scene/constants.js`,
  `references/engine/src/scene/mesh-instance.js`.
- Aperture anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `docs/research/OPAQUE_MATERIAL_QUEUE_APP_ROUTING_PLAN_2026_05_17.md`,
  `packages/render/src/rendering/material-queue.ts`,
  `packages/webgpu/src/webgpu/render-frame-plan.ts`.

Recommended next task:

- `task-0624 — Add StandardMaterial normal-map shader support`.

Known issues / follow-ups:

- StandardMaterial normal maps are still diagnostic-only. `task-0624` should
  implement tangent-space sampling without regressing existing texture variants.
- Generic prepared material descriptors remain future work in `task-0625`.
- Single-family app frames still use the existing single-family/multi-unlit
  paths. `task-0630` tracks routing them through the material queue without
  cache regressions.
- Alpha-test and transparent app queue items are diagnosed, not consumed.
  `task-0631` tracks the implementation plan for phase consumption.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/QUEUE_DRIVEN_APP_ROUTING_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed `task-0617`, `task-0618`, `task-0619`, `task-0620`, `task-0622`,
and `task-0623` in this automation run:

- `task-0617` — StandardMaterial now supports metallic-roughness textures in
  WebGPU shaders and pipeline specialization. Roughness uses the green channel,
  metallic uses the blue channel, and both multiply authored scalar factors.
- `task-0618` — StandardMaterial normal maps now have renderer-independent
  tangent readiness diagnostics. Extraction blocks authored normal-map draws
  without required tangent metadata, while actual normal-map shading remains
  deferred.
- `task-0619` — Added a generic material-family queue contract in
  `@aperture-engine/render`. Queue items are plain snapshot-derived data with
  material family, pipeline/resource keys, phase, draw index, and sort data; no
  WebGPU handles are carried.
- `task-0620` — StandardMaterial now supports emissive and occlusion textures.
  Emissive textures multiply `emissiveFactor`; occlusion textures use red
  channel plus `occlusionStrength` to affect ambient/indirect contribution
  without changing direct light math.
- `task-0622` — Audited the queue/PBR texture work and recorded the result in
  `docs/research/MATERIAL_QUEUE_PBR_TEXTURE_AUDIT_2026_05_17.md`.
- `task-0623` — Added focused material queue tests proving opaque, alpha-test,
  and transparent phase ordering, including back-to-front transparent sorting
  and stable order for identical transparent keys.
- Added ready follow-up `task-0627` so the backlog remains above five ready
  tasks and captures a glTF PBR texture expectation audit before GLB material
  mapping resumes.

Validation:

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-bind-group.test.ts test/webgpu/webgpu-app.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm exec vitest run test/materials/standard-normal-map-readiness.test.ts test/rendering/extraction.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts`
- `pnpm exec vitest run test/rendering/material-queue.test.ts`
- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts test/materials/standard-proof-point.test.ts test/webgpu/webgpu-app.test.ts test/rendering/material-queue.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run check:examples`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm run check` passed after `task-0619`: 169 test files / 807 tests.
- `pnpm run check` passed after `task-0620`: 169 test files / 811 tests.
- `pnpm run test:e2e` passed after the stop-hook continuation: 142 Playwright
  tests.

Reference files/patterns inspected:

- Bevy render phase queue/sort:
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- Bevy StandardMaterial/PBR texture handling:
  `references/bevy/crates/bevy_pbr/src/pbr_material.rs`,
  `references/bevy/crates/bevy_pbr/src/render/pbr_bindings.wgsl`,
  `references/bevy/crates/bevy_pbr/src/render/pbr_fragment.wgsl`.
- three.js and PlayCanvas PBR texture handling:
  `references/three.js/src/renderers/shaders/ShaderChunk/metalnessmap_fragment.glsl.js`,
  `references/three.js/src/renderers/shaders/ShaderChunk/roughnessmap_fragment.glsl.js`,
  `references/three.js/src/renderers/shaders/ShaderChunk/emissivemap_fragment.glsl.js`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/scene/materials/standard-material.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/normalMap.js`.
- Aperture audit anchors:
  `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`.

Recommended next task:

- `task-0621 — Integrate opaque material queue app routing`.

Task 0621 prep notes:

- The new queue contract is in `packages/render/src/rendering/material-queue.ts`
  and exported through `packages/render/src/rendering/index.ts`.
- App routing is still narrow and branch-shaped in `packages/webgpu/src/webgpu/app.ts`.
  Do not add more pairwise material-family branches. Replace opaque unlit,
  MatcapMaterial, and StandardMaterial routing with queue-driven resource
  resolution/consumption.
- Existing showcase coverage now exercises StandardMaterial base-color,
  metallic-roughness, occlusion, and emissive texture bindings through
  `createWebGpuApp`.

Known issues:

- `task-0621` is still pending. Mixed material app routing remains a temporary
  bridge until queue consumption replaces the branch-specific paths.
- StandardMaterial normal maps are still diagnostic-only. Tangent-space normal
  shading should wait for `task-0624`.
- Transparent queue sort coverage is now in place; transparent render-state
  validation and app consumption are still future work.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/MATERIAL_QUEUE_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `examples/materials-showcase.js`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-normal-map-readiness.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/index.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/materials/standard-normal-map-readiness.test.ts`
- `test/materials/standard-proof-point.test.ts`
- `test/rendering/extraction.test.ts`
- `test/rendering/material-queue.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the mixed built-in material app route and promoted the material
showcase onto the app facade:

- `task-0602` — `createWebGpuApp.render()` now supports mixed StandardMaterial
  frames with either unlit or Matcap materials when source dependencies and
  Standard lights are ready.
- `task-0603` — the app diagnostics example now covers mixed material
  dependency readiness failures and a successful mixed material render with
  JSON-safe browser status.
- `task-0604` — textured unlit materials can participate in mixed unlit/Matcap
  app frames when texture and sampler source dependencies are ready.
- `task-0606` — audited mixed material app routing and recorded the findings in
  `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`.
- `task-0607` — added the three-family mixed route for one unlit, one
  StandardMaterial, and one MatcapMaterial draw in a shared-mesh app frame.
- `task-0583` — replaced the direct WebGPU material showcase shader with an
  ECS-authored `createWebGpuApp` example using typed mesh/material/texture/
  sampler assets, camera/lights, `SpinSystem`, and app render reports.
- `task-0605` — audited the promoted showcase and recorded the findings in
  `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`.
- `task-0608` — added StandardMaterial base-color texture dependency app
  diagnostics in mixed-material frames and exposed the same path in the browser
  diagnostics example.
- `task-0609` — added renderer-independent DebugNormalMaterial preparation
  metadata with stable material/pipeline keys, JSON-safe dependency readiness,
  and render-state validation.
- `task-0610` — documented `createWebGpuApp`, ECS-authored entities, typed
  assets, and systems as the default browser application path while keeping
  direct WebGPU helpers as backend/test surfaces.
- `task-0611` — planned the first renderer-independent GLB container slice and
  explicitly deferred GLB material mapping/viewer work until StandardMaterial
  PBR and the generic material queue are ready.
- `task-0612` — audited the post-showcase material app route and confirmed the
  current pairwise/three-family helpers are still a safe narrow bridge, but
  should be replaced by a generic material-family queue after the near-term
  StandardMaterial PBR texture slices.
- `task-0613` — added a package-boundary guard script that fails if headless
  packages import `@aperture-engine/webgpu`, declare it as a dependency, or
  reference browser WebGPU globals in source files.
- `task-0614` — added DebugNormalMaterial WebGPU shader metadata and descriptor
  planning contracts, including normal-to-RGB WGSL, view/world/material binding
  metadata, pipeline cache-key planning, and JSON-safe diagnostics for invalid
  topology/layout inputs.
- `task-0615` — added StandardMaterial base-color texture rendering through a
  specialized WebGPU shader/pipeline variant, app texture/sampler preparation,
  pipeline cache-key specialization, and focused tests for resource reuse and
  group-2 texture/sampler binding. The material showcase Standard cube now uses
  a base-color texture, and Playwright verifies the textured browser path with
  real pixels.
- `task-0616` — added a renderer-independent GLB 2.0 container parser with
  JSON-safe diagnostics, JSON/BIN chunk extraction, unknown chunk warnings, and
  no WebGPU, image decoding, ECS authoring, or glTF material/scene mapping.
- Corrective detail: mixed-family frames now scope shared group-0/group-1 bind
  groups by pipeline key before render-frame resource planning. This prevents
  one material family's view/world bind group from satisfying another pipeline's
  resource key and was necessary for real browser pixels.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm run check:examples`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts test/e2e/materials-showcase.spec.ts`
- `pnpm run check` passed: 162 test files / 771 tests after `task-0608`.
- `pnpm run test:e2e` passed after `task-0608`: 142 Playwright tests.
- `pnpm exec vitest run test/materials/debug-normal-preparation.test.ts test/materials/materials.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed after `task-0609`: 163 test files / 775 tests.
- `pnpm run format:check`
- `pnpm run check:examples`
- `pnpm exec vitest run test/tooling/package-boundary-guard.test.mjs`
- `pnpm run check:boundaries`
- `pnpm run lint`
- `pnpm exec vitest run test/webgpu/debug-normal-shader.test.ts test/webgpu/debug-normal-pipeline-descriptor.test.ts test/webgpu/material-pipeline-selection.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-material-buffer.test.ts test/webgpu/standard-bind-group.test.ts test/webgpu/webgpu-app.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run check` passed after `task-0615`: 166 test files / 786 tests.
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts`
- `pnpm run test:e2e` passed after the showcase base-color texture update: 142
  Playwright tests.
- `pnpm exec vitest run test/assets/glb-container.test.ts`
- `pnpm exec vitest run test/assets/glb-container.test.ts test/assets/render-asset-preparation.test.ts test/assets/dependencies.test.ts test/assets/registry.test.ts test/assets/typed-collections.test.ts`
- `pnpm run build`
- `pnpm run check` passed after `task-0616`: 167 test files / 791 tests.

Reference files/patterns inspected:

- Bevy material/render-asset patterns:
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_render/src/render_asset.rs`.
- Existing Aperture app/material paths:
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/render/src/materials/types.ts`,
  `packages/render/src/materials/dependency-readiness.ts`,
  `packages/render/src/materials/debug-normal-preparation.ts`.
- Promoted examples/tests:
  `examples/app-diagnostics.js`, `examples/materials-showcase.html`,
  `examples/materials-showcase.js`, `test/e2e/app-diagnostics.spec.ts`,
  `test/e2e/materials-showcase.spec.ts`, `test/webgpu/webgpu-app.test.ts`.
- Project docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`.
- GLB planning references:
  `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/engine/src/framework/parsers/glb-container-parser.js`,
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`,
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`.
- Post-showcase material route audit:
  `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`,
  `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`,
  `packages/webgpu/src/webgpu/app.ts`, `test/webgpu/webgpu-app.test.ts`,
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs`.
- Package-boundary guard:
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, root and package
  `package.json` manifests, and source trees for `packages/simulation`,
  `packages/render`, `packages/runtime`, and `packages/core`.
- DebugNormalMaterial shader/descriptor contracts:
  `packages/webgpu/src/webgpu/unlit-shader.ts`,
  `packages/webgpu/src/webgpu/matcap-shader.ts`,
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/render/src/materials/debug-normal-preparation.ts`,
  `references/three.js/src/materials/MeshNormalMaterial.js`,
  `references/three.js/src/renderers/shaders/ShaderLib/meshnormal.glsl.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/common/vert/normalCore.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/normalMap.js`.
- StandardMaterial base-color texture path:
  `packages/render/src/materials/standard-proof-point.ts`,
  `packages/webgpu/src/webgpu/standard-shader.ts`,
  `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`,
  `packages/webgpu/src/webgpu/app.ts`,
  `packages/webgpu/src/webgpu/unlit-frame-resources.ts`,
  `references/bevy/crates/bevy_pbr/src/material.rs`,
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/three.js/src/renderers/shaders/ShaderLib/meshphysical.glsl.js`,
  `references/engine/src/scene/shader-lib/wgsl/chunks/standard/frag/diffuse.js`.
- GLB container parser:
  `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`,
  `references/engine/src/framework/parsers/glb-parser.js`,
  `references/three.js/examples/jsm/loaders/GLTFLoader.js`,
  `references/bevy/crates/bevy_gltf/src/loader/mod.rs`,
  `packages/render/src/assets/index.ts`,
  `test/assets/render-asset-preparation.test.ts`.

Recommended next task:

- `task-0617 — Render StandardMaterial metallic-roughness textures`.

Task 0617 prep notes:

- The base-color texture slice established the shader/descriptor/app pattern:
  `STANDARD_BASE_COLOR_TEXTURED_MESH_WGSL`, `resolveStandardShaderForBatchKey`,
  `standard/group-2:material-base-color-texture@0,1,2`, and
  `prepareStandardAppTextureSamplerResources()`.
- Standard material packing and bind-group planning already collect
  `metallicRoughnessTexture` dependencies and reserve group-2 bindings 3/4, but
  `prepareStandardAppTextureSamplerResources()` currently only prepares
  `baseColorTexture`.
- `standard-pipeline-descriptor.ts` still treats `metallicRoughnessTexture` as a
  deferred feature. The next slice should move that feature to a supported
  shader/pipeline variant and keep any unsupported normal/occlusion/emissive
  paths deferred.
- Reference channel convention for glTF metallic-roughness remains roughness in
  G and metallic in B, multiplied by authored scalar factors.

Steering note:

- The user wants the backlog after the current ready queue to focus on full
  StandardMaterial PBR support first, then the proper render pipeline/material
  queue sorter. `agent/BACKLOG.md` now has a `Post-Queue Direction` section and
  `docs/MEDIUM_LONG_TERM_GOALS.md` now makes that priority explicit.
- `task-0612` added concrete follow-ups for StandardMaterial
  metallic-roughness textures, StandardMaterial normal-map/tangent diagnostics,
  and the generic material-family queue contract.
- StandardMaterial base-color texture rendering and the narrow GLB container
  parser are now supported. Next work should return to metallic-roughness and
  normal-map PBR texture support, then the generic material queue.
- Added ready follow-ups `task-0620` and `task-0621` so the queue stays above
  five ready tasks and remains pointed at PBR texture completion plus
  queue-driven app routing.

Known issues:

- Mixed material app routing is still implemented as narrow pairwise and
  three-family helpers, not a generic material-family queue. The audit found
  this safe only as a temporary bridge through the next StandardMaterial PBR
  texture slices.
- StandardMaterial remains an MVP: base-color textures are supported, but
  metallic-roughness textures, normal maps, IBL, shadows, and advanced glTF PBR
  extensions are still deferred.
- DebugNormalMaterial now has source/preparation contracts, but does not yet
  have frame resources, bind groups, or app activation.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GLB_CONTAINER_SLICE_PLAN_2026_05_16.md`
- `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`
- `docs/research/MATERIAL_SHOWCASE_APP_PATH_AUDIT_2026_05_16.md`
- `docs/research/MIXED_MATERIAL_APP_ROUTING_AUDIT_2026_05_16.md`
- `examples/app-diagnostics.js`
- `examples/materials-showcase.html`
- `examples/materials-showcase.js`
- `package.json`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/debug-normal-shader.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `packages/render/src/materials/debug-normal-preparation.ts`
- `packages/render/src/assets/glb-container.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `scripts/check-package-boundaries.mjs`
- `test/e2e/app-diagnostics.spec.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/materials/debug-normal-preparation.test.ts`
- `test/tooling/package-boundary-guard.test.mjs`
- `test/assets/glb-container.test.ts`
- `test/webgpu/debug-normal-pipeline-descriptor.test.ts`
- `test/webgpu/debug-normal-shader.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/standard-material-buffer.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the app diagnostics and Matcap WebGPU preparation sequence:

- `task-0584` — `createWebGpuApp.render()` now prepares and caches ready unlit
  base-color texture/sampler dependencies as WebGPU-owned resources keyed by
  source handle and asset version.
- `task-0585` — app `resourceReuse` reports now include texture/sampler
  created/reused counters.
- `task-0580` — added `WebGpuAppRenderReportJsonValue`,
  `webGpuAppRenderReportToJsonValue()`, and `webGpuAppRenderReportToJson()`.
  The helper omits snapshots, raw resource handles, bind groups, command
  buffers, and browser/WebGPU objects.
- `task-0581` — added Matcap WGSL shader metadata, pipeline-family selection,
  and descriptor planning for `matcap`.
- `task-0582` — added `examples/app-diagnostics.*` plus Playwright coverage for
  mixed source-resource and material dependency readiness diagnostics.
- `task-0587` — added Matcap material uniform packing, dependency key
  extraction, buffer descriptors, and GPU material-buffer creation.
- `task-0588` — added Matcap group-2 bind group layout metadata, descriptor
  planning, resource-key creation, and bind group creation.
- `task-0589` — added Matcap render pipeline resource creation from the Matcap
  shader/descriptor contract.
- `task-0590` — added Matcap frame GPU resource assembly for mesh, view/world
  buffers, material buffer, prepared texture/sampler resources, and shared plus
  material bind groups.
- `task-0586` — audited the app diagnostics and Matcap WebGPU boundaries. No
  ECS/render ownership drift was found.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm exec vitest run test/webgpu/texture-resources.test.ts test/webgpu/unlit-frame-resources.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run build`
- `pnpm exec vitest run test/webgpu/matcap-shader.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts test/webgpu/material-pipeline-selection.test.ts`
- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
- `pnpm exec vitest run test/webgpu/matcap-frame-resources.test.ts test/webgpu/matcap-material-buffer.test.ts test/webgpu/matcap-bind-group.test.ts test/webgpu/matcap-pipeline.test.ts test/webgpu/matcap-pipeline-descriptor.test.ts`
- `pnpm run check` passed: 162 test files / 757 tests.
- `pnpm run test:e2e` passed: 141 Playwright tests.

Reference files/patterns inspected:

- Bevy render asset preparation and material prepare/retry patterns:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- Three.js matcap shader/UV patterns:
  `references/three.js/src/nodes/utils/MatcapUV.js` and
  `references/three.js/src/renderers/shaders/ShaderLib/meshmatcap.glsl.js`.
- PlayCanvas/WebGPU texture and sampler resource patterns:
  `references/engine/src/platform/graphics/texture.js` and
  `references/engine/src/platform/graphics/webgpu/webgpu-texture.js`.
- Existing Aperture unlit/standard material buffer, bind group, frame resource,
  pipeline, and resource summary helpers.
- Project docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`.

Recommended next task:

- `task-0591 — Wire single-material Matcap app-facade rendering`.

Preflight notes for `task-0591`:

- The new Matcap pieces are intentionally independent:
  `matcap-material-buffer.ts`, `matcap-material-buffer-resource.ts`,
  `matcap-bind-group-layout.ts`, `matcap-bind-group.ts`,
  `matcap-pipeline.ts`, and `matcap-frame-resources.ts`.
- App activation should mirror the narrow standard/unlit app paths and reuse
  the existing source-handle/version cache for Matcap texture/sampler
  dependencies.
- Keep mixed material/source-resource frames on the existing
  `webGpuApp.additionalDrawResourceUnsupported` diagnostic until broader
  batching exists.

Known issues:

- The three-material showcase is a direct WebGPU proof/demo, not an app-facade
  multi-material implementation.
- `createWebGpuApp.render()` still supports one source mesh/material resource
  set per frame; mixed source-resource frames now fail clearly with
  `webGpuApp.additionalDrawResourceUnsupported`.
- MatcapMaterial now has WebGPU shader metadata, material buffer, bind group,
  pipeline, and frame-resource helpers, but no app-facade activation, browser
  example, or material-showcase route yet.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are still deferred.

Files touched in this update:

- `examples/app-diagnostics.html`
- `examples/app-diagnostics.js`
- `examples/index.html`
- `examples/materials-showcase.html`
- `examples/multi-entity.html`
- `examples/spinning-cube.html`
- `examples/triangle.html`
- `package.json`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/matcap-bind-group.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-material-buffer-resource.ts`
- `packages/webgpu/src/webgpu/matcap-material-buffer.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/matcap-pipeline.ts`
- `packages/webgpu/src/webgpu/matcap-shader.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/resource-summary.ts`
- `packages/webgpu/src/webgpu/texture-resources.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/app-diagnostics.spec.ts`
- `test/webgpu/matcap-bind-group.test.ts`
- `test/webgpu/matcap-frame-resources.test.ts`
- `test/webgpu/matcap-material-buffer.test.ts`
- `test/webgpu/matcap-pipeline-descriptor.test.ts`
- `test/webgpu/matcap-pipeline.test.ts`
- `test/webgpu/matcap-shader.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/APP_DIAGNOSTICS_AND_MATCAP_METADATA_AUDIT_2026_05_16.md`

## Previous Run Update

Completed a user-requested browser demo plus six follow-up backlog tasks:

- Added `examples/materials-showcase.html` and
  `examples/materials-showcase.js`, visible at
  `http://127.0.0.1:4173/examples/materials-showcase.html`. It renders three
  spinning cubes side by side: unlit, standard PBR, and matcap. The page uses a
  focused direct WebGPU showcase shader because the high-level app facade still
  cannot bind multiple material families/resource sets in one frame.
- Fixed the PBR black-spot artifact in the showcase by using the camera
  position when computing `viewDir`.
- Fixed the built-in StandardMaterial shader path the same way: packed view
  uniforms now include `cameraPosition`, and the standard shader uses
  `view.cameraPosition.xyz - input.worldPosition`. Unlit shaders accept the
  expanded view uniform layout.
- Fixed app resource-cache reuse to store logical descriptor source byte lengths
  instead of scratch-buffer backing-array byte lengths.
- `task-0576` — `createWebGpuApp.render()` now diagnoses mixed source
  mesh/material resource sets instead of silently binding first-draw resources
  for all draws. Same-resource multi-draw frames still render.
- `task-0574` — app render failures now surface JSON-safe material dependency
  readiness when material texture/sampler source dependencies are
  missing/loading/failed.
- `task-0578` — material dependency readiness reports now have explicit JSON
  value/string helpers, and app diagnostics embed that serialized contract.
- `task-0575` — added a renderer-independent MatcapMaterial preparation
  metadata plan. It carries material key, matcap texture/sampler keys, render
  state, pipeline key, and dependency readiness JSON. This is metadata only; no
  Matcap WebGPU rendering path was activated.
- `task-0579` — audited the material showcase, expanded view-uniform layout,
  app diagnostics, mixed source-resource handling, and MatcapMaterial
  preparation metadata. No ownership drift was found. Added `task-0583` to
  promote the showcase onto built-in material/app-facade paths once
  multi-material app rendering and matcap WebGPU support exist.
- `task-0577` — checked texture/sampler reuse diagnostics. The app facade does
  not yet prepare or cache texture/sampler GPU resources from source material
  dependencies, so reuse counters would be misleading. Recorded the blocker and
  added `task-0584` for the prepared-resource cache plus `task-0585` for the
  actual reuse counters.

Validation:

- `pnpm exec vitest run test/e2e/materials-showcase.spec.ts` passed earlier in
  the run after the syntax fix and browser verification.
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/materials/matcap-preparation.test.ts test/materials/material-dependency-readiness.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm run check` passed: 156 test files / 733 tests.
- `pnpm exec playwright test test/e2e/materials-showcase.spec.ts test/e2e/spinning-cube.spec.ts` passed.
- `pnpm run test:e2e` passed: 140 Playwright tests.
- In-app browser was refreshed and showed the material showcase status `ready`.
- `task-0579` was audit-only; no additional code validation was needed after the
  docs/backlog update.
- `task-0577` resolved as a documented blocker; no code validation was needed
  for the blocker note/backlog update.

Reference files/patterns inspected:

- Three.js render-list/material routing and WebGPU pipeline state patterns:
  `references/three.js/src/renderers/WebGLRenderer.js`,
  `references/three.js/src/renderers/webgpu/WebGPUBackend.js`,
  `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`.
- PlayCanvas/engine layer/material sorting, frame graph, and shader chunk
  patterns under `references/engine/src/scene` and
  `references/engine/src/platform/graphics`.
- Bevy render asset preparation and material prepare/retry patterns:
  `references/bevy/crates/bevy_render/src/render_asset.rs`,
  `references/bevy/crates/bevy_pbr/src/material.rs`.
- Texture/sampler resource summary helpers and lower-level unlit textured frame
  resource tests in `packages/webgpu/src/webgpu/resource-summary.ts`,
  `packages/webgpu/src/webgpu/unlit-frame-resources.ts`, and
  `test/webgpu/unlit-frame-resources.test.ts`.
- Project docs: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
  `docs/DECISIONS.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`.

Recommended next task:

- `task-0584 — Add app-facade texture/sampler prepared-resource cache`.

Preflight notes for `task-0584`:

- The lower-level path is already ready for prepared resources:
  `createUnlitFrameGpuResources()` accepts `textures` and `samplers`, and
  `test/webgpu/unlit-frame-resources.test.ts` verifies textured bind groups.
- Extraction already blocks unready unlit texture dependencies before snapshots
  are rendered. The app facade should therefore prepare resources only for ready
  source asset dependencies on the first material in the current
  single-resource-set path.
- Use `assetHandleKey(handle)@entry.version` as the cache key pattern, matching
  existing mesh/material app-frame cache keys.
- First implementation slice can target unlit `baseColorTexture` only. Standard
  material texture sampling is still deferred in the built-in shader.
- Tests should extend `test/webgpu/webgpu-app.test.ts` with fake
  `device.createTexture`, `texture.createView`, `device.createSampler`, and
  queue upload/write events.

Known issues:

- The three-material showcase is a direct WebGPU proof/demo, not an app-facade
  multi-material implementation.
- `createWebGpuApp.render()` still supports one source mesh/material resource
  set per frame; mixed source-resource frames now fail clearly with
  `webGpuApp.additionalDrawResourceUnsupported`.
- MatcapMaterial has source asset and preparation metadata contracts, but no
  active WebGPU matcap shader/pipeline/bind-group/app path yet.
- Texture/sampler GPU resource reuse counts are still not active in app reports.
  `task-0584` must first add the prepared-resource cache, then `task-0585` can
  add the counters.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are still deferred.

Files touched in this update:

- `examples/materials-showcase.html`
- `examples/materials-showcase.js`
- `examples/index.html`
- `examples/multi-entity.html`
- `examples/spinning-cube.html`
- `examples/triangle.html`
- `examples/styles.css`
- `package.json`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/matcap-preparation.ts`
- `packages/render/src/rendering/view-pack.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/materials-showcase.spec.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/matcap-preparation.test.ts`
- `test/rendering/view-pack.test.ts`
- `test/webgpu/frame-readiness.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/unlit-frame-resources.test.ts`
- `test/webgpu/view-uniform-buffer-resource.test.ts`
- `test/webgpu/view-uniform-buffer.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `docs/research/MATERIAL_SHOWCASE_BOUNDARY_AUDIT_2026_05_16.md`
- `docs/research/APP_TEXTURE_SAMPLER_REUSE_BLOCKER_2026_05_16.md`

## Previous Run Update

Completed the stop-hook continuation sequence through the remaining ready tasks:

- `task-0567` — audited post-proof-point resource reuse and shader metadata
  boundaries.
- `task-0568` — moved the app facade onto reusable frame scratch for packing
  and planning where scratch APIs already existed.
- `task-0569` — added scratch-backed snapshot resource binding planning.
- `task-0570` — added the renderer-independent MatcapMaterial source asset
  contract and validation.
- `task-0571` — added JSON-safe app resource reuse diagnostics.
- `task-0572` — added renderer-independent material asset dependency readiness
  reports.
- `task-0573` — audited the new diagnostics and material-source boundaries.

What changed:

- Added `docs/research/POST_PROOF_POINT_BOUNDARY_AUDIT_2026_05_16.md` and
  corrected stale README text for the current early engine foundation and lit
  StandardMaterial spinning cube.
- `createWebGpuApp` now owns a reusable app-frame scratch object for packed
  view uniforms, packed transforms, render-world package planning, draw command
  descriptors, draw-list planning, render-pass resource resolution, and
  render-pass command planning.
- Added a scratch-backed writer for injected snapshot resource bindings. The
  existing convenience planner remains for tests and one-shot diagnostics.
- Added `MatcapMaterialAsset`, `createMatcapMaterialAsset()`, validation,
  pipeline-feature participation, and `assets.materials.matcap`. This is source
  asset data only; no Matcap WebGPU shader/pipeline/bind-group path was added.
- `WebGpuAppRenderReport.resourceReuse` now reports JSON-safe counts for
  pipeline hits/misses, mesh/material buffer creation and reuse, bind group
  creation and reuse, light buffer creation and reuse, and dynamic buffer
  writes. The spinning cube status includes this report.
- Added renderer-independent material asset dependency readiness reports for
  texture/sampler slots. They accept a material handle plus `AssetRegistry`,
  distinguish missing/registered/loading/failed/ready dependencies, and omit
  WebGPU resources.
- Refilled the backlog with the next audit and follow-up diagnostics/material
  tasks.
- Added `docs/research/POST_CLEANUP_DIAGNOSTICS_AUDIT_2026_05_16.md`; no
  additional architecture fixes were needed after the type-name collision fix
  caught by validation.

Validation:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/render-frame-snapshot-binding-planner.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/render-frame-plan.test.ts test/webgpu/render-frame-runner.test.ts test/webgpu/render-frame-runner-diagnostics.test.ts`
- `pnpm exec vitest run test/materials/materials.test.ts test/assets/typed-collections.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/render-frame-snapshot-binding-planner.test.ts test/materials/materials.test.ts test/assets/typed-collections.test.ts`
- `pnpm exec vitest run test/materials/material-dependency-readiness.test.ts test/materials/materials.test.ts test/assets/typed-collections.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed: 155 test files / 725 tests.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed after the
  app status/reuse-report change.
- `pnpm run test:e2e` passed: 139 Playwright tests.

Reference files/patterns inspected:

- Bevy render schedules and phase queue/sort:
  - `references/bevy/crates/bevy_render/src/lib.rs`
  - `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
  - `references/bevy/crates/bevy_pbr/src/material.rs`
- Bevy render asset preparation/cache:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/crates/bevy_pbr/src/medium.rs`
- Three.js light uniform/shader update patterns:
  - `references/three.js/src/renderers/shaders/UniformsLib.js`
  - `references/three.js/src/renderers/WebGLRenderer.js`
  - `references/three.js/src/renderers/webgl/WebGLProgram.js`
- PlayCanvas/engine light/layer/render organization search under
  `references/engine/src`.
- Project docs:
  - `docs/NORTH_STAR.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md`

Recommended next task:

- `task-0574 — Surface material asset dependency readiness in app render failures`.

Known issues:

- `createWebGpuApp.render()` still has a narrow single-resource-set app facade
  path. It binds resources derived from the first draw and should now diagnose
  unsupported additional draw resource sets before a broader render-world cache
  is implemented.
- The app resource cache is intentionally narrow: it caches the current unlit or
  standard frame resource set per app path, not a multi-asset render-world cache.
- Texture/sampler GPU resource reuse counts are not active yet because the app
  facade textured-resource reuse path is still limited.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are still deferred.
- MatcapMaterial is source asset data only; no active Matcap rendering exists.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/ARCHITECTURE.md`
- `docs/LIGHT_SHADER_WGSL_CONTRACT.md`
- `docs/research/POST_CLEANUP_DIAGNOSTICS_AUDIT_2026_05_16.md`
- `docs/research/POST_PROOF_POINT_BOUNDARY_AUDIT_2026_05_16.md`
- `examples/spinning-cube.js`
- `packages/render/src/assets/collections.ts`
- `packages/render/src/materials/bindings.ts`
- `packages/render/src/materials/dependency-readiness.ts`
- `packages/render/src/materials/factories.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/index.ts`
- `packages/render/src/rendering/render-frame-phases.ts`
- `packages/render/src/rendering/render-queue.ts`
- `packages/render/src/rendering/view-pack.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/light-shader-metadata.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/renderer-frame-summary.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `packages/webgpu/src/webgpu/view-uniform-buffer.ts`
- `README.md`
- `test/assets/typed-collections.test.ts`
- `test/e2e/spinning-cube.spec.ts`
- `test/materials/material-dependency-readiness.test.ts`
- `test/materials/materials.test.ts`
- `test/rendering/render-frame-phases.test.ts`
- `test/rendering/view-pack.test.ts`
- `test/webgpu/light-shader-metadata.test.ts`
- `test/webgpu/render-frame-snapshot-binding-planner.test.ts`
- `test/webgpu/unlit-shader.test.ts`
- `test/webgpu/view-uniform-buffer.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the lit StandardMaterial proof-point sequence and the first resource
inspection follow-up:

- `task-0561` — direct-lit StandardMaterial WGSL and pipeline.
- `task-0562` — standard material render selection.
- `task-0563` — lit spinning cube app-facade example and Playwright E2E.
- `task-0564` — post-proof-point architecture audit.
- `task-0565` — standard material resource inspection records.

What changed:

- Added `STANDARD_MESH_WGSL` and StandardMaterial pipeline helpers for a narrow
  direct-lit metallic/roughness MVP:
  - consumes view/world transforms, StandardMaterial uniform data, normals, and
    packed light buffers.
  - supports ambient and directional lights.
  - documents texture sampling, normal maps, IBL, and shadows as deferred.
- Added material pipeline selection and draw-list routing so standard draws
  require group 3 light bind groups and never silently fall back to unlit.
- Added StandardMaterial group-2 bind group resource creation and standard frame
  GPU resources for the app facade.
- Extended `createWebGpuApp.render()` to render `standard` materials through the
  new standard pipeline/resource path while preserving the existing unlit path.
- Reworked `examples/spinning-cube.js` to use the user-facing app facade:
  typed asset collections, ECS entity spawning, camera, ambient/directional
  lights, `SpinSystem`, and `app.render()` instead of manual WebGPU setup.
- Updated the spinning-cube Playwright spec to verify a nonblank lit cube,
  animation/frame progress, and JSON-safe status.
- Completed the architecture audit:
  - `@aperture-engine/core` and `@aperture-engine/runtime` remain headless.
  - StandardMaterial source data stays renderer-independent.
  - WebGPU objects are still backend-owned.
  - No scene graph or WebGL fallback was introduced.
  - Main follow-up is app-facade hot-path allocation/resource reuse.
- Added `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md` with the
  audit findings and validation record.
- Added `task-0566` for steady-state reuse of prepared WebGPU app resources
  across frames.
- Added StandardMaterial-specific resource inspection adapters that produce the
  existing generic material inspection records for live, missing, stale, and
  pending-destroy material buffer resources without exposing raw GPU handles.

Validation:

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-pipeline.test.ts`
- `pnpm exec vitest run test/webgpu/material-pipeline-selection.test.ts test/webgpu/render-pass-draw-list.test.ts test/webgpu/standard-bind-group.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/examples/navigation.test.mjs`
- `pnpm exec vitest run test/webgpu/standard-material-resource-inspection.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed: 152 test files / 706 tests.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed.

Reference files/patterns inspected:

- PlayCanvas/engine lit material and shader organization:
  - `references/engine/src/scene/graphics/light-cube.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/pass-forward/litForwardBackend.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/pass-forward/litForwardDeclaration.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/metalnessModulate.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/lightFunctionLight.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/lightDeclaration.js`
- Three.js material/shader/render routing:
  - `references/three.js/src/materials/MeshStandardMaterial.js`
  - `references/three.js/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js`
  - `references/three.js/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js`
  - `references/three.js/src/renderers/common/RenderList.js`
  - `references/three.js/src/renderers/common/Pipelines.js`
- Bevy ECS/render/material bridge:
  - `references/bevy/crates/bevy_pbr/src/material.rs`
  - render phase/material queue patterns under `references/bevy/crates/bevy_render`
- Project docs:
  - `docs/NORTH_STAR.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`
- Existing Aperture app facade, WebGPU frame planning, light resource, unlit
  bind group, and browser E2E patterns.

Recommended next task:

- `task-0566 — Reuse WebGPU app prepared resources across frames`.

Known issues:

- `createWebGpuApp.render()` now proves the standard path but still creates
  pipelines and GPU resources per rendered frame. This is acceptable for the
  proof-point example, but it does not satisfy the frame hot-path allocation
  discipline for a steady-state runtime loop.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are intentionally deferred.
- Standard material resource inspection records now exist for material-buffer
  inspection; broader app-facade resource reuse is still pending.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md`
- `examples/spinning-cube.js`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-resource-inspection.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/spinning-cube.spec.ts`
- `test/examples/navigation.test.mjs`
- `test/materials/standard-proof-point.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/render-pass-draw-list.test.ts`
- `test/webgpu/standard-bind-group.test.ts`
- `test/webgpu/standard-material-resource-inspection.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-pipeline.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the next proof-point bridge sequence through the renderer-independent
StandardMaterial contract, then ran a focused package-boundary audit.

What changed:

- Added typed asset collections:
  - Generic `TypedAssetCollection` in `@aperture-engine/simulation`.
  - Render-facing `createRenderAssetCollections()` with `assets.meshes.add(...)`
    and `assets.materials.standard.add(...)`.
  - Material collections derive texture/sampler dependencies into
    `AssetRegistry`.
- Added renderer-independent render asset preparation:
  - `RenderAssetAdapter`.
  - `PreparedRenderAssetStore`.
  - mesh/material prepared metadata stores.
  - deterministic prepare/update/retry/remove bookkeeping.
  - docs in `docs/RENDER_ASSET_PREPARATION.md`.
- Added minimal runtime authoring helpers:
  - `app.spawn(...)` on simulation/extraction app facades.
  - `withTransform`, `withMesh`, `withMaterial`, `withCamera`, `withLight`,
    visibility/layer/metadata helpers.
  - `Spin` and `SpinSystem` for proof-point examples/tests.
- Added `createWebGpuApp` in `@aperture-engine/webgpu`:
  - Initializes WebGPU from a canvas.
  - Exposes world/assets/spawn/step/extract/render/stepAndRender.
  - Renders the existing unlit path from extracted snapshots/render-world data.
  - Does not import runtime/core.
- Added StandardMaterial proof-point contract:
  - Explicit supported/deferred feature scope.
  - Validation distinguishes deferred texture/IBL/shadow features from invalid
    scalar inputs.
  - Extraction test proves StandardMaterial produces a distinct standard
    pipeline key without raw WebGPU handles.
- Completed package-boundary audit and recorded it in
  `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`.

Validation:

- `pnpm run check` passed.
- Focused tests also passed during the run:
  - `test/assets/typed-collections.test.ts`
  - `test/assets/render-asset-preparation.test.ts`
  - `test/runtime/runtime.test.ts`
  - `test/webgpu/webgpu-app.test.ts`
  - `test/materials/standard-proof-point.test.ts`

Reference files/patterns inspected:

- Bevy `crates/bevy_asset/src/assets.rs`
- Bevy `crates/bevy_asset/src/render_asset.rs`
- Bevy `crates/bevy_render/src/render_asset.rs`
- Bevy `crates/bevy_mesh/src/components.rs`
- Existing Aperture triangle/spinning-cube WebGPU setup and frame execution
  helpers.

Recommended next task:

- `task-0560 — Prepare StandardMaterial GPU data and bind layout`.

Known issues:

- `createWebGpuApp` currently covers the existing unlit path only.
- StandardMaterial GPU buffers, bind groups, WGSL, and draw routing are still
  pending.
- The lit spinning cube example and Playwright E2E are still pending.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`
- `packages/simulation/src/assets/collections.ts`
- `packages/simulation/src/assets/index.ts`
- `packages/simulation/src/ecs/index.ts`
- `packages/render/src/assets/collections.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/index.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `packages/runtime/src/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/assets/render-asset-preparation.test.ts`
- `test/assets/typed-collections.test.ts`
- `test/materials/standard-proof-point.test.ts`
- `test/runtime/runtime.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Added medium/long-term guidance for post-proof-point work and updated
automation so stop-hook checkpoints are pushed upstream.

What changed:

- Added `docs/MEDIUM_LONG_TERM_GOALS.md` as the post-proof-point guidance doc.
- Recorded the material-family direction: `UnlitMaterial`, `MatcapMaterial`,
  `StandardMaterial`, `DebugNormalMaterial`, and optional simple lit material
  later only if it proves useful.
- Recorded the 3D import direction: focus on glTF 2.0 / GLB only; other 3D
  import formats require a later decision.
- Updated the roadmap, North Star, architecture, MVP concept map, wake prompts,
  backlog maintenance rules, and stop-hook prompt to reference the new guidance.
- Removed the older duplicate `scripts/CODEX_WAKE_PROMPT.md` and repointed the
  example autonomous runner to `agent/WAKE.md`.
- Updated `scripts/codex-stop-hook.sh` so it commits all changes and then pushes
  the current branch to its configured upstream.
- Enabled local Codex hooks in `.codex/config.toml`.

Validation:

- `pnpm run format:check` passed.
- `bash -n scripts/codex-stop-hook.sh` passed.
- `agent/STATUS.json` parses as valid JSON.

Recommended next task:

- `task-0540 — Add typed asset collection API over AssetRegistry`.

Files touched in this latest update:

- `.codex/config.toml`
- `AGENTS.md`
- `agent/BACKLOG.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `agent/WAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/MVP_3D_CONCEPTS.md`
- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `scripts/STOP_HOOK_PROMPT.md`
- `scripts/CODEX_WAKE_PROMPT.md` (removed)
- `scripts/codex-stop-hook.sh`
- `scripts/codex_next_task_sh.md`

## Previous Run Update

Retargeted the ready backlog toward the near-term proof point: a user-facing
WebGPU example that spawns ECS entities, uses typed mesh/material assets,
renders a spinning cube with a StandardMaterial MVP, and verifies the lit output
with Playwright.

What changed:

- Made `task-0540 — Add typed asset collection API over AssetRegistry` the
  recommended next task.
- Added a near-term proof-point track with explicit automation priority:
  typed assets, render asset preparation, user-facing spawn/component API,
  `createWebGpuApp` facade, StandardMaterial render contract, StandardMaterial
  WebGPU preparation, direct-lit standard shader/pipeline, render selection
  routing, lit spinning cube E2E, and post-proof-point audit.
- Rewrote `task-0543` from an API sketch into an implementation task for the
  minimal user-facing ECS spawn/component API.
- Added new tasks `task-0558` through `task-0564` for the proof-point vertical
  slice and follow-up audit.
- Moved `task-0557`, `task-0542`, and metadata-only light shader tasks behind
  the proof point unless they become direct blockers.

Recommended next task:

- `task-0540 — Add typed asset collection API over AssetRegistry`.

## Previous Run Update

Implemented the render pipeline reference follow-up sequence `task-0546`
through `task-0550`, completed `task-0551` for the first hot-path allocation
audit, added scratch-backed writers through `task-0554`, completed the
extraction/packing allocation audit in `task-0555`, and added the transform-pack
scratch writer in `task-0556`.

What changed:

- Added render-frame phase vocabulary and summary reports for apply, prepare,
  queue, resolve, command, and submit phases.
- Expanded WebGPU pipeline cache keys so they include shader family/variant,
  render targets, bind group layouts, vertex layout, primitive/depth/blend
  state, material variants, and batch compatibility fields.
- Added unlit bind group layout metadata and validation for required groups,
  duplicate bindings, missing required bindings, and resource-kind mismatches.
- Added view/pass-scoped render queue records in `@aperture-engine/render`,
  including a reusable scratch/record-pool writer for allocation-conscious
  frame-loop use.
- Added renderer resource inspection for live, missing, stale, and
  pending-destroy resources, and bridged inspection diagnostics into resource
  summaries.
- Added architecture and decision-log coverage for the new rule: no steady-state
  render hot-path allocation on successful per-frame paths.
- Added `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md` and a reusable
  draw-package writer/scratch API:
  `createRenderWorldDrawPackageScratch` and `writeRenderWorldDrawPackages`.
- Added `createRenderFramePlanScratch` / `writeRenderFramePlanFromSnapshot`,
  `createDrawCommandDescriptorScratch` / `writeDrawCommandDescriptors`, and
  `createRenderPassDrawListScratch` / `writeRenderPassDrawList`.
- Added `createResolveRenderPassResourcesScratch` /
  `writeResolveRenderPassResources` and `createRenderPassCommandScratch` /
  `writeRenderPassCommands`.
- Audited extraction, transform packing, view packing, snapshot resource
  binding plans, and `RenderWorld.applySnapshot` for remaining allocation risks.
- Added `createPackedSnapshotTransformsScratch` and
  `writePackedSnapshotTransforms`, with `floatCount` on packed transform results
  for scratch-backed buffers.

Validation completed so far:

- Focused render/WebGPU Vitest slice passed.
- `pnpm run typecheck` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check` passed.
- Focused Playwright render routes passed:
  spinning cube, primitive routing, mixed unlit pipelines, textured/multi-textured
  unlit, sampler routing, multi-entity, depth overlap, and disabled renderable
  coverage.

## Current Status

The render pipeline reference audit, its first implementation follow-ups, and
the first hot-path allocation cleanup tasks are complete.

Recent architecture state:

- The pnpm monorepo/package-boundary refactor is implemented.
- Active packages are `@aperture-engine/simulation`,
  `@aperture-engine/render`, `@aperture-engine/webgpu`,
  `@aperture-engine/runtime`, and `@aperture-engine/core`.
- The active render authoring model uses separate `Mesh` and `Material`
  components rather than `MeshRenderer`.

Latest workflow update:

- `agent/WAKE.md` now requires categorizing selected tasks before
  implementation.
- Ready backlog tasks now include category, package/write-scope, and reference
  anchor metadata.
- Reference policy is explicit:
  - ECS binding, render bridge, assets, and orchestration should anchor on
    `/Users/felixz/Projects/aperture/references/bevy`.
  - WebGPU/render-pipeline work should compare
    `/Users/felixz/Projects/aperture/references/engine` and
    `/Users/felixz/Projects/aperture/references/three.js`, then adapt the common
    patterns to Aperture.
- The backlog now includes recurring `audit-refactor` tasks to catch
  architecture drift every few implementation tasks or after boundary changes.
- The immediate backlog priority is now the lit StandardMaterial spinning cube
  proof point through user-facing ECS APIs. General render-pipeline cleanup
  remains available but should not displace the proof-point path unless it is a
  direct blocker.

Previous audit context:

- Added `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`.
- Confirmed `/Users/felixz/Projects/aperture/references/engine` is the
  PlayCanvas engine checkout and used it as the canonical PlayCanvas reference.
- Compared Aperture's current render pipeline against local Three.js and
  PlayCanvas renderer implementations.
- Documented the current Aperture pipeline:
  `RenderSnapshot -> RenderWorld.applySnapshot -> resource binding updates ->
draw readiness report -> RenderWorldDrawPackage plan -> DrawCommandDescriptor
plan -> RenderPassDrawList plan -> render pass resource resolution ->
RenderPassCommand plan -> command execution/frame report`.
- Added prioritized follow-up tasks `task-0546` through `task-0550` for render
  phases, pipeline cache keys, bind group layout metadata, view/pass queues, and
  resource lifetime/version inspection.

Reference files inspected for the audit:

- Three.js `src/renderers/common/RenderLists.js`
- Three.js `src/renderers/common/RenderList.js`
- Three.js `src/renderers/common/RenderObjects.js`
- Three.js `src/renderers/common/RenderObject.js`
- Three.js `src/renderers/common/Pipelines.js`
- Three.js `src/renderers/common/Bindings.js`
- Three.js `src/renderers/webgpu/WebGPUBackend.js`
- PlayCanvas `src/scene/frame-graph.js`
- PlayCanvas `src/scene/composition/render-action.js`
- PlayCanvas `src/scene/renderer/render-pass-forward.js`
- PlayCanvas `src/scene/renderer/forward-renderer.js`
- PlayCanvas `src/platform/graphics/bind-group-format.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-render-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-bind-group.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-draw-commands.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-graphics-device.js`

## Architecture Notes

- ECS remains authoritative.
- Rendering remains derived from extracted snapshots/render-world data.
- `@aperture-engine/simulation` imports no render/runtime/WebGPU packages.
- `@aperture-engine/render` imports simulation only.
- `@aperture-engine/runtime` imports simulation and render only.
- `@aperture-engine/core` does not import or export WebGPU.
- `@aperture-engine/webgpu` does not import runtime or core.
- WebGPU examples import `@aperture-engine/core` and
  `@aperture-engine/webgpu` explicitly.
- The renderer pipeline now has the first reference-audit follow-ups in place:
  explicit phases, expanded pipeline keys, bind group metadata, view/pass queue
  records, and resource inspection.
- Per decision 0009, future frame-loop work must distinguish hot-path writer
  APIs from allocating diagnostic/setup helpers.
- Draw package planning, view/pass queue planning, render-frame result/summary
  planning, draw command descriptors, and draw-list planning now have
  scratch-backed writer APIs. Resource resolution and command planning also now
  have scratch-backed writer APIs.
- Remaining allocation risk is earlier in the frame: snapshot extraction,
  binding-plan/update aggregation, and transform/view packing.
- Transform packing now has that scratch writer; view-uniform packing is the
  next compact packer to update.

## Files Touched

Primary implementation:

- `packages/render/src/rendering/render-queue.ts`
- `packages/render/src/rendering/draw-package.ts`
- `packages/render/src/rendering/transform-pack.ts`
- `packages/webgpu/src/webgpu/draw-command.ts`
- `packages/webgpu/src/webgpu/render-frame-phases.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `packages/webgpu/src/webgpu/render-pass-resources.ts`
- `packages/webgpu/src/webgpu/render-pass-commands.ts`
- `packages/webgpu/src/webgpu/pipeline-cache.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/resource-lifecycle.ts`
- `packages/webgpu/src/webgpu/resource-summary.ts`

Docs/bookkeeping:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md`
- `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

- Focused render/WebGPU Vitest slice passed.
- `pnpm run typecheck` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check` passed.
- Focused Playwright render routes passed.

## Known Issues

- Typed asset collections are still not implemented; callers still use
  `AssetRegistry` directly.
- Render asset preparation is still spread across render/WebGPU helpers and
  examples rather than a formal renderer-independent adapter contract.
- Runtime does not yet provide a `createWebGpuApp` facade; WebGPU examples still
  contain backend setup code.
- PBR remains blocked on typed assets, material-family contracts, and render
  asset preparation.
- View packing and resource-binding planning still need scratch-backed writers
  before a real runtime frame loop or deeper PBR work. Snapshot creation remains
  the explicit copy boundary until a reusable builder or delta transport design
  is chosen.

## Recommended Next Task

Start with `task-0540 — Add typed asset collection API over AssetRegistry`.
