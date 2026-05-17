# GLB Primitive Material Resolution Boundary Audit

Date: 2026-05-17

## Scope

This audit covers the primitive material resolution helper and focused tests:

- `packages/render/src/assets/gltf-primitive-material-resolution.ts`
- `test/assets/gltf-primitive-material-resolution.test.ts`
- `test/assets/gltf-primitive-material-resolution-json.test.ts`

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GLB_PRIMITIVE_MATERIAL_RESOLUTION_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/gltf-mesh-primitive.ts`

## Findings

- The resolver is report-driven. It consumes a mesh primitive mapping report,
  source asset registration report, caller-provided available material handle
  keys, and an optional default material handle key.
- The resolver does not import `AssetRegistry`, mutate source assets, create
  default materials, author ECS entities, create render packets, or touch
  WebGPU/browser APIs.
- Duplicate material registrations are only treated as available when the caller
  explicitly lists the existing material handle key.
- Primitives without glTF material indices require a caller-owned default
  material handle; the resolver does not create one.
- JSON helpers clone plain report fields and do not embed mesh data, texture
  source data, registry entries, ECS state, or GPU handles.

## Boundary Scan

Searched implementation, tests, and the handoff plan for:

```text
World Entity Ecs Component addComponent spawn AssetRegistry new AssetRegistry
registry.register markReady WebGPU GPU device queue canvas navigator document
window vertexStreams sourceData
```

The implementation had no matches. Test matches were limited to negative JSON
assertions. Documentation matches describe explicit non-goals.

## Validation

- `pnpm run check:boundaries`
- `pnpm exec vitest run test/assets/gltf-primitive-material-resolution.test.ts test/assets/gltf-primitive-material-resolution-json.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Follow-Ups

- Wire primitive material resolution into later ECS authoring command planning
  only after mesh source asset registration exposes stable mesh handle keys.
- Keep the default material policy caller-owned so no hidden fallback material is
  registered during resolution.
