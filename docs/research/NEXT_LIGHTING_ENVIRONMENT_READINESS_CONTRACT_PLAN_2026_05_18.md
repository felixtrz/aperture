# Next Lighting Environment Readiness Contract Plan

Date: 2026-05-18

## Scope

Plan the next lighting-boundary readiness contract after direct-light readiness
diagnostics.

This plan does not implement IBL, skyboxes, shadow maps, clustered lighting,
environment texture upload, binary GLB loading, or shader environment sampling.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/RENDER_FRAME_READINESS.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_AFTER_STANDARD_MATERIAL_FIDELITY_PLAN_2026_05_18.md`
- `docs/research/NEXT_LIGHTING_BOUNDARY_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/direct-light-readiness.ts`
- `packages/webgpu/src/webgpu/environment-resource-planning.ts`
- `packages/webgpu/src/webgpu/lighting-resource-plan.ts`
- `packages/webgpu/src/webgpu/resource-summary.ts`
- `test/webgpu/environment-resource-planning.test.ts`
- `test/webgpu/lighting-resource-plan.test.ts`

## Current State

Direct-light readiness now reports extracted light counts and whether the
renderer-side light buffer, light bind group layout, light bind group, and
shader metadata are present.

Environment lighting has the earlier boundary pieces:

- extraction emits `EnvironmentPacket` records;
- invalid, loading, missing, or failed environment-map handles are diagnosed at
  extraction and omitted from `RenderSnapshot.environments`;
- `planEnvironmentResources()` groups non-null environment-map handles into
  stable renderer-side resource requirements;
- resource summary reports can count planned environment-map requirements.

What is missing is a small JSON-safe readiness contract that mirrors
direct-light readiness for environment inputs. It should explain whether a
snapshot contains environment packets, whether they require environment-map
resources, and whether those renderer-owned resources are present when a caller
has them. It should remain inspection data, not shader IBL activation.

## Selected Next Boundary

Target an environment-map readiness report.

The report should be derived from `RenderSnapshot.environments` and the existing
environment resource plan. It may accept optional renderer-owned resource state
later, but the first implementation can stay planning-focused if no prepared
environment resource type exists yet.

Expected report shape:

- total environment packet count;
- null-handle environment count;
- required environment-map resource count;
- stable required environment-map resource keys;
- a readiness section for environment resource planning;
- JSON-safe diagnostics if a required renderer resource is expected but absent.

## Follow-Up Task

### task-1227 - Add environment-map readiness report

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, `test/webgpu`, and
`docs/RENDER_FRAME_READINESS.md`.
Reference anchor:
`docs/research/NEXT_LIGHTING_ENVIRONMENT_READINESS_CONTRACT_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/direct-light-readiness.ts`, and
`packages/webgpu/src/webgpu/environment-resource-planning.ts`.

Acceptance criteria:

- Add a JSON-safe environment-map readiness helper derived from
  `RenderSnapshot.environments` or `EnvironmentPacket[]`.
- Report environment counts, null-handle counts, required environment-map
  resource keys, and readiness/diagnostic sections without raw handles or GPU
  objects in JSON helpers.
- Tests cover empty snapshots, null-handle environments, repeated ready
  environment-map handles, and missing optional renderer resource state if the
  implementation accepts it.
- Update `docs/RENDER_FRAME_READINESS.md` to describe the readiness helper as
  diagnostics/planning only.
- Do not add IBL shader sampling, skybox rendering, shadow maps, environment
  texture upload, app route changes, or GLB viewer behavior.

## Deferred Alternatives

- IBL/environment shader consumption should wait until StandardMaterial texture
  source fidelity and material route contracts are tighter.
- Shadow readiness should wait until environment-map readiness and material
  queue architecture remain stable.
- Direct-light contract cleanup is not urgent unless app status grows another
  StandardMaterial-only branch.
