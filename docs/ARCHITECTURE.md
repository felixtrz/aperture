# Architecture

## Summary

This project is a WebGPU-only, ECS-first 3D runtime.

The core architecture is:

```text
ECS World
  -> Systems / Transform Resolution
  -> Render Extraction
  -> Render Snapshot
  -> Render World
  -> WebGPU Render Graph
  -> GPU Submission
```

The ECS world is authoritative. Rendering is a derived view of ECS state.

There is no public three.js-style mutable scene graph as the central world model.

## Primary Layers

### ECS / Simulation Layer

Owns:

- Entities.
- Components.
- Systems.
- Resources.
- Commands.
- Events.
- Game/app logic.
- Transform hierarchy.
- Simulation state.

The ECS layer does not own GPU resources.

### Render Extraction Layer

Reads ECS state and produces a render-facing representation.

Responsibilities:

- Query entities with renderable components.
- Read resolved world transforms.
- Apply visibility and layer filtering.
- Resolve mesh/material handles.
- Produce render packets.
- Produce render snapshots.
- Generate diagnostics for skipped/invalid renderables.

This is the key boundary that allows future worker-thread simulation.

### Render Snapshot

A compact representation of what should be rendered for a frame or state update.

Should be:

- Typed.
- Serializable.
- Stable.
- Diffable eventually.
- Suitable for worker-to-main-thread transport.
- Free of arbitrary JS object graph dependencies.

### Render World

Main-thread/render-thread representation of renderable state.

Owns:

- Render objects.
- GPU-facing resource references.
- Material/pipeline grouping.
- Draw sorting state.
- Batching state.
- Render diagnostics.

The render world is not authoritative gameplay state.

### WebGPU Backend

Owns:

- GPU device.
- Canvas context.
- Buffers.
- Textures.
- Samplers.
- Bind groups.
- Pipelines.
- Render passes.
- Command encoding.
- Submission.

WebGPU code should be isolated from ECS logic.

## Transform Ownership

Transforms belong to the ECS layer.

The renderer consumes resolved world transforms.

Suggested component split:

- `LocalTransform`
- `Parent`
- `WorldTransform`
- optional `TransformDirty`

The renderer should never compute gameplay hierarchy itself.

## Render Authoring Components

Initial ECS-facing render components may include:

- `MeshRenderer`
- `Camera`
- `Visibility`
- `RenderLayer`
- `Name`
- `DebugMetadata`
- `Light`
- `LightShadowSettings`

These are semantic app-facing components. They should not contain WebGPU-specific state.

Light and environment authoring follow the same ECS-owned rule as mesh and
camera authoring. Ambient and environment inputs are global and can be extracted
without a `WorldTransform`: ambient authoring emits a `LightPacket`, while
environment authoring emits an `EnvironmentPacket`. Directional, point, and spot
lights require `WorldTransform` because extraction derives their render-facing
position and orientation from ECS transform data; missing transforms should
produce diagnostics instead of renderer-owned fallback state.

Shadow settings are also ECS-owned authoring data. Extraction may emit a flat
`ShadowRequestPacket` for supported lights or diagnostics for unsupported
requests, but shadow maps, shadow cameras, atlases, passes, and GPU resources
remain renderer-owned future work and must not be stored on ECS components.

## Assets and Handles

The ECS should reference assets through stable handles.

Examples:

- `MeshHandle`
- `MaterialHandle`
- `TextureHandle`
- `AssetHandle`

GPU objects are created and owned by the renderer/asset backend, not by ECS components.

## Frame Pipeline

A typical single-threaded frame:

```text
1. Input collection
2. Command processing
3. Fixed update, if needed
4. Simulation systems
5. Transform resolution
6. Render extraction
7. Render world update
8. WebGPU render graph execution
9. GPU submit
10. Cleanup
```

A future split-thread frame:

```text
Worker:
  1. Read input command stream
  2. Run simulation
  3. Resolve transforms
  4. Extract render snapshot
  5. Publish snapshot

Main:
  1. Collect input
  2. Write input command stream
  3. Read latest complete render snapshot
  4. Update render world
  5. Render via WebGPU
```

## Multithreading Design Direction

The renderer must never require direct access to the authoritative ECS world.

Future worker mode should use:

- SharedArrayBuffer for hot data paths.
- Atomics for coarse synchronization.
- Double/triple-buffered snapshots.
- Input command ring buffer.
- Render snapshot publication.
- `postMessage` for cold-path data such as debug names, asset metadata, and errors.

Hot data candidates:

- transforms
- visibility flags
- instance data
- input samples
- frame counters

Cold data candidates:

- debug names
- asset registration
- error reports
- schema metadata
- large scene changes

## Material System

Materials should be data-driven.

A material should describe:

- shader family
- parameters
- texture handles
- render state
- feature flags

The renderer resolves materials into:

- pipeline keys
- bind groups
- uniform/storage buffer layouts
- batching compatibility

Material diagnostics should explain performance costs where possible.

## Diagnostics

Diagnostics are part of the architecture, not an afterthought.

Current renderer frame readiness report relationships are documented in [`RENDER_FRAME_READINESS.md`](./RENDER_FRAME_READINESS.md).

The runtime should eventually provide:

- `inspectEntity(entity)`
- `explainVisibility(entity)`
- `getFrameReport()`
- `getRenderPacketReport()`
- `getAssetValidationReport()`
- `getBatchingReport()`

Agents and humans should be able to understand why something rendered, failed to render, or rendered slowly.

## Agent-Friendliness

The architecture should be easy for coding agents to work with.

Prefer:

- explicit schemas
- strong TypeScript types
- small modules
- clear file ownership
- deterministic systems
- actionable errors
- stable docs
- small backlog tasks
- tests for every subsystem

Avoid:

- hidden global mutable state
- vague lifecycle hooks
- uncontrolled plugin mutation
- large unreviewed rewrites
- object graphs that cannot be serialized or inspected

## Architecture Invariants

These should not be violated without updating `docs/DECISIONS.md`:

1. ECS is the source of truth.
2. Rendering is a derived view.
3. WebGPU is the only rendering backend.
4. The renderer does not expose a central mutable scene graph.
5. Transform hierarchy belongs to ECS.
6. GPU resources belong to renderer/backend.
7. Render extraction is a first-class boundary.
8. Future worker simulation must remain possible.
