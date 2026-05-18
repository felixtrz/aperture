# Valid Non-Default glTF Sampler Mapping Browser Coverage Audit

Date: 2026-05-18

Task: `task-1562`

## Scope

Audit the `task-1561` implementation for valid non-default glTF sampler mapping
browser coverage.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/assets/gltf-asset-mapping.ts`
- `examples/standard-gltf-texture.js`
- `test/e2e/standard-gltf-texture.spec.ts`

## Findings

- The implementation keeps the source-of-truth material and sampler data in the
  glTF asset mapping layer; WebGPU sampler resources remain derived prepared
  state.
- `GltfPlannedSamplerAsset` now retains the original sampler source object.
  This is the narrow metadata needed for JSON-safe browser status and does not
  expose backend handles.
- The `valid-non-default-sampler` browser scenario maps:
  - `wrapS: 10497` to `addressModeU: "repeat"`
  - `wrapT: 33648` to `addressModeV: "mirror-repeat"`
  - `magFilter: 9729` to `magFilter: "linear"`
  - `minFilter: 9987` to `minFilter: "linear"` and `mipmapFilter: "linear"`
- The Playwright test asserts one texture resource, one sampler resource, one
  material buffer, draw submission, pipeline presence, JSON-safe sampler status,
  and no backend resource leakage.

## Architecture Check

- ECS remains authoritative; no renderer-owned game state was added.
- Render extraction remains the boundary; the example only reports derived
  mapping/prepared status.
- WebGPU remains the only backend path.
- No broad sampler API, route compatibility alias, IBL, shadows, binary GLB
  loading, or custom material authoring path was introduced.

## Recommendation

Proceed to tracker/backlog alignment. A visual wrap/repeat proof can stay
deferred until a task explicitly asks for UV/out-of-range sampling behavior.
