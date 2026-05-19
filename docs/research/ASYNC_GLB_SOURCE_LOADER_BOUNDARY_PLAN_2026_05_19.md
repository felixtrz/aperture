# Async GLB Source Loader Boundary Plan 2026-05-19

## Scope

Plan the eventual async GLB source-loader boundary without implementing network
fetching, image decoding, ECS authoring, or WebGPU resource creation.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/GLB_SOURCE_STATUS_HELPER_ADOPTION_AUDIT_2026_05_19.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `packages/render/src/assets/gltf-report-driven-import.ts`

## Boundary Responsibilities

The future source-loader boundary should sit before ECS authoring and before
WebGPU preparation:

```text
URL / provided bytes
  -> source loader facade
  -> GLB bytes plus optional external buffer bytes
  -> report-driven GLB import contract
  -> ECS authoring command plan / asset registration later
  -> render extraction / WebGPU preparation later
```

The source-loader boundary may eventually own:

- Fetching the primary `.glb` or `.gltf` payload.
- Resolving external buffer URIs relative to the source URL.
- Producing fetch/cache/dependency diagnostics.
- Passing image sources to an image-decode handoff layer.
- Returning compact JSON-safe source status.
- Feeding provided bytes into the existing GLB report-driven import contract.

The source-loader boundary must not own:

- ECS entity creation or mutation.
- Renderer-owned prepared resources.
- WebGPU buffers, textures, samplers, bind groups, pipelines, or passes.
- A mutable scene graph.
- Silent fallback behavior for unsupported compression or external assets.

## Diagnostic Shape

Loader status should stay JSON-safe and compact:

- `status`: `pending`, `loaded`, `failed`, or `blocked`.
- `sourceKind`: `glb`, `gltf`, or `unknown`.
- `byteLength` for loaded primary bytes, never the bytes themselves.
- `externalBuffers`: URI, status, byte length if loaded, and diagnostic code if
  blocked or failed.
- `diagnostics`: stable code, severity, message, and source URI when relevant.
- `glbSourceStatus`: the existing compact GLB source status when GLB parsing ran.

## Near-Term Implementation Shape

The next implementation should avoid network behavior. Add a no-fetch fixture
facade that accepts:

- already provided primary GLB bytes;
- optional caller-provided external buffer bytes keyed by buffer index or URI;
- the existing `createGltfReportDrivenImportReportFromGlb` options.

It should return:

- loader-style source status;
- compact GLB source status;
- the GLB import report for downstream tests.

This lets Aperture test the status and dependency boundary before adding fetch,
cache, validator, image decode, compression, reload, or unload behavior.

## Selected Follow-Up

Implement `task-1924`: add GLB source-loader status shape tests. Keep it
renderer-independent and no-fetch. The implementation should define the status
shape first, with pending, loaded, failed, and externally blocked cases, before
adding a facade that executes the GLB import wrapper.
