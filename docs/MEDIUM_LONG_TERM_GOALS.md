# Medium And Long Term Goals

This document guides backlog creation after the near-term proof point:

- User-facing ECS app API.
- Typed mesh/material assets.
- A spinning cube rendered in WebGPU with a direct-lit StandardMaterial MVP.
- Playwright verification of pixels and frame diagnostics.

The goal after that proof point is to turn a proven vertical slice into a
practical engine foundation without drifting into a scene-graph renderer or a
grab bag of isolated WebGPU demos.

## Current Steering

After the current documentation, audit, guardrail, GLB-container planning, and
DebugNormal metadata queue, prioritize full StandardMaterial PBR support and the
proper render pipeline architecture.

The desired sequence is:

1. Expand StandardMaterial from the current direct-lit scalar MVP to glTF-style
   metallic-roughness coverage: base-color texture, metallic-roughness texture,
   normal map/tangents, emissive, occlusion, UV set handling, sampler behavior,
   color-space rules, and structured diagnostics.
2. Replace the current narrow mixed-material app routing with a generic
   material-family render queue, phase sorting, and prepared-asset contracts.
3. Add IBL/environment lighting and shadows once StandardMaterial texture paths
   and queueing are stable.
4. Bring GLB material mapping forward only when it can map into real
   StandardMaterial and UnlitMaterial support without pretending unsupported PBR
   features are rendered.

## Post-Proof-Point Priority

1. Audit and tighten the proof point.
   - Verify examples use ECS entities/components and typed assets.
   - Verify StandardMaterial source data stays renderer-independent.
   - Verify GPU resources remain WebGPU-owned.
   - Remove user-facing backend plumbing from examples.

2. Make the user API the default path.
   - Stabilize `createWebGpuApp` or equivalent.
   - Keep `createSimulationApp` / `createExtractionApp` headless-safe.
   - Make `app.world.spawn(...)`, typed assets, systems, and diagnostics the
     normal example shape.

3. Expand the material system deliberately.
   - Material families should be data-driven assets referenced by ECS
     components.
   - Renderer code should prepare material assets into WebGPU resources through
     explicit render-asset contracts.
   - New material families should include validation, pipeline-key behavior,
     bind group layout metadata, diagnostics, and Playwright coverage when they
     affect pixels.

4. Mature the render pipeline.
   - Prepare assets in the render world.
   - Queue, sort, and specialize draws by material/pipeline.
   - Improve resource lifetime, cache reporting, batching, instancing, and
     hot-path allocation discipline.

5. Build the glTF/GLB asset path.
   - Aperture should focus 3D model import on glTF 2.0 / GLB.
   - Do not add OBJ, FBX, STL, USD, or other 3D import formats without a new
     decision record.
   - Unsupported glTF extensions should produce structured diagnostics rather
     than silent fallbacks.

6. Improve diagnostics and agent tooling.
   - Explain why an entity did not render.
   - Report asset readiness, material readiness, visibility decisions, pipeline
     specialization, and browser/WebGPU failures in JSON-safe formats.

7. Add app-scale features only after the core path is stable.
   - Texture coverage, GLB viewer, multiple cameras, render targets,
     transparency, picking/raycasting, simple animation, and worker/headless
     proofs should arrive as vertical slices over the same ECS/render boundary.

8. Keep WebXR later.
   - XR should become a view/input mode over the same ECS and render extraction
     architecture, not a separate runtime.

## Material Families

Near and medium-term material family order:

1. `UnlitMaterial`
   - Constant or textured color, analogous to a three.js `MeshBasicMaterial`
     role.
   - Useful for UI-like surfaces, debug visuals, sprites/planes later, and fast
     baseline rendering.

2. `MatcapMaterial`
   - Normal/view-based material using a matcap texture.
   - Shows form and dimension without scene lighting.
   - Useful for attractive previews, editor-like inspection, and low-cost
     materials before full lighting is needed.
   - Naming can change if a better Aperture name emerges, but the material
     concept should exist.

3. `StandardMaterial`
   - Metallic/roughness material aligned with glTF PBR concepts.
   - Start with direct lighting plus base color, metallic, roughness, and
     emissive factors.
   - Expand later to base-color textures, metallic-roughness textures, normal
     maps, occlusion, emissive textures, color-space handling, IBL, and shadows.

4. `DebugNormalMaterial`
   - Diagnostic material for normals/tangents/geometry validation.
   - Not a primary art material, but useful for tests and agent debugging.

5. Optional simple lit material.
   - A Lambert/Phong-style material can be considered later if it fills a real
     performance or authoring gap.
   - Do not prioritize it before `MatcapMaterial` and the `StandardMaterial`
     proof path.

Deferred material families:

- Physical material extensions.
- Shader graphs or node materials.
- Arbitrary custom shader chunks.
- Advanced transparency.
- Line/point/sprite/depth-only material families, unless a specific vertical
  slice requires them.

## Asset Import Direction

For 3D scene/model import, focus on glTF 2.0 and GLB:

- First target: simple uncompressed GLB with meshes, nodes, transforms,
  materials, textures, samplers, cameras, and basic scene hierarchy.
- Material mapping should target `UnlitMaterial` for `KHR_materials_unlit` and
  `StandardMaterial` for glTF metallic-roughness materials.
- Animation clips, skins, morph targets, lights, and advanced extensions can be
  preserved or diagnosed before they are fully rendered.
- Draco, Meshopt, KTX2/Basis, sparse accessors, advanced material extensions,
  and non-triangle primitives are deferred until the base path is solid.
- Non-glTF 3D import formats require an explicit decision because they expand
  scope and validation burden.

## Backlog Creation Rules

When adding future tasks after the proof point:

- Prefer vertical slices that end in a testable user-facing behavior.
- Keep examples on the public API; move low-level render tests to test fixtures.
- Preserve headless simulation and extraction as a first-class path.
- Add audit-refactor tasks after every few implementation slices.
- Do not add broad engine features without a narrow acceptance test.
- Update this document or `docs/DECISIONS.md` when material/import priorities
  change.
