# Omitted glTF Sampler Default Mapping Implementation Audit

Date: 2026-05-18

Task: `task-1578`

## Scope

Audit the `task-1577` implementation that added
`scenario=default-sampler` to the StandardMaterial glTF browser fixture.

## Findings

- The fixture now covers a glTF texture object with no authored `sampler`
  field.
- Browser status reports the planned sampler `source` as `null`, so omitted
  source data is not confused with an explicit authored sampler.
- The mapped sampler still exposes renderer-independent defaults:
  repeat addressing on U/V/W and linear min/mag/mipmap filtering.
- The Playwright test asserts one texture resource, one sampler resource, one
  material buffer, one draw, no diagnostics, and JSON-safe sampler status with
  no raw backend resources.

## Boundary Check

- ECS authority is unchanged; the scenario remains source-asset driven through
  ECS-authored renderability.
- Render extraction remains the boundary; no WebGPU code reads simulation state
  directly.
- GPU resources remain renderer-owned and only appear through counts/JSON-safe
  reports.
- The implementation stays narrowly scoped to the browser fixture/status helper
  and its e2e assertion.

## Validation

- `node --check examples/standard-gltf-texture.js`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/standard-gltf-texture.spec.ts -g "omitted sampler defaults"`

## Recommendation

Proceed to tracker/backlog alignment. The next planning task should compare a
generic material-route/prepared-resource slice against one remaining
StandardMaterial/glTF fidelity gap.
