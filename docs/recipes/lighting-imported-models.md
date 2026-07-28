# Recipe: Lighting imported models

**Status:** reference

Use this setup when a glTF model should look good immediately while preserving
its authored PBR material values.

## Why metallic models need an environment

Aperture follows the metallic/roughness PBR model. As metalness approaches
one, the diffuse lobe approaches zero and the material's base color moves into
its specular response. Uniform ambient light affects the diffuse lobe; it
cannot replace reflected surroundings. A fully metallic surface with only
ambient and directional light can therefore have dark faces even though the
asset is valid.

The general fix is specular image-based lighting from an HDR environment. Do
that before changing a material. Textureless glTF materials are also valid:
base-color, metallic, and roughness factors are sufficient, and the absence of
a texture is not a load failure.

## Complete physically faithful setup

Put the packaged neutral studio HDR and your model under `public/assets/`, then
declare both as blocking assets:

```ts
// aperture.shared-config.ts (or aperture.config.ts)
import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    model: asset.gltf("/assets/model.glb", { preload: "blocking" }),
    studioEnvironment: asset.hdr("/assets/studio-neutral.hdr", {
      preload: "blocking",
    }),
  },
  render: {
    tonemap: "aces",
    exposure: 1,
    outputColorSpace: "srgb",
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
  },
});
```

Author the camera, rig, and model as ordinary ECS entities:

```ts
// src/systems/setup.system.ts
import { createSystem } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: {
        translation: [0, 1.4, 4],
        lookAt: [0, 0.4, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.lightRig({
      key: "lighting.presentation",
      preset: "studio-neutral",
      environmentMap: this.assets.hdr("studioEnvironment"),
      shadows: true,
    });

    this.spawn.gltf(this.assets.gltf("model"), {
      key: "viewer.model",
      castShadow: true,
      receiveShadow: true,
    });
  }
}
```

`studio-neutral` expands to an environment, a directional key, and an area rim
light. They are normal ECS entities and can be inspected, overridden, or
removed with the rig. ACES maps HDR highlights into the sRGB output without
hard clipping; exposure `1` activates the HDR scene path.

For a single environment without a preset rig:

```ts
this.spawn.environment({
  key: "lighting.environment",
  source: this.assets.hdr("studioEnvironment"),
  intensity: 1,
});
```

## Explicit stylized path

Import defaults preserve source material values. If the asset represents
painted props but was authored as metal, select a named policy explicitly:

```ts
import { createSystem, material } from "@aperture-engine/app/systems";

this.spawn.gltf(this.assets.gltf("model"), {
  key: "viewer.model",
  materials: material.preset("painted-stylized", {
    baseColorFactor: [1, 0.96, 0.92, 1],
  }),
});
```

`painted-stylized` starts at `metallicFactor: 0.12` and
`roughnessFactor: 0.72`. The preset patches cloned materials for that spawned
subtree; it never mutates the imported source assets. Use `source`, `matte`, or
`preview-safe` for the other versioned policies, or pass a
`StandardMaterialPatch` directly.

## Inspect before reviewing pixels

Start a strict, deterministic headless slot, then inspect the authored values
and submitted lighting state:

```text
app_start({ target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "strict" })
asset_inspect({ id: "model" })
render_diagnose({ width: 960, height: 640 })
frame_capture({ width: 960, height: 640, out: "artifacts/model.png" })
```

`asset_inspect` reports source and spawn-patched materials, texture authoring
versus failures, and normal/tangent/UV availability without requiring a GPU.
`render_diagnose` reports ACES/exposure/HDR state, active lights, submitted IBL
state, visible metallic counts, and warnings. Resolve
`render.material.metalWithoutSpecularIbl` or
`render.environment.requestedButInactive` before subjective review.

Run a headed capture for final DPR/live-canvas parity, not for normal simulation
iteration.

## Fill and rim guidance

A rim or area light is useful for silhouette separation and art direction. A
sky/ground gradient or hemisphere-style fill can make diffuse materials easier
to read, but it is not a substitute for specular IBL: pure metals need a
reflected environment. Aperture's built-in studio rig uses an area rim while
the HDR environment supplies both diffuse irradiance and specular reflections.

See [StandardMaterial image-based lighting](../architecture/standard-material-ibl.md)
for the executable renderer path and readiness meanings.
