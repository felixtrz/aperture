# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3157` — add clustered-light cache pressure history to
clustered-lights.

Status: `task-3156` completed the transparent sort pressure proof route and
closed a render-bundle pipeline identity validation issue.

Key findings:

- `examples/standard-queue-phases.html?transparent-pressure=1` now renders 32
  dense alpha-blend StandardMaterial surfaces and reports record count,
  depth-order inversions, render-order tie-breaks, stable-id tie-breaks, camera
  phase, and order signatures.
- Transparent queue records are no longer coalesced before draw-list creation,
  preserving per-object transparent sort order under dense overlap pressure.
- WebGPU draw planning now carries actual renderer pipeline resource keys per
  render id so default-layout bind groups are scoped to the pipeline object used
  by render bundles, while authored pipeline keys still drive feature detection
  and required bind-group groups.
- The pressure route passed browser proof when run directly through Playwright,
  and the default route returned clean direct browser status with zero relevant
  WebGPU validation warnings. The headed full Playwright spec remains locally
  prone to runner hangs, so rerun focused routes if investigating CI behavior.
- The hard SOTA claim should still wait on clustered-light cache pressure
  history and broader profiling polish.

Next step: implement `task-3157`.

Reference anchors for `task-3157`:

- `references/engine/src/scene/lighting/world-clusters.js`.
- `references/engine/src/scene/renderer/frame-pass-update-clustered.js`.
