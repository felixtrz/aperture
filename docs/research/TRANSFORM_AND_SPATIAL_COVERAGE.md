# Transform And Spatial Coverage

Date: 2026-05-15

Status: task-0017 coverage output

This document maps transform, hierarchy, math, bounds, ray, and frustum concepts from three.js, Babylon.js, and PlayCanvas into Aperture's ECS-first MVP design.

It follows the accepted math decision in `docs/DECISIONS.md#0007--webgpu-first-array-math`: `wgpu-matrix` is the preferred internal MVP math kernel behind an Aperture-owned `math` module. This task did not reopen that choice.

## Reference Source Anchors

three.js:

- `references/three.js/src/core/Object3D.js`
- `references/three.js/src/math/Vector2.js`
- `references/three.js/src/math/Vector3.js`
- `references/three.js/src/math/Vector4.js`
- `references/three.js/src/math/Quaternion.js`
- `references/three.js/src/math/Matrix3.js`
- `references/three.js/src/math/Matrix4.js`
- `references/three.js/src/math/Ray.js`
- `references/three.js/src/math/Box3.js`
- `references/three.js/src/math/Sphere.js`
- `references/three.js/src/math/Plane.js`
- `references/three.js/src/math/Frustum.js`

Babylon.js:

- `Babylon.js/packages/dev/core/src/Meshes/transformNode.ts`
- `Babylon.js/packages/dev/core/src/Maths/math.vector.ts`
- `Babylon.js/packages/dev/core/src/Maths/math.plane.ts`
- `Babylon.js/packages/dev/core/src/Maths/math.frustum.ts`
- `Babylon.js/packages/dev/core/src/Culling/ray.core.ts`
- `Babylon.js/packages/dev/core/src/Culling/boundingInfo.ts`
- `Babylon.js/packages/dev/core/src/Culling/boundingBox.ts`
- `Babylon.js/packages/dev/core/src/Culling/boundingSphere.ts`

PlayCanvas:

- `references/engine/src/scene/graph-node.js`
- `references/engine/src/core/math/vec2.js`
- `references/engine/src/core/math/vec3.js`
- `references/engine/src/core/math/vec4.js`
- `references/engine/src/core/math/quat.js`
- `references/engine/src/core/math/mat3.js`
- `references/engine/src/core/math/mat4.js`
- `references/engine/src/core/shape/ray.js`
- `references/engine/src/core/shape/bounding-box.js`
- `references/engine/src/core/shape/bounding-sphere.js`
- `references/engine/src/core/shape/plane.js`
- `references/engine/src/core/shape/frustum.js`

Math kernel:

- `wgpu-matrix/src/wgpu-matrix.ts`
- `wgpu-matrix/src/types.ts`
- `wgpu-matrix/src/vec2-impl.ts`
- `wgpu-matrix/src/vec3-impl.ts`
- `wgpu-matrix/src/vec4-impl.ts`
- `wgpu-matrix/src/quat-impl.ts`
- `wgpu-matrix/src/mat3-impl.ts`
- `wgpu-matrix/src/mat4-impl.ts`

EliCS storage references:

- `./node_modules/elics/lib/types.d.ts`
- `./node_modules/elics/lib/entity.d.ts`
- `./node_modules/elics/lib/component.js`
- `./node_modules/elics/lib/entity.js`

## Reference Coverage Summary

### three.js

three.js centers transform authoring on `Object3D`. It stores local position, quaternion, scale, a local matrix, a world matrix, a parent pointer, and an ordered children array. World transform propagation composes a root's local matrix directly and composes children from parent world matrix multiplied by local matrix. It also folds visibility, layers, render order, frustum-culling flags, and user data into the same object model.

Spatial primitives are object-oriented classes:

- `Ray`: origin, direction, point-at-distance, recast, distance-to-point, ray/sphere, ray/plane, ray/box, ray/triangle, and matrix transform.
- `Box3`: min/max AABB, construction from points/attributes/objects, expansion, containment, intersection, union, bounding-sphere derivation, and transform by matrix through eight corners.
- `Sphere`: center/radius, construction from points, containment, sphere/box/plane intersection, matrix transform with max scale, and bounding-box derivation.
- `Frustum`: six planes derived from a projection matrix, with object, sphere, box, and point tests.

Aperture should treat three.js as an ergonomics and coverage reference only. Its `Object3D` shape is exactly the object graph Aperture must not make authoritative.

### Babylon.js

Babylon.js separates a non-rendered `TransformNode` from renderable mesh classes, but transform state is still held by mutable node objects. `TransformNode` tracks position, rotation/euler, optional rotation quaternion, scaling, pivot matrix, billboard mode, parent, dirty/cache state, local matrix, and world matrix. It supports reparenting while preserving world transform, pivot adjustments, billboards, non-uniform-scaling state, and bone attachment paths.

Babylon's math layer is class based but allocation-conscious: many helpers have `ToRef` variants. `Matrix.ComposeToRef`, `Matrix.Decompose`, `Matrix.LookAt*ToRef`, projection helpers, `Vector3.TransformCoordinatesToRef`, and `Vector3.TransformNormalToRef` are the important coverage anchors for Aperture's wrapper shape.

Spatial primitives are split across culling modules:

- `Ray` in `ray.core.ts`: origin, direction, optional length, box/sphere/triangle/plane tests, mesh picking helpers, camera picking-ray creation, and matrix transform to a reused destination ray.
- `BoundingInfo`: pairs a `BoundingBox` and `BoundingSphere`, updates both from a world matrix, and checks culling/intersections with sphere-first broad phase.
- `BoundingBox`: local/world min/max, center, extents, eight world vectors, frustum checks, sphere/box/point intersections.
- `BoundingSphere`: local/world center and radius, frustum checks, point/sphere intersections, and world-radius scaling from the max transformed axis.
- `Frustum`: six planes extracted from a transform matrix.

Aperture should borrow Babylon's distinction between local and world bounds and its destination/ref style, but not its node-owned scene state.

### PlayCanvas

PlayCanvas uses `GraphNode` for hierarchy and transform propagation under framework `Entity` objects. `GraphNode` stores local position, rotation, scale, local transform, world transform, parent, children, graph depth, dirty local/world flags, enabled-in-hierarchy state, and optional scale compensation. It updates world transforms by recursively syncing dirty nodes and composing parent world transform with local transform.

PlayCanvas math and shapes are class-based but small and direct:

- `Mat4`: `setTRS`, multiplication, affine multiplication, transform point/vector, invert, perspective, orthographic, look-at-like helpers, translation and scale extraction.
- `Quat`: euler/axis construction, multiplication, inversion, interpolation, transform vector, matrix extraction.
- `BoundingBox`: center and half extents, min/max helpers, ray intersection, transformed-AABB support, vertex min/max computation, point/sphere intersection.
- `BoundingSphere`: center/radius, point, ray, and sphere intersection.
- `Ray`: copied origin/direction only.
- `Plane` and `Frustum`: normalized planes and frustum extraction from a matrix.

Aperture should borrow PlayCanvas' explicit dirty propagation and center/half-extents AABB convenience where useful, but ECS components must remain the source of truth.

## Aperture Math Module MVP

The `math` module should be an Aperture-owned facade over `wgpu-matrix`. It should export curated type aliases and functions, not the entire dependency as the public contract.

Recommended type aliases:

```ts
export type Vec2 = Float32Array;
export type Vec3 = Float32Array;
export type Vec4 = Float32Array;
export type Quat = Float32Array;
export type Mat3 = Float32Array;
export type Mat4 = Float32Array;

export type Vec2Like = readonly [number, number] | Float32Array;
export type Vec3Like = readonly [number, number, number] | Float32Array;
export type Vec4Like = readonly [number, number, number, number] | Float32Array;
export type QuatLike = readonly [number, number, number, number] | Float32Array;
export type Mat4Like = ArrayLike<number>;
```

Recommended wrapped `wgpu-matrix` functions for MVP:

- `vec2.create`, `vec2.set`, `vec2.copy`.
- `vec3.create`, `vec3.set`, `vec3.copy`, `vec3.add`, `vec3.subtract`, `vec3.multiply`, `vec3.normalize`, `vec3.dot`, `vec3.cross`, `vec3.length`, `vec3.lengthSq`, `vec3.distance`, `vec3.distanceSq`, `vec3.transformMat4`, `vec3.transformMat4Upper3x3`, `vec3.lerp`.
- `vec4.create`, `vec4.set`, `vec4.copy`.
- `quat.identity`, `quat.fromAxisAngle`, `quat.fromEuler`, `quat.multiply`, `quat.normalize`, `quat.invert`, `quat.slerp`, `quat.fromMat`, `quat.rotationTo`.
- `mat3.create`, `mat3.identity`, `mat3.fromMat4`, `mat3.transpose`, `mat3.inverse`.
- `mat4.create`, `mat4.identity`, `mat4.copy`, `mat4.multiply`, `mat4.inverse`, `mat4.transpose`, `mat4.fromQuat`, `mat4.translation`, `mat4.setTranslation`, `mat4.getTranslation`, `mat4.getAxis`, `mat4.perspective`, `mat4.ortho`, `mat4.lookAt`, `mat4.rotationX`, `mat4.rotationY`, `mat4.rotationZ`, `mat4.rotation`, `mat4.scaling`.

Aperture-specific helpers should normalize naming and argument order:

- `composeTransform(out, translation, rotation, scale)`: write a column-major mat4 from TRS.
- `composeWorldTransform(out, parentWorld, local)`: multiply parent world by local.
- `transformPoint(out, matrix, point)`: position transform with translation.
- `transformDirection(out, matrix, direction)`: upper-3x3 direction transform.
- `makePerspective(out, fovyRadians, aspect, near, far)`: WebGPU Z `[0, 1]`.
- `makeOrthographic(out, left, right, bottom, top, near, far)`: WebGPU Z `[0, 1]`.
- `makeLookAt(out, eye, target, up)`: camera/world matrix helper; view-matrix helper should be explicit if it returns the inverse.
- `copyMat4ToColumns(matrix, c0, c1, c2, c3)` and `copyColumnsToMat4(c0, c1, c2, c3, matrix)`.

`wgpu-matrix` uses destination-last APIs. Aperture should document this once and make its wrapper names mutation-explicit where useful.

## ECS Component Mapping

### LocalTransform

Purpose: authoritative local transform owned by the ECS simulation layer.

EliCS schema:

```ts
const LocalTransform = defineComponent("aperture.transform.local", {
  translation: { type: EcsType.Vec3, default: [0, 0, 0] },
  rotation: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
  scale: { type: EcsType.Vec3, default: [1, 1, 1] },
});
```

Notes:

- `rotation` is a quaternion stored as `[x, y, z, w]`.
- Authoring helpers may accept tuple-like inputs, but must copy into EliCS vector storage through `getVectorView`.
- No Euler rotation component is required for MVP. Euler helpers can create quaternions at authoring boundaries.

### Parent

Purpose: authoritative transform parent relationship.

EliCS schema:

```ts
const Parent = defineComponent("aperture.transform.parent", {
  entity: { type: EcsType.Entity, default: null },
});
```

Notes:

- `null` means root.
- EliCS entity references are generation checked and resolve destroyed entities to `null`, which is useful for parent-destroy behavior.
- Reparenting semantics should be explicit in helper APIs: `setParentKeepLocal` for MVP, `setParentKeepWorld` later unless needed by importers.

### WorldTransform

Purpose: derived ECS-owned world transform consumed by render extraction.

EliCS-compatible schema:

```ts
const WorldTransform = defineComponent("aperture.transform.world", {
  col0: { type: EcsType.Vec4, default: [1, 0, 0, 0] },
  col1: { type: EcsType.Vec4, default: [0, 1, 0, 0] },
  col2: { type: EcsType.Vec4, default: [0, 0, 1, 0] },
  col3: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
});
```

Decision: represent `WorldTransform.matrix` as four `Vec4` columns in EliCS storage.

Rationale:

- EliCS has `Vec2`, `Vec3`, `Vec4`, and `Color` vector storage but no `Mat4` type.
- Four `Vec4` fields stay in typed arrays and avoid `Object` fields.
- Column fields match the common mat4 memory layout used by WebGPU/WGSL and `wgpu-matrix` arrays, including translation in column 3.
- Render extraction can copy columns into a packed snapshot transform buffer without consulting renderer state.
- A future ECS matrix-resource indirection remains possible for very large worlds, but it is unnecessary for MVP and would add lifecycle complexity too early.

Do not store `WorldTransform.matrix` as an arbitrary `Object` field for MVP. That would work mechanically but would weaken serialization, worker transport, and query-time introspection.

### HierarchyIndex Resource

Purpose: optional derived resource for deterministic transform traversal.

MVP shape:

```ts
interface HierarchyIndex {
  roots: Entity[];
  childrenByParent: Map<number, Entity[]>;
  parentByChild: Map<number, Entity | null>;
}
```

Notes:

- This is simulation/ECS-layer derived state, not renderer state.
- Keys should use stable packed entity identity or an Aperture helper that includes generation, not raw indices alone.
- The resource may be rebuilt each transform update for MVP if scene sizes are small. Dirty incremental maintenance can follow when profiling justifies it.

## Spatial Primitive Mapping

Spatial primitives should live in the `math` or `spatial` module as plain data plus pure functions. They should not be ECS components by default, except where a later component references them.

### Ray

MVP data:

```ts
interface Ray {
  origin: Vec3;
  direction: Vec3;
}
```

Rules:

- `direction` should be normalized by construction helpers unless explicitly documented otherwise.
- MVP helpers: create/copy/set, point-at-distance, transform by mat4, distance-squared to point, intersects plane, intersects AABB, intersects sphere.
- Triangle and mesh picking belong to the picking task, but ray/triangle math can be added with tests if needed by mesh picking.

### Aabb

MVP data:

```ts
interface Aabb {
  min: Vec3;
  max: Vec3;
}
```

Rules:

- Store min/max as canonical data because that maps directly to importers, broad-phase tests, and render extraction diagnostics.
- Public helpers may expose center/half-extents conversion for PlayCanvas-style ergonomics.
- MVP helpers: empty, from points, from center/half-extents, center, half extents, union, contains point, intersects AABB, intersects sphere, transform by mat4 through eight corners.

### BoundingSphere

MVP data:

```ts
interface BoundingSphere {
  center: Vec3;
  radius: number;
}
```

Rules:

- MVP helpers: from points, from AABB, contains point, intersects sphere, intersects AABB, transform by mat4 using maximum axis scale.
- Negative radius can represent empty only if the helper APIs document it clearly. Prefer an explicit `emptySphere()` helper and tests.

### Plane

MVP data:

```ts
interface Plane {
  normal: Vec3;
  distance: number;
}
```

Rules:

- Plane equation: `dot(normal, point) + distance = 0`.
- MVP helpers: normalize, distance to point, transform by inverse-transpose matrix if needed by frustum extraction.

### Frustum

MVP data:

```ts
interface Frustum {
  planes: [Plane, Plane, Plane, Plane, Plane, Plane];
}
```

Rules:

- Build from view-projection matrix using WebGPU projection conventions.
- MVP helpers: from matrix, contains point, intersects AABB, intersects sphere.
- Plane order should be documented and locked by tests. Suggested order: left, right, bottom, top, near, far.

## MVP vs Later Scope

### Transform dirty propagation

MVP:

- Implement deterministic full transform resolution each frame or each explicit transform update.
- Rebuild a hierarchy index from `Parent` components if simpler.
- Process roots first, then children breadth-first or depth-first in stable entity order.
- Emit diagnostics or throw from validation when cycles are found.

Soon:

- Add dirty flags for changed local transforms and changed parent relationships.
- Incrementally propagate dirty state to descendants.

Later:

- Chunked transform storage, multithread-friendly transform buffers, and partial snapshot publication.

### Cycle detection

MVP:

- Reject cycles during transform update with an actionable diagnostic naming the involved entities.
- A simple DFS color marking pass is acceptable for MVP.

Soon:

- Validate on `setParent` helper calls before mutation.

Later:

- Rich hierarchy diagnostics for imported scenes.

### Reparenting semantics

MVP:

- `setParentKeepLocal(child, parent)` only. The child keeps local TRS, so world transform may change.
- Removing a destroyed or missing parent makes the child a root on the next transform resolution pass unless stricter validation is enabled.

Soon:

- `setParentKeepWorld(child, parent)` that decomposes the new local transform from current world and parent inverse.

Later:

- Importer-specific pivot preservation and scene-authoring convenience APIs.

### Non-uniform scale caveats

MVP:

- Support TRS composition with non-uniform scale.
- Document that look-at decomposition, keep-world reparenting, and some direction transforms may behave poorly with sheared or non-uniformly scaled ancestors.
- Bounds transforms must use conservative AABB corner transform or max-axis sphere scaling.

Soon:

- Add diagnostics when helpers such as look-at are asked to preserve world orientation under non-uniform parent scale.

Later:

- Optional transform decomposition policy for sheared matrices if importers require it.

### Billboard and pivot support

MVP:

- Defer billboard components and pivot matrices.
- GLB node transforms should import as TRS or matrix-decomposed TRS where possible; unsupported pivot semantics should produce importer diagnostics.

Soon:

- Add `Billboard` as an ECS render-authoring component that is resolved before extraction, not inside the renderer's authoritative state.

Later:

- Add pivot support if a concrete importer or authoring workflow requires it. Pivot should compile to transform math in ECS, not to a renderer-owned node.

## Future Implementation Acceptance Tests

The implementation backlog after the planning gate should include tests like these:

1. `LocalTransform` defaults to translation `[0, 0, 0]`, rotation `[0, 0, 0, 1]`, and scale `[1, 1, 1]` in EliCS vector storage.
2. A root entity's `WorldTransform` columns equal the composed local TRS matrix.
3. A child entity's `WorldTransform` equals `parentWorld * childLocal` and keeps translation in column 3.
4. A three-level hierarchy resolves in stable order regardless of entity creation order after the hierarchy index is built.
5. A parent cycle is rejected with an actionable diagnostic and no renderer state is touched.
6. Destroying a parent causes generation-checked parent references to resolve to `null`, and the next transform update treats the child as a root or reports the configured policy.
7. Reparent keep-local changes world transform predictably and does not mutate local TRS.
8. `WorldTransform` uses four EliCS `Vec4` fields and never stores a `Matrix4` class instance or arbitrary object.
9. Perspective and orthographic helpers produce WebGPU Z `[0, 1]` projection matrices.
10. Quaternion helpers preserve `[x, y, z, w]` ordering for identity, axis-angle, and multiplication.
11. Transforming an AABB by a rotated/scaled matrix produces a conservative world AABB from all eight corners.
12. Transforming a bounding sphere by a non-uniform scale uses the maximum axis scale for radius.
13. Frustum extraction from a view-projection matrix culls an AABB behind the camera and accepts one in front.
14. Ray/AABB and ray/sphere tests cover hit, miss, inside-origin, and parallel-axis cases.

## Implementation Guidance

When transform implementation resumes:

- Add `wgpu-matrix` as the math dependency only when runtime code needs it.
- Introduce an Aperture `math` module before transform components depend on raw `wgpu-matrix` imports.
- Keep ECS component definitions separate from pure spatial helpers.
- Keep `WorldTransform` derivation in an ECS system.
- Render extraction should read `WorldTransform` and copy matrix columns into snapshot data; it must not walk `Parent` or compute hierarchy.
- Do not add an `Object3D`, `Node`, `GraphNode`, or renderer-owned scene graph compatibility layer as part of the MVP transform work.
