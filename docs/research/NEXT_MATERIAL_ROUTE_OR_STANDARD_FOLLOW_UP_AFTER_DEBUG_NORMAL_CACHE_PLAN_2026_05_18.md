# Next Material Route Or Standard Follow-Up After DebugNormal Cache Plan — 2026-05-18

## Context

DebugNormalMaterial now has active app route integration, browser pixel
coverage, and prepared material cache parity. The next slice should reduce
material route specialization without outrunning StandardMaterial/glTF fidelity.

## Candidate A — Route Architecture

Add a small generic built-in app resource adapter registry smoke path that
exercises all active built-in material families through one shared route table
shape. This would not add custom material rendering, but it would make the
current family-specific app wiring easier to audit before any future
non-built-in adapter work.

Pros:

- Directly attacks the highest current architecture risk: family-specific app
  route branches becoming permanent.
- Builds on the active Unlit, Matcap, Standard, and DebugNormal families.
- Can be tested without browser flakiness.

Cons:

- Mostly architecture/tooling value; it does not improve visible glTF fidelity.
- Needs careful scope to avoid a broad route rewrite.

## Candidate B — StandardMaterial/glTF Fidelity

Add a focused StandardMaterial browser/status regression for one remaining glTF
material behavior, such as another texture-transform edge case or alpha/depth
interaction.

Pros:

- Moves the proof point closer to honest lit glTF rendering.
- Browser coverage is user-visible and validates the full app facade.

Cons:

- StandardMaterial already has many narrow fidelity fixtures; route
  specialization is the more immediate structural risk after DebugNormal parity.
- Could add another family-specific path before the route spine is cleaner.

## Candidate C — Diagnostics/Tooling

Add a progress/backlog validation that fails when fewer than five ready tasks
remain after a run.

Pros:

- Helps future automations keep momentum.
- Small and low-risk.

Cons:

- Does not advance renderer architecture directly.
- The existing end-of-run protocol already requires backlog refill.

## Selected Follow-Up

Select Candidate A: add a generic built-in app resource adapter registry smoke
path.

The implementation should stay narrow: introduce no new public rendering API,
no non-built-in custom material rendering, and no route renames. The useful
proof is that the active built-in families can be described by one typed
adapter registry and exercised by tests without losing the existing specialized
resource creation behavior.

## Proposed Task

### task-1416 — Add generic built-in app resource adapter registry smoke coverage

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/app.ts`, targeted tests, and docs/research only if
the audit finds a boundary concern.
Reference anchor:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Add or expose a typed built-in app resource adapter registry shape that covers
  Unlit, Matcap, Standard, and DebugNormal without adding new material family
  behavior.
- Add tests proving all active built-in families are present, uniquely keyed,
  and route through the shared registry metadata.
- Preserve existing app resource creation behavior and JSON-safe route reports.
- Keep non-built-in custom material rendering, route renames, GLB loading, IBL,
  shadows, and batching deferred.
