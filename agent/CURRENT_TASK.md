# Current Task

No active task is required for the persistent render shell goal.

Status: `task-3160` completed the persistent render shell for scenario-swap
proofs.

Key findings:

- `examples/persistent-render-shell.html` creates one canvas-backed
  `createWebGpuApp(...)` instance and keeps it alive while fresh ECS/extraction
  workers reset underneath it.
- The focused shell proof runs `transparent-pressure` and
  `clustered-pressure-history` in one Playwright page without navigation or
  renderer recreation.
- Per-scenario status includes scenario id/run id, frame count, elapsed time,
  renderer identity, readback evidence, worker transport evidence, and a
  WebGPU-warning list.
- Standalone route tests remain necessary for cold-start coverage; shell mode
  is for renderer-lifetime reset/stress coverage.

Recommended future task:

- `task-3161` — add cross-device benchmark automation for post-SOTA hardening,
  using shell mode where it reduces page/device churn and standalone routes for
  first-frame boot coverage.
