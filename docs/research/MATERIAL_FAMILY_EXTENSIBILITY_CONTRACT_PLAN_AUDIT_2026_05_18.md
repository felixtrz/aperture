# Material-Family Extensibility Contract Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1294` material-family extensibility contract plan.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/MATERIAL_FAMILY_EXTENSIBILITY_CONTRACT_PLAN_2026_05_18.md`
- `packages/render/src/materials/types.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Findings

Pass. The plan is conservative and preserves the current architecture.

The important distinction is clear:

- source material assets stay closed around known `MaterialKind` variants until
  Aperture has a real public custom material source API;
- route-family keys may become registry-driven strings later so queue and
  diagnostics can describe future adapter families;
- WebGPU rendering remains adapter-owned and diagnostics-only for unsupported
  route keys.

This avoids turning route-summary test flexibility into a hidden custom material
API and avoids adding app-level non-built-in rendering before there is a source
asset, prepared-resource, pipeline, and diagnostics contract.

Boundary checks:

- ECS remains authoritative;
- render extraction remains snapshot/packet based;
- WebGPU resource ownership remains backend-only;
- no public mutable scene graph is introduced;
- no WebGL fallback, IBL, shadows, binary GLB loading, or GLB viewer behavior is
  implied.

## Recommendation

Implement `task-1300` next when the run returns to route architecture: add the
decision record before changing route-family parsing or public types.

If the next run stays on glTF fidelity instead, `task-1295` is also ready.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
