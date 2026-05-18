# glTF Sampler Wrap Visual Proof Implementation Audit

Date: 2026-05-18

Task: `task-1568`

## Scope

Audit the `task-1567` implementation that added
`scenario=valid-repeat-sampler` to the StandardMaterial glTF browser fixture.

## Findings

- The proof stays focused on one wrap behavior: valid glTF `wrapS: 10497`
  maps to WebGPU `addressModeU: "repeat"` while `wrapT: 33071` remains
  `addressModeV: "clamp-to-edge"`.
- The fixture uses a constant out-of-range UV of `{ u: 1.25, v: 0.25 }`, so
  the center canvas/readback sample must resolve the wrapped left texel instead
  of the clamped right-edge texel.
- The Playwright assertion checks both JSON-safe sampler mapping status and
  rendered pixels. Readback is asserted when available, and screenshot pixels
  are always compared against the rejected clamp color.
- The implementation touched only the glTF browser fixture and its e2e test.
  It did not add a sampler matrix, change shader code, alter package
  boundaries, introduce backend state into ECS, or add any WebGL fallback.

## Boundary Check

- ECS authority is preserved: renderability still comes from ECS components and
  typed source assets registered into the app asset collections.
- Render extraction boundaries are preserved: the WebGPU backend consumes the
  app render report/snapshot path rather than reading simulation state directly.
- GPU ownership is preserved: sampler and texture resources are created inside
  the WebGPU app path from prepared source assets.
- The proof remains a StandardMaterial/glTF fidelity slice, not a broader
  material-family route or GLB-loading change.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "valid repeat sampler"`

## Recommendation

Proceed to tracker/backlog alignment. The next implementation follow-up should
be selected after the tracker reflects that glTF sampler wrapping now has a
visual browser proof.
