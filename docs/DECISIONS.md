# Decision Log

Use this file to record significant architectural decisions.

Each decision should include:

- Date
- Status
- Context
- Decision
- Consequences

## 0001 — WebGPU Only

Status: accepted

Context:

The project aims to be a modern rendering/runtime foundation, not a compatibility layer for legacy APIs.

Decision:

The renderer will target WebGPU only. WebGL fallback is out of scope.

Consequences:

- Simpler renderer architecture.
- Modern GPU concepts can be used directly.
- Some browser/device compatibility is intentionally sacrificed.
- Unsupported environments should receive clear errors.

## 0002 — ECS Is Authoritative

Status: accepted

Context:

three.js-style scene graphs create friction when paired with ECS-based application logic.

Decision:

The ECS world is the source of truth for simulation, transforms, lifecycle, and render authoring components.

Consequences:

- The renderer does not own gameplay state.
- Transform hierarchy is implemented in ECS.
- Render state is extracted from ECS.
- Public API should emphasize entities/components rather than scene objects.

## 0003 — Rendering Is a Derived View

Status: accepted

Context:

To support batching, diagnostics, and future multithreading, the renderer should not directly own or mutate app state.

Decision:

Rendering is derived from ECS state through a render extraction layer.

Consequences:

- A render snapshot/render packet model is required.
- The renderer can be optimized independently.
- Worker-thread simulation becomes possible.
- There is a clean place for validation and diagnostics.

## 0004 — No Core Mutable Scene Graph

Status: accepted

Context:

A mutable object graph would recreate the three.js impedance mismatch.

Decision:

The runtime will not expose a central `Object3D`/`Scene` style graph as the core world model.

Consequences:

- Parent-child relationships exist through ECS transform components.
- Renderables are authored as components.
- Any convenience scene-like API must compile down to ECS components.

## 0005 — Multithread-Ready Boundary

Status: accepted

Context:

Long-term performance and architecture may benefit from running simulation in a Worker while rendering on the main thread.

Decision:

The renderer must not require direct access to ECS. Communication should be possible through typed snapshots and command/event streams.

Consequences:

- Single-thread mode remains possible.
- Worker mode can be added later.
- Render snapshot design must avoid arbitrary JS object dependencies.
- SharedArrayBuffer can be introduced for hot paths later.

## 0006 — Use EliCS for ECS Foundation

Status: accepted

Context:

Aperture initially added a small custom generation-checked entity allocator as the first ECS primitive. The user then requested switching the ECS foundation to EliCS.

Research notes:

- EliCS is a TypeScript/JavaScript ECS framework for web and 3D applications.
- EliCS provides `World`, `createComponent`, `Types`, `createSystem`, component schemas, component registry, pooled/recycled entities, queries, systems, and world update lifecycle.
- EliCS documentation describes components as centralized typed storage rather than per-entity component objects, which fits Aperture's data-driven direction.
- EliCS docs and repository present it as MIT licensed.
- Implementation verified the latest stable npm version as `3.4.2`.

Decision:

Aperture will use EliCS as the ECS foundation rather than continuing to grow a custom ECS implementation, while preserving Aperture's architectural invariants:

- ECS remains authoritative.
- Rendering remains a derived view of ECS state.
- WebGPU remains the only rendering backend.
- Render extraction remains a first-class boundary.
- The renderer must not own gameplay state or require direct ECS access.

Consequences:

- Aperture installs `elics@^3.4.2` and exposes a small ECS entrypoint backed by EliCS.
- The custom `EntityAllocator` API is no longer public.
- Aperture component definitions should use EliCS schemas where practical.
- Any Aperture convenience APIs must remain thin and explicit instead of hiding a scene graph.
- Future render extraction should read from EliCS world/query state and emit serializable render snapshots.

## 0007 — WebGPU-First Array Math

Status: accepted

Context:

Aperture needs math primitives for transforms, bounds, cameras, render extraction, and WebGPU submission. three.js-style math classes are ergonomic, but they encourage per-value object identity and mutation patterns that do not fit ECS column storage, worker snapshots, or allocation-sensitive transform/render extraction systems. The user specifically asked to investigate whether `gl-matrix` or a similar array-first library would be a better fit.

Research notes:

- three.js, Babylon.js, and PlayCanvas all expose ergonomic object/class math surfaces, but their internals still need flat matrix/vector data for rendering.
- `gl-matrix@3.4.4` is MIT licensed, mature, fast, and array-first, but WebGPU projection conventions are not the default; callers must explicitly use `perspectiveZO`/`orthoZO`.
- `wgpu-matrix@3.4.2` is MIT licensed, TypeScript-based, array-first, defaults to `Float32Array`, supports destination arguments for allocation control, and is explicitly WebGPU-oriented with Z 0..1 projection defaults and WebGPU mat3 padding awareness.
- `@math.gl/core@4.1.0` is MIT licensed and ergonomic, but remains class-oriented and broader than Aperture's MVP needs.

Decision:

Aperture will use a WebGPU-first, array-based math architecture:

- `wgpu-matrix` is the preferred internal MVP math kernel.
- Aperture will wrap it behind a small owned `math` module with curated type aliases and helpers.
- ECS-facing and render-extraction math data will be arrays/tuples/numeric storage, not `Vector3`/`Matrix4` class instances.
- Public authoring helpers may accept ergonomic tuple-like inputs, but must copy values into owned ECS/resource storage.
- WebGPU projection conventions use normalized device Z range `[0, 1]` by default.
- Quaternions are stored as `[x, y, z, w]`.

Consequences:

- Transform, camera, bounds, and render extraction implementation tasks should add `wgpu-matrix` rather than implementing a custom math kernel or adopting three-style classes.
- `gl-matrix` remains the fallback if `wgpu-matrix` fails a required performance, correctness, or maintenance criterion.
- The public API can be made ergonomic through helper functions, but not by making object-oriented math classes the ECS storage model.
- Tests must lock projection depth range, transform composition order, quaternion ordering, and allocation-conscious destination usage.
