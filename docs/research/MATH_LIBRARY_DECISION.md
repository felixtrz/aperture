# Math Library Decision Research

Date: 2026-05-15

## Recommendation

Aperture should use `wgpu-matrix` as the internal math kernel for MVP implementation, wrapped by a small Aperture-owned math module.

Prescriptive policy:

- Use array-first math types internally, not three.js-style mutable classes.
- Use `Float32Array` for hot runtime math and GPU-adjacent data by default.
- Use plain readonly tuples only for authoring convenience and configuration inputs.
- Use WebGPU clip-space conventions by default.
- Do not expose `wgpu-matrix` as the whole public math API. Aperture should export a curated `math` surface and type aliases so the dependency can be swapped if needed.
- Do not put object-oriented vector/matrix class instances into ECS components.
- Do not add three.js, Babylon.js, or PlayCanvas math classes as dependencies.

## Compared Options

### three.js Math Classes

Reference path:

- `references/three.js/src/math`

Useful traits:

- Ergonomic classes: `Vector2`, `Vector3`, `Vector4`, `Quaternion`, `Matrix3`, `Matrix4`, `Color`, `Ray`, `Box3`, `Sphere`, `Frustum`, and related helpers.
- Excellent user-facing examples and discoverable instance methods.
- `Object3D` integration makes transform authoring pleasant for direct object APIs.

Problems for Aperture:

- Class instances encourage object graph modeling and mutable object references.
- Per-value object allocation is a poor fit for ECS column storage, render extraction, and worker snapshots.
- Matrix/projection conventions are inherited from a cross-backend engine and are not WebGPU-first.
- Importing or mimicking three-style classes would pull Aperture toward scene-graph ergonomics at the wrong architectural layer.

Conclusion:

- Use three.js as an ergonomics reference only.
- Do not use three.js math classes internally.

### gl-matrix

Reference path:

- `/Users/felixz/Projects/aperture-reference-libs/gl-matrix`, commit `accefb6`

NPM metadata checked:

- package: `gl-matrix`
- version: `3.4.4`
- license: MIT
- types: `dist/index.d.ts`
- module: `esm/index.js`

Useful traits:

- Mature, widely used, low-level, array-first math library.
- Strong fit for allocation-sensitive code because APIs write to explicit output arrays.
- Supports `Float32Array` by default and can change array type through `setMatrixArrayType`.
- Has WebGPU-suitable projection helpers such as `mat4.perspectiveZO` and `mat4.orthoZO`.
- Has broad coverage: `vec2`, `vec3`, `vec4`, `quat`, `mat2`, `mat2d`, `mat3`, `mat4`.

Problems for Aperture:

- WebGPU conventions are not the default. The default `mat4.perspective` aliases the `NO` depth range path, while WebGPU requires `ZO`.
- API is more verbose: `mat4.perspective(out, ...)` and `mat4.fromRotationTranslationScale(out, ...)`.
- Type surface is older and less expressive than a TypeScript-native library.
- gl-matrix is a strong fallback if `wgpu-matrix` fails, but it requires more Aperture wrapper discipline to avoid wrong projection defaults.

Conclusion:

- Keep gl-matrix as the fallback option.
- Do not choose it as the default MVP math kernel unless `wgpu-matrix` proves insufficient.

### wgpu-matrix

Reference path:

- `/Users/felixz/Projects/aperture-reference-libs/wgpu-matrix`, commit `3dba901`

NPM metadata checked:

- package: `wgpu-matrix`
- version: `3.4.2`
- license: MIT
- types: `dist/3.x/wgpu-matrix.d.ts`
- module: `dist/3.x/wgpu-matrix.module.js`

Useful traits:

- WebGPU-specific defaults: projection helpers target WebGPU clip-space Z 0..1.
- Explicitly handles WebGPU mat3 padding expectations.
- Array-first API with optional destination parameters, so hot paths can avoid allocations.
- Defaults to `Float32Array`, but also exposes `Float64Array` and `number[]` variants.
- TypeScript source and type aliases for `Vec2`, `Vec3`, `Vec4`, `Quat`, `Mat3`, and `Mat4`.
- More ergonomic than gl-matrix while preserving destination-based operation:
  - `mat4.perspective(fov, aspect, near, far, dst?)`
  - `mat4.translation([x, y, z], dst?)`
  - `mat4.lookAt(eye, target, up, dst?)`

Risks:

- Smaller ecosystem than gl-matrix.
- Less long-term battle history than gl-matrix.
- We should avoid leaking it directly as the complete public API.

Conclusion:

- Best fit for a WebGPU-only, ECS-first runtime.
- Adopt as Aperture's internal MVP math kernel.

### math.gl

NPM metadata checked:

- package: `@math.gl/core`
- version: `4.1.0`
- license: MIT
- description: array-based 3D math classes optimized for WebGL applications

Useful traits:

- More ergonomic object/class API than gl-matrix.
- Strong geospatial and vis.gl ecosystem ties.

Problems for Aperture:

- Class-oriented surface is not the desired ECS storage model.
- Larger ecosystem scope than Aperture needs for MVP.
- Less directly aligned with WebGPU clip-space and renderer data layout than `wgpu-matrix`.

Conclusion:

- Not selected for MVP.

## Aperture Math Architecture

### Internal Types

Use `wgpu-matrix` types behind Aperture aliases:

```ts
export type Vec2 = Float32Array;
export type Vec3 = Float32Array;
export type Vec4 = Float32Array;
export type Quat = Float32Array;
export type Mat3 = Float32Array;
export type Mat4 = Float32Array;
```

The exact aliases can narrow later to `wgpu-matrix` exported types, but the important invariant is: math values in runtime hot paths are arrays, not classes.

### Authoring Inputs

Public authoring helpers may accept tuples:

```ts
type Vec3Like = readonly [number, number, number] | Float32Array;
type QuatLike = readonly [number, number, number, number] | Float32Array;
type Mat4Like = readonly number[] | Float32Array;
```

Helpers should copy tuple inputs into owned ECS/component storage rather than retaining arbitrary external arrays.

### ECS Storage

EliCS component schemas should use numeric fields or vector-like storage compatible with its data model:

- `LocalTransform.translation`: `Vec3`
- `LocalTransform.rotation`: `Vec4` quaternion
- `LocalTransform.scale`: `Vec3`
- `WorldTransform.matrix`: `Mat4`

If EliCS vector component storage cannot hold 16-float matrices directly, `WorldTransform` should either:

- use four `Vec4` fields, or
- store a handle/index into a transform matrix resource owned by the ECS/simulation layer.

This should be resolved in `task-0017`.

### Allocation Policy

Hot systems should follow this pattern:

- Allocate scratch vectors/matrices outside inner loops.
- Pass destination arrays to math functions.
- Avoid returning newly allocated math values from per-entity update code.
- Expose allocation-friendly helpers with names that make mutation clear.

Example style:

```ts
mat4.fromRotationTranslationScale(localMatrix, rotation, translation, scale);
mat4.multiply(worldMatrix, parentWorldMatrix, localMatrix);
```

If using `wgpu-matrix`, the actual argument order is input-first, destination-last:

```ts
mat4.multiply(parentWorldMatrix, localMatrix, worldMatrix);
```

The Aperture wrapper should normalize naming and document argument order clearly.

### Public Ergonomics

We should recover some of three.js's ergonomics without copying its runtime representation.

Recommended helpers:

- `vec3(x, y, z): Vec3`
- `quatIdentity(): Quat`
- `mat4Identity(): Mat4`
- `localTransform({ translation, rotation, scale })`
- `cameraLookAt({ eye, target, up })`

Do not add `new Vector3()`, `Vector3.add()`, or mutable chained object APIs for ECS-facing data.

### Coordinate And Projection Conventions

MVP should standardize:

- Right-handed world coordinates unless a future decision changes it.
- WebGPU normalized device Z range `[0, 1]`.
- Column-major matrices compatible with WGSL uniform/storage layout expectations.
- Quaternions stored as `[x, y, z, w]`.
- Transforms represented as translation + quaternion + scale at the authoring level.

These conventions need tests before transform implementation proceeds.

## Follow-Up Work

Update `task-0017` to produce:

- A minimal `math` module design based on `wgpu-matrix`.
- A decision on how `WorldTransform.matrix` is represented in EliCS.
- Tests that lock projection conventions against WebGPU depth range.
- Tests that lock transform composition order.
- Tests that verify no math class instances are stored in ECS component data.
