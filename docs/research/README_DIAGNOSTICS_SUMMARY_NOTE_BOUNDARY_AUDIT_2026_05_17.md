# README Diagnostics Summary Note Boundary Audit - 2026-05-17

## Scope

Audit the README note that mentions aggregate dependency summary counts in the
app diagnostics example.

This audit checks docs wording only. It does not change code, examples, tests,
or report schemas.

## References Inspected

- `README.md`
- `docs/ARCHITECTURE.md`
- `examples/app-diagnostics.js`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`

## Findings

No corrective docs changes are required.

The README wording is scoped to the app diagnostics example. It says the example
publishes aggregate dependency summary counts for failure scenarios. It does not
state that `WebGpuAppRenderReport`, `WebGpuAppRenderReportJsonValue`, or
`WebGpuAppResourceReuseReport` includes a new core field.

The wording keeps retained cache summaries separate from source dependency
readiness. It references material kind, dependency kind, status, and diagnostic
code; it does not mention texture/sampler cache reuse or retained GPU resource
identity.

The note also avoids raw WebGPU/browser object exposure claims beyond the
existing example paragraph.

## Follow-Up

No backlog wording changes are needed. A dedicated diagnostics summaries docs
page can now list the public helpers and their ownership boundaries without
expanding the README further.

## Validation

- `pnpm exec prettier --check README.md`
