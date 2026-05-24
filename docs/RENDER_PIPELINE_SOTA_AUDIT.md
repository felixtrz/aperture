# Render Pipeline SOTA Audit

Updated: 2026-05-24

## Scope

This audit covers Aperture's implemented WebGPU render pipeline lanes:

- ECS snapshot extraction into a renderer-owned WebGPU view.
- StandardMaterial forward rendering, including covered glTF/PBR features.
- Queue/sort/submit efficiency for opaque, alpha-test, transparent, bundled,
  indirect, grouped, instanced, batched, and multi-material draw paths.
- Covered post/temporal stack: TAA transform history, bloom, transmission
  grabs, and depth-fed screen-space effects.
- Covered environment/lighting stack: multi-environment IBL, CSM plus IBL,
  RectAreaLight LTC, clustered local lights, clustered local shadows, cookies,
  shadow/cookie atlases, and cache pressure.

It does not claim unsupported features are SOTA. Remaining out-of-scope or
future-hardening areas include public app-owned material adapter rendering,
broader imported GLB multi-material fixtures, WebXR, physics, editor tooling,
and production-scale cross-device benchmark automation.

## Reference Comparison Summary

- three.js `Renderer` keeps general render lists, sorting, render-bundle hooks,
  and backend-managed render objects. Aperture now matches the relevant covered
  queue/bundle/sort behavior while preserving ECS as the source of truth and
  exposing app-visible pressure reports for state commands, bundles, bind
  groups, indirect draws, and transparent ordering.
- PlayCanvas `FramePassUpdateClustered` drives local shadow/cookie passes and
  world-cluster updates, and `WorldClusters` uses light cell ranges to fill
  clustered light data. Aperture now matches the relevant clustered-light shape
  for covered StandardMaterial routes, then adds per-view route splitting,
  WebGPU storage-buffer-backed metadata, minimum-limit packed shadow/cookie
  routes, cache-hit skipping, and rolling avoided-work proof telemetry.

## Evidence Table

| Lane                          | Evidence                                                                                                                                                                                                                                                                   | SOTA decision                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECS/render boundary           | Worker-owned examples, transferable/SAB snapshot transport, render packet inspector, change-set/update schedule reports, no mutable scene graph as renderer source of truth.                                                                                               | Supported. This is beyond three.js scene graph coupling and preserves future worker-thread simulation.                                                                        |
| Queue and draw pressure       | `task-3111` through `task-3115`, `task-3156`; `standard-queue-phases.html?transparent-pressure=1`; queue/submit unit suite with 114 passing tests.                                                                                                                         | Supported for covered routes: state-command elision, render bundles, indirect grouped draws, state-aware ordering, bind-group reuse, and transparent pressure are all proven. |
| Transparent sorting           | Dense 32-record alpha-blend route reports zero depth-order inversions before/after a camera move and preserves per-object transparent records.                                                                                                                             | Supported for the covered alpha-blend path; the proof is stronger than a diagnostic-only sort check.                                                                          |
| Temporal/post stack           | TAA object transform history, bloom downsample/upsample graph, transmission grabs/filtering, texture-backed PBR extensions, and depth-fed post effects are implemented and browser-proven in focused routes.                                                               | Supported for covered effects. Broader cinematic post features remain outside this claim.                                                                                     |
| Environment and area lighting | Multi-environment IBL, CSM plus IBL, and production RectAreaLight LTC tables are implemented through renderer-owned resources and browser-proven routes.                                                                                                                   | Supported for covered StandardMaterial lighting.                                                                                                                              |
| Clustered local lights        | `clustered-lights.html` proves per-view view/depth clusters, light-driven cluster filling, point/spot shadows, cookies, multi-cookie arrays, atlas packing, mixed shadow/cookie routes, and minimum-limit packed metadata paths.                                           | Supported. Aperture now matches the relevant PlayCanvas clustered-light shape and is ahead of three.js's covered lane.                                                        |
| Clustered cache pressure      | `clustered-lights.html?enable-cluster-pressure-history=1` reports 30-frame cached-path vs derived no-cache baseline totals for avoided clustered-buffer writes, skipped cookie-atlas tile updates, and skipped local-shadow submissions while readback pixels stay stable. | Supported. This closes the last identified clustered efficiency blocker.                                                                                                      |
| Profiling visibility          | `gpu-profiler.html?phase-history=1` reports extract/collect/prepare/queue/sort/submit CPU history beside GPU pass timing. Direct Playwright probe returned six phase rows, sample counts of 2, changed phase values of 6, diagnostics `0`, and zero WebGPU warnings.       | Supported. Playwright's headed test wrapper can still wedge locally, but the route itself is proven.                                                                          |
| Proof harness                 | `test/e2e/persistent-route-harness.ts` runs clustered routes through one page with route reset, status/readback/frame/timing attachments, and route-local warning slices.                                                                                                  | Supported as validation infrastructure for repeated route proofs.                                                                                                             |

## Validation Run

- `pnpm exec playwright test test/e2e/clustered-lights.spec.ts -g "cache pressure history|persistent route harness" --timeout=60000 --reporter=line` — 2 passed.
- `pnpm exec playwright test test/e2e/standard-queue-phases.spec.ts -g "transparent pressure" --timeout=60000 --reporter=line` — 1 passed.
- Direct Playwright probe for `examples/gpu-profiler.html?phase-history=1&proof=direct-final-audit` — `ok: true`, `routePhaseHistoryReady: true`, six phase rows, diagnostics `0`, warnings `[]`.
- `pnpm exec vitest run test/webgpu/draw-command.test.ts test/webgpu/render-frame-plan.test.ts test/webgpu/queued-material-frame-resource-set.test.ts test/webgpu/queued-built-in-frame-resource-set.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-pipeline.test.ts test/rendering/render-queue.test.ts` — 114 tests passed.
- `pnpm exec tsc -p tsconfig.test.json --noEmit` — passed.
- `pnpm run build` — passed.
- `pnpm run check:progress` — passed.

## Decision

Within the implemented scope above, Aperture's render pipeline can now be
considered SOTA against the audited three.js and PlayCanvas lanes. The claim is
bounded to covered features and is backed by executable proof routes, unit
coverage, app-visible pressure reports, and renderer-owned WebGPU resource
paths.

Future work should improve benchmark automation and broaden unsupported feature
coverage, but no remaining blocker prevents the covered-pipeline SOTA claim.
