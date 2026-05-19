# Renderer Planning Hot-Path Allocation Audit — 2026-05-19

## Task

`task-1815` audited the recent IBL/shadow planning and readiness helpers against
Decision 0009 and the frame hot-path allocation guidance in `docs/ARCHITECTURE.md`.

## Scope Checked

- `ibl-texture-preparation`
- `ibl-preparation-pass-plan`
- `ibl-preparation-resource-summary`
- `shadow-pass-plan`
- `directional-shadow-view-projection-plan`
- `shadow-matrix-buffer-descriptor`
- `shadow-caster-draw-list-plan`
- `shadow-caster-command-plan-readiness`
- `standard-material-ibl-shadow-binding-readiness`
- `standard-material-ibl-shadow-pipeline-key-readiness`
- GLTF scene status wiring in `examples/gltf-scene.js`

## Findings

The helpers are currently setup/diagnostic/status surfaces. They allocate arrays,
maps, sets, cloned JSON values, and diagnostics, which is acceptable for the
current browser status and tests.

They should not be promoted directly into a steady-state renderer hot path
without scratch-backed writer forms. The allocation-heavy patterns are explicit:

- `new Map` / `new Set` for lookup and uniqueness.
- `map`, `filter`, `flatMap`, and spread cloning for JSON reports.
- Fresh diagnostic arrays and descriptor objects on every call.

The GLTF example calls these reports from `publishFrameStatus` after `app.render`.
That status path is diagnostic/browser-facing, not the renderer's source of
truth. It remains acceptable while it is treated as example telemetry, but live
IBL/shadow frame orchestration should eventually use reusable scratch buffers or
preallocated report shells before entering the renderer frame loop.

## Follow-Up

Add a focused scratch-writer task before moving any of these helpers into
`createWebGpuApp().render`, render-world preparation, or command encoding.

Suggested task:

```md
### task-1817 — Add scratch-backed shadow command-plan writer

Category: `webgpu-render`
Package/write-scope: `packages/webgpu`, targeted tests.
Reference anchor: Decision 0009 hot-path writer guidance and local
`shadow-caster-command-plan-readiness`.

Acceptance criteria:

- Define a reusable scratch object for shadow caster command-plan readiness.
- Provide a writer API that can refill caller-owned arrays for valid frames.
- Keep the existing JSON helper as a diagnostic convenience wrapper.
```

## Result

No corrective code change was required in this audit. The current helpers are
properly documented as data-only readiness/report helpers, but they need writer
forms before becoming live frame-loop machinery.
