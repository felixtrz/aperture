# Next Standard glTF Follow-Up After Occlusion Assertions

Date: 2026-05-19

Task: `task-1751`

## Context

Several small StandardMaterial/glTF assertion hardening slices landed in a row:
emissive factor/color status, combined emissive status, metallic-roughness
channel status, and occlusion red-channel status. Audit cadence now favors a
small review before adding more assertions.

Reference files inspected:

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `test/e2e/standard-gltf-texture.spec.ts`
- `examples/standard-gltf-texture.js`
- recent StandardMaterial/glTF assertion audits

## Candidates

### Audit-Refactor Candidate

Audit the recent StandardMaterial/glTF assertion hardening slices for drift,
coverage overlap, and next best fidelity gap.

Pros:

- Satisfies audit cadence after many small browser assertion changes.
- Can confirm the assertion hardening stayed scoped to JSON-safe status and did
  not become duplicate busywork.
- Can recommend whether to continue assertion cleanup or move to a larger
  browser-verifiable fidelity gap.

Cons:

- Docs-only.

Decision: select.

### StandardMaterial / glTF Fidelity Candidate

Continue with another exact status assertion, such as alpha or sampler fields.

Pros:

- Keeps browser coverage moving.

Cons:

- Enough assertion-only tasks have landed that an audit is prudent first.

Decision: defer until after audit.

### Diagnostics / Route Candidate

Return to package-level custom source validation or route diagnostics.

Pros:

- Advances material architecture.

Cons:

- The recent work was browser assertion hardening; audit that local area first.

Decision: defer.

## Selected Follow-Up

### task-1753 — Audit recent StandardMaterial assertion hardening

Category: `audit-refactor`
Package/write-scope:
`docs/research`; targeted tests only if a tiny corrective fix is required.
Reference anchor:
this plan, `docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`test/e2e/standard-gltf-texture.spec.ts`, `examples/standard-gltf-texture.js`,
and recent assertion implementation audits.

Acceptance criteria:

- Review the recent emissive, metallic-roughness, and occlusion assertion
  hardening slices for scope, JSON-safe status coverage, and overlap.
- Confirm no ECS/render ownership, WebGPU-only, public API, or custom material
  source boundary drift.
- Recommend the next focused StandardMaterial/glTF fidelity direction.

## Next Step

Run `task-1752` to audit this selected follow-up plan before implementation.
