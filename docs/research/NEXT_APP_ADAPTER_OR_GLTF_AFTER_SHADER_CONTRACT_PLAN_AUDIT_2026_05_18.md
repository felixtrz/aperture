# Next App Adapter Or glTF After Shader Contract Plan Audit

Date: 2026-05-18

Task: `task-1672`

## Scope

Audit the plan selecting metallic-roughness factor browser coverage after the
shader contract regression.

Reference files inspected:

- `docs/research/NEXT_APP_ADAPTER_OR_GLTF_AFTER_SHADER_CONTRACT_PLAN_2026_05_18.md`
- `docs/research/METALLIC_ROUGHNESS_FACTOR_SHADER_CONTRACT_AUDIT_2026_05_18.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- The selected follow-up is concrete and browser-verifiable.
- It stays within StandardMaterial/glTF fidelity and does not require app-level
  adapter registration, public custom material source APIs, IBL, shadows, or
  binary GLB loading.
- It preserves ECS/render ownership because it uses the existing example
  authoring path and WebGPU app facade, not renderer-owned gameplay state.
- It preserves WebGPU backend ownership because any new status is JSON-safe
  fixture metadata and existing resource diagnostics.

## Recommendation

Implement `task-1673` as planned. Keep the fixture narrow: one new scenario,
status assertions for factors and texture channels, and existing screenshot or
readback non-clear checks.
