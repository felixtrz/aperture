# Environment-Map Readiness Report Audit

Date: 2026-05-18

## Scope

Audit the `task-1227` implementation of the environment-map readiness report.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_FRAME_READINESS.md`
- `docs/research/NEXT_LIGHTING_ENVIRONMENT_READINESS_CONTRACT_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/environment-map-readiness.ts`
- `packages/webgpu/src/webgpu/environment-resource-planning.ts`
- `test/webgpu/environment-map-readiness.test.ts`
- `references/engine/src/extras/render-passes/frame-pass-camera-frame.js`
- `references/three.js/src/extras/PMREMGenerator.js`
- `references/three.js/src/renderers/WebGLRenderer.js`

## Findings

Pass. The implementation stayed within the selected readiness/reporting scope.

`createEnvironmentMapReadinessReport()` derives its data from extracted
`EnvironmentPacket[]` or `RenderSnapshot.environments` via the existing
`planEnvironmentResources()` helper. It reports packet counts, null-handle
counts, required environment-map resource keys, optional renderer-owned resource
presence, and stable warning diagnostics for missing renderer resource keys.

The JSON helper omits raw `EnvironmentMapHandle` objects and does not expose
WebGPU textures, texture views, samplers, bind groups, backend cache maps,
source texture payloads, queues, encoders, or devices. The helper does not read
ECS state, mutate render-world state, create resources, upload environment maps,
add app report fields, render skyboxes, activate IBL shader sampling, or add
shadow passes.

The references reinforce the boundary: PlayCanvas and three.js treat
environment/skybox and PMREM work as renderer-side render-pass or texture
processing concerns. Aperture's current helper remains earlier in the pipeline:
it only explains extracted environment requirements and optional renderer
resource readiness.

## Validation

- `pnpm exec vitest run test/webgpu/environment-map-readiness.test.ts test/webgpu/environment-resource-planning.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Recommendation

Proceed to `task-1229`: add focused texture fidelity summary coverage for
`standardMaterialTexture.invalidColorSpaceFormat`. Keep IBL shader sampling,
skyboxes, environment texture upload, shadows, binary GLB loading, and broad app
route changes deferred.
