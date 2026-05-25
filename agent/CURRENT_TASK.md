# Current Task

No active task is currently checked out.

Status: `task-3162` completed the unified example render-control testing
infrastructure slice and the follow-up route-restoration fixes completed
`task-3163`, `task-3164`, and `task-3165`.

Key findings:

- All renderer-backed example HTML files except `examples/index.html` now load
  the shared `examples/example-control.js` browser protocol helper.
- The reusable Playwright controller can drive standalone routes and persistent
  shell scenarios, capture scoped WebGPU warnings, pause/step supported routes,
  write snapshots/screenshots, and generate status/pixel diffs.
- The CLI frontend can run proof scripts and an all-route smoke that records
  status and warning artifacts for 49 renderer-backed routes.
- The final all-route smoke now visits 49 renderer-backed routes with empty
  `routeStatusFailures` and empty `warningRoutes`.
- The focused controller/persistent/custom-material/transmission/DOF Playwright
  run passes. The full legacy `gltf-scene.spec.ts` browser wrapper remains too
  heavy for this acceptance gate; `gltf-scene.html` is covered by the final
  controller smoke with `ok:true` and zero scoped warnings.

Recommended next task:

- `task-3166` — add a split-screen multi-camera route with two ECS-authored
  camera views and render-control pixel/status proof.
