# North Star

## Project Vision

Build a WebGPU-only, ECS-native 3D runtime for the web that can eventually replace three.js inside an IWSDK-style stack.

The long-term goal is broad practical feature parity with major web/game 3D frameworks such as three.js, Babylon.js, PlayCanvas, Wonderland Engine, Unity, and Unreal-inspired workflows, while using a fundamentally different architecture:

- ECS is the source of truth.
- Rendering is a derived view of ECS state.
- There is no three.js-style mutable scene graph as the core world model.
- The renderer consumes extracted render snapshots / render packets.
- The architecture is designed to support split-thread execution:
  - Worker thread: ECS simulation / logic.
  - Main thread: WebGPU rendering / presentation.
  - Boundary: typed snapshots and command/event streams.
- The system is designed for AI-agentic coding:
  - Strong schemas.
  - Deterministic behavior.
  - Excellent documentation.
  - Clear diagnostics.
  - Inspectable state.
  - Small, composable tasks.

This is not a low-level WebGPU wrapper and not a clone of three.js. It is a modern ECS-first 3D runtime.

## Architectural Anchor

Bevy is the closest current architecture reference for Aperture's ECS/render
bridge. Aperture should borrow Bevy's proven patterns conceptually:

- Entities are logic identities until render-facing components are added.
- Meshes, materials, cameras, lights, and visibility are ECS components or
  resources, not renderer-owned scene nodes.
- Meshes and materials are assets stored in typed collections and referenced by
  stable handles from components.
- Rendering runs from extracted ECS state, renderer-owned prepared assets, draw
  queues, and explicit render stages.
- Materials are asset families with shader, bind group, render-state, and
  pipeline specialization contracts.

Aperture should not mechanically copy Bevy names or Rust API shapes. The runtime
must remain TypeScript-first, WebGPU-only, and worker-snapshot-friendly.

## Strategic Bet

In an AI-agentic coding era, users may care less about which rendering framework is underneath if the system can reliably deliver the experience they want.

Therefore, the project should optimize for:

- Agent-readable APIs.
- Stable architecture.
- Strong docs.
- Predictable behavior.
- High-level capability.
- Performance transparency.
- Testable systems.
- Clear feature contracts.

The runtime should be easy for humans to use and especially easy for coding agents to extend safely.

## Long-Term Feature Targets

The system should eventually support most practical app/game needs covered by major 3D engines/frameworks:

### Core Runtime

- ECS world.
- Entity/component lifecycle.
- Query system.
- System scheduler.
- Commands/events/resources.
- Deterministic frame phases.
- Prefabs.
- Serialization.
- Scene loading.
- Runtime validation.

### Rendering

- WebGPU-only renderer.
- Render extraction from ECS.
- Render snapshots.
- Render world.
- Render graph.
- Cameras.
- Layers.
- Visibility.
- Mesh rendering.
- Instancing.
- Materials.
- Textures.
- Lighting.
- Shadows.
- Post-processing.
- Transparency.
- Render targets.
- Debug rendering.
- GPU profiling where possible.

### Assets

- Asset registry.
- Typed asset collections.
- Asset handles.
- GLTF/GLB loading.
- Texture loading.
- KTX2/Basis support eventually.
- Mesh optimization.
- Material import.
- Asset validation.
- Build-time asset processing.
- Agent-readable asset manifests.

### Animation

- Transform animation.
- Skeletal animation.
- Animation clips.
- Animation state machines.
- Blend trees eventually.
- Agent-readable animation diagnostics.

### Interaction

- Pointer/raycast picking.
- Input abstraction.
- Controller abstraction eventually.
- Grabbable/interactable components.
- Gesture/action mapping.
- WebXR support later.

### Physics

- Physics integration point.
- Collider components.
- Rigidbody components.
- Trigger/collision events.
- Worker-friendly simulation path.

### Multithreading

- Single-thread mode first.
- Worker simulation mode later.
- SharedArrayBuffer transport.
- Double/triple-buffered snapshots.
- Input command ring buffer.
- Render command/event stream.
- Main-thread late view updates for future XR.

### Tooling

- CLI validation.
- Project analyzer.
- Frame reports.
- Entity inspector.
- Render packet inspector.
- Asset validation reports.
- Batching diagnostics.
- Agent handoff reports.
- Optional visual inspector/editor later.

### WebXR Later

- XR session integration.
- Stereo rendering.
- XR input.
- Late head/controller pose application.
- Spatial UI.
- Performance budgets for headset-class devices.

## Non-Goals for Early Versions

Early versions should not attempt to include everything.

Do not start with:

- Full editor.
- Visual scripting.
- Full PBR pipeline.
- Full physics engine.
- Full WebXR framework.
- Large plugin marketplace.
- Complex asset cooking pipeline.
- Full Unity/Unreal-style toolchain.

The correct early path is small vertical slices that preserve the architecture.

## Architectural Principles

1. ECS is authoritative.
2. Rendering is a derived projection, not the source of truth.
3. The renderer must not require direct access to gameplay logic.
4. Transforms/hierarchy belong to ECS, not the renderer.
5. GPU resources belong to the renderer.
6. Assets are referenced by stable handles.
7. Render extraction is a first-class boundary.
8. The runtime must be inspectable and diagnosable.
9. The frame pipeline must be explicit.
10. Public APIs must be stable, typed, documented, and agent-friendly.
11. Avoid hidden global mutable state.
12. Avoid engine bloat before core architecture is proven.
13. Prefer data-oriented structures where they improve clarity or performance.
14. Prefer small, testable vertical slices over broad unfinished scaffolding.
15. Every major decision should be recorded.
16. Prefer Bevy-proven ECS/render/asset patterns when they preserve
    Aperture's TypeScript and worker-boundary constraints.

## Success Criteria

The project is succeeding if:

- Agents can contribute safely without constant human steering.
- The ECS/render boundary remains clean.
- The renderer does not grow a scene graph as the hidden source of truth.
- New features plug into the ECS/render-extraction model cleanly.
- Performance characteristics are visible and measurable.
- Examples remain small and understandable.
- Documentation stays aligned with implementation.
- The runtime becomes capable enough to replace three.js usage in IWSDK-like scenarios.

## Failure Modes to Avoid

- Accidentally rebuilding three.js with different names.
- Letting the renderer own app/game state.
- Letting every subsystem invent its own lifecycle.
- Creating a giant, untestable engine skeleton before proving core loops.
- Letting autonomous agents pile unfinished abstractions on top of each other.
- Allowing the backlog to drift away from the North Star.
- Skipping diagnostics until too late.
- Optimizing for demos while corrupting architecture.
