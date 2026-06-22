# @aperture-engine/math

Fast, zero-dependency, **WebGPU-first** 3D math for the [Aperture](https://github.com/felixtrz/aperture) engine.

`Float32Array`-native vectors, quaternions, and 4×4 matrices, with an ergonomic wrapper API and a raw, allocation-free kernel — tuned to be the fastest option for a real engine's transform workload.

## Install

```sh
pnpm add @aperture-engine/math
```

## Why

- **Zero dependencies.** Pure TypeScript over `Float32Array`. Nothing to audit, nothing to bundle.
- **WebGPU-first by default.** Column-major matrices, clip-space depth `z ∈ [0, 1]`, `[x, y, z, w]` quaternions, right-handed world space — the conventions WGSL and the engine expect, with no flags.
- **Allocation-free hot paths.** Every operation takes an optional output parameter, so per-frame, per-entity code never allocates.
- **Fused fast paths for the workload that matters.** `composeTRS`, `mulAffine`, and `invertAffine` collapse the per-entity transform pipeline into single passes.
- **Two layers.** An ergonomic wrapper (`composeTrsMatrix`, `makePerspective`, `vec3Cross`, …) for app code, and a raw kernel (`mat4.multiply`, `quat.slerp`, …) for the hottest loops.

## Quick start

Ergonomic wrapper — the default entry point:

```ts
import {
  composeTrsMatrix,
  makePerspective,
  vec3,
  quatFromAxisAngle,
} from "@aperture-engine/math";

const model = composeTrsMatrix(
  [0, 1, 0], // translation
  quatFromAxisAngle([0, 1, 0], Math.PI / 4), // rotation
  [1, 1, 1], // scale
);

const projection = makePerspective(Math.PI / 3, 16 / 9, 0.1, 1000);
```

Raw kernel — namespaced, output-parameter ops for allocation-free inner loops:

```ts
import { mat4, vec3, quat } from "@aperture-engine/math/kernel";

const world = new Float32Array(16);
const local = new Float32Array(16);

// Fused translation·rotation·scale in one pass, written into `local`.
mat4.composeTRS(translation, rotation, scale, local);
// Affine-only multiply: skips the homogeneous row.
mat4.mulAffine(parentWorld, local, world);
```

## Conventions

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| Storage        | `Float32Array` (tight, GPU/ECS/worker-friendly)          |
| Matrices       | column-major, 16 contiguous floats                       |
| Depth range    | WebGPU clip space `z ∈ [0, 1]` (`perspective` / `ortho`) |
| Quaternions    | `[x, y, z, w]`                                           |
| Handedness     | right-handed                                             |
| Argument order | inputs first, optional `dst` last                        |

## Benchmarks

The headline number: on the engine's real **per-entity transform-propagation** workload (compose a local TRS matrix and multiply it by a parent world matrix, over thousands of entities in packed `Float32Array` storage), this library is **~1.3× faster than `wgpu-matrix`** and **~1.1× faster than `gl-matrix`**.

Measured with `node scripts/bench-math.mjs` (standalone Node, all three libraries loaded as native modules with preallocated outputs — median ops/s, Node 22):

| Operation                                     | @aperture-engine/math | vs `wgpu-matrix` |   vs `gl-matrix` |
| --------------------------------------------- | --------------------: | ---------------: | ---------------: |
| `mat4.multiply`                               |             **21.5M** | **1.13× faster** | **1.06× faster** |
| `mat4.inverse` (general)                      |                 19.0M | **1.25× faster** |     1.03× slower |
| compose TRS → `mat4`                          |             **45.0M** | **1.30× faster** |     1.02× faster |
| `mat4 × vec3` (transform point)               |             **44.3M** |     1.00× (tied) |     1.01× faster |
| `quat.multiply`                               |                 58.3M |     1.01× slower |     1.01× faster |
| `quat.fromEuler`                              |                 21.7M |     1.00× (tied) |                — |
| `perspective` (z 0..1)                        |             **70.0M** |     1.00× (tied) |     1.00× (tied) |
| `vec3.normalize`                              |                 70.5M |     1.01× slower |     1.08× faster |
| **`mulAffine`** (fused) vs general multiply   |             **26.4M** | **1.36× faster** |                — |
| **`invertAffine`** (fused) vs general inverse |             **29.0M** | **1.92× faster** |                — |
| **transform propagation (4096 entities)**     |           **fastest** | **1.33× faster** | **1.10× faster** |

Fastest-or-tied on every core primitive, and decisively fastest on the fused operations and the end-to-end transform workload — the path that dominates engine frame time. The two non-wins (general `inverse` vs `gl-matrix`, `vec3.normalize` vs `wgpu-matrix`) are within run-to-run noise.

Run them yourself from the repo root:

```sh
pnpm run bench:math
```

Methodology notes:

- All competitors get **preallocated output buffers**, so we measure compute, not allocation — exactly how the engine calls them.
- A vitest bench (`test/math/kernel.bench.ts`) also exists, but it runs engine source through vite's module runner while node_modules deps load natively, which understates this library. The standalone script (`scripts/bench-math.mjs`) loads the **built** kernel so all three are equal native modules — that's the fair comparison reported above.
- Correctness is locked by parity tests against `wgpu-matrix` as an oracle (`test/math/kernel.test.ts`), including the fused ops vs the primitives they replace.

## API surface

**Wrapper (`@aperture-engine/math`)** — vectors (`vec2`/`vec3`/`vec4`, `vec3Add`/`vec3Cross`/`vec3Dot`/`vec3Normalize`/…), quaternions (`quat`, `quatFromAxisAngle`/`quatFromEuler`/`quatMultiply`/`quatLookAt`/…), matrices (`mat4`, `composeTrsMatrix`/`decomposeTrsMatrix`/`multiplyMat4`/`invertMat4`/`transformPoint`/…), projections (`makePerspective`/`makeOrthographic`), tuple converters (`toVec3Tuple`/…), bounds & rays (AABB/sphere intersection), scalar helpers (`lerp`/`clamp`/`remap`/…), and the shared types (`Vec3`, `Mat4`, `Vec3Like`, …).

**Kernel (`@aperture-engine/math/kernel`)** — namespaced raw ops: `mat4` (incl. `composeTRS`, `mulAffine`, `invertAffine`, `perspective`, `ortho`), `vec2`, `vec3`, `vec4`, `quat`. Every op is monomorphic over `Float32Array` and takes an optional `dst`.

## License

Part of the [Aperture](https://github.com/felixtrz/aperture) monorepo. MIT licensed.
