# Next Route Or Standard Follow-Up After Route Failure Shape Coverage

Date: 2026-05-18

Task: `task-1605`

## Context

`task-1602` pinned route-failure app diagnostics to the existing
`materialQueueRoute` field and rejected built-in family-specific resource-set
fields. The next task should avoid additional field-shape assertions unless a
new public field is involved.

## Candidates

### Material Route / Prepared-Resource Candidate

Start another route/prepared-resource cleanup.

Pros:

- Continues pressure on the material-family route spine.

Cons:

- The last two implementation slices were route field-shape regressions.
- Another route assertion would have diminishing value unless it changes a real
  route or prepared-resource contract.

Decision: defer until the next route candidate is more substantive.

### StandardMaterial / glTF Fidelity Candidate

Add render-bridge unit coverage that glTF `emissiveFactor` maps into
StandardMaterial even when no `emissiveTexture` is authored.

Pros:

- Complements the new browser proof with a focused mapper-level regression.
- Covers the source-material contract without WebGPU or browser setup.
- Keeps the behavior renderer-independent and aligned with the ECS/render
  bridge.

Cons:

- It is unit coverage, not a new rendered behavior.

Decision: select.

### Diagnostics / Tooling Candidate

Only update tracker/backlog state after route failure field-shape coverage.

Pros:

- Low risk.

Cons:

- Already handled by `task-1604`.

Decision: complete; no tooling-only follow-up now.

## Selected Follow-Up

### task-1607 — Add emissive-factor-only glTF material mapping regression

Category: `render-bridge`
Package/write-scope: `test/materials/gltf-material.test.ts`.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/gltf-material.ts`, and the existing glTF
material mapping tests.

Acceptance criteria:

- Add a mapper-level regression where `emissiveFactor` is authored without
  `emissiveTexture`.
- Assert the mapped StandardMaterial keeps the factor, has no active emissive
  texture binding, remains valid, and emits no diagnostics.
- Do not change WebGPU route behavior, shader behavior, browser examples,
  binary GLB loading, IBL, shadows, or non-built-in material rendering.

## Next Step

Run `task-1606` to audit this selected follow-up before implementation.
