# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3155` — add render-pipeline phase timing history to the GPU
profiler.

Status: `task-3154` completed unchanged clustered local-light buffer write
skipping across frames.

Key findings:

- Aperture's covered clustered StandardMaterial pressure lane now reuses stable
  clustered shadow/cookie atlas resources, cached local shadow maps, and
  unchanged local-light params/cells/indices/metadata buffers across frames.
- `examples/clustered-lights.html?enable-cluster-buffer-cache=1` proves a
  changed cluster phase followed by a stable frame with zero clustered
  local-light buffer writes and 16 skipped clustered buffer writes across the
  two view/light routes.
- The hard SOTA claim should still wait on broader phase timing/pressure
  visibility. The render-pipeline tracker still lists sort at 90% because phase
  duration telemetry and broader batching/pressure history are missing.

Next step: implement `task-3155`.

Reference anchors for `task-3155`:

- `references/engine/src/extras/mini-stats/gpu-timer.js`.
- `references/engine/src/framework/stats.js`.
