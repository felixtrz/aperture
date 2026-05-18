# Generic App Adapter Registry Validation Helper Audit

Date: 2026-05-18

Task: `task-1659`

## Scope

Audit the `task-1658` generic queued material adapter registry validation
helper after implementation.

Reference files inspected:

- `docs/research/GENERIC_APP_ADAPTER_REGISTRATION_POLICY_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_APP_ADAPTER_CONTRACT_PROOF_IMPLEMENTATION_AUDIT_2026_05_18.md`
- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/three.js/src/renderers/common/Pipelines.js`
- `references/three.js/src/renderers/common/Bindings.js`
- `references/engine/src/scene/materials/standard-material-validator.js`
- `references/engine/src/scene/frame-graph.js`

## Findings

- `validateQueuedMaterialAdapterRegistry()` stays generic. It accepts any
  `QueuedMaterialAdapterRegistry` and optional expected family keys, then
  reports registered families, expected families, existing duplicate-family
  warnings, and generic missing-expected-family errors.
- The new missing-family diagnostic is
  `queuedMaterialAdapter.missingExpectedFamily`. It does not mention built-in
  material policy or use the built-in
  `queuedBuiltInAppResourceAdapter.missingFamily` code.
- Existing duplicate-family diagnostics remain unchanged as
  `queuedMaterialAdapter.duplicateFamily` warnings. Duplicate adapters do not
  make the generic validation report invalid by themselves.
- JSON helpers clone arrays and diagnostic objects and expose no adapter
  callback functions, raw GPU handles, pipeline objects, or descriptors.
- Built-in registry validation behavior remains compatible. The built-in
  validator still owns the default required-family list and its
  built-in-specific missing-family diagnostic.

## Reference Pattern Notes

- three.js keeps renderer pipeline and binding management behind renderer-owned
  caches and validates/updates those resources from render objects rather than
  gameplay state.
- PlayCanvas separates material validation and frame-graph pass management from
  resource execution details.
- Aperture's helper follows the same broad separation: adapter registration
  policy is inspected as data, while WebGPU resource creation and source
  material authoring remain outside the registry validator.

## Boundary Check

- ECS remains authoritative; this helper validates backend adapter metadata and
  does not read or mutate ECS state.
- Rendering remains derived from queued material/app resource contracts.
- WebGPU ownership remains backend-only; the helper is JSON-safe metadata and
  does not create shaders, bind groups, pipelines, buffers, or textures.
- Public source material kinds remain closed. Passing built-in family names to
  the generic helper is compatibility coverage, not a public custom material
  source API.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-adapter-json.test.ts`
- `pnpm run typecheck`

## Recommendation

Proceed to tracker/backlog alignment. The next implementation direction should
be selected by a short route/StandardMaterial planning pass after confirming the
public tracker reflects the registry validation helper and that enough ready
tasks remain.
