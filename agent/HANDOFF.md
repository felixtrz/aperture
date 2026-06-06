# Handoff — Rapier Physics Worker Action Route

**Updated:** 2026-06-06 09:49 PDT

This run kept the physics line Rapier-first, refactored oversized physics
backend entrypoints, and moved the dedicated worker route from a body-packet
proof toward a real backend-owned action surface.

## Completed

- Commit `dc63a842` adds the Rapier dedicated-worker action protocol, proxy
  methods, backend endpoint dispatch, dedicated-worker example handling, focused
  protocol/proxy tests, and browser worker-mode proof updates.
- Commit `22e1df82` refactored `packages/physics-rapier/src/index.ts` into a
  small public barrel plus focused backend modules, and split the deterministic
  test backend the same way.
- The dedicated Rapier worker protocol now has action/result messages for
  backend-owned raycasts, overlap/shape/point queries, character movement,
  sleep/wake controls, and debug geometry.
- `createPhysicsWorkerTransferProxy(...)` exposes those actions as async
  methods, while `createPhysicsWorkerBackendEndpoint(...)` dispatches them
  against the worker-owned backend with unsupported-capability fallbacks.
- `examples/physics-worker-mode.*` and the dedicated mode in
  `examples/physics-settling.worker.js` now request real worker-side raycast and
  debug-geometry data instead of deriving fake debug markers from transferred
  ECS body state.
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

- `pnpm run check` passed with 444 test files and 2478 tests.
- `pnpm exec playwright test test/e2e/physics-worker-mode.spec.ts` passed.
- Focused checks also passed during the slice:
  `pnpm exec vitest run test/physics/worker-protocol.test.ts test/runtime/physics-worker-transfer.test.ts`;
  `node --check examples/physics-settling.worker.js && node --check examples/physics-worker-mode.physics-worker.js && node --check examples/physics-worker-mode.main.js`.

## Current State

Physics is Rapier-first. The primary gameplay route is still the simulation
worker: ECS authoring produces backend-neutral commands, Rapier steps at the
fixed-step boundary, and writeback mutates ECS state before render extraction.
The dedicated physics-worker path is now a Rapier transferable route with
off-thread step/writeback and worker-owned query/debug/control actions. It
should still not become the default route until larger-scene profiling shows the
extra protocol is worthwhile for Aperture.

## Known Gaps

- Mesh/heightfield collider cooking remains unsupported and is reported
  explicitly.
- Generic joints, automatic break-force enforcement, native joint impulse
  readback, motor force limits, and paired non-fixed body-B frame semantics
  remain unsupported.
- The dedicated physics worker now owns the core backend query/control/debug
  hooks, but still needs larger-scene profiling and broader gameplay/E2E
  coverage before it should displace the generated simulation-worker workflow.

## Recommended Next Task

Add a larger-scene Rapier dedicated-worker benchmark/proof route that compares
simulation-worker and dedicated-worker latency, transfer bytes, query timing,
and debug-geometry costs under body-heavy, query-heavy, and character-heavy
pressure.
