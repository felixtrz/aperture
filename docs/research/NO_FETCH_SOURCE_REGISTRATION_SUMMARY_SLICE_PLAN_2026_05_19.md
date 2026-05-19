# No-Fetch Source Registration Summary Slice Plan 2026-05-19

## Scope

Plan a report-only source-registration summary for no-fetch source-loader output.
This is a diagnostics/readiness layer, not actual asset registry mutation.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/BUFFER_BACKED_SOURCE_FIXTURE_SUMMARY_AUDIT_2026_05_19.md`
- `packages/render/src/assets/gltf-source-registration.ts`
- `packages/render/src/assets/gltf-source-registration-orchestration.ts`
- `packages/render/src/assets/glb-source-loader-facade.ts`
- `packages/render/src/assets/glb-source-loader-output-summary.ts`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`

## Plan

Add source-registration summaries after mesh-construction summaries, but keep
them optional and report-derived:

```text
no-fetch GLB source bytes
  -> GLB import report
  -> outputSummary.meshConstruction
  -> outputSummary.sourceRegistration (planned)
  -> future ECS command-plan summary (deferred)
```

The summary should be able to report:

- status: `absent`, `ready`, or `invalid`;
- source asset counts by kind, when available;
- dependency/diagnostic counts;
- validity.

The summary must not:

- mutate an `AssetRegistry`;
- mark assets ready;
- replay ECS commands;
- allocate WebGPU resources;
- expose raw source bytes, decoded image payloads, registry internals, ECS world
  state, or GPU handles.

## Selected Follow-Up

Implement `task-1949`: add source-registration output summary status tests.
Start with the summary shape and tests around absent, valid provided, and invalid
provided report cases. Do not route it into the browser example until the helper
is tested.
