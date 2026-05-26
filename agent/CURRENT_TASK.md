# Current Task

No active task is currently checked out.

Status: task-3177 render-target reuse stress preview route completed.

Key findings:

- Added `examples/render-target-reuse.html` using the existing
  render-to-texture main/worker route family.
- The route renders two consecutive worker snapshots through the same
  renderer-owned off-screen WebGPU texture and ECS `ViewPacket.renderTarget`
  handle without resizing.
- Status reports requested/rendered frames, displayed frame, stable dimensions,
  target key, created-vs-reused texture pressure, and stale-first-frame status.
- Playwright verifies the second displayed preview is non-clear and comes from
  the centered second snapshot while the first snapshot had a different
  center-sample expectation.
- Focused render-to-texture browser coverage and static validation passed for
  this slice.

Recommended next task:

- `task-3178` — add a camera viewport resize matrix route.
