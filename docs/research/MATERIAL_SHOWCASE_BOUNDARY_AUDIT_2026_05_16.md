# Material Showcase Boundary Audit

Date: 2026-05-16

## Scope

This audit covers the material showcase example, the expanded view-uniform
layout, app-facade material diagnostics, mixed draw resource diagnostics, and
MatcapMaterial preparation metadata added during the material showcase run.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- Bevy-style render asset preparation and renderer-owned prepared resources
- Aperture's WebGPU-only backend boundary

## Findings

### ECS and Render Ownership

No ECS ownership drift was found. The new material dependency readiness helpers
and MatcapMaterial preparation plan live in `@aperture-engine/render` and
operate on source asset handles and registry status. They do not create WebGPU
resources or require browser globals.

The new mixed-source-resource diagnostic in `@aperture-engine/webgpu` preserves
the current app-facade limitation explicitly: frames with additional draws that
need different source mesh/material resource sets fail with a JSON-safe
diagnostic instead of silently reusing the first draw's resources. Same-resource
multi-draw frames still render.

### View Uniform Layout

The view uniform layout now packs:

- 16 floats for the view-projection matrix.
- 4 floats for camera position.

Both built-in unlit and standard shaders declare the expanded uniform structure.
The StandardMaterial shader uses `cameraPosition - worldPosition` for its view
direction, which fixes view-dependent PBR artifacts caused by assuming a fixed
view vector. The unlit shader does not use the camera position, but it keeps the
same layout so the app facade can share the view bind-group contract.

Tests cover the stride, buffer byte length, readiness checks, frame-resource
planning, and StandardMaterial shader source expectations.

### Diagnostics

The new app diagnostics are JSON-safe. They use stable asset handle keys,
status strings, counts, fields, and diagnostic codes. They do not expose
`GPUDevice`, buffers, textures, samplers, pipelines, bind groups, or arbitrary
asset objects.

The material dependency readiness report has explicit JSON value/string helpers,
which gives examples and future tooling a stable serialization path.

### Material Showcase

The browser material showcase intentionally uses a local direct WebGPU shader.
That keeps the example focused on visually comparing unlit, StandardMaterial-like
PBR, and matcap shading while the high-level `createWebGpuApp` path still only
supports one source mesh/material resource set per frame.

This does not replace the built-in StandardMaterial shader. The built-in shader
exists in `@aperture-engine/webgpu` and was fixed in the same run. The showcase
duplicates the PBR math only as a temporary demo path until the app facade can
route multiple material families and MatcapMaterial has an active WebGPU shader,
pipeline, bind-group, and resource-preparation path.

## Follow-Up

No corrective code change was required during this audit. A concrete follow-up
task was added to promote the showcase onto built-in material/app-facade paths
after multi-material app rendering and matcap WebGPU support exist.
