# Roadmap

This roadmap is the medium-term execution plan. The North Star defines where the project is going. The backlog defines immediate executable tasks.

Agents should use this document to understand phase order, but should work from `agent/BACKLOG.md` for specific tasks.

## Immediate Planning Gate — Reference Engine Coverage

As of 2026-05-15, more implementation should pause until Aperture has a thorough MVP concept map based on local reference research into three.js, Babylon.js, and PlayCanvas.

Reason:

- Aperture aims to become a practical 3D runtime, not just a minimal ECS/WebGPU demo.
- The immediate backlog was still shaped like a custom ECS implementation plan even after EliCS adoption.
- Future hourly automation runs should spend full cycles on high-leverage research/design tasks instead of finishing tiny two-minute implementation slices.

Current reference checkouts:

- three.js: `/Users/felixz/Projects/aperture-reference-libs/three.js`
- Babylon.js: `/Users/felixz/Projects/aperture-reference-libs/Babylon.js`
- PlayCanvas engine: `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine`
- gl-matrix: `/Users/felixz/Projects/aperture-reference-libs/gl-matrix`
- wgpu-matrix: `/Users/felixz/Projects/aperture-reference-libs/wgpu-matrix`

Planning gate exit criteria:

- `docs/MVP_3D_CONCEPTS.md` covers the MVP domains: math/spatial primitives, transforms, geometry/mesh, render authoring components, materials, textures, cameras, lights, visibility/culling/sorting, assets/loading, animation/skinning/morph design, picking/bounds, render extraction, WebGPU render world, diagnostics, and examples.
- Each MVP domain has explicit references to three.js, Babylon.js, and PlayCanvas concepts.
- Each MVP domain has an Aperture ECS binding plan that preserves the architecture invariants.
- Implementation tasks in `agent/BACKLOG.md` are either superseded, rewritten, or deferred until concept coverage is complete.
- Ready backlog tasks are substantial enough for a focused 30-60 minute automation run.

## Phase 0 — Repository Foundation

Goal: create a safe, testable TypeScript project structure that autonomous agents can extend.

Core work:

- Initialize TypeScript package.
- Add build/test scripts.
- Add lint/format scripts if useful.
- Add `AGENTS.md`.
- Add `docs/NORTH_STAR.md`.
- Add `docs/ARCHITECTURE.md`.
- Add `docs/DECISIONS.md`.
- Add `agent/BACKLOG.md`.
- Add `agent/HANDOFF.md`.
- Add `agent/STATUS.json`.
- Add automation scripts.

Exit criteria:

- `npm run build` passes.
- `npm test` passes.
- Agent can complete one small task and update handoff.

## Phase 1 — ECS Core

Goal: use EliCS as Aperture's ECS foundation and define only the Aperture-specific ECS conventions needed by the MVP concept map.

Core work:

- EliCS-backed world/entity/component/query/system usage.
- Aperture naming conventions for components and resources.
- Thin helpers only where they improve public API clarity.
- Validation that component schemas remain serializable and renderer-independent.
- Resources.
- Commands/events model.

Exit criteria:

- Entities can be created/destroyed safely.
- Components can be attached/removed.
- Queries work.
- Systems run deterministically.
- Tests cover lifecycle, query behavior, and any Aperture-specific helper surface.
- No custom ECS internals are rebuilt unless EliCS cannot support a required invariant.

## Phase 2 — Transform System

Goal: make ECS own all transform and hierarchy logic.

Core work:

- `LocalTransform`.
- `WorldTransform`.
- `Parent`.
- Optional derived children index.
- Dirty propagation.
- Hierarchy update system.
- Matrix/quaternion/vector utilities or small math dependency.

Exit criteria:

- Parent-child transforms work.
- Renderer can consume `WorldTransform` without knowing hierarchy.
- Tests cover hierarchy changes.

## Phase 3 — Render Component Model

Goal: define the ECS-facing render authoring model.

Core work:

- `MeshRenderer`.
- `Camera`.
- `Visibility`.
- `RenderLayer`.
- `Name` / debug metadata.
- Stable asset handles.
- Mesh/material handle concepts.

Exit criteria:

- Users can author renderable entities through ECS components.
- No public mutable scene graph exists.
- Tests cover render component storage and queries.

## Phase 4 — Render Extraction

Goal: create the boundary between ECS simulation state and renderer state.

Core work:

- `RenderPacket`.
- `RenderSnapshot`.
- `RenderExtractSystem`.
- Visibility filtering.
- Layer filtering.
- Camera extraction.
- Stable render object IDs.
- Initial diagnostics for skipped renderables.

Exit criteria:

- ECS world can produce flat render packets.
- Renderer does not need to query ECS directly.
- Tests cover extraction.

## Phase 5 — WebGPU Foundation

Goal: establish the WebGPU backend.

Core work:

- WebGPU feature detection.
- Device/context initialization.
- Canvas configuration.
- Shader module creation.
- Buffer abstraction.
- Texture abstraction.
- Pipeline cache.
- Minimal render pass.
- Clear canvas.
- Draw triangle.

Exit criteria:

- Example renders a triangle.
- Unsupported WebGPU path has clear error.
- WebGPU code is isolated from ECS logic.

## Phase 6 — Mesh Rendering

Goal: render ECS-extracted mesh packets.

Core work:

- Static mesh data.
- Vertex/index buffers.
- Transform buffer.
- Camera uniform buffer.
- Basic unlit shader.
- Render packet submission.
- Draw sorting.
- Minimal example: multiple cubes/entities.

Exit criteria:

- Multiple ECS entities render with distinct transforms.
- Render extraction feeds WebGPU draw submission.
- Tests cover packet generation; examples cover rendering.

## Phase 7 — Materials

Goal: introduce data-driven material system.

Core work:

- Material registry.
- Material handles.
- Material schemas.
- Unlit material.
- Matcap material.
- Basic standard material later.
- Pipeline key generation.
- Material validation.
- Batching compatibility reporting.

Exit criteria:

- Materials are data objects.
- Render packets reference material handles.
- Renderer resolves material handles into GPU state.
- Diagnostics explain material/pipeline implications.

## Phase 8 — Asset System

Goal: make assets first-class.

Core work:

- Asset registry.
- Stable asset IDs.
- Mesh loading.
- Texture loading.
- Basic GLB/GLTF subset.
- Asset metadata.
- Asset validation.
- Agent-readable asset manifest.

Exit criteria:

- Simple GLB can be loaded and rendered.
- Asset handles are stable.
- Asset errors are clear and actionable.

## Phase 9 — Render World

Goal: decouple render state from ECS state fully.

Core work:

- `RenderWorld`.
- Apply snapshots to render world.
- Create/update/destroy render objects.
- Snapshot diffing.
- Render object lifecycle.
- Render-world diagnostics.

Exit criteria:

- Renderer consumes render world, not ECS.
- Same render path can later consume worker-produced snapshots.

## Phase 10 — Multithreading Preparation

Goal: prepare architecture for worker-based simulation.

Core work:

- Serializable render snapshot format.
- Input command stream design.
- Render command/event stream design.
- SharedArrayBuffer memory layout design.
- Double/triple buffering design.
- Worker simulation proof of concept.

Exit criteria:

- Single-thread mode and experimental worker-sim mode use same conceptual boundary.
- Renderer does not require direct ECS access.
- Documentation describes threading model and constraints.

## Phase 11 — Diagnostics and Agent Introspection

Goal: make the runtime explain itself.

Core work:

- Frame report.
- Entity inspection.
- Render packet inspection.
- Asset validation report.
- Batching report.
- Visibility explanation.
- Pipeline/material report.

Exit criteria:

- Human/agent can ask why an entity is not visible and get useful information.
- Performance warnings identify actionable causes.

## Phase 12 — Examples

Goal: prove the runtime through examples.

Initial examples:

- Basic triangle.
- ECS cubes.
- Transform hierarchy.
- Materials.
- GLB viewer.
- Instancing.
- Diagnostics.
- Worker simulation proof of concept.

Exit criteria:

- Examples are documented.
- Examples are small and focused.
- Examples double as regression targets.

## Phase 13 — Higher-Level Runtime Features

Goal: move toward full-service engine capability.

Possible work:

- Prefabs.
- Scene serialization.
- Input abstraction.
- Picking/raycasting.
- Simple animation.
- Basic physics integration.
- Spatial UI foundations.
- Build-time validation.

Exit criteria:

- Users can build small complete 3D apps without falling down to raw WebGPU.

## Phase 14 — WebXR Path

Goal: add WebXR without violating architecture.

Possible work:

- XR view abstraction.
- XR session lifecycle.
- Stereo rendering.
- XR input.
- Late pose application.
- Controller components.
- Interaction components.
- Headset performance diagnostics.

Exit criteria:

- WebXR behaves as a view mode over the same ECS/render architecture.
