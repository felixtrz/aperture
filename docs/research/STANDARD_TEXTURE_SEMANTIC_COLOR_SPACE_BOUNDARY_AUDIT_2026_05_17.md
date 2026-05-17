# StandardMaterial Texture Semantic/Color-Space Boundary Audit - 2026-05-17

## Scope

Audit the narrow render-bridge update that preserves StandardMaterial texture
semantic and color-space readiness details on `RenderSnapshot.diagnostics`.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `packages/render/src/materials/standard-texture-readiness.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/standard-material-texture-fidelity-summary.ts`
- `test/materials/standard-texture-readiness.test.ts`
- `test/rendering/extraction.test.ts`
- `docs/DIAGNOSTICS_SUMMARIES.md`

## Findings

- ECS remains authoritative. The update only copies diagnostics from the
  existing material readiness report into the extracted snapshot diagnostics.
- Rendering behavior is unchanged. No draw is newly queued, no shader flag is
  added, and no WebGPU resource is created or prepared by this path.
- `RenderDiagnostic` now carries optional expected/actual semantic and
  color-space values. These are stable strings and arrays, so the snapshot
  remains structured-clone-friendly and JSON-safe.
- The aggregate WebGPU texture fidelity summary remains compact. It still
  consumes readiness report JSON and does not include material, texture, sampler,
  source-asset, prepared-resource, or GPU handles.
- The app report shape is unchanged. The richer fields are available only on
  detailed render diagnostics when extraction blocks a draw.

## Validation

- `pnpm exec vitest run test/rendering/extraction.test.ts test/materials/standard-texture-readiness.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`

## Result

No ownership or package-boundary drift found. The follow-up remains controlled
browser verification for StandardMaterial texture behavior, not more readiness
metadata plumbing.
