# Invalid-Source No-Prepared-Resource Browser Summary Audit

Date: 2026-05-18

## Scope

Audit the `task-1264` invalid-source no-prepared-resource browser status
assertion.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_PREPARED_OR_GLTF_FIDELITY_AFTER_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

Pass. The change describes derived renderer results without moving GPU/resource
ownership into ECS or source assets.

The invalid texture-info browser fixture now asserts that invalid source mapping
creates no texture resources, sampler resources, material buffers, material bind
groups, pipeline keys, draw packages, draw commands, or draw calls. The only
example code change is making `bindGroupsCreated` explicit as `0` when the
render report omits a bind-group count on no-work frames.

This remains JSON-safe status. It does not expose raw GPU handles, backend
resource objects, texture bytes, sampler objects, prepared-resource cache
internals, or source object graphs.

The assertion reinforces the intended boundary:

- invalid source mapping prevents material registration;
- render extraction reports the missing material handle;
- renderer preparation and submission remain no-ops for that invalid source;
- WebGPU resources stay backend-owned and absent.

## Recommendation

Use `task-1266` to re-evaluate material route migration readiness after the
diagnostic and no-prepared-resource coverage added in this run.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "invalid texture-info"`
