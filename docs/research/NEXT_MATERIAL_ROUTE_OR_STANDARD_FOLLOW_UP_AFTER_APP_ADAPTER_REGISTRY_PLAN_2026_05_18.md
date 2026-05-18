# Next Material Route Or Standard Follow-Up After App Adapter Registry Plan — 2026-05-18

## Context

The built-in app resource adapter registry now has typed family metadata and
smoke coverage. The next slice can either keep reducing route specialization or
advance StandardMaterial/glTF fidelity.

## Candidate A — Route Architecture

Add duplicate/missing-family diagnostics around the built-in app resource
adapter registration factory.

Pros:

- Continues tightening the route spine.
- Low implementation risk.

Cons:

- Mostly defensive coverage after the registry smoke task.
- Does not improve user-visible material behavior.

## Candidate B — StandardMaterial/glTF Fidelity

Add a focused browser/readback fixture for GLB-derived metallic-roughness
texture-transform sampling on `TEXCOORD_1`.

Pros:

- Advances the lit glTF proof point with a concrete material behavior.
- Builds directly on existing texture-transform and UV1 coverage.
- Keeps the scope narrow to one StandardMaterial texture binding and one
  browser/status regression.

Cons:

- It is more fixture-heavy than a pure unit test.
- It should not expand into broad GLB viewer or full PBR work.

## Candidate C — Diagnostics/Tooling

Add a small progress check for stale "missing" items when a tracker update marks
the same item working.

Pros:

- Helps avoid public tracker drift.

Cons:

- Tooling-only; the project currently benefits more from a material fidelity
  slice.

## Selected Follow-Up

Select Candidate B: add GLB-derived metallic-roughness `TEXCOORD_1`
texture-transform browser coverage.

The implementation should stay narrow: one fixture, one status/readback test,
and targeted code fixes only if the existing material mapping does not already
support the case.

## Proposed Task

### task-1421 — Add GLB metallic-roughness UV1 transform browser coverage

Category: `webgpu-render`
Package/write-scope:
`examples`, `test/e2e`, targeted StandardMaterial/glTF mapping code only if the
fixture reveals a bug.
Reference anchor:
existing StandardMaterial GLB texture-transform browser fixtures,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, and
`docs/DECISIONS.md`.

Acceptance criteria:

- Add a GLB-derived StandardMaterial browser fixture that samples a
  metallic-roughness texture through `TEXCOORD_1` with a transform.
- Verify JSON-safe status includes the expected texture-info/transform/UV set
  mapping.
- Verify a readback or screenshot pixel proves the transformed `TEXCOORD_1`
  sample affects rendered output.
- Keep GLB viewer work, IBL, shadows, broad PBR completeness, route renames,
  and non-built-in material rendering deferred.
