# Backlog

This file contains immediate executable tasks.

Agents should complete one task per run unless explicitly instructed otherwise.

When tasks are completed, move them to `agent/COMPLETED.md` or mark them complete here and summarize in handoff.

## Ready Tasks

### task-0003 — Implement entity allocator

Implement ECS entity allocation with stable numeric IDs and generation counters.

Acceptance criteria:

- Entities can be created.
- Entities can be destroyed.
- Destroyed IDs can be reused safely.
- Stale entity references can be detected.
- Tests cover create/destroy/reuse/stale-reference behavior.

### task-0004 — Implement component registry and storage

Implement minimal component registration and storage.

Acceptance criteria:

- Component types can be registered.
- Components can be added to entities.
- Components can be retrieved.
- Components can be removed.
- Component presence can be checked.
- Tests cover add/get/remove/has behavior.

### task-0005 — Implement ECS query API

Implement queries by component set.

Acceptance criteria:

- Query can return entities with one component.
- Query can return entities with multiple components.
- Query results update after component add/remove.
- Tests cover query correctness.

### task-0006 — Implement system schedule

Implement deterministic system execution.

Acceptance criteria:

- Systems can be registered.
- Systems execute in defined order.
- Systems receive world/context.
- Tests cover execution order.

### task-0007 — Add command and event model

Add simple frame-local commands/events.

Acceptance criteria:

- Events can be emitted and consumed.
- Commands can be queued and applied at a deterministic point.
- Tests cover command/event lifecycle.
- Documentation explains durable state vs frame-local events.

### task-0008 — Add transform component types

Add `LocalTransform`, `WorldTransform`, and `Parent` component definitions.

Acceptance criteria:

- Component types are strongly typed.
- Default constructors/helpers exist if useful.
- Tests cover storage of transform components.

### task-0009 — Implement transform resolution system

Compute `WorldTransform` from `LocalTransform` and `Parent`.

Acceptance criteria:

- Root entity world transform equals local transform.
- Child world transform composes with parent.
- Parent changes update children.
- Tests cover simple hierarchy.

### task-0010 — Add render authoring components

Add initial render-facing ECS components.

Suggested components:

- `MeshRenderer`
- `Camera`
- `Visibility`
- `RenderLayer`
- `Name`

Acceptance criteria:

- Components are typed.
- Components are stored in ECS.
- Query for renderable entities works.
- Tests cover render component storage.

### task-0011 — Define asset handle types

Define stable handle types for assets.

Suggested handles:

- `AssetHandle`
- `MeshHandle`
- `MaterialHandle`
- `TextureHandle`

Acceptance criteria:

- Handles are typed enough to avoid accidental mixing.
- Handles can be compared/stored.
- Docs explain that ECS stores handles, not GPU objects.

### task-0012 — Define RenderPacket and RenderSnapshot

Create flat render-facing data structures.

Acceptance criteria:

- `RenderPacket` type exists.
- `RenderSnapshot` type exists.
- Types do not depend on WebGPU objects.
- Types are suitable for future serialization.
- Tests or type-level examples cover basic usage.

### task-0013 — Implement RenderExtractSystem

Implement extraction from ECS world into render packets.

Acceptance criteria:

- Reads `WorldTransform` + `MeshRenderer`.
- Skips invisible entities.
- Includes layer information.
- Includes stable entity/render IDs.
- Tests cover extraction.

### task-0014 — Add architecture invariant tests or checks

Add tests or static checks for key architectural constraints where possible.

Acceptance criteria:

- Render snapshot types do not import WebGPU backend modules.
- ECS components do not contain GPU objects.
- Tests/checks document architectural boundaries.

### task-0015 — Add WebGPU support detection

Create WebGPU detection/init error path.

Acceptance criteria:

- Function detects whether WebGPU is available.
- Unsupported error is clear and actionable.
- No ECS dependency in WebGPU detection module.
- Tests cover unsupported logic where practical.

## Backlog Maintenance Rules

At the end of a run:

- Mark completed task(s).
- Add new tasks if the backlog has fewer than five ready tasks.
- New tasks must align with roadmap.
- New tasks must have acceptance criteria.
- Prefer tasks that unblock the next roadmap phase.
