# Interaction, Picking, Input, Collision, And Physics Boundary Coverage

This note records the reference-engine coverage for `task-0024` and turns it into an Aperture MVP schema direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is to define interaction data without making the renderer own pickable state, without making physics the source of transform truth, and without introducing a hidden scene graph.

MVP coverage should include:

- Ray, bounds, and intersection helper requirements.
- `Pickable` component data.
- CPU-friendly picking query and report shapes.
- Collider component schema design.
- Rigid-body integration boundary, with simulation deferred.
- Frame-local input event/command stream design.
- Future XR controller compatibility through the same ray and input concepts.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/core/Raycaster.js`
- `src/math/Ray.js`
- `src/core/Layers.js`
- `src/core/Object3D.js`
- `src/objects/Mesh.js`
- `src/objects/Line.js`
- `src/objects/Points.js`
- `src/objects/Sprite.js`
- `src/objects/InstancedMesh.js`
- `src/math/Box3.js`
- `src/math/Sphere.js`
- `src/math/Frustum.js`

Findings:

- `Raycaster` derives rays from cameras, filters candidates by layer masks, delegates precise hit behavior to each object's `raycast` hook, optionally recurses through children, and sorts intersections by distance.
- `Layers` is a compact bit-mask filter. Its `test` behavior maps cleanly to Aperture's `layerMask` fields on pick queries and pickable entities.
- `Mesh.raycast` performs broad-phase checks against bounding sphere and local bounding box before triangle tests, then reports distance, point, UVs, normal, face, barycentric coordinate, face index, and object identity.
- `Line.raycast` and `Points.raycast` add threshold-based distance checks. Aperture should reserve schema space for line/point picking but defer it until line and point rendering exist.
- `InstancedMesh.raycast` reports `instanceId`, which is a useful reference for future render-packet instance IDs.
- `Ray`, `Box3`, `Sphere`, and `Frustum` provide the practical helper set Aperture needs: closest-point, distance-to-point/segment, sphere/plane/box/triangle intersections, containment checks, transformed bounds, and frustum tests.
- three.js object raycast hooks are flexible but object-model-specific. Aperture should instead run query functions over ECS-derived bounds, render packets, collider packets, or asset CPU geometry.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Culling/ray.ts`
- `packages/dev/core/src/Culling/ray.core.ts`
- `packages/dev/core/src/Culling/boundingInfo.ts`
- `packages/dev/core/src/Culling/boundingBox.ts`
- `packages/dev/core/src/Culling/boundingSphere.ts`
- `packages/dev/core/src/Collisions/pickingInfo.ts`
- `packages/dev/core/src/Collisions/intersectionInfo.ts`
- `packages/dev/core/src/Collisions/collider.ts`
- `packages/dev/core/src/Collisions/collisionCoordinator.ts`
- `packages/dev/core/src/Collisions/meshCollisionData.ts`
- `packages/dev/core/src/Inputs/scene.inputManager.ts`
- `packages/dev/core/src/Inputs/pointerPickingConfiguration.ts`
- `packages/dev/core/src/DeviceInput/InputDevices/deviceSourceManager.ts`
- `packages/dev/core/src/Events/pointerEvents.ts`
- `packages/dev/core/src/Events/keyboardEvents.ts`
- `packages/dev/core/src/Events/deviceInputEvents.ts`
- `packages/dev/core/src/Physics/v2/physicsBody.ts`
- `packages/dev/core/src/Physics/v2/physicsShape.ts`
- `packages/dev/core/src/Physics/v2/physicsEngine.ts`
- `packages/dev/core/src/Physics/v2/IPhysicsEnginePlugin.ts`
- `packages/dev/core/src/Physics/v2/physicsAggregate.ts`
- `packages/dev/core/src/Physics/v2/Plugins/havokPlugin.ts`
- `packages/dev/core/src/XR/webXRInput.ts`
- `packages/dev/core/src/XR/webXRInputSource.ts`
- `packages/dev/core/src/XR/features/WebXRControllerPointerSelection.ts`
- `packages/dev/core/src/XR/features/WebXRHitTest.ts`

Findings:

- `ray.ts` extends scenes with screen-to-ray helpers plus `pick`, `pickWithRay`, `multiPick`, `multiPickWithRay`, and `pickWithBoundingInfo`. It separates ray creation, predicates, bounding checks, and precise mesh results.
- `PickingInfo` stores whether a hit occurred, hit distance, picked point, picked mesh, barycentric data, face/submesh IDs, sprite information, thin-instance information, and helpers for texture coordinates and normals.
- `PointerPickingConfiguration` allows separate predicates and fast-check behavior for down, up, and move picking. Aperture should expose pick options explicitly instead of hiding them in scene flags.
- `BoundingInfo` joins `BoundingBox` and `BoundingSphere` and supports update, scale, encapsulation, point tests, frustum tests, and collision checks.
- `Collider`, `collisionCoordinator`, and mesh collision data show a separate collision query layer from visual picking. Aperture should keep visual picking, collider queries, and physics simulation as related but distinct systems.
- `DeviceSourceManager` and event files show low-level input state and event streams as their own layer before scene interaction logic.
- Physics v2 uses body, shape, engine, and plugin interfaces, with Havok as a backend plugin. Aperture should model ECS-facing rigid-body and collider data now but keep the physics engine as an optional system/backend later.
- `WebXRControllerPointerSelection` adapts XR controller rays into pointer-style move/down/up interaction using picking results. This reinforces that Aperture's pointer stream should support `pointerType: "xr"` and a controller ray pose without a separate interaction stack.

### PlayCanvas

Representative files inspected:

- `src/core/shape/ray.js`
- `src/core/shape/bounding-box.js`
- `src/core/shape/bounding-sphere.js`
- `src/core/shape/oriented-box.js`
- `src/core/shape/frustum.js`
- `src/core/shape/plane.js`
- `src/core/shape/tri.js`
- `src/scene/picker-id.js`
- `src/framework/graphics/picker.js`
- `src/framework/graphics/render-pass-picker.js`
- `src/scene/shader-lib/wgsl/chunks/common/frag/pick.js`
- `src/platform/input/mouse.js`
- `src/platform/input/keyboard.js`
- `src/platform/input/touch-device.js`
- `src/platform/input/game-pads.js`
- `src/platform/input/controller.js`
- `src/framework/input/element-input.js`
- `src/framework/components/collision/component.js`
- `src/framework/components/collision/system.js`
- `src/framework/components/collision/trigger.js`
- `src/framework/components/collision/data.js`
- `src/framework/components/rigid-body/component.js`
- `src/framework/components/rigid-body/system.js`
- `src/framework/components/rigid-body/data.js`
- `src/framework/components/rigid-body/constants.js`
- `src/framework/xr/xr-input.js`
- `src/framework/xr/xr-input-source.js`
- `src/framework/xr/xr-hit-test.js`

Findings:

- Shape files cover the same core spatial helper set as the other engines: rays, planes, AABBs, spheres, oriented boxes, frustums, and triangles.
- `PickerId` centralizes numeric IDs for GPU picking. `RenderPassPicker` renders pickable mesh instances into a pick buffer and maps IDs back to mesh instances. Aperture can use this later from extracted render packets, not from renderer-owned scene objects.
- Input files keep mouse, keyboard, touch, gamepad, controller, and element hit handling as distinct event sources. Aperture should normalize these into a frame-local input stream before gameplay systems consume them.
- Collision components support `box`, `sphere`, `capsule`, `mesh`, and `compound` shapes, plus triggers. This is a good practical baseline for Aperture's collider schema.
- Rigid-body components and systems create physics bodies from entity/collision data, manage a physics world, emit collision/contact events, and expose raycast queries with filtering. Aperture should preserve this boundary but defer the backend and simulation loop.
- XR input and hit-test files show that controller rays, select/squeeze-style input, handedness, and hit-test results should flow into common interaction concepts rather than a separate scene graph.

## Aperture MVP Schema Direction

### Spatial Helpers

Aperture's math module should expose data-first helpers for:

```ts
interface Ray {
  origin: Vec3;
  direction: Vec3;
}

interface Aabb {
  min: Vec3;
  max: Vec3;
}

interface BoundingSphere {
  center: Vec3;
  radius: number;
}
```

Required helper families:

- Ray construction from normalized viewport coordinates plus an extracted camera/view packet.
- Ray transforms between world and local space.
- Ray against AABB, sphere, plane, triangle, and mesh-local bounds.
- Bounds transform from local mesh space to world space.
- Bounds containment, union, expansion, and frustum tests.
- Distance-to-point and distance-to-segment helpers for later line and point picking.

Helpers should operate on Aperture-owned array/tuple data and return plain values or preallocated output objects. They should not require mutable math class instances.

### Pickable Component

Recommended ECS component:

```ts
interface Pickable {
  enabled: boolean;
  layerMask: number;
  mode: "bounds" | "mesh";
  priority: number;
}
```

Rules:

- `Pickable` marks an entity as eligible for visual picking. It does not create physics bodies.
- Picking also requires a resolved `WorldTransform` and either renderable bounds, collider bounds, or an explicit bounds component.
- `mode: "bounds"` uses transformed AABB/sphere data. `mode: "mesh"` may use CPU mesh triangles after static mesh assets and submesh ranges are available.
- `priority` is for deterministic tie-breaking and UI/interaction layering. Hits still sort by distance first unless a query requests another sort.
- `layerMask` participates in bit-mask filtering with query masks and view masks.

### Picking Query And Report

Recommended query shape:

```ts
interface PickQuery {
  ray: Ray;
  near: number;
  far: number;
  layerMask: number;
  mode: "bounds" | "mesh";
  firstOnly: boolean;
  includeBackfaces: boolean;
  source: "visual" | "collider" | "physics";
}

interface PickHit {
  entity: Entity;
  distance: number;
  point: Vec3;
  normal?: Vec3;
  uv?: Vec2;
  faceIndex?: number;
  submeshIndex?: number;
  instanceIndex?: number;
  layerMask: number;
  source: "bounds" | "mesh" | "collider" | "physics";
}

interface PickReport {
  query: PickQuery;
  hits: PickHit[];
  diagnostics: PickDiagnostic[];
}
```

MVP query behavior:

- Sort hits by ascending distance, then descending `Pickable.priority`, then stable entity ID.
- Respect `near`, `far`, `layerMask`, `Pickable.enabled`, and `Pickable.layerMask`.
- Report diagnostics for missing world transforms, missing bounds, unsupported mesh-pick modes, invalid rays, zero layer masks, and unavailable source backends.
- Keep reports serializable so worker-mode simulation can consume picking results without renderer objects.

### Collider Component Schema

Recommended collider component:

```ts
type ColliderShape =
  | { kind: "box"; halfExtents: Vec3; center?: Vec3 }
  | { kind: "sphere"; radius: number; center?: Vec3 }
  | {
      kind: "capsule";
      radius: number;
      height: number;
      axis: "x" | "y" | "z";
      center?: Vec3;
    }
  | { kind: "mesh"; mesh: MeshHandle }
  | { kind: "compound"; children: ColliderChild[] };

interface ColliderChild {
  localTransform: LocalTransform;
  shape: Exclude<ColliderShape, { kind: "compound" }>;
}

interface Collider {
  enabled: boolean;
  shape: ColliderShape;
  isTrigger: boolean;
  layerMask: number;
  collisionMask: number;
  material?: PhysicsMaterialHandle;
}
```

Rules:

- Colliders are ECS data. They are not renderer pick IDs or physics-engine body objects.
- Static query helpers may use colliders before a physics backend exists.
- Mesh colliders should be accepted as schema but deferred for simulation until asset cooking and backend support exist.
- Trigger behavior is an event-system concern. A trigger collider should not apply impulses.
- Invalid shapes produce diagnostics instead of silently disappearing.

### Rigid-Body Boundary

Recommended future component:

```ts
interface RigidBody {
  type: "static" | "kinematic" | "dynamic";
  mass: number;
  linearVelocity?: Vec3;
  angularVelocity?: Vec3;
  gravityScale?: number;
  lockTranslation?: [boolean, boolean, boolean];
  lockRotation?: [boolean, boolean, boolean];
}
```

Boundary rules:

- ECS `LocalTransform` and `WorldTransform` remain the source of authored state.
- A physics system may read `Collider`, `RigidBody`, and transforms, then write deterministic transform updates and collision/contact events at a defined schedule point.
- Physics backend objects live in a physics-world resource, not in durable ECS components.
- The renderer consumes only extracted transform/render data and should not depend on physics backend bodies.
- Physics raycasts may produce `PickHit`-compatible reports, but they are a separate query source from visual picking.

### Input Event And Command Stream

Aperture should normalize platform input into frame-local event data:

```ts
type InputEvent =
  | PointerInputEvent
  | KeyboardInputEvent
  | WheelInputEvent
  | GamepadInputEvent
  | XrInputEvent;

interface PointerInputEvent {
  kind: "pointer";
  phase: "down" | "move" | "up" | "cancel";
  pointerId: number;
  pointerType: "mouse" | "touch" | "pen" | "xr";
  position: Vec2;
  button?: number;
  buttons?: number;
  modifiers?: InputModifiers;
  ray?: Ray;
  pick?: PickReport;
}
```

Rules:

- Input events are frame-local resources/events, not durable ECS state.
- Gameplay systems may convert input events into command buffers that mutate ECS state at deterministic schedule points.
- Pointer events may carry a ray and optional pick report after camera/view data is available.
- Keyboard, wheel, touch, gamepad, and XR inputs should share timestamp/frame metadata.
- Commands should be explicit, replayable data. They should not be closures that capture renderer or DOM state.

### Future XR Controller Compatibility

Future XR support should reuse the same concepts:

- XR controller target rays become `Ray` values with `pointerType: "xr"`.
- Select/squeeze/controller button changes become pointer or XR input events.
- Handedness, grip pose, target-ray pose, input-source ID, and profiles should be event fields or transient resources.
- XR hit-test results can be represented as pick-like reports with `source: "physics"` or a future `source: "xr-hit-test"` extension.
- XR views/cameras remain view packets. They should not create a renderer-owned scene graph or bypass ECS extraction.

## Feature Classification

MVP:

- `Ray`, `Aabb`, `BoundingSphere`, and intersection helper definitions.
- `Pickable` component schema.
- `PickQuery`, `PickHit`, and `PickReport` schemas.
- CPU bounds picking against ECS/extracted bounds.
- Input event and command stream schema.
- Collider and rigid-body component schemas as documented boundaries, without simulation.
- Diagnostics for invalid pick/input/collider state.

Soon:

- Pointer-to-ray helpers from camera/view packets.
- CPU triangle picking for static mesh assets and submesh ranges.
- Collider query helpers independent of physics simulation.
- Trigger event model after the command/event scheduler exists.
- Basic mouse, touch, keyboard, wheel, and gamepad adapters.
- Visual picking integration with render extraction reports.

Later:

- GPU picking pass using renderer-assigned pick IDs from render packets.
- Full physics backend integration and dynamic rigid bodies.
- Mesh collider cooking and broad-phase acceleration structures.
- Contact manifolds, constraints, joints, character controllers, and vehicles.
- XR controller pointer selection and XR hit testing.
- UI event routing, drag/drop capture, gesture recognition, and editor gizmos.
- Line, point, sprite, skinned mesh, and morphed mesh precise picking.

## Diagnostics

Recommended diagnostic codes:

- `pick.invalidRay`
- `pick.zeroLayerMask`
- `pick.noCameraView`
- `pick.missingWorldTransform`
- `pick.missingBounds`
- `pick.unsupportedMeshMode`
- `pick.physicsBackendUnavailable`
- `collider.invalidShape`
- `collider.missingMeshAsset`
- `rigidBody.missingCollider`
- `input.missingViewport`
- `xr.missingControllerPose`

Diagnostics should include entity IDs, component names, asset handles, query source, and enough context for agents to explain why an interaction query did or did not produce a hit.

## Future Implementation Acceptance Tests

- Ray/AABB and ray/sphere helpers return nearest positive hit distances and reject hits outside the query range.
- `PickQuery` filters entities by query mask and `Pickable.layerMask`.
- Disabled `Pickable` entities do not produce hits.
- Bounds picking sorts by distance and uses stable entity ID tie-breaking.
- Missing `WorldTransform` on a pickable entity produces a structured diagnostic.
- Mesh picking reports submesh and face indices for a static triangle mesh.
- Pointer-to-ray conversion from a perspective camera produces a normalized world-space ray.
- Collider schema validation rejects negative radii and zero extents with diagnostics.
- Trigger colliders emit events without requiring a rigid body simulation backend.
- Rigid-body backend resources are not stored inside durable ECS components.
- Gamepad and keyboard input events are frame-local and clear between frames.
- XR controller events can carry a target ray using the same pick query path as pointer events.

## Architectural Guardrails

- Picking must read ECS-derived or extraction-derived data. It must not walk a renderer-owned object tree.
- Render picking IDs, if added later, are renderer resources derived from render packets and mapped back to ECS entity IDs.
- Physics backend state is an implementation cache owned by a physics-world resource.
- Input events and commands are frame-local and serializable enough for future worker-mode simulation.
- Visual picking, collider queries, and physics raycasts can share report shapes, but their backends and diagnostics remain distinguishable.
