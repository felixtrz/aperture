# Asset, Loader, Scene Import, And Handle Coverage

This note records the reference-engine coverage for `task-0022` and turns it into an Aperture MVP schema direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is to define an asset and import boundary that lets Aperture load practical 3D content without introducing a scene graph or making the renderer authoritative for game state.

MVP coverage should include:

- Typed handles for mesh, material, texture, sampler, scene/prefab, and animation assets.
- Asset registry status and diagnostics.
- GLB/glTF 2.0 import for a deliberately small subset.
- Import output as reusable assets plus ECS authoring commands.
- Missing, failed, unsupported, and not-ready asset diagnostics.
- Agent-readable import manifests.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/loaders/LoadingManager.js`
- `src/loaders/Loader.js`
- `src/loaders/FileLoader.js`
- `src/loaders/Cache.js`
- `src/loaders/ImageLoader.js`
- `src/loaders/TextureLoader.js`
- `src/loaders/CubeTextureLoader.js`
- `src/loaders/CompressedTextureLoader.js`
- `src/loaders/BufferGeometryLoader.js`
- `src/loaders/MaterialLoader.js`
- `src/loaders/ObjectLoader.js`
- `src/loaders/AnimationLoader.js`
- `examples/jsm/loaders/GLTFLoader.js`
- `examples/jsm/loaders/KTX2Loader.js`
- `examples/jsm/loaders/DRACOLoader.js`

Findings:

- `LoadingManager` tracks item start/end/error/progress, URL rewriting, and extension-specific loader handlers. Aperture needs equivalent lifecycle data, but as registry status and diagnostics rather than global mutable loader callbacks.
- Base `Loader` and `FileLoader` separate common path, request headers, credentials, response type, cache, and async load behavior from format-specific parsing.
- `ObjectLoader`, `BufferGeometryLoader`, `MaterialLoader`, and `AnimationLoader` parse engine-native JSON into scene graph objects, geometries, materials, and clips. Aperture should not copy the object model, but should keep the idea of parse phases with reusable asset records.
- `GLTFLoader` is the key reference: it parses GLB/glTF, maintains dependency caches, maps glTF entities to created objects, supports extension plugins, and loads buffers, buffer views, accessors, textures, materials, meshes, skins, animations, cameras, nodes, and scenes.
- `GLTFLoader` returns `scene`, `scenes`, `animations`, and `cameras` as engine objects. Aperture should instead return an import report containing asset handles and ECS creation commands.
- `KTX2Loader` requires renderer/device capability detection before transcoding and uses worker-backed Basis Universal transcoding. This should be a later compression path for Aperture, not an MVP requirement.
- `DRACOLoader` requires decoder configuration and worker management. Draco should be represented as an unsupported/deferred import feature until the uncompressed GLB path is working.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Loading/sceneLoader.ts`
- `packages/dev/core/src/assetContainer.ts`
- `packages/dev/core/src/Misc/fileTools.ts`
- `packages/dev/core/src/Materials/Textures/texture.ts`
- `packages/dev/core/src/Materials/Textures/baseTexture.ts`
- `packages/dev/core/src/Materials/Textures/textureSampler.ts`
- `packages/dev/core/src/Materials/Textures/Loaders/internalTextureLoader.ts`
- `packages/dev/core/src/Materials/Textures/Loaders/basisTextureLoader.ts`
- `packages/dev/core/src/Materials/Textures/Loaders/ktxTextureLoader.ts`
- `packages/dev/core/src/Meshes/Compression/dracoCompression.ts`
- `packages/dev/core/src/Meshes/Compression/dracoDecoder.ts`
- `packages/dev/core/src/Meshes/Compression/meshoptCompression.ts`
- `packages/dev/loaders/src/glTF/glTFFileLoader.ts`
- `packages/dev/loaders/src/glTF/glTFValidation.ts`
- `packages/dev/loaders/src/glTF/2.0/glTFLoader.ts`
- `packages/dev/loaders/src/glTF/2.0/materialLoadingAdapter.ts`
- `packages/dev/loaders/src/glTF/2.0/pbrMaterialLoadingAdapter.ts`
- `packages/dev/loaders/src/glTF/2.0/Extensions/KHR_draco_mesh_compression.ts`
- `packages/dev/loaders/src/glTF/2.0/Extensions/KHR_texture_basisu.ts`
- `packages/dev/loaders/src/glTF/2.0/Extensions/EXT_texture_webp.ts`
- `packages/dev/loaders/src/glTF/2.0/Extensions/EXT_meshopt_compression.ts`

Findings:

- `SceneLoader` provides plugin registration, extension lookup, module-level async entry points, progress/error callbacks, import-mesh loading, append/load scene loading, animation import, and `LoadAssetContainerAsync`.
- `AssetContainer` groups loaded meshes, materials, textures, skeletons, animation groups, cameras, lights, and other scene resources before adding or instantiating them in a scene. Aperture needs a similar intermediate container, but its output should be handles plus ECS commands.
- `FileTools` handles URL preprocessing, base URL, CORS behavior, retry strategy, file/image loading, data URLs, and MIME inference. Aperture's loader should make URL and source normalization explicit so diagnostics are reproducible.
- `GLTFFileLoader` owns glTF file parsing, GLB chunk reading, optional validation, range-request behavior, observables, and the bridge into the glTF 2.0 loader.
- `glTFValidation.ts` runs Khronos validation in a worker and preserves validation results. Aperture should expose import diagnostics in a structured report even before adopting the full validator.
- `GLTFLoader` loads scenes, nodes, meshes, materials, textures, images, buffers, buffer views, accessors, cameras, skins, and animations with extension hooks and per-resource async caches.
- Material loading adapters map glTF material data into Babylon material families. Aperture should map the MVP metallic-roughness subset into the `MaterialAsset` schema from `task-0019`.
- `KHR_draco_mesh_compression`, `EXT_meshopt_compression`, `KHR_texture_basisu`, and `EXT_texture_webp` show the main compressed mesh/texture pressures. MVP should reject these extensions with clear diagnostics unless an explicit decoder has been added.
- Babylon's texture loaders and compression helpers show that KTX/KTX2/Basis/Draco/Meshopt support needs device capabilities, worker resources, external decoder binaries, and format negotiation. These are later loader tasks.

### PlayCanvas

Representative files inspected:

- `src/framework/asset/asset.js`
- `src/framework/asset/asset-file.js`
- `src/framework/asset/asset-registry.js`
- `src/framework/asset/asset-list-loader.js`
- `src/framework/asset/asset-reference.js`
- `src/framework/handlers/loader.js`
- `src/framework/handlers/container.js`
- `src/framework/handlers/model.js`
- `src/framework/handlers/render.js`
- `src/framework/handlers/material.js`
- `src/framework/handlers/texture.js`
- `src/framework/handlers/scene.js`
- `src/framework/handlers/hierarchy.js`
- `src/framework/handlers/template.js`
- `src/framework/parsers/glb-parser.js`
- `src/framework/parsers/glb-container-parser.js`
- `src/framework/parsers/glb-container-resource.js`
- `src/framework/parsers/glb-model.js`
- `src/framework/parsers/material/json-standard-material.js`
- `src/framework/parsers/texture/img.js`
- `src/framework/parsers/texture/ktx.js`
- `src/framework/parsers/texture/ktx2.js`
- `src/framework/parsers/texture/basis.js`
- `src/framework/parsers/draco-decoder.js`
- `src/framework/parsers/draco-worker.js`
- `src/framework/parsers/scene.js`

Findings:

- `Asset` stores name, type, file metadata, JSON data, loaded/loading flags, resources, preload behavior, tags, localization, ready callbacks, reload, unload, and file-content fetch helpers.
- `AssetRegistry` indexes assets by id, name, URL, and tags; emits add/remove/load/error/unload events; delegates parsing to resource handlers; and offers URL-based loading helpers.
- `AssetListLoader` tracks grouped asset loading, waiting assets, failed assets, and completion. Aperture should represent dependency groups in import reports and registry status.
- `AssetReference` is a useful reference for handle-like indirection by id or URL with callbacks for add/load/remove/unload.
- Resource handlers provide a consistent `load`, `open`, and `patch` shape per asset type. Aperture can mirror this internally as loader stages, but public ECS components should only store handles.
- `TextureHandler` picks parsers for browser images, DDS, KTX, KTX2, Basis, and HDR and applies sampler/color-space options from asset data. MVP should keep image texture loading narrow and defer compressed variants.
- `JsonStandardMaterialParser` validates and migrates material JSON before constructing a `StandardMaterial`, including texture placeholder behavior for unloaded assets. Aperture should validate material assets directly and surface missing texture handles.
- `GlbParser` validates GLB headers/chunks, parses glTF 2.0 JSON, creates images, textures, materials, meshes, skins, animations, cameras, lights, and scenes, and reports invalid GLB/glTF structure as explicit errors.
- `GlbContainerResource` creates sub-assets for renders, materials, models, and animations, and can instantiate model/render entities with render, camera, and light components. Aperture should adapt this into ECS authoring commands instead of direct entity side effects.
- Draco and Basis/KTX2 parser paths use workers and external modules. They should stay outside MVP until the uncompressed import path is deterministic.

## Aperture MVP Schema Direction

### Handles

Use opaque typed asset handles across ECS and public APIs:

```ts
type AssetHandle<TKind extends AssetKind> = {
  kind: TKind;
  id: string;
};

type AssetKind =
  | "mesh"
  | "material"
  | "texture"
  | "sampler"
  | "scene"
  | "prefab"
  | "animation-clip";
```

Rules:

- ECS components store handles, not loaded asset objects, file bytes, decoded arrays, or GPU resources.
- Asset handles are stable across import reports and serialization.
- The renderer resolves ready handles during extraction/upload and emits diagnostics for missing or not-ready assets.

### Asset Registry

Recommended registry record:

```ts
type AssetStatus = "registered" | "loading" | "ready" | "failed" | "unloaded";

interface AssetRecord<TKind extends AssetKind, TAsset> {
  handle: AssetHandle<TKind>;
  kind: TKind;
  label?: string;
  source?: AssetSource;
  status: AssetStatus;
  asset?: TAsset;
  dependencies: AssetHandle<AssetKind>[];
  diagnostics: AssetDiagnostic[];
}

interface AssetSource {
  uri?: string;
  byteRange?: { offset: number; length: number };
  mimeType?: string;
  hash?: string;
}
```

Registry operations should include:

- `registerAsset(record)`
- `loadAsset(handle)`
- `getAsset(handle)`
- `getStatus(handle)`
- `unloadAsset(handle)`
- `listAssets(filter?)`
- `collectDiagnostics(handle?)`

MVP can implement loading synchronously or asynchronously, but status transitions should be explicit:

- `registered`: handle exists but no load attempt has completed.
- `loading`: bytes or dependencies are being resolved.
- `ready`: typed asset data is available.
- `failed`: load/import failed and diagnostics explain why.
- `unloaded`: handle remains valid, but asset data was released.

### Asset Kinds

MVP asset kinds:

- `MeshAsset`: from `task-0018`, including vertex streams, optional index buffer, submeshes, bounds, and deferred skin/morph placeholders.
- `MaterialAsset`: from `task-0019`, including unlit, metallic-roughness, and debug-normal material families.
- `TextureAsset`: from `task-0019`, initially 2D image data with explicit format and color space.
- `SamplerAsset`: from `task-0019`, separate address/filter state.
- `SceneAsset`: reusable imported scene/prefab description that can instantiate ECS commands.
- `AnimationClipAsset`: preserve glTF clip handles in the registry, but playback can remain deferred until animation coverage is implemented.

### GLB/glTF MVP Subset

Initial supported subset:

- GLB container and glTF 2.0 JSON with one binary chunk or external buffers when the source resolver allows them.
- Nodes with TRS or matrix transforms mapped to ECS `LocalTransform` and `Parent`.
- Mesh primitives with `TRIANGLES` mode, `POSITION`, optional `NORMAL`, optional `TEXCOORD_0`, optional `COLOR_0`, optional indices, and local bounds generation when missing.
- Materials using glTF metallic-roughness core fields and `KHR_materials_unlit`.
- 2D images referenced by URI, buffer view, or GLB binary chunk when the image MIME type is supported by the MVP image path.
- Samplers mapped to `SamplerAsset`.
- Cameras mapped to the `Camera` component schema from `task-0020`.
- Scene roots mapped to ECS entity creation commands.
- Preserve unsupported skins, morph targets, animations, lights, and extensions as diagnostics or deferred asset records when possible.

Initial unsupported subset with explicit diagnostics:

- glTF 1.0.
- Draco and Meshopt compressed meshes.
- KTX/KTX2/Basis/WebP/AVIF compressed or alternative texture paths.
- Sparse accessors unless explicitly implemented.
- Non-triangle primitive modes beyond preserving a diagnostic.
- Skins, morph targets, animation playback, punctual lights extension, material variants, texture transforms, advanced PBR extensions, GPU instancing extension, and interactivity extensions.
- OBJ, FBX, STL, USD, SVG, HDR/EXR, SPLAT, scene-template formats, and editor project formats.

### Import Output

Import should produce a report instead of mutating a renderer or hidden scene graph:

```ts
interface AssetImportReport {
  source: AssetSource;
  rootScene?: AssetHandle<"scene">;
  assets: AssetHandle<AssetKind>[];
  commands: EcsAuthoringCommand[];
  manifest: AssetManifest;
  diagnostics: AssetDiagnostic[];
}

type EcsAuthoringCommand =
  | { type: "create-entity"; id: string; name?: string }
  | { type: "add-component"; entity: string; component: string; value: unknown }
  | { type: "set-parent"; child: string; parent: string };

interface AssetManifest {
  sourceLabel?: string;
  assetCountByKind: Record<AssetKind, number>;
  rootEntities: string[];
  dependencyEdges: Array<{ from: string; to: string }>;
  unsupportedFeatures: string[];
}
```

The import report is agent-readable by design. It should make the generated entities, handles, dependency edges, unsupported features, and diagnostics inspectable without opening a renderer.

### Scene And Prefab Assets

`SceneAsset` should store reusable import results:

```ts
interface SceneAsset {
  handle: AssetHandle<"scene">;
  label?: string;
  rootEntityIds: string[];
  commands: EcsAuthoringCommand[];
  dependencies: AssetHandle<AssetKind>[];
}
```

Instantiating a scene asset means replaying commands into a target ECS world with remapped entity IDs. It must not share mutable transform state between instances.

### Diagnostics

Asset and import diagnostics should include:

- Missing source, unsupported URI scheme, failed fetch, or failed decode.
- Invalid GLB magic, version, length, chunk count, or chunk type.
- Invalid glTF version or malformed JSON.
- Missing required buffers, buffer views, accessors, images, textures, samplers, materials, meshes, nodes, or scenes.
- Unsupported required extension.
- Unsupported optional extension used in data that affects rendered output.
- Unsupported compressed mesh or texture path.
- Attribute count/stride/component-type mismatches.
- Missing `POSITION` for renderable mesh primitives.
- Unsupported primitive mode.
- Invalid material factors, texture color-space mismatch, or missing texture/sampler handle.
- Failed asset dependency, not-ready handle, or circular dependency.

## Future Implementation Acceptance Tests

Use these as acceptance tests when asset loading moves from schema planning into runtime code:

- Registers typed handles for mesh, material, texture, sampler, scene, and animation clip assets.
- Transitions asset records through `registered`, `loading`, `ready`, `failed`, and `unloaded` states.
- Resolves a valid handle to typed asset data and emits a diagnostic for a missing handle.
- Imports a minimal GLB triangle into one mesh asset, one material asset, one scene asset, and ECS creation commands.
- Imports glTF node TRS hierarchy into `LocalTransform` and `Parent` authoring commands without creating renderer objects.
- Imports metallic-roughness material fields into `MaterialAsset`.
- Imports image and sampler references into `TextureAsset` and `SamplerAsset` handles.
- Emits a structured diagnostic for an unsupported required glTF extension.
- Emits a structured diagnostic for Draco or Meshopt compressed primitives in MVP.
- Emits a structured diagnostic for KTX2/Basis/WebP/AVIF texture paths in MVP.
- Produces a deterministic, agent-readable manifest with asset counts, dependency edges, root entities, and unsupported features.
- Replays a `SceneAsset` into two separate worlds or namespaces without sharing mutable entity state.
