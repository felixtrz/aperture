# Next StandardMaterial PBR Fidelity Slice Plan

Date: 2026-05-18

## Scope

Select the next narrow StandardMaterial fidelity slice after generic route
cleanup was pinned.

This plan intentionally avoids IBL, shadows, render targets, broad GLB viewer
work, and unrelated shader refactors.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_COMPATIBILITY_TEST_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_CLEANUP_PLAN_AUDIT_2026_05_18.md`
- Existing StandardMaterial texture diagnostics and browser coverage noted in
  `agent/HANDOFF.md`

## Selected Slice

Implement `StandardMaterial` metallic-roughness texture transform support for
the same narrow case already proven for base-color textures:

- texture slot: `metallicRoughnessTexture`;
- texcoord set: `TEXCOORD_0`;
- transform fields: finite offset and scale first;
- keep rotation, `TEXCOORD_1`, and non-selected slots unsupported unless the
  implementation proves the same math can be reused safely;
- preserve unsupported diagnostics for cases that remain deferred.

## Why This Slice

This advances glTF metallic-roughness fidelity without jumping to lighting or
shadow features.

It is also a good next route after generic app routing because:

- metallic-roughness texture browser coverage already exists;
- base-color transform packing/sampling provides a proven local pattern;
- transformed non-base-color diagnostics already exist, so behavior changes can
  be tested against a clear before/after boundary;
- the work stays within material texture readiness, uniform packing, WGSL
  sampling, and browser readback diagnostics.

## Acceptance Criteria For Implementation

- glTF material mapping preserves supported metallic-roughness texture transform
  fields for `TEXCOORD_0`.
- StandardMaterial readiness accepts the selected transform case and continues
  to diagnose unsupported cases.
- Uniform packing and WGSL sampling apply the transform consistently with the
  base-color path.
- Browser coverage verifies a transformed metallic-roughness texture changes
  rendered output or readback in a deterministic way.
- Existing transformed UV1/non-base-color unsupported diagnostics are updated
  only where behavior intentionally changes.

## Non-Goals

Do not include:

- IBL/environment lighting.
- Shadows.
- New BRDF/PBR lighting model work.
- Normal-map tangent changes.
- GLB binary loading.
- Texture transform support for every slot at once.
- New app diagnostics fields.

## Outcome

The next implementation should be a focused metallic-roughness transform slice,
audited first to ensure it remains narrow and consistent with the existing
base-color transform path.
