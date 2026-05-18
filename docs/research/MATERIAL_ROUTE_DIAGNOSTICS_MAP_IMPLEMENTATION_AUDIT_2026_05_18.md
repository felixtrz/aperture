# Material Route Diagnostics Map Implementation Audit

Date: 2026-05-18

Task: `task-1638`

## Scope

Audit `docs/research/MATERIAL_ROUTE_DIAGNOSTICS_MAP_2026_05_18.md`.

## Findings

- The map identifies each current material route diagnostic layer, its source
  module, diagnostic codes, JSON/public surface, and ownership boundary.
- It distinguishes generic route infrastructure from built-in/app compatibility
  policy.
- It calls out JSON-safe inspection surfaces and explicitly excludes raw GPU
  handles, callbacks, app objects, and source asset objects from diagnostics.
- It proposes next cleanup candidates without committing to broad custom
  material rendering.

## Boundary Check

- Documentation only; no runtime code, public API, examples, browser fixtures,
  dependencies, or package boundaries changed.
- The map aligns with the North Star: ECS remains authoritative, rendering is
  derived, WebGPU owns GPU resources, and route diagnostics remain inspection
  metadata rather than renderer-owned gameplay state.
- No decision record is required because the document records existing
  implementation boundaries rather than making a new architecture decision.

## Validation

- Covered by final `pnpm run format:check` and broad validation.

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should consider a
small design/audit decomposition for real non-built-in app material adapter
support, but should still compare that against a narrow StandardMaterial/glTF
fidelity proof before selecting implementation work.
