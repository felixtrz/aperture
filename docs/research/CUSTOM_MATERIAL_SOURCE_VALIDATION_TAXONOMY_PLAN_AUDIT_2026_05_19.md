# Custom Material Source Validation Taxonomy Plan Audit

Date: 2026-05-19

Task: `task-1712`

## Scope

Audit the `task-1711` selected follow-up before implementation.

Reference files inspected:

- `docs/research/NEXT_SOURCE_VALIDATION_OR_GLTF_AFTER_DECISION_0012_PLAN_2026_05_19.md`
- `docs/DECISIONS.md` Decision 0012
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/materials/types.ts`
- current material/glTF diagnostic tests under `test/materials` and `test/webgpu`

## Findings

- The selected follow-up is concrete enough for one focused run: a docs-only
  taxonomy for future custom material source validation diagnostics.
- The plan preserves Decision 0012 because it does not add TypeScript APIs,
  runtime validators, package exports, app facade options, shaders,
  prepared-resource adapters, or rendered custom material families.
- The taxonomy should make source validation failures distinct from existing
  route diagnostics (`queuedMaterialPrepareRoute.*`,
  `webGpuApp.unsupportedMaterialQueueFamily`), dependency readiness diagnostics,
  frame-resource route diagnostics, and pipeline/resource diagnostics.
- JSON-safe fields should be limited to family keys, source labels, source
  fields, stable dependency names, primitive values, severities, and diagnostic
  codes. The taxonomy should continue banning source payload bytes, WebGPU
  handles, callbacks, adapter instances, and mutable caches.
- The taxonomy should be marked non-binding until follow-up implementation adds
  actual validators and tests.

## Recommendation

Implement `task-1713` as selected. Keep the work in `docs/research` and avoid
runtime code, public API exports, app facade changes, examples, browser tests,
IBL, shadows, binary GLB loading, or non-built-in material rendering.
