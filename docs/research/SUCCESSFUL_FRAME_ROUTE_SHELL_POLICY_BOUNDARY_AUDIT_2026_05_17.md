# Successful-Frame Route Shell Policy Boundary Audit - 2026-05-17

## Scope

Audit `task-0980`, which decided to keep successful-frame
`QueuedMaterialFrameResourceRouteShell` data omitted from app reports for now.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_REPORTING_POLICY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### Report Shape

The policy avoids adding a new successful-frame report field. Existing app
reports continue to use counts, diagnostics, resource reuse summaries, draw
counts, and material dependency readiness where applicable.

This keeps the app report shape stable while failure diagnostics provide the new
route shell detail only when frame resource preparation fails.

### Allocation Discipline

Successful-frame route shells would allocate/report per queued item unless a
scratch-backed or optional reporting surface was designed first. Keeping them
omitted by default matches the Architecture guidance that valid frame paths
should not allocate diagnostic wrappers without clear value.

### Diagnostic Separation

The current policy keeps:

- failure route shells in current-frame diagnostics
- retained cache summaries in `resourceReuse`
- successful-frame draw/resource counts in existing report fields

No retained cache summary is merged with route diagnostics.

## Result

The policy is aligned with the architecture boundary. No implementation follow-up
is needed unless a future debugging workflow asks for successful-frame route
shells. If that happens, it should be optional and covered by allocation/report
shape tests.

## Follow-Up

Resume the material fidelity track with `task-0969`.
