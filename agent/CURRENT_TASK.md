# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3156` — add a transparent sort pressure proof route.

Status: `task-3155` completed rolling CPU phase timing history in the GPU
profiler.

Key findings:

- Aperture's covered clustered StandardMaterial pressure lane now reuses stable
  clustered shadow/cookie atlas resources, cached local shadow maps, and
  unchanged local-light params/cells/indices/metadata buffers across frames.
- `examples/clustered-lights.html?enable-cluster-buffer-cache=1` proves a
  changed cluster phase followed by a stable frame with zero clustered
  local-light buffer writes and 16 skipped clustered buffer writes across the
  two view/light routes.
- `WebGpuApp` now reports rolling CPU phase timings for extract, collect,
  prepare, queue, sort, and submit.
- `examples/gpu-profiler.html?phase-history=1` renders those six phase rows
  with latest and rolling-average timings beside the existing GPU timestamp
  pass overlay.
- The hard SOTA claim should still wait on broader transparent-sort pressure
  proof coverage and clustered-light cache pressure history.

Next step: implement `task-3156`.

Reference anchors for `task-3156`:

- `references/three.js/manual/en/transparency.html`.
- `references/engine/src/scene/layer.js`.
