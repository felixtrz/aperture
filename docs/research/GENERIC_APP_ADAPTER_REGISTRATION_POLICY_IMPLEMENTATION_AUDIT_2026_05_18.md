# Generic App Adapter Registration Policy Implementation Audit

Date: 2026-05-18

Task: `task-1656`

## Scope

Audit the `task-1655` registration-policy audit and its recommended next
implementation slice.

## Findings

- The audit correctly keeps public source material authoring closed.
- It distinguishes generic adapter registry behavior from built-in default
  family validation.
- The recommended next helper is small and testable: generic registry
  validation with optional expected-family keys.
- The recommendation avoids `createWebGpuApp()` changes, app options, shaders,
  GPU resources, examples, and browser fixtures.
- Existing built-in adapter validation can remain as compatibility policy while
  reusing or aligning with a future generic helper.

## Boundary Check

- ECS authority and render extraction boundaries are unaffected.
- WebGPU remains the only backend.
- Diagnostics remain JSON-safe and adapter-policy-scoped.
- No decision record is needed before the next helper, because it remains
  internal infrastructure and does not expose custom material source APIs.

## Recommendation

Proceed to tracker/backlog alignment. Add the generic app adapter registry
validation helper as the next ready implementation task, followed by the usual
implementation audit and tracker alignment tasks.
