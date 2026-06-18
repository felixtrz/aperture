# FPS Starter Audit Fix Plan

**Created:** 2026-06-17
**Updated:** 2026-06-17
**Source:** Multi-agent audit of `b80e8a43b61e9b6a234e443c05ff8448c7bc471b` through `fps-starter-kit-port`.
**Status:** Batch 1 implemented; Batch 2 particle items implemented; remaining
Batch 2 and Batch 3 pending.

This plan converts the confirmed audit findings from the FPS starter-kit branch
into reviewable remediation batches. The goal is to fix the steady-state
correctness and resource-lifecycle issues first, then follow with visual,
developer-experience, and cleanup work.

The branch delivered meaningful FPS, shadow, material, post-processing,
particle, input, camera, and audio improvements. These fixes should preserve
that work. Do not use this plan as a rollback queue.

## Guiding Invariants

1. Every WebGPU allocation path must either use a persistent cache with explicit
   byte-size discipline or have a deterministic destroy path.
2. A cached GPU resource must be recreated, and the previous resource destroyed
   when its size, layout, or backing buffer identity changes.
3. Partial public API patches must preserve unspecified sibling fields unless
   the API explicitly documents reset semantics.
4. Visual-correctness fixes should be validated against FPS, Racing, and
   Shadow Lab where the touched feature affects those experiences.
5. Each batch should commit only one coherent class of fixes plus the tests that
   prove them.
6. Hot paths should avoid per-frame allocation when the relevant feature is not
   active; allocation fixes should include characterization tests when the code
   is otherwise under-covered.
7. The Aperture CLI and MCP harness must reset input completely, because stale
   synthetic input can corrupt later browser validation.

## Batch 1 - Shippability Fixes

**Status:** implemented 2026-06-17 on `fix/audit-resource-lifecycle`.

**Recommended branch:** `fix/audit-resource-lifecycle`

Fix the highest-risk confirmed issues before treating the merged FPS work as
shippable.

### 1. Shadow Baked-Caster Resource Leak

- Files:
  - `packages/webgpu/src/shadows/render-shadow-frame.ts`
  - Nearby shadow resource tests or new focused tests under `test/`
- Problem:
  - The baked caster matrix buffer and matching bind group are allocated every
    frame and are not cached or destroyed.
- Action:
  - Cache the baked caster matrix buffer by a stable key.
  - Reuse the buffer when the byte size matches.
  - Destroy and recreate the buffer when matrix count or byte size changes.
  - Cache the bind group with invalidation tied to the backing buffer identity.
- Acceptance:
  - A test proves the baked caster buffer is reused across two frames with the
    same matrix count.
  - A test proves the previous buffer is destroyed and replaced when the matrix
    byte size changes.
  - FPS and Racing still render directional shadows.

### 2. Shadow Matrix Buffer Size Guard

- Files:
  - `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts`
  - `test/webgpu` or the existing shadow matrix buffer test location
- Problem:
  - Cached matrix re-upload writes refreshed data into an existing buffer without
    checking whether the byte size still matches.
- Action:
  - Compare refreshed byte size against cached byte size before `writeBuffer`.
  - Reuse and re-upload only when sizes match.
  - Destroy and recreate the old buffer when sizes differ.
- Acceptance:
  - Constant matrix count reuses the cached buffer.
  - Matrix count changes recreate the buffer without out-of-bounds writes or
    stale tail data.

### 3. Particle State Eviction Buffer Leak

- Files:
  - `packages/webgpu/src/app/particles.ts`
  - Particle renderer tests
- Problem:
  - `cleanupParticleStates` deletes inactive state entries without destroying
    the associated `GPUBuffer`.
- Action:
  - Call `state.particleBuffer?.destroy?.()` before deleting inactive entries.
  - Check resize and teardown paths for the same ownership pattern.
- Acceptance:
  - A burst-churn or inactive-state test records one destroy call per evicted
    particle buffer.
  - Existing particle rendering tests still pass.

### 4. Audio Partial Lowpass Patch Contract

- Files:
  - `packages/app/src/systems/audio.ts`
  - Audio system tests
- Problem:
  - A frequency-only or q-only lowpass patch resets the unspecified sibling
    field to a hard default.
- Action:
  - Update `lowpassFrequency` only when frequency is explicitly supplied.
  - Update `lowpassQ` only when q is explicitly supplied.
  - Preserve current component values for omitted sibling fields.
- Acceptance:
  - A frequency-only patch preserves the previous q.
  - A q-only patch preserves the previous frequency.
  - Frequency-only and q-only automation are both covered, because the reported
    reproduction path routes through `automate({ lowpass: ... })`.

### 5. CLI Input Reset Completeness

- File: `packages/cli/src/tools/dispatch.ts`
- Problem:
  - `input_reset` releases only the left mouse button, leaving right or middle
    button state stuck after managed browser validation.
- Action:
  - Release all supported synthetic mouse buttons during input reset.
  - Keep keyboard and pointer-state reset behavior intact.
- Acceptance:
  - A CLI/tool test proves left, middle, right, and auxiliary button state is
    cleared by `input_reset`.
  - FPS pointer-locked smoke tests still receive clean input after reset.

### Batch 1 Validation

Run targeted tests while developing, then at minimum:

```sh
pnpm run typecheck
pnpm run build
pnpm exec vitest run <targeted-shadow-tests> <targeted-particle-tests> <targeted-audio-tests> <targeted-cli-tests>
```

If browser validation is available, smoke-test:

```sh
pnpm --dir fps run build
pnpm --dir racing run build
pnpm --dir shadow-lab run build
```

## Batch 2 - Confirmed Mediums

**Status:** partial. Items 4 and 5 implemented 2026-06-17 on
`fix/audit-resource-lifecycle`.

**Recommended branch:** `fix/audit-render-dev-mediums`

Handle confirmed medium-risk defects that are important but less urgent than
the resource leaks and API-contract bug.

### 0. Protect Intentional Visual Baselines

- Files:
  - `packages/webgpu/src/materials/standard/standard-shader.ts`
  - `packages/webgpu/src/post/post-bloom.ts`
  - Existing visual golden tests for affected routes
- Problem:
  - The FPS branch intentionally changed two visual contracts: ambient/indirect
    lighting is no longer shadow-attenuated, and bloom defaults align with the
    three.js-style threshold behavior. Future bloom or lighting fixes could
    accidentally revert those intentional changes.
- Action:
  - Re-baseline or explicitly document affected goldens before judging later
    bloom or lighting deltas.
  - Keep the bloom mip-size fix separate from any threshold-default change.
- Acceptance:
  - Golden updates, if any, name the intentional visual contract they preserve.
  - Bloom blur-radius fixes do not alter the intended threshold default.

### 1. Bloom Blur Mip Texel Size

- File: `packages/webgpu/src/post/post-bloom.ts`
- Problem:
  - Blur sampling uses the input texture texel size instead of the output mip's
    inverse size, reducing blur radius at higher mips.
- Action:
  - Pass or derive the target mip dimensions for each blur pass.
  - Match the three.js BloomNode-style mip behavior without adding a magic
    fallback.
- Acceptance:
  - Focused bloom test or golden verifies stable blur radius across mip levels.
  - Existing bloom routes still pass.

### 2. Vite Worker Entry HMR Staleness

- File: `packages/vite-plugin/src/virtual-modules.ts`
- Problem:
  - Adding or removing a system can leave the generated physical worker entry
    stale until a full dev refresh.
- Action:
  - Ensure system graph changes invalidate/regenerate the generated worker
    entry.
  - Add plugin-level coverage for added and removed system files if practical.
- Acceptance:
  - Dev HMR sees a newly added system without requiring a full browser refresh.
  - Dev HMR stops serving a removed system after invalidation.

### 3. Sprite-Only Depth Mode

- File: `packages/webgpu/src/app/sprite-frame.ts`
- Problem:
  - Sprite-only rendering ignores per-batch `depthMode`, so
    `depthMode: "disabled"` sprites can still be depth-tested in mesh-less
    scenes.
- Action:
  - Route sprite-only batches through the same depth-state selection used by
    mixed render paths.
- Acceptance:
  - A mesh-less sprite test verifies `depthMode: "disabled"` does not depth-test.
  - Existing sprite and trail rendering tests still pass.

### 4. Particle Burst TTL Time Scale

**Status:** implemented 2026-06-17 on `fix/audit-resource-lifecycle`.

- File: `packages/render/src/rendering/particle-burst-queue.ts`
- Problem:
  - Burst expiration uses fixed-frame TTL and ignores `request.timeScale`.
- Action:
  - Apply time scale consistently when calculating burst lifetime.
  - Preserve deterministic expiration across fixed-step and render-interpolated
    execution.
- Acceptance:
  - Slow-motion and faster-time tests verify burst TTL scales as expected.

### 5. Particle Runtime Feature Analysis Cache

**Status:** implemented 2026-06-17 on `fix/audit-resource-lifecycle`.

- File: `packages/app/src/worker/assets.ts`
- Problem:
  - `analyzeParticleEffectRuntimeFeatures` is recomputed every frame for
    immutable particle descriptors, causing avoidable `Set` and array
    allocation per particle asset.
- Action:
  - Cache runtime feature analysis by particle asset identity or version.
  - Invalidate only when the underlying descriptor changes.
- Acceptance:
  - Repeated frames with unchanged particle assets reuse the analysis result.
  - Descriptor changes invalidate the cached analysis.

### 6. Render Interpolation Allocation And Characterization

- File: `packages/app/src/render-interpolation.ts`
- Problem:
  - Render interpolation allocates an unconditional per-draw `Set` even when no
    entities are interpolated, and the parent-chain resolver, cycle guard, and
    view-matrix interpolation paths are under-covered.
- Action:
  - Avoid per-draw allocation when interpolation is inactive for the relevant
    entity/draw.
  - Add characterization tests for parent-chain interpolation, cycle handling,
    view-matrix interpolation, and the zero-interpolated-entity fast path.
- Acceptance:
  - A render snapshot with zero interpolated entities avoids the per-draw
    allocation path.
  - Characterization tests lock down parent-chain, cycle-guard, and camera view
    interpolation behavior before further refactors.

### Batch 2 Validation

```sh
pnpm run typecheck
pnpm run build
pnpm exec vitest run <targeted-bloom-tests> <targeted-vite-tests> <targeted-sprite-tests> <targeted-burst-tests> <targeted-worker-asset-tests> <targeted-render-interpolation-tests>
```

Also run live smoke checks for FPS, Racing, and Shadow Lab if any visual render
path changes affect them.

## Batch 3 - Visual And Performance Cleanup

Use this batch only after Batch 1 and Batch 2 are green.

### 1. Trail Bounds Shrinkage

- File: `packages/app/src/systems/trails.ts`
- Problem:
  - Ribbon bounds grow monotonically and never shrink, permanently defeating
    frustum culling for long-running trails.
  - Trail flushing also re-uploads the full max-capacity vertex buffer each
    frame instead of the active range.
- Action:
  - Recompute bounds from the active ring-buffer window or maintain a bounded
    incremental structure that can shrink when old samples expire.
  - Reduce trail upload size to the active vertex range when possible.
- Acceptance:
  - Bounds shrink after old trail samples age out.
  - Flushes upload active trail data rather than the full maximum capacity.
  - Racing trails remain visually stable.

### 2. Continuous Particle Auto-Bounds Parity

- File: `packages/render/src/rendering/extraction-particles.ts`
- Problem:
  - Continuous auto-bounds are larger than the shader behavior, causing wasted
    culling area and noisy `boundsLarge` diagnostics.
- Action:
  - Align CPU-side bounds estimation with the shader's actual motion envelope.
- Acceptance:
  - Bounds match the intended shader envelope within a documented tolerance.
  - Existing particle diagnostics remain actionable.

### 3. Diagnostic Double Counting And Report Inflation

- Files:
  - `packages/render/src/rendering/extraction-meshes.ts`
  - `packages/webgpu/src/app/particles.ts`
- Problem:
  - Shared mutable accumulators can double-count caster diagnostics or inflate
    particle frame reports.
- Action:
  - Split pass-local diagnostics from frame-global reporting.
  - Avoid reusing mutable report objects across logically separate passes.
- Acceptance:
  - Diagnostics counts are stable and not duplicated by caster extraction.
  - Particle frame reports reflect the current frame, not shared reuse totals.

## Deferred Low-Severity Cleanup

Defer low-severity cleanup until after the confirmed functional issues are
fixed and verified. Candidates include:

- Removing the bloom `radiusPixels` legacy shim once all callers use the modern
  radius API.
- Removing dead packed-quad codec compatibility sentinels if no serialized data
  depends on them.
- Removing unused world-globals start-option bridge code.
- Fixing `packages/cli/src/bin/aperture.ts` so the write queue does not abort
  all remaining output on the first write error.
- Tightening quaternion validation if a live public authoring path requires it.
- Deduplicating concurrent asset `request()` calls if load amplification becomes
  observable.

## Commit Strategy

1. Commit Batch 1 as one coherent shippability fix if all targeted tests pass.
2. Commit Batch 2 separately to keep render/dev-server behavior reviewable.
3. Split Batch 3 by subsystem if trail, particle-bounds, and diagnostic changes
   each require separate visual validation.
4. Do not include unrelated screenshot artifacts, parity directories, or local
   verification scripts in these commits unless they are intentionally promoted
   into tests or documentation.

## Recommended Next Step

Start with Batch 1. The shadow resource lifecycle fixes and particle buffer
destroy path directly protect FPS and Racing steady-state behavior, while the
audio patch restores the documented incremental update contract with low
implementation risk.
