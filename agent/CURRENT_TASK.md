# Current Task

No active task is currently checked out.

Status: task-3167 orthographic camera route completed.

Key findings:

- `examples/orthographic-camera.html` now renders one perspective reference and
  two orthographic cameras at different distances over the same worker-owned ECS
  plane.
- The shared multi-view WebGPU path now routes by page, so split-screen and
  orthographic proofs both use the same per-view viewport/scissor submission
  logic.
- Playwright verifies the near and far orthographic views keep the same sampled
  object footprint while outside-edge samples remain clear.
- `pnpm run render-control:smoke-all` includes both multi-view routes and
  reports zero route status failures and zero warning routes across 51 example
  pages.

Recommended next task:

- `task-3168` — add a line/wire primitive rendering route.
