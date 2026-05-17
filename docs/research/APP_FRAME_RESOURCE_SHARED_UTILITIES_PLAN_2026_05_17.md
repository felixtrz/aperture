# App Frame Resource Shared Utilities Plan - 2026-05-17

## Scope

Plan whether to extract duplicated helper utilities from the app frame-resource
helper modules.

This is a planning slice only. It does not move implementation code.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Duplicated Utilities

The extracted frame-resource helpers now duplicate two small utilities:

- `sameStringList`
- `writeBufferData`

The duplication is intentional for the first extraction pass because it kept
each material-family helper self-contained and reviewable. The helpers now share
the same dependency shape:

- explicit WebGPU-like device;
- explicit frame cache slot;
- explicit prepared texture/sampler keys;
- caller-owned reuse counters;
- no app facade imports.

## Recommendation

Extract a tiny internal utility module only after the current helper boundaries
are committed and audited.

Suggested module:

```text
packages/webgpu/src/webgpu/app-frame-resource-utils.ts
```

Suggested exports:

- `sameStringList`
- `writeBufferData`
- `QueueWriteBufferDeviceLike`

The module should remain internal and general-purpose. It must not import
material assets, frame resources, `WebGpuApp`, render snapshots, caches, layout
types, frame planning, or command submission.

## Why Not Extract More Yet

Do not extract descriptor planning or cache write logic yet. The current helpers
still differ in important ways:

- Unlit has only view/transform dynamic buffers.
- Matcap adds a material bind group layout and required texture/sampler inputs.
- Standard adds snapshot-derived light buffer descriptors and four dynamic
  writes on reuse.

The shared utility module should remove only mechanical duplication, not hide
family-specific resource ownership or light-buffer behavior.

## Hot-Path Allocation Notes

`sameStringList` and `writeBufferData` do not allocate. Extracting them should
not change steady-state frame allocation behavior.

Descriptor plan creation, reused-result object creation, and copied
texture/sampler key arrays remain separate allocation concerns. They should be
handled by a later allocation-focused audit/refactor, not this utility cleanup.

## Validation Plan

After utility extraction:

- run focused WebGPU app tests;
- run WebGPU package type-checking;
- run test type-checking;
- run package boundary checks;
- verify package exports do not expose these helpers as public API unless a real
  external testing need appears.

## Proposed Next Slice

Extract the two utility functions into an internal module and update unlit,
Matcap, and Standard app frame-resource helpers to import them.
