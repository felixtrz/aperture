# Task Progress

Last updated: 2026-05-24 18:25 PDT

## Current Goal

Implement `docs/UNIFIED_EXAMPLE_TESTING_INFRA_PLAN.md` and make sure every
explicitly listed acceptance criterion in that plan is met.

## Result

The goal is complete.

- Every renderer-backed example HTML file except `examples/index.html` loads the
  shared render-control protocol helper.
- The reusable Playwright controller, CLI frontend, proof commands, all-route
  smoke command, and developer documentation are in place.
- Pilot controller coverage drives `triangle`, `spinning-cube`, `post-effects`,
  `glb-viewer`, and `persistent-render-shell`.
- The persistent route harness and persistent shell spec delegate to the shared
  controller.
- Follow-up route issues surfaced by the smoke were fixed for
  `custom-material`, `transmission`, and `clustered-lights`.
- The final all-route smoke visits 49 renderer-backed routes with empty
  `routeStatusFailures` and empty `warningRoutes`.

## Final Validation

Passing validation:

- `pnpm run check:examples`
- `pnpm exec tsc -p tsconfig.test.json --noEmit`
- `pnpm --filter @aperture-engine/webgpu build`
- `pnpm exec vitest run test/webgpu/draw-command.test.ts test/webgpu/standard-shader.test.ts`
- `pnpm exec playwright test test/e2e/render-control.spec.ts test/e2e/persistent-render-shell.spec.ts test/e2e/custom-material.spec.ts test/e2e/transmission.spec.ts test/e2e/dof.spec.ts --timeout=180000 --reporter=line --trace=off`
- `pnpm render-control:proofs`
- `pnpm render-control:smoke-all`

## Notes

- The broad legacy `test/e2e/gltf-scene.spec.ts` wrapper remained too heavy for
  the final gate. The migrated `gltf-scene.html` route is covered by
  `pnpm render-control:smoke-all` with `ok:true` and zero scoped warnings.
- Preserve pre-existing unrelated working-tree state, including the deleted
  `.codex/hooks.json` entry and `.playwright-mcp/`.
