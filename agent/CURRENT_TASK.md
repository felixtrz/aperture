# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3159` — final covered render-pipeline SOTA audit against
three.js and PlayCanvas.

Status: `task-3158` completed a persistent Playwright route proof harness for
clustered-light routes.

Key findings:

- `test/e2e/persistent-route-harness.ts` now provides a reusable one-page route
  harness that resets to `about:blank`, navigates to the next route, captures
  JSON-safe status, readback evidence, frame count, elapsed time, final URL,
  and per-route WebGPU validation warnings.
- `test/e2e/clustered-lights.spec.ts` now proves the default clustered route
  and the pressure-history route in the same browser page without opening a
  page per route.
- Focused Playwright validation passed for both the standalone pressure-history
  route and the persistent harness route.
- The old broad all-in-one clustered-lights spec remains a known poor fit for
  local headed validation; use focused route proofs and the persistent harness
  while doing the final audit.

Next step: implement `task-3159`.

Reference anchors for `task-3159`:

- `docs/render-pipeline-comparison.html`.
- `references/three.js/src/renderers/common/Renderer.js`.
- `references/engine/src/scene/renderer/frame-pass-update-clustered.js`.
