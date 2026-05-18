# glTF Sampler Wrap Visual Proof Plan Audit

Date: 2026-05-18

Task: `task-1565`

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_VALID_GLTF_SAMPLER_MAPPING_PLAN_2026_05_18.md`:
add a glTF-shaped browser visual proof for sampler wrapping.

## Assessment

The selected follow-up is concrete enough for one focused implementation run:

- It builds directly on the valid non-default sampler mapping scenario.
- It targets one missing behavior proof: wrapped sampling with out-of-range UVs.
- Existing controlled StandardMaterial repeat sampler coverage provides a local
  reference pattern without requiring a new library or broad renderer changes.
- The acceptance criteria require screenshot/readback distinction from clamp
  behavior, which is a stronger proof than status-only sampler mapping.

## Boundaries

Keep the implementation narrow:

- Prove one wrap behavior, preferably repeat unless mirror-repeat is simpler in
  the existing fixture.
- Reuse the glTF texture browser fixture and existing pixel/readback helpers.
- Preserve source sampler enum and mapped sampler status assertions.
- Do not build a sampler matrix, add IBL/shadows, add binary GLB loading, or
  introduce real non-built-in app rendering.

## Recommendation

Proceed with `task-1567` after tracker/backlog alignment. If deterministic UV
or texture setup proves larger than expected, stop with a documented fixture
design audit rather than expanding into a broad sampler harness rewrite.
