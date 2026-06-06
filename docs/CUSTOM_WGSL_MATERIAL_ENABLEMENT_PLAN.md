# Custom WGSL Material Enablement Plan

Date: 2026-05-27
Status: implemented for v1; storage-buffer and shader-import follow-ups deferred

## Purpose

Enable app-authored custom WGSL materials end to end, from a public,
worker-safe material source contract through `createWebGpuApp()` routing and
normal generated Vite app usage.

This plan turns the current proof pieces into a supported path. It does not
introduce a general user-supplied renderer plugin API, shader graph, scene
graph, WebGL fallback, or app-owned live WebGPU callbacks.

Implementation note, 2026-05-28: the v1 data route is now wired through public
shader assets, app system builders, source asset mirroring, render-asset
preparation, the normal `createWebGpuApp()` custom frame paths, the animated
`examples/custom-material.html` app route, generated config/system coverage for
`asset.shader(...)` plus `material.customWgsl(...)`, and a Chrome/WebGPU smoke
of the generated developer API app. Mixed built-in/custom snapshots now render
through one successful app resource collector. App-route group-2 uniform,
texture, sampler, and instance-attribute declarations are supported or clearly
diagnosed by the renderer-owned custom WGSL resource path. Remaining follow-up
scope is explicitly deferred to storage-buffer source assets, WGSL
imports/includes, and custom lighting/environment integration.

## Current State

The v1 route now has the expected pieces:

- `packages/render/src/materials/` exposes a public, data-only
  `CustomWgslMaterialAsset` contract, namespaced family keys, shader refs,
  binding declarations, source validation, and prepared custom material
  metadata.
- `packages/simulation/src/assets/` and `packages/app/src/` expose
  `ShaderHandle`, `asset.shader(...)`, `this.assets.shader(...)`,
  `shader.asset(...)`, `shader.inlineWgsl(...)`, and
  `material.customWgsl(...)` without DOM or WebGPU types in worker systems.
- Generated apps mirror shader and material source assets from worker to main
  via `serializeSourceAssetRegistry(...)` and
  `mirrorSourceAssetRegistryFromMessage(...)`.
- `createWebGpuApp()` routes built-ins, single-custom WGSL frames, and mixed
  built-in/custom WGSL frames through normal material queueing, frame-resource
  preparation, command planning, frame-boundary assembly, and submission.
- `packages/webgpu/src/materials/custom-wgsl/` creates renderer-owned shader
  modules, pipelines, uniform buffers, texture views, samplers, bind groups, and
  caches from prepared custom WGSL metadata.
- `examples/custom-material.html` and
  `examples/triangle.html?material=custom-wgsl` render custom WGSL through the
  normal app path. `examples/custom-material.html?broken=wgsl` reports typed
  shader diagnostics without crashing.
- `examples/developer-api/` now declares a generated WGSL shader asset and
  worker-authored custom material; unit tests and a Chrome/WebGPU smoke prove
  the generated browser path reports the custom entity and zero frame
  diagnostics.

The accepted architectural decisions already establish the right boundary:

- Custom material source assets are data-only family instances.
- Built-in material keys remain reserved.
- Unsupported family keys diagnose and do not fall back.
- GPU resources, shader modules, bind groups, pipelines, and caches remain
  renderer-owned.
- Worker simulation remains the default browser shape.
- Storage-buffer material bindings, WGSL imports/includes, and custom
  lighting/environment integration remain follow-up work behind the same
  data-only source and renderer-owned GPU boundary.

## Reference Anchors

- Aperture custom WGSL proof:
  - `packages/render/src/assets/preparation.ts`
  - `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts`
  - `examples/custom-material.main.js`
  - `examples/custom-material.worker.js`
- Aperture route spine:
  - `packages/render/src/rendering/material-queue.ts`
  - `packages/webgpu/src/render/queues/queued-material-prepare-route.ts`
  - `packages/webgpu/src/render/queues/queued-material-app-resource-item.ts`
  - `packages/webgpu/src/render/queues/queued-material-frame-resource-set.ts`
  - `packages/webgpu/src/render/queues/queued-built-in-app-resource-set.ts`
  - `packages/webgpu/src/app/app.ts`
- Aperture app facade:
  - `packages/app/src/config.ts`
  - `packages/app/src/systems.ts`
  - `packages/app/src/asset-mirror.ts`
  - `packages/app/src/browser.ts`
  - `packages/app/src/worker.ts`
- Bevy conceptual references:
  - `references/bevy/examples/shader/shader_material.rs`
  - `references/bevy/crates/bevy_pbr/src/material.rs`
  - `references/bevy/crates/bevy_shader/src/shader.rs`

## Design Constraints

1. ECS remains authoritative. A custom material is authored as source data and
   referenced by the `Material` component handle.
2. System modules still target the worker. They may create handles, register
   source assets, update JSON-safe material data, and reference shader assets;
   they must not create `GPUShaderModule`, `GPUBuffer`, `GPUBindGroup`, or
   `GPURenderPipeline`.
3. The main/WebGPU side owns shader compilation, buffer allocation, texture
   views, samplers, bind groups, pipeline caches, and submission.
4. WGSL crosses the worker/main boundary as source data: either inline source
   in a material for tests/examples or a `ShaderAsset` loaded from a URL and
   mirrored by handle/version.
5. The normal app path must not require manual snapshot rewriting, manual
   command submission, or example-local renderer plumbing.
6. Custom material support starts as an Aperture-owned generic WGSL material
   route, not arbitrary app-supplied adapter callbacks.
7. Built-in material behavior must not regress.

## Target Public Shape

The names can be refined during implementation, but the implemented contract
should keep this shape.

```ts
import {
  EcsType,
  createSystem,
  material,
  mesh,
  shader,
} from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({
  priority: 0,
}) {
  init() {
    const waterShader = this.assets.shader("water");

    this.spawn.mesh({
      key: "water",
      mesh: mesh.plane({ size: [8, 4] }),
      material: material.customWgsl({
        familyKey: "app/water",
        label: "Water",
        shader: shader.asset(waterShader),
        entryPoints: {
          vertex: "vs_main",
          fragment: "fs_main",
        },
        renderState: {
          cullMode: "none",
        },
        bindings: [
          material.uniform("water", {
            binding: 0,
            visibility: ["vertex", "fragment"],
            fields: {
              color: { type: EcsType.Vec4, default: [0.02, 0.46, 0.9, 1] },
              time: { type: EcsType.Float32, default: 0 },
            },
          }),
        ],
      }),
    });
  }
}
```

Config gains shader assets:

```ts
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  assets: {
    water: asset.shader("/shaders/water.wgsl", { preload: "blocking" }),
  },
  systems: ["src/systems/**/*.system.ts"],
});
```

Inline WGSL remains available for tests, demos, generated examples, and small
single-file reproductions:

```ts
material.customWgsl({
  familyKey: "example/water",
  label: "Inline Water",
  shader: shader.inlineWgsl(WATER_WGSL, { virtualPath: "water.wgsl" }),
  entryPoints: { vertex: "vs_main", fragment: "fs_main" },
  bindings: [],
});
```

## Source Contract

Add a public custom WGSL source asset shape under `@aperture-engine/render` and
surface ergonomic builders from `@aperture-engine/app/systems`.

Recommended internal source shape:

```ts
export interface CustomWgslMaterialAsset {
  readonly sourceDiscriminator: "custom-material-source";
  readonly shaderLanguage: "wgsl";
  readonly familyKey: MaterialFamilyKey;
  readonly label: string;
  readonly shader: CustomWgslShaderRef;
  readonly entryPoints: {
    readonly vertex: string;
    readonly fragment: string;
  };
  readonly renderState: RenderStateDescriptor;
  readonly pipelineKey: {
    readonly features: readonly string[];
    readonly specialization: Readonly<
      Record<string, string | number | boolean>
    >;
  };
  readonly bindings: readonly CustomWgslBindingDeclaration[];
  readonly dependencies: readonly CustomMaterialDependencyDeclaration[];
  readonly instanceAttributes?: InstanceAttributeLayoutInput;
  readonly metadata?: JsonRecord;
}
```

Use `sourceDiscriminator` instead of extending the built-in `MaterialKind`
union. Built-in material assets keep `kind: "unlit" | "matcap" | "standard" |
"debug-normal"`.

Define a wider source-material type where needed:

```ts
export type SourceMaterialAsset = MaterialAsset | CustomWgslMaterialAsset;
```

### Family Keys

Add a `MaterialFamilyKey` parser/validator:

- Built-in family keys remain `unlit`, `matcap`, `standard`, and
  `debug-normal`.
- Custom family keys must be namespaced, for example `app/water`,
  `example/water`, or `package.name/effect`.
- Family keys must not contain `|` because pipeline keys use `|` as their
  segment delimiter.
- Built-in collisions and duplicate custom registrations are errors.

Update `materialQueueFamilyFromPipelineKey(...)` so it accepts valid namespaced
custom keys instead of only `[a-z][a-z0-9-]*`.

### Shader References

Add shader assets:

```ts
export type ShaderHandle = AssetHandle<"shader">;

export interface WgslShaderAsset {
  readonly kind: "shader";
  readonly language: "wgsl";
  readonly label: string;
  readonly source: string;
  readonly url?: string;
  readonly virtualPath?: string;
}

export type CustomWgslShaderRef =
  | { readonly kind: "shader-asset"; readonly handle: ShaderHandle }
  | {
      readonly kind: "inline-wgsl";
      readonly code: string;
      readonly virtualPath?: string;
    };
```

Implementation requirements:

- Add `"shader"` to `ASSET_KINDS`.
- Add `ShaderHandle`, `createShaderHandle(...)`, serialization support, and
  typed collection support where applicable.
- Add `ShaderAsset` exports from the render package.
- Add `asset.shader(url, options)` to `@aperture-engine/app/config`.
- Add `this.assets.shader(id)` to `SystemAssetAccess`.
- Load shader assets as text in the worker through the same app asset request
  path used by generated apps.
- Mirror ready shader assets to the main thread through the existing
  `sourceAssets` payload.
- Do not create GPU shader modules in the worker.

V1 should treat WGSL as a complete module string. WGSL imports/includes can be a
later slice with explicit dependency handles and diagnostics.

### Bindings

Custom WGSL materials use fixed Aperture groups initially:

- `@group(0) @binding(0)`: view uniform, renderer-owned.
- `@group(1) @binding(0)`: world transform storage, renderer-owned.
- `@group(2)`: custom material bindings declared by the source asset.
- `@group(3)`: reserved for future lights/environment/custom extensions.

V1 binding declarations should support:

- Uniform buffers built from data-only field layouts and source values.
- 2D textures referenced by `TextureHandle`.
- Samplers referenced by `SamplerHandle`.
- Existing instance attributes through `defineInstanceAttributes(...)`.

Storage buffers can remain validator-recognized but app-route-unsupported until
there is a renderer-independent buffer source asset. Unsupported storage
bindings must diagnose clearly instead of creating manual resource holes.

Uniform fields should use an owned typed layout, aligned to WGSL rules:

```ts
export interface CustomWgslUniformBindingDeclaration {
  readonly name: string;
  readonly kind: "uniform-buffer";
  readonly binding: number;
  readonly visibility: readonly CustomWgslShaderStage[];
  readonly fields: Readonly<Record<string, CustomWgslUniformField>>;
  readonly values: Readonly<Record<string, JsonPrimitive | readonly number[]>>;
}
```

The renderer prepares these declarations into renderer-owned uniform buffers.
Systems update values by updating material source data or a future targeted
material-uniform update command, never by writing a GPU buffer directly.

## Worker/Main Data Flow

Target flow:

```text
Worker system
  -> registers ShaderAsset and CustomWgslMaterialAsset in AssetRegistry
  -> extracts RenderSnapshot with Mesh + Material handles
  -> posts RenderSnapshot plus changed sourceAssets

Main generated browser app
  -> mirrors sourceAssets into its AssetRegistry
  -> prepares changed shader and material source assets
  -> builds material queue from snapshot
  -> routes custom family keys through the custom WGSL WebGPU adapter
  -> creates or reuses shader modules, pipelines, buffers, textures, samplers,
     bind groups, and draw commands
  -> submits through createWebGpuApp()
```

WGSL is sent as source text only when the corresponding shader asset version
changes. Inline WGSL lives in the material source and is therefore appropriate
only for small demos/tests. Path-loaded shader assets should be the recommended
app path.

## Implementation Plan

### Phase 1 - Lock the Public Contract

Files likely touched:

- `packages/render/src/materials/types.ts`
- `packages/render/src/materials/factories.ts`
- `packages/render/src/materials/validation.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/assets/preparation.ts`
- `docs/DECISIONS.md`
- new focused tests under `test/materials/`

Work:

1. Introduce `MaterialFamilyKey`, `CustomWgslMaterialAsset`,
   `CustomWgslShaderRef`, custom binding declarations, custom uniform field
   declarations, and `SourceMaterialAsset`.
2. Keep the existing built-in `MaterialKind` closed.
3. Move the current low-level custom WGSL source types out of the generic
   preparation module or make that module import the new public contract.
4. Migrate current `family` field usage to `familyKey`.
5. Add source-shape validation with `customMaterialSource.*` diagnostics based
   on the existing taxonomy.
6. Reject live renderer objects, callbacks, class instances, maps, sets,
   promises, typed arrays in metadata, raw WebGPU descriptors with live
   resources, and non-JSON-safe source metadata.
7. Validate family-key syntax, built-in collisions, label, render-state
   overrides, pipeline-key inputs, shader refs, entry-point names, binding
   declarations, dependency declarations, and metadata.

Acceptance:

- A minimal valid custom WGSL source validates with no diagnostics.
- Invalid shape failures use only `customMaterialSource.*` codes.
- Built-in material validation remains unchanged.
- Type tests show `MaterialKind` is still the built-in union while
  `SourceMaterialAsset` accepts custom WGSL assets.
- Diagnostics are JSON-safe and do not leak payload bytes or live object
  internals.

### Phase 2 - Add Shader Assets

Files likely touched:

- `packages/simulation/src/assets/types.ts`
- `packages/simulation/src/assets/handles.ts`
- `packages/simulation/src/assets/index.ts`
- `packages/render/src/materials/types.ts`
- `packages/app/src/config.ts`
- `packages/app/src/systems.ts`
- `packages/app/src/advanced.ts`
- `packages/app/src/worker.ts`
- `packages/app/src/asset-mirror.ts`
- tests under `test/assets/` and `test/app/`

Work:

1. Add `shader` to `AssetKind`.
2. Add `ShaderHandle` and `createShaderHandle(...)`.
3. Add a `WgslShaderAsset` data type in render.
4. Add `asset.shader(url, options)` and config validation.
5. Add `this.assets.shader(id)` and shader readiness/error signals.
6. Implement shader text loading in the worker asset loader path.
7. Register shader asset dependencies so material preparation can retry until
   the shader asset is ready.
8. Mirror shader source assets through the existing source asset serialization
   state.

Acceptance:

- `asset.shader("/shaders/water.wgsl")` type-checks and validates in
  `aperture.config.ts`.
- `this.assets.shader("water")` returns a `ShaderHandle`-backed system asset.
- Blocking shader preload fetches WGSL text and marks a `ShaderAsset` ready.
- Failed shader fetch reports `aperture.asset.loadFailed` with kind `shader`.
- The mirrored main-thread source registry receives shader assets only when
  their versions change.
- Existing `gltf`, `texture`, and `hdr` config assets still behave as before.

### Phase 3 - Add App-Facing Custom Material Builders

Files likely touched:

- `packages/app/src/systems.ts`
- `packages/render/src/materials/factories.ts`
- tests under `test/app/developer-api.test.ts`

Work:

1. Add `shader.asset(handleOrSystemAsset)` and `shader.inlineWgsl(...)`
   helpers.
2. Add `material.customWgsl(...)` and binding helper builders such as
   `material.uniform(...)`, `material.texture(...)`, and
   `material.sampler(...)`.
3. Widen `SpawnMeshOptions.material` from standard-only descriptors to
   built-in or custom descriptors.
4. Update `resolveMaterialHandle(...)` so custom descriptors register a
   `CustomWgslMaterialAsset` with shader/texture/sampler dependencies.
5. Add update semantics for descriptor-created material assets:
   - If the same handle already exists, update the asset when source data
     changes.
   - Keep versions monotonic so the main thread can refresh prepared resources.
6. Ensure custom source descriptors are frozen or copied into owned source data
   so systems cannot mutate renderer-visible source state behind the registry.

Acceptance:

- A `.system.ts` file can spawn a mesh using `material.customWgsl(...)`.
- The system import surface remains worker-safe and has no DOM/WebGPU types.
- Descriptor-created custom material assets include shader, texture, and sampler
  dependencies.
- Updating custom uniform values increments the material source asset version.
- Invalid custom descriptors throw actionable app-system errors or produce
  source validation diagnostics before rendering.

### Phase 4 - Generalize Prepared Material Stores

Files likely touched:

- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/snapshot-prepared-materials.ts`
- `packages/render/src/rendering/prepared-material-queue-resolver.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- tests under `test/assets/` and `test/rendering/`

Work:

1. Split built-in prepared material metadata from custom WGSL prepared metadata
   or widen the prepared material store to a discriminated union.
2. Add a material-source adapter registry keyed by source discriminator and
   family key.
3. Keep the existing built-in metadata adapter as the default for built-ins.
4. Add a custom WGSL render-asset adapter that resolves shader refs:
   - Inline WGSL source comes from the material source.
   - Shader asset refs read the ready `ShaderAsset` dependency.
5. Compute stable prepared custom material keys from:
   - source material handle;
   - material source version;
   - shader asset handle/version or inline source hash;
   - entry points;
   - render state;
   - pipeline specialization;
   - binding layout;
   - instance attribute layout.
6. Update `prepareSnapshotMaterials(...)` so one snapshot can prepare built-in
   and custom material sources.
7. Update queue resource key resolution so custom WGSL prepared materials return
   custom prepared material resource keys.

Acceptance:

- Built-in prepared material JSON summaries still count built-in families.
- Custom WGSL prepared material entries expose JSON-safe labels, source keys,
  family keys, shader keys, pipeline keys, binding counts, and diagnostics.
- One render snapshot can contain both built-in and custom materials and prepare
  both without type casts in app code.
- Dependency readiness retries custom material preparation while a shader,
  texture, or sampler dependency is loading.
- Unready or failed dependencies produce material-preparation diagnostics rather
  than falling back to unlit.

### Phase 5 - Generalize Queue Routing

Files likely touched:

- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/render/queues/queued-material-adapter.ts`
- `packages/webgpu/src/render/queues/queued-material-prepare-route.ts`
- `packages/webgpu/src/render/queues/queued-material-app-resource-item.ts`
- `packages/webgpu/src/render/queues/queued-built-in-app-resource-set.ts`
- new `packages/webgpu/src/render/queues/queued-app-resource-set.ts`
- tests under `test/rendering/` and `test/webgpu/`

Work:

1. Update material queue family parsing to accept validated namespaced custom
   family keys.
2. Introduce a generic queued app resource collector that can route any
   registered family, not only `QueuedBuiltInAppResourceSet`.
3. Keep the built-in collector as a wrapper or specialization over the generic
   collector if that keeps current tests simple.
4. Add a custom WGSL route adapter:
   - accepts `CustomWgslMaterialAsset`;
   - validates the queue item against the prepared custom material;
   - returns the custom material pipeline key and prepared resource keys;
   - rejects built-in collision and mismatched family/source shape.
5. Ensure mixed built-in/custom queue failures produce the existing
   JSON-safe route report plus custom family details.
6. Remove early `createWebGpuApp()` failures that reject all non-built-in
   `material.kind` values before the queue route registry can inspect them.

Acceptance:

- Route tests cover one custom family, one mixed built-in/custom frame, one
  missing custom adapter, one family mismatch, and one invalid family key.
- Unsupported custom family keys produce `queuedMaterialPrepareRoute.*` or
  `webGpuApp.materialQueueRouteReport` diagnostics, not
  `webGpuApp.unsupportedMaterialKind` from an early built-in-only branch.
- Built-in single-material fast paths still pass or are deliberately folded into
  the generic route with no behavior loss.
- Route summaries remain deterministic and JSON-safe.

### Phase 6 - Prepare WebGPU Custom WGSL Frame Resources

Files likely touched:

- `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts`
- new `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts`
- new `packages/webgpu/src/materials/custom-wgsl/prepared-custom-wgsl-material-cache.ts`
- `packages/webgpu/src/app/app-texture-sampler-resources.ts`
- `packages/webgpu/src/app/app.ts`
- tests under `test/webgpu/`

Work:

1. Add caches for custom WGSL shader modules, render pipelines, uniform
   buffers, bind groups, and optional texture/sampler dependencies.
2. Reuse the existing view uniform and world transform resources.
3. Create group-2 material bind groups from declared custom material bindings.
4. Create uniform buffers from source uniform layouts and values.
5. Resolve texture/sampler bindings through the existing app texture/sampler
   preparation path.
6. Support instance attributes through the existing
   `defineInstanceAttributes(...)` and instance-rate vertex buffer path.
7. Keep pipeline creation browser-safe:
   - group 0 view;
   - group 1 world transforms;
   - group 2 material;
   - group 3 reserved.
8. Start with the existing Aperture mesh vertex layout expectations
   (`POSITION`, `NORMAL`, `TEXCOORD_0`) and diagnose unsupported custom vertex
   layout declarations. A later slice can expand custom vertex inputs.
9. Include shader module and pipeline diagnostics from
   `createWebGpuShaderModule(...)` and pipeline creation.

Acceptance:

- `createCustomWgslMaterialRenderResources(...)` is usable from the app route,
  not only from manual examples.
- Shader modules are cached by shader asset version/source hash and entry
  points.
- Pipelines are cached by shader key, render state, vertex layout, sample count,
  color format, depth format, and instance attribute layout.
- Bind groups are cached or reused when source material binding values do not
  change.
- Missing binding resources report `customWgslMaterial.missingBindingResource`
  with the binding number and resource key.
- Shader compile failures report JSON-safe diagnostics in `getDiagnostics()`.
- No GPU resource objects appear in public diagnostics or source asset mirrors.

### Phase 7 - Hook Custom WGSL Into `createWebGpuApp()`

Files likely touched:

- `packages/webgpu/src/app/app.ts`
- `packages/webgpu/src/app/custom-wgsl-frame.ts`
- `packages/webgpu/src/app/mixed-custom-wgsl-frame.ts`
- `packages/webgpu/src/app/app-diagnostics-summary.ts`
- `packages/webgpu/src/materials/core/material-queue-route-report.ts`
- `packages/webgpu/src/render/queues/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/materials/core/prepared-built-in-material-store.ts`
- tests under `test/webgpu/webgpu-app.test.ts`

Work:

1. Register the built-in adapters plus the generic custom WGSL adapter in the
   app resource registry.
2. Prepare meshes and source materials before queue collection for both built-in
   and custom families.
3. Route all snapshot draw items through the generic collector.
4. Prepare frame resources per family through the generic
   `prepareQueuedMaterialFrameResourceSet(...)` spine.
5. Merge built-in and custom resources into one frame plan:
   - mesh resources;
   - pipeline results;
   - bind groups;
   - material resource key maps;
   - pipeline key maps by render id.
6. Keep render bundles, indirect draw commands, occlusion query culling,
   snapshot change sets, render targets, MSAA, post effects, and readback paths
   operating on the final command list.
7. Report custom family counts in diagnostics and resource summaries.

Acceptance:

- `createWebGpuApp()` renders a custom WGSL material through the normal
  worker/main source asset mirror.
- The custom material path uses the same frame boundary assembly and submission
  path as built-ins.
- Existing render-target, MSAA, post-effect, readback, render-bundle, and
  indirect-draw tests do not regress for built-ins.
- Mixed built-in/custom snapshots render all routed draws or fail with complete
  route diagnostics.
- No example-local snapshot rewriting is needed.

### Phase 8 - Migrate Examples

Files likely touched:

- `examples/custom-material.html`
- `examples/custom-material.main.js`
- `examples/custom-material.worker.js`
- maybe `examples/developer-api/`
- `test/e2e/custom-material.spec.ts`
- `test/e2e/custom-wgsl-material.spec.ts`

Work:

1. Replace the manual custom-material example path with a normal app route.
2. Keep low-level custom WGSL unit tests for shader/pipeline/bind-group helper
   behavior.
3. Use `material.customWgsl(...)` in worker-authored scene setup.
4. Load the WGSL from `asset.shader(...)` in at least one app-level example.
5. Keep one inline WGSL test fixture to prove inline source remains supported.
6. Preserve the broken-WGSL scenario, but make the failure surface come from
   `createWebGpuApp()` diagnostics.
7. Add status JSON fields for:
   - custom family key;
   - shader asset key/version or inline source hash;
   - pipeline key;
   - binding count;
   - diagnostics by code;
   - rendered frame/readback samples.

Acceptance:

- `examples/custom-material.html` no longer manually prepares GPU resources,
  rewrites snapshots, or submits custom command plans.
- The custom material example renders visible non-clear pixels through
  `createWebGpuApp()`.
- The custom material example animates via worker-authored source data,
  instance data, or another explicit worker-safe update path.
- The `?broken=wgsl` route reports shader diagnostics without crashing the app.
- Playwright verifies at least two frames differ for the animated material and
  that the center sample is non-clear.

### Phase 9 - Documentation

Files likely touched:

- `docs/AUTHORING.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/render-pipeline-comparison.html`
- `docs/index.html`

Work:

1. Add a decision record for the finalized custom WGSL material API if the
   implementation materially extends Decision 0012.
2. Update architecture docs with the custom material source asset,
   shader-asset, and prepared-resource flow.
3. Document reserved WGSL groups and required shader entry points.
4. Add authoring docs showing `asset.shader(...)` plus
   `material.customWgsl(...)`.
5. Document limitations:
   - WGSL only;
   - no shader imports in v1;
   - no user-supplied WebGPU objects;
   - no arbitrary app-owned render adapter callbacks;
   - storage buffer bindings deferred unless a renderer-independent buffer
     source asset is added;
   - lighting/environment integration deferred.
6. Update public tracker pages if this work changes render-pipeline status.

Acceptance:

- A new app author can copy the documented config/system shape and get a custom
  WGSL material running without manual WebGPU setup.
- Docs clearly say that systems run in the worker and must author data only.
- Docs explicitly state how WGSL source reaches the renderer.
- Docs list the current binding groups and limitations.
- `pnpm run check:progress` passes if tracker pages are changed.

## Implementation Status

As of 2026-05-28, Phases 1 through 9 are implemented for the v1 scope:

- Public shader assets and custom material builders are exported from the app
  subpaths and remain worker-safe.
- Custom material source validation, dependency readiness, prepared metadata,
  and source asset mirroring are covered by focused tests.
- `createWebGpuApp()` renders single-custom and mixed built-in/custom WGSL
  frames without manual snapshot rewriting or manual command submission.
- Group-2 uniform, texture, sampler, and existing instance-attribute bindings
  are supported in the app route; storage-buffer bindings remain source-valid
  but app-route unsupported with JSON-safe diagnostics.
- The custom-material, triangle custom-WGSL, and generated developer API app
  routes have browser or render-control coverage for success and failure paths.

## End-To-End Acceptance Criteria

The feature is complete when all of these are true:

1. Public API:
   - `asset.shader(...)`, `this.assets.shader(...)`, `shader.asset(...)`,
     `shader.inlineWgsl(...)`, and `material.customWgsl(...)` are exported from
     the intended app subpaths.
   - A generated Vite app can author a custom material entirely from
     `aperture.config.ts` and `*.system.ts` files.
   - The public API does not expose DOM or WebGPU types to worker system files.

2. Source contract:
   - Custom material source assets use a discriminator separate from
     `MaterialKind`.
   - Built-in `MaterialKind` remains closed.
   - Built-in family-key collisions are rejected.
   - Source validation diagnostics use `customMaterialSource.*` codes and are
     JSON-safe.

3. Shader transport:
   - WGSL can be referenced by shader asset handle.
   - WGSL can be inlined for tests and demos.
   - Path-loaded WGSL is mirrored to the main thread by source asset
     handle/version and is not resent every frame unless changed.
   - Shader fetch and shader compile failures surface actionable diagnostics.

4. Render routing:
   - `createWebGpuApp()` routes custom WGSL families through normal material
     queueing, frame-resource preparation, command planning, frame boundary
     assembly, and submission.
   - No custom material example performs manual snapshot rewriting or manual
     WebGPU submission.
   - Unsupported custom family keys diagnose without falling back to built-ins.
   - Mixed built-in/custom frames render deterministically through the mixed
     app resource collector.

5. GPU ownership:
   - GPU shader modules, buffers, texture views, samplers, bind groups,
     pipelines, and caches are created only in `@aperture-engine/webgpu`.
   - ECS components and source assets never contain live GPU resources.
   - Public diagnostics and source asset mirrors never expose live GPU objects.

6. Rendering behavior:
   - A custom WGSL material renders visible pixels in a browser app.
   - Custom render state affects the WebGPU pipeline.
   - Uniform, texture, sampler, and instance-attribute declarations are either
     supported or clearly diagnosed as unsupported.
   - Existing built-in material examples and tests continue to pass.

7. Testing:
   - Unit tests cover source validation, shader asset handles/loading,
     source-asset mirroring, dependency readiness, prepared custom material
     metadata, family-key parsing, and queue route diagnostics.
   - WebGPU tests cover shader module failure, pipeline failure, missing binding
     resources, cache key behavior, and valid custom resource creation.
   - App/developer API tests cover generated browser config plus system usage.
   - Playwright covers successful custom material rendering and broken WGSL
     diagnostics.

## Suggested Validation Commands

Run targeted checks while implementing each slice, then finish with the broad
validation that is practical for the touched surface:

```sh
pnpm --filter @aperture-engine/simulation run typecheck
pnpm --filter @aperture-engine/render run typecheck
pnpm --filter @aperture-engine/app run typecheck
pnpm --filter @aperture-engine/webgpu run typecheck
pnpm run typecheck:test
pnpm exec vitest run test/materials test/assets test/rendering test/app test/webgpu
pnpm exec playwright test test/e2e/custom-material.spec.ts --project=chrome-webgpu-headed
pnpm exec playwright test test/e2e/developer-api.spec.ts --project=chrome-webgpu-headed --grep "custom material"
pnpm run check:examples
pnpm run check:progress
```

If full `pnpm test` or `pnpm run lint` still has unrelated repo-wide failures,
document the pre-existing failures in handoff and include the targeted pass list
for the changed files.

## Risks And Mitigations

- Risk: widening material source types breaks built-in assumptions.
  Mitigation: keep `MaterialKind` closed, introduce `SourceMaterialAsset`, and
  narrow explicitly at built-in boundaries.
- Risk: custom family keys conflict with pipeline-key parsing.
  Mitigation: validate family keys and ban `|`.
- Risk: group layouts collide with StandardMaterial lighting/IBL.
  Mitigation: reserve groups 0 and 1, use group 2 for v1 custom material
  bindings, keep group 3 reserved, and document the contract.
- Risk: dynamic uniform updates become too chatty if every frame mirrors a full
  material source.
  Mitigation: start with source-version updates for correctness, then add a
  targeted uniform-update packet or command if examples reveal pressure.
- Risk: shader source loading duplicates work between worker and main.
  Mitigation: v1 uses the existing source asset mirror as the single transport;
  future optimization can allow main-side shader asset fetch by handle/version.
- Risk: custom vertex layouts explode scope.
  Mitigation: v1 supports Aperture's current mesh layout expectations and
  existing instance attributes; broader vertex specialization is a follow-up.
- Risk: this becomes an arbitrary plugin system accidentally.
  Mitigation: ship only the Aperture-owned custom WGSL adapter. App-owned
  adapter callbacks remain deferred behind a separate decision.

## Explicit Non-Goals For V1

- Shader graphs or node materials.
- GLSL, SPIR-V, WESL, or WGSL import preprocessing.
- User-created WebGPU objects in ECS, system files, or source assets.
- Arbitrary app-owned material adapter registration in `createWebGpuApp()`.
- Custom render graph passes.
- Lighting, IBL, shadow, skinning, morph, or clustered-light integration for
  custom materials unless the custom WGSL shader explicitly uses already
  documented reserved renderer bindings.
- WebGL fallback.
