# Omitted glTF Sampler Default Mapping Plan Audit

Date: 2026-05-18

Task: `task-1576`

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_OPAQUE_DOUBLE_SIDED_PLAN_2026_05_18.md`: add
browser coverage for a glTF texture that omits the optional `sampler` field and
ensure status reports default sampler mapping honestly.

## Assessment

The selected follow-up is concrete enough for one focused run:

- The glTF sampler mapper already creates default sampler assets when the source
  sampler is omitted.
- The likely code change is limited to the browser fixture/status helper so it
  reports an omitted source as `null` while still exposing mapped defaults.
- The test can stay status/resource oriented and does not need a new visual
  sampler matrix.

## Boundary Check

- ECS authority remains intact because this is source asset mapping and browser
  fixture status coverage.
- Render extraction remains unchanged.
- WebGPU resources remain renderer-owned; the test should inspect resource
  counts and JSON-safe status only.
- The task should not expand into sampler wrap/filter matrices, binary GLB
  loading, IBL, shadows, or non-built-in material adapter rendering.

## Recommendation

Proceed with `task-1577`. If the omitted sampler source requires changing
public asset mapping types, keep the change narrowly typed and covered by the
browser status assertion.
