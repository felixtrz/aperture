# Custom Material Source Asset Shape Checklist

Date: 2026-05-18

Task: `task-1703`

## Purpose

This checklist prepares a future decision record for the minimum public custom
material source asset shape. It is non-binding and does not add public APIs or
runtime behavior.

## Source Shape Decisions

- Family key format: decide whether public custom families use arbitrary
  strings, reverse-DNS strings, package-scoped names, or registered symbols.
- Stable identity: decide whether source assets carry a user label only or a
  stable family plus source asset key.
- Render phase declaration: decide whether source assets declare supported
  phases directly or delegate phase support to the family adapter.
- Render-state inputs: decide which source fields may influence alpha mode,
  cull mode, depth compare/write, blending, and polygon offset.
- Pipeline-key inputs: decide which source fields are allowed to affect
  pipeline specialization and how they serialize.
- Binding schema: decide whether the source shape declares uniform, texture,
  sampler, storage, and optional light/environment bindings.
- User data: decide whether arbitrary JSON metadata is allowed and whether it
  participates in preparation or diagnostics.

## Keep Separate From This Decision

- Validation code and diagnostic implementation.
- Texture/sampler dependency readiness plumbing.
- WebGPU resource preparation and unload behavior.
- WGSL shader module loading or shader asset registration.
- Bind group layout and pipeline creation code.
- `createWebGpuApp()` app-owned adapter facade options.
- Browser rendering proof for a non-built-in material family.

## Required Constraints

- Source material assets must remain renderer-independent and JSON-safe enough
  for future worker boundaries.
- Source assets must not contain raw WebGPU objects, callbacks, mutable cache
  maps, or renderer-owned resources.
- Unsupported or colliding family keys must diagnose clearly and must not
  silently override built-ins or fallback to built-ins.
- The renderer must prepare GPU resources from extracted/source data; ECS
  remains authoritative and does not own GPU state.

## Decision Record Questions

A future accepted decision should answer:

1. What is the exact public source asset TypeScript shape?
2. How are public family keys registered and validated?
3. Which source fields are serializable across snapshots or worker transport?
4. Which fields are stable pipeline-key inputs?
5. Which fields are merely metadata and never affect rendering?
6. What diagnostics are emitted for invalid source shape versus unsupported
   route/app adapter behavior?

## Suggested Next Slice

Turn this checklist into a narrow decision record only after reviewing it
against the existing built-in material source assets and route/adapter tests.
