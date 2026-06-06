# Handoff — Rapier Physics + M6 Content Checkpoints

**Updated:** 2026-06-06 09:05 PDT

This run committed the older M6 content/rendering work and the current M10
Rapier-first physics work.

## Completed

- Commit `58df7607` adds the render/content slice: MSDF text atlas handling,
  UI quad extraction/rendering, GPU particle assets/pipeline, content showcase,
  UI interaction, sprite follow-up coverage, quad snapshot transport support,
  and focused render/WebGPU/E2E tests.
- Commit `73c29a62` adds the physics/runtime slice: `@aperture-engine/physics`,
  `@aperture-engine/physics-rapier`, fixed-step runtime/app scheduling,
  ECS physics authoring and serialization, generated-worker pause/step/diff
  physics tools, Rapier simulation-worker examples, benchmark route, and the
  Rapier transferable dedicated-worker proof route.
- The Havok adapter package and tests were removed before the physics commit.
  The package graph, import maps, benchmark example, generated-worker test
  surface, and source config now ship only deterministic test physics plus
  Rapier as concrete backends.
- Generic joint descriptors now report `physics.joint.unsupported` and remove
  stale backend joints instead of throwing or leaving stale constraints in the
  deterministic and Rapier backends.

## Validation Run

- `pnpm exec vitest run test/rendering/particle-emitter-extraction.test.ts test/webgpu/particle-frame-resources.test.ts test/webgpu/particle-pipeline.test.ts test/rendering/msdf-font-atlas.test.ts test/webgpu/msdf-text-frame-resources.test.ts test/webgpu/msdf-text-pipeline.test.ts test/rendering/ui-hit-test.test.ts test/rendering/ui-layout-extraction.test.ts test/webgpu/ui-frame-resources.test.ts test/webgpu/ui-quad-pipeline.test.ts test/app/ui-interaction-route.test.ts test/webgpu/app-snapshot-transport.test.ts`
- `pnpm exec vitest run test/physics/components.test.ts test/physics/component-validation.test.ts test/physics/fixed-step-clock.test.ts test/physics/test-backend.test.ts test/physics/character-controller.test.ts test/physics/benchmark.test.ts test/physics/worker-protocol.test.ts test/physics-rapier/rapier-backend.test.ts test/physics-rapier/benchmark.test.ts test/runtime/fixed-step-schedule.test.ts test/runtime/physics-authoring-helpers.test.ts test/runtime/physics-worker-transfer.test.ts test/runtime/simulation-worker.test.ts test/app/fixed-step-app.test.ts test/app/physics-access.test.ts test/app/physics-authoring.test.ts test/app/physics-spatial-source.test.ts test/app/generated-worker-start.test.ts test/serialization/physics-scene-document.test.ts test/scripts/serve-examples.test.mjs`
- `pnpm exec tsc -p tsconfig.test.json --noEmit --pretty false`
- `pnpm run build`

## Current State

Physics is Rapier-first. The primary gameplay route is still the simulation
worker: ECS authoring produces backend-neutral commands, Rapier steps at the
fixed-step boundary, and writeback mutates ECS state before render extraction.
The dedicated physics-worker path exists as a Rapier transferable proof
(`examples/physics-worker-mode.*` and `packages/physics/src/worker-transfer.ts`)
but should not be treated as the default route until profiling and gameplay
query semantics justify the extra protocol.

## Known Gaps

- Need to run the broader E2E suite after docs/status cleanup.
- Mesh/heightfield collider cooking remains unsupported and is reported
  explicitly.
- Generic joints, automatic break-force enforcement, native joint impulse
  readback, motor force limits, and paired non-fixed body-B frame semantics
  remain unsupported.
- The dedicated physics worker does not yet own the full gameplay query surface
  that the simulation-worker route exposes.

## Recommended Next Task

Run the full validation/check suite, update the public tracker/status files,
then push the committed feature slices.
