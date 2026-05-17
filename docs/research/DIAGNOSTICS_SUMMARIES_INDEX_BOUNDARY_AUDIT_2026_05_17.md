# Diagnostics Summaries Index Boundary Audit - 2026-05-17

## Scope

Audit `docs/DIAGNOSTICS_SUMMARIES.md` after adding the helper inventory and
boundary notes.

This audit checks docs alignment only. It does not change code or public APIs.

## References Inspected

- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/draw-package.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`

## Findings

No corrective docs changes are required.

The docs page keeps the ownership split clear:

- renderer-independent summaries live in `@aperture-engine/render`;
- WebGPU app/frame summaries live in `@aperture-engine/webgpu`;
- retained backend cache behavior remains in resource reuse reports;
- current-frame queue/dependency summaries remain diagnostics inspection data.

The docs do not imply a hidden scene graph, renderer-owned ECS state, raw WebGPU
handle exposure, or app report schema guarantees. They explicitly state that a
future app report diagnostics field should be a sibling of `resourceReuse`.

The hot-path allocation note is aligned with decision 0009: allocating helpers
are acceptable for explicit inspection, but every-frame success-path wiring
needs caller-owned scratch or stable result shells.

## Follow-Up

No backlog wording changes are needed. The remaining optional app-report flag
planning task should use this docs page as its boundary anchor.

## Validation

- `pnpm exec prettier --check docs/DIAGNOSTICS_SUMMARIES.md`
