# Next Route Or Standard Follow-Up After Route Report Collector Extraction

Date: 2026-05-18

Task: `task-1585`

## Context

`task-1582` extracted the app material-queue route-report diagnostic collector
into `app-diagnostics-summary.ts`. The app route-failure summary now uses the
reusable helper, and `task-1583` confirmed the change stayed JSON-safe and did
not move route traversal, adapter selection, or frame-resource preparation.

The next slice should stay narrow. A broad material-family collector migration
is still too large unless the moved responsibility is isolated and already
covered by focused tests.

## Candidates

### Generic Route / Prepared-Resource Candidate

Extract another part of the built-in route collector into a generic
material-family collector.

Pros:

- Advances the long-term route spine for future non-built-in material families.
- Could reduce the remaining built-in collector weight after the recent
  diagnostic helper extractions.

Cons:

- The remaining collector work mixes source asset indexing, adapter validation,
  compatibility diagnostics, route traversal, and app resource item creation.
- Another traversal extraction risks becoming a broad collector rewrite instead
  of one focused route/prepared-resource slice.
- Recent audits already moved the cleanest generic helper candidates; the next
  route migration should wait for a more concrete non-built-in app-routing
  boundary.

Decision: defer.

### StandardMaterial / glTF Fidelity Candidate

Add one more StandardMaterial/glTF browser proof, such as emissive-factor-only
rendering or a smaller material-factor status fixture.

Pros:

- Continues closing glTF material fidelity gaps.
- The existing `standard-gltf-texture` fixture can absorb narrow scenarios.

Cons:

- The recent run already added several sampler, double-sided, and dependency
  fidelity proofs.
- This would not address the diagnostic/status extraction opportunity exposed
  by the route-report collector cleanup.

Decision: defer.

### Diagnostics / Tooling Candidate

Extract the app render-report material dependency readiness collector from
`app.ts` into the diagnostics summary module and cover it directly.

Pros:

- Mirrors the route-report collector extraction without changing runtime
  behavior or app routing.
- Makes the public `materialDependencyReadiness` JSON field easier to test
  without constructing full app reports.
- Keeps the helper on JSON-safe diagnostic data and preserves the existing
  `webGpuApp.materialDependenciesNotReady` diagnostic contract.
- Small enough for one focused implementation and targeted unit tests.

Cons:

- It is diagnostic-surface cleanup, not a material-family routing unlock.
- It should not expand into app report serialization or dependency readiness
  policy changes.

Decision: select.

## Selected Follow-Up

### task-1587 — Extract app material dependency readiness collector

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`, and
`test/webgpu/app-diagnostics-summary.test.ts`.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`, and recent route
diagnostics collector audits.

Acceptance criteria:

- Add a reusable helper that extracts
  `webGpuApp.materialDependenciesNotReady` diagnostics through the public
  `materialDependencyReadiness` field.
- Ignore unknown diagnostics and malformed/non-object readiness payloads.
- Route `webGpuAppRenderReportToJsonValue()` through the helper without
  changing JSON output shape.
- Add targeted tests proving valid extraction, empty output for missing or
  malformed diagnostics, and JSON-safe behavior.
- Do not change dependency readiness policy, route traversal, prepared-resource
  behavior, StandardMaterial shader behavior, binary GLB loading, IBL, shadows,
  or app-level non-built-in rendering.

## Next Step

Run `task-1586` to audit this selected follow-up before implementation.
