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
