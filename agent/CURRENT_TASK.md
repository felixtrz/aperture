# Current Task

No active task is currently checked out.

Status: task-3168 line primitive route completed.

Key findings:

- `createLineListMeshAsset(...)` is now exported through
  `@aperture-engine/core`, producing typed indexed `line-list` mesh assets with
  bounds and material slots.
- The unlit WebGPU pipeline descriptor and browser bridge now preserve
  `line-list` topology instead of hard-coding triangle-list.
- `examples/line-primitives.html` renders two indexed ECS-authored colored line
  sets through the same extraction, prepared-resource, render-world, draw-list,
  and WebGPU command path as mesh examples.
- Playwright verifies cyan and amber line samples are non-clear while a center
  clear sample remains clear.
- `pnpm run render-control:smoke-all` includes the line route and reports zero
  route status failures and zero warning routes across 52 example pages.

Recommended next task:

- `task-3169` — add a camera render-target preview route.
