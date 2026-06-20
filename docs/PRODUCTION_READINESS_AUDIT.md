# Production-Readiness Audit

Status: plan

_Last updated: 2026-06-20_

This document records an independent, full-repository production-readiness audit
of the Aperture engine (all 11 `packages/*`, ~280k LOC), plus the remediation
work completed in the same pass. It was produced by reading the source directly
rather than relying on the repository's own roadmap docs.

## Verification snapshot

| Gate                          | Result at audit time | After remediation                |
| ----------------------------- | -------------------- | -------------------------------- |
| `pnpm run typecheck` (tsc -b) | ✅ passes            | ✅ passes                        |
| `pnpm test` (vitest)          | ✅ 3505 pass         | ✅ pass (+ new regression tests) |
| `pnpm run lint` (eslint)      | ❌ 16 errors         | ✅ passes                        |
| `pnpm run typecheck:test`     | ❌ pre-existing\*    | ❌ pre-existing\*                |

\* `typecheck:test` fails with ~104 errors in this environment, concentrated in
untouched source (`packages/physics/src/ecs-sync.ts`,
`packages/render/src/rendering/extraction-*.ts`, …). They are all
`Float32Array<ArrayBufferLike>` generic-TypedArray and `exactOptionalPropertyTypes`
mismatches introduced by the installed TypeScript (`^6.0.3`, which made
`TypedArray`s generic over their buffer type). The build gate (`tsc -b`) is
green, so this is a type-checker/lib-version drift in the test tsconfig, not a
defect introduced by this audit.

**Update:** resolved in a follow-up — the math storage types are now branded as
`Float32Array & <tuple>` (so vector element access types as `number` and stays
assignable to `number[]`), and the `Float32Array` ⇄ `number[]` /
`exactOptionalPropertyTypes` call sites across source and tests were adapted.
`pnpm run check` (including `typecheck:test` and `format:check`) is now green.

## Remediation completed in this pass

- **Lint gate is green.** Removed unused imports/vars across
  `packages/app`, `packages/render`, and `packages/webgpu`, converted an empty
  interface to a type alias, `let`→`const`, ignored the vendored Three.js
  comparison files (`shadow-lab/src/compare/three.*.js`), added a scoped
  `/* global HTMLCanvasElement */` for a Playwright `page.evaluate` block, and
  removed `any` from the WebGPU report tests.
- **C1 fixed** — see below (SAB transport now returns owned copies).
- **C2 fixed** — see below (worker tick-loop errors now propagate).
- **C4 fixed** — see below (vite-plugin emits COOP/COEP headers).

Each fix ships with a regression test.

---

## Critical findings

### C1 — SharedArrayBuffer transport tore under load _(FIXED)_

`packages/runtime/src/shared-snapshot-transport.ts`

The reader returned `.subarray()` **views** into the 2-buffer shared ring. The
seqlock only guarded the header/offset read, not the consumer's later use of the
views. The WebGPU consumer passed those views straight through
(`packages/webgpu/src/app/app-snapshot-transport.ts`) and retained them across
an `await` GPU upload and across frames (`create-webgpu-app.ts`
`previousSnapshotForUpdate`). Because the worker ticks up to 240 Hz versus a
~60 Hz render loop, the writer recycled the buffer the renderer was still
reading → corrupted transforms mid-upload and corrupted frame-to-frame diffs.

**Fix:** the reader now copies each payload out via `slice` (a fresh, non-shared
buffer) _before_ the final seqlock re-validation, so the lock covers the data
read and the consumer receives owned copies it can safely hold. Trade-off: one
copy per `readLatestFrame()` (allocation on the read path). A follow-up could
pool reader-side scratch if profiling shows GC pressure. Regression test:
`test/runtime/shared-snapshot-transport.test.ts` ("returns payload copies the
writer cannot overwrite").

### C2 — Worker steady-state tick errors were uncaught _(FIXED)_

`packages/app/src/worker/loop.ts`

The loop's `try/catch` only covered startup. `tick()` was rescheduled
asynchronously, so a throw in a per-frame system / `publishSnapshot` escaped, the
reschedule never ran, and the main thread was never told — the simulation froze
silently.

**Fix:** the per-tick body is wrapped in `try/catch`; on failure the loop halts,
disposes the scheduler, and posts a `SIMULATION_WORKER_PROTOCOL.error` with an
`aperture.generatedWorker.tickFailed` diagnostic (matching the existing
startup-error semantics). Regression test:
`test/app/generated-worker-start.test.ts` ("reports a steady-state tick failure
instead of freezing silently").

### C3 — No GPU resource teardown; textures leak during normal use _(OPEN)_

`packages/webgpu/src/app/`

`WebGpuApp` exposes `start()`/`stop()` but no `dispose()`; `stop()` never calls
`device.destroy()` and `resource-cache.ts` holds ~25 unbounded `Map` caches with
no eviction. Versioned texture/sampler caches
(`app-texture-sampler-resources.ts`) create a new `GPUTexture` on every asset
version bump and never destroy the superseded one, so video/streamed/hot-reloaded
textures leak one GPU texture per update during _normal_ operation.
`GeneratedBrowserApp` (`packages/app/src/browser/app.ts`) has no teardown at all
(worker, RAF loop, and DOM listeners leak for the page lifetime).

**Recommended:** add a `dispose()` to `WebGpuApp` that destroys cached GPU
objects and the device; destroy superseded textures on version bump; add a
teardown method to `GeneratedBrowserApp` that terminates the worker, cancels
RAF, and removes listeners. This is the top remaining blocker for long-running
or multi-instance use.

### C4 — Scaffolded apps crashed on first run (no COOP/COEP) _(FIXED)_

`packages/vite-plugin/src/index.ts`

The transport hard-throws when `crossOriginIsolated !== true`, but the plugin set
no `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers, and the
scaffold did not either, so `aperture create` → `pnpm run dev` threw on startup.

**Fix:** the plugin now adds a `config` hook that sets COOP (`same-origin`) and
COEP (`require-corp`) headers for both the dev server and `vite preview`,
controllable via a new `crossOriginIsolation` option (default `true`). The
scaffolded `vite.config.ts` already uses `aperture({...})`, so generated apps get
cross-origin isolation automatically. Regression test:
`test/vite-plugin/cross-origin-isolation.test.ts`. Note: production static hosts
still need the same headers (e.g. a `_headers` file, as in `showcase/racing`).

---

## High findings (open)

- **H1 — Device-lost is unhandled** in the render loop (only handled at init,
  `packages/webgpu/src/gpu/initialize-webgpu.ts`); a lost device is swallowed and
  the RAF loop keeps scheduling against a dead device.
- **H2 — Particle authoring API is partial but reports assets as valid.**
  `duration`, `looping`, `prewarm`, `emissionRate`, asset-authored `bursts`, and
  `atlasFrameCount > 1` are accepted and silently ignored
  (`packages/render/src/assets/particles.ts`); the only signal is an opt-in
  `runtimeFeatures` diagnostics report.
- **H3 — Physics "for now" limitations silently fail by default.** `breakForce`,
  `motorMaxForce`, generic joints, `frameB`, and mesh/asset colliders without a
  geometry provider are no-ops (the collider case _destroys_ the body). The
  diagnostics are only returned in a report; nothing logs/warns by default
  (`packages/physics/src/backend.ts`). Recommend a throttled dev-mode warning
  when `unsupportedFeatureCount > 0`.
- **H4 — Rapier backend doesn't deliver the determinism its API implies.**
  `build` is hardcoded `"performance"`; the `"deterministic"` enum value is
  unreachable and solver/integration params are never configured
  (`packages/physics-rapier/src/backend.ts`).
- **H5 — Misleading "readiness" diagnostics.** A vestigial planning layer
  hardcodes `shaderSampling: false` / `passSubmission: false` and emits
  "not implemented yet" for shadows & IBL that _are_ implemented and wired
  (callers pass `"ready"`, bypassing the dead branch). Tooling gating on these
  reports draws false conclusions.
- **H6 — Audio autoplay rejections unhandled.** `resume()`/`suspend()` are
  awaited with no `try/catch` and called fire-and-forget from gesture handlers
  (`packages/audio/src/index.ts`).
- **H7 — `slerp` calls `Math.acos` without a domain clamp**
  (`packages/math/src/kernel/quat.ts`); float rounding pushes `cosOmega > 1` →
  `NaN`.

## Medium / Low (open, selected)

- No backpressure/dropped-frame signal in the transport; SAB capacity overflow
  falls back to the transferable path silently and forever, allocating per frame.
- Hot-path GC churn: per-frame Maps/Sets + per-entity matrices in render
  interpolation; `entityVersionKey` string allocations.
- `lerpAngle` can hang on non-finite input (unbounded `while`,
  `packages/math/src/scalars.ts`); `normalize` of a zero vector returns
  `(0,0,0)`.
- CLI ships heavy hard deps (`playwright`, `ts-morph`, `vite`, `tar`) for a tool
  whose headline feature is scaffolding; no per-package `engines` field.
- GLTF loader rejects cross-origin external buffers and data-URIs (loud);
  `distance` joint maps to a Rapier rope (max-distance, not bilateral).

## Bottom line

The engine core (ECS, fixed-step scheduling, transform resolution, the actual
shadow/IBL/clustered-lighting GPU paths, physics integration/teardown, audio) is
solid and thoroughly tested. The "not implemented yet" grep noise is mostly a
stale planning layer, not missing functionality. With C1/C2/C4 fixed and the lint
gate green, the largest remaining shippability blocker is resource teardown (C3),
followed by device-lost recovery (H1) and surfacing the silent particle/physics
feature gaps (H2/H3).
