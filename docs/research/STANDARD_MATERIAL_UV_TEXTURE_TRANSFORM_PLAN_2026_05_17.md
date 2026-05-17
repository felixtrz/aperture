# StandardMaterial UV Set And Texture Transform Plan - 2026-05-17

## Context

`task-0627` confirmed that StandardMaterial now renders the main glTF
metallic-roughness texture channels, but it also identified two import-facing
gaps:

- `MaterialTextureBinding.texCoord` is packed into material metadata, but
  StandardMaterial WGSL samples only `input.uv` from `TEXCOORD_0`.
- glTF `KHR_texture_transform` is not represented in Aperture material
  bindings, so an importer would currently have to drop or hide that metadata.

Reference patterns inspected:

- three.js `GLTFLoader` assigns texture channels from `texCoord` and applies
  `KHR_texture_transform` to texture offset/repeat/rotation.
- PlayCanvas maps `texCoord` to per-map UV fields and stores transform
  offset/scale/rotation on the material.
- Bevy maps glTF texture `texCoord` into typed UV channels and currently
  supports `KHR_texture_transform` narrowly for base-color texture transforms
  while warning about differing transforms on other maps.

## Recommended Shape

Treat UV-set and texture-transform handling as renderer-independent material
metadata first, then specialize shaders from that metadata.

1. Extend `MaterialTextureBinding` with optional transform metadata:

   ```ts
   interface MaterialTextureTransform {
     readonly offset?: readonly [number, number];
     readonly scale?: readonly [number, number];
     readonly rotation?: number;
   }
   ```

   Add `transform?: MaterialTextureTransform` beside the existing `texCoord`.

2. Add readiness diagnostics before rendering support:
   - Diagnose `texCoord > 0` until a shader variant consumes `TEXCOORD_1`.
   - Diagnose any non-identity transform until shader support exists.
   - Keep the diagnostics JSON-safe and tied to material key, texture field,
     `texCoord`, and transform metadata.

3. Add shader support in small vertical slices:
   - First support `TEXCOORD_1` selection without transforms.
   - Then support one shared base-color texture transform.
   - Only after that consider per-map transforms, because they affect material
     uniform layout, shader keys, and bind-group/pipeline cache keys.

4. Keep GLB import honest:
   - Preserve `texCoord` and transform metadata in source assets.
   - Emit diagnostics for unsupported UV/transform cases instead of silently
     sampling the wrong coordinates.
   - Do not promote GLB material mapping until diagnostics and the default
     `TEXCOORD_0` path are both covered by tests.

## Pipeline-Key Impact

`texCoord` and texture transforms are shader-affecting. The near-term key shape
should stay coarse and explicit:

- `standard|baseColorTexture|uv1|...` for any texture slot that needs
  `TEXCOORD_1`.
- `standard|baseColorTexture|baseColorTransform|...` when transform support
  lands.

Avoid encoding raw transform values in the pipeline key. Transform values belong
in the material uniform/resource data; only the fact that a transform path is
needed should affect shader specialization.

## Follow-Up Tasks

- `task-0632` should land semantic/color-space diagnostics first.
- Add a future implementation task for `texCoord > 0` diagnostics across
  StandardMaterial texture bindings.
- Add a future implementation task for `TEXCOORD_1` shader variants once the
  diagnostics prove where the unsupported cases appear.
