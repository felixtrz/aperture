# Current Task

No active task is currently checked out.

Status: task-3166 split-screen multi-camera route completed.

Key findings:

- `examples/split-screen-multi-camera.html` now renders two ECS-authored
  cameras over one worker-owned world using WebGPU viewport/scissor regions.
- The route reports two extracted views, two viewport/scissor pixel regions,
  two per-view command plans, truthful render-control capabilities, and zero
  diagnostics in the browser proof.
- Playwright samples both halves and verifies the two camera views produce
  distinct non-clear pixels.
- `pnpm run render-control:smoke-all` includes the route and reports zero
  route status failures and zero warning routes across 50 example pages.

Recommended next task:

- `task-3167` — add an orthographic camera projection route.
