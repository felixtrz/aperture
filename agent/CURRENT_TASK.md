# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: task-3119.

Status: Tier 20 is complete. The post-Tier-20 submit-efficiency and immediate
environment-preparation slices have shipped:

- `task-3111` closed redundant state-command emission.
- `task-3112` closed static command-plan render-bundle reuse.
- `task-3113` closed indirect grouped draws.
- `task-3114` closed state-aware opaque/alpha-test queue ordering.
- `task-3115` closed shared queued built-in bind-group reuse.
- `task-3116` closed previous per-object transform history for TAA motion
  vectors.
- `task-3117` closed the bloom downsample/upsample post-effect graph.
- `task-3118` closed broader environment asset preparation with versioned
  multi-environment diffuse/specular IBL resources.

Browser proof:

- `examples/materials-showcase.html` now prepares warm and cool ECS-authored
  environment handles as renderer-owned diffuse/specular IBL assets.
- Browser status reports two prepared environment assets, two ready assets,
  two diffuse/specular texture resources reused, four sampler resources reused,
  and two StandardMaterial IBL bind groups reused without raw GPU handles.
- The headed Playwright proof switches from
  `environment-map:materials-showcase-warm-studio` to
  `environment-map:materials-showcase-cool-studio`, observes distinct
  StandardMaterial cube pixels, and reports zero WebGPU validation warnings.

Next step: run `task-3119` from `agent/BACKLOG.md`, a fresh render-pipeline
parity audit against three.js and PlayCanvas to select the next visible SOTA
implementation slice.
