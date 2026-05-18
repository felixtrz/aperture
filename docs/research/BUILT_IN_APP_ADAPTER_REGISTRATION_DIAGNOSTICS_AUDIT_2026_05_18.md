# Built-In App Adapter Registration Diagnostics Audit — 2026-05-18

## Scope

Audited the `task-1431` implementation adding validation diagnostics for
built-in app resource adapter registration.

Reference anchors:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `references/three.js/src/renderers/common/Pipeline.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material.js`

## Findings

- The implementation adds a focused built-in app resource adapter registry
  validation report without changing the default active registry behavior.
- Duplicate families reuse the existing generic
  `queuedMaterialAdapter.duplicateFamily` warning, preserving the first-adapter
  lookup behavior and producing deterministic indices.
- Missing built-in families now produce deterministic
  `queuedBuiltInAppResourceAdapter.missingFamily` errors with the expected and
  registered family lists.
- The JSON helper returns only plain family strings and diagnostics; it does not
  expose callback functions, app objects, GPU handles, or prepared resources.
- ECS authority and render extraction remain untouched. The change is limited to
  WebGPU route/app-resource adapter metadata and tests.
- Scope stayed narrow. It does not add app-level non-built-in rendering, route
  renames, GLB viewer behavior, IBL, shadows, or broader PBR work.

## Validation Reviewed

- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm run typecheck:test`

## Recommendation

Mark `task-1431` and `task-1432` complete. Continue with `task-1433`: align the
public tracker/backlog after adapter registration diagnostics.
