# Lighting, Environment, And Shadow Coverage

This note records the reference-engine coverage for `task-0021` and turns it into an Aperture MVP schema direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is to define light, environment, and shadow authoring data that remains ECS-owned while giving render extraction enough flat data to build WebGPU light buffers, environment bindings, and future shadow passes.

MVP coverage should include:

- Ambient/environment, directional, point, and spot light authoring.
- Color, intensity, range, spot cone, and layer-mask fields.
- Environment map handle design.
- Shadow caster/receiver and light shadow request schema design.
- Flat light and shadow extraction packet shapes.
- Diagnostics for invalid, unsupported, or incomplete light state.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/lights/Light.js`
- `src/lights/AmbientLight.js`
- `src/lights/HemisphereLight.js`
- `src/lights/DirectionalLight.js`
- `src/lights/PointLight.js`
- `src/lights/SpotLight.js`
- `src/lights/RectAreaLight.js`
- `src/lights/LightProbe.js`
- `src/lights/LightShadow.js`
- `src/lights/DirectionalLightShadow.js`
- `src/lights/PointLightShadow.js`
- `src/lights/SpotLightShadow.js`
- `src/renderers/common/Lighting.js`
- `src/renderers/common/Background.js`
- `src/extras/PMREMGenerator.js`
- `src/renderers/common/extras/PMREMGenerator.js`

Findings:

- Base `Light` stores color and intensity and inherits transform, layers, visibility, and shadow flags through the scene-object model.
- `AmbientLight` is a global color/intensity contribution with no direction or shadow support.
- `HemisphereLight` adds sky color, ground color, and intensity. It is useful as an environment-light reference, but not required as a distinct MVP kind.
- `DirectionalLight` derives direction from light position toward a target and owns a directional shadow descriptor.
- `PointLight` stores distance/range, decay, and point-shadow data. It also exposes power/intensity conversion helpers.
- `SpotLight` stores distance/range, outer angle, penumbra, decay, target, optional projected texture, and spot-shadow data.
- `RectAreaLight` covers rectangular area lights with width and height, but no shadow support. This should be a later Aperture feature.
- `LightProbe` stores spherical harmonics plus intensity, which is the right conceptual reference for later irradiance/environment data.
- `LightShadow` carries camera, intensity, bias, normal bias, radius, map size, shadow textures, transform matrix, and update flags. Specialized directional, point, and spot shadows choose orthographic, cube/perspective, or perspective camera behavior.
- Renderer lighting/background modules derive renderer-side lighting and background state from scene/camera inputs. Aperture should keep this as extraction-derived state, not renderer-owned authoring state.
- PMREM generation is an environment-map preprocessing path. Aperture should leave equivalent filtered environment generation for later asset cooking/runtime tooling.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Lights/light.ts`
- `packages/dev/core/src/Lights/shadowLight.ts`
- `packages/dev/core/src/Lights/directionalLight.ts`
- `packages/dev/core/src/Lights/pointLight.ts`
- `packages/dev/core/src/Lights/spotLight.ts`
- `packages/dev/core/src/Lights/hemisphericLight.ts`
- `packages/dev/core/src/Lights/areaLight.ts`
- `packages/dev/core/src/Lights/rectAreaLight.ts`
- `packages/dev/core/src/Lights/Clustered/clusteredLightingSceneComponent.ts`
- `packages/dev/core/src/Lights/Clustered/clusteredLightContainer.ts`
- `packages/dev/core/src/Lights/Shadows/shadowGenerator.ts`
- `packages/dev/core/src/Lights/Shadows/cascadedShadowGenerator.ts`
- `packages/dev/core/src/Lights/Shadows/shadowGeneratorSceneComponent.ts`
- `packages/dev/core/src/Rendering/IBLShadows/*`
- `packages/dev/core/src/Rendering/iblCdfGenerator.ts`
- `packages/dev/core/src/Helpers/environmentHelper.ts`
- `packages/dev/core/src/Probes/reflectionProbe.ts`
- `packages/dev/core/src/Misc/environmentTextureTools.ts`
- `packages/dev/core/src/Materials/environmentLighting.defines.ts`

Findings:

- Base `Light` owns diffuse/specular colors, intensity, range, falloff, intensity mode, render priority, include/exclude layer masks, included/excluded meshes, shadow enablement, and shadow generators keyed by camera.
- `DirectionalLight` stores direction plus shadow frustum configuration, including fixed and automatic orthographic bounds.
- `PointLight` stores position, range, and shadow support.
- `SpotLight` stores position, direction, angle, inner angle, exponent, optional projection texture, and shadow support.
- `HemisphericLight` stores direction, diffuse/specular/ground colors, and is explicitly a non-shadow-casting ambient approximation.
- `AreaLight` and `RectAreaLight` show area-light authoring pressure, but they require different shading data and should remain later.
- `ShadowGenerator` centralizes shadow-map size, bias, normal bias, darkness, filtering modes, render list management, and depth texture binding. It reinforces that shadow rendering needs its own render-pass resource path.
- `CascadedShadowGenerator` adds directional-light cascade count, split lambda, stabilization, blend percentage, depth bounds, and per-cascade matrices. Aperture should defer cascades until after a simple directional shadow path exists.
- Clustered-lighting files show Babylon's renderer-side aggregation path for many lights. Aperture's renderer may create clustered buffers later from extracted packets, but ECS should not contain cluster cells or light-container internals.
- Environment helpers, reflection probes, IBL shadow files, and environment texture tools show that environment lighting spans asset processing, scene resources, probes, and shader defines. Aperture's MVP should model handles now and implement filtered IBL later.

### PlayCanvas

Representative files inspected:

- `src/scene/light.js`
- `src/framework/components/light/component.js`
- `src/framework/components/light/system.js`
- `src/framework/components/light/data.js`
- `src/scene/lighting/world-clusters.js`
- `src/scene/lighting/lights-buffer.js`
- `src/scene/lighting/lighting-params.js`
- `src/scene/lighting/light-texture-atlas.js`
- `src/scene/renderer/world-clusters-allocator.js`
- `src/scene/renderer/frame-pass-update-clustered.js`
- `src/scene/renderer/shadow-map.js`
- `src/scene/renderer/shadow-map-cache.js`
- `src/scene/renderer/shadow-renderer.js`
- `src/scene/renderer/shadow-renderer-directional.js`
- `src/scene/renderer/shadow-renderer-local.js`
- `src/scene/renderer/render-pass-shadow-directional.js`
- `src/scene/renderer/render-pass-shadow-local-clustered.js`
- `src/scene/renderer/render-pass-shadow-local-non-clustered.js`
- `src/scene/renderer/light-camera.js`
- `src/scene/graphics/env-lighting.js`
- `src/scene/skybox/sky.js`
- `src/scene/skybox/sky-mesh.js`

Findings:

- `Light` stores type, layers, mask, color, intensity, luminance, range, falloff, spot inner/outer cones, shadow flags, shadow distance/resolution/bias/intensity, normal offset bias, shadow type, cascades, atlas viewport, cookie data, bake flags, shape, and clustered-lighting metadata.
- The light component maps framework fields into the scene light while preserving layers, cookies, shadow options, and bake settings. Aperture should expose comparable fields as data components and handles.
- `LightingParams`, `LightsBuffer`, and `WorldClusters` show the practical GPU aggregation path for many local lights: cluster grid parameters, max lights per cell, shadow/cookie toggles, atlas resolution, light-property texture buffers, and cluster updates.
- The world-clusters allocator reuses cluster data per unique light set. Aperture can derive similar renderer caches from extracted light packets and view packets later.
- The light texture atlas allocates shadow/cookie slots and sorts lights by screen size. This is a renderer concern and should not leak into ECS authoring state.
- Shadow renderers split directional and local light paths, create shadow cameras, assign atlas targets, cull casters, and render faces/cascades. This reinforces the need for `ShadowRequestPacket` data separate from `LightPacket` data.
- `light-camera.js` derives perspective shadow cameras for spot/omni lights and orthographic cameras for directional lights. Aperture should compute these during renderer shadow planning, not during ECS simulation.
- Environment-lighting and skybox files generate skybox cubemaps, lighting sources, environment atlases, and sky meshes. Aperture's MVP should keep skybox/environment as handles and avoid adopting a scene-graph sky object.

## Aperture MVP Schema Direction

### Components And Handles

Use ECS components for authoring and resource handles for reusable lighting assets:

```ts
type TextureHandle = ResourceHandle<"texture">;
type SamplerHandle = ResourceHandle<"sampler">;
type EnvironmentMapHandle = ResourceHandle<"environment-map">;

interface Light {
  enabled: boolean;
  kind: LightKind;
  color: [number, number, number];
  intensity: number;
  layerMask: number;
  range?: number;
  innerConeRadians?: number;
  outerConeRadians?: number;
  shadow?: LightShadowSettings;
}

type LightKind = "ambient" | "directional" | "point" | "spot";
```

Non-ambient lights use `WorldTransform` for position and/or direction. Directional and spot lights should use the entity's world orientation, with local negative Z as the default forward direction. Point and spot lights use the world translation.

### Light Fields

MVP field rules:

- `color`: linear RGB factor. Values should be finite and non-negative.
- `intensity`: non-negative scalar. Photometric units can be added later; MVP treats this as renderer-defined relative intensity.
- `layerMask`: 32-bit mask. A light affects a view/renderable only when masks overlap.
- `range`: required for point and spot lights. `0` or omitted means infinite range only if the renderer explicitly supports it; otherwise validation should reject it for MVP.
- `innerConeRadians` and `outerConeRadians`: required for spot lights. `0 <= inner <= outer <= pi / 2`.
- Directional and ambient lights ignore `range` and spot cone fields with a warning or diagnostic.
- Ambient lights do not require `WorldTransform`.

### Environment Lighting

Represent environment lighting as a resource-level input, not as a renderer-owned scene object:

```ts
interface EnvironmentLighting {
  enabled: boolean;
  intensity: number;
  layerMask: number;
  skyboxTexture?: TextureHandle;
  radianceMap?: EnvironmentMapHandle;
  irradianceSH?: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  rotationRadians?: number;
}
```

MVP can start with ambient color and an optional skybox/environment texture handle. Filtered radiance maps, SH probes, PMREM generation, reflection probes, and IBL shadowing are later asset/rendering work.

### Shadow Authoring

Keep shadow casting and receiving on renderable entities separate from per-light shadow requests:

```ts
interface ShadowCaster {
  enabled: boolean;
  layerMask?: number;
}

interface ShadowReceiver {
  enabled: boolean;
  layerMask?: number;
}

interface LightShadowSettings {
  enabled: boolean;
  mapSize?: number;
  bias?: number;
  normalBias?: number;
  strength?: number;
  casterLayerMask?: number;
  receiverLayerMask?: number;
}
```

MVP should define these schemas before rendering shadows. Actual shadow map rendering can start with one directional-light shadow map and later add spot, point/cube, cascaded, atlas, VSM/PCF/PCSS, and contact-hardening variants.

### Render Extraction Packets

Render extraction should emit flat packets that contain resolved transform-derived data and stable ECS identity:

```ts
type LightPacket =
  | AmbientLightPacket
  | DirectionalLightPacket
  | PointLightPacket
  | SpotLightPacket;

interface BaseLightPacket {
  entity: Entity;
  kind: LightKind;
  color: [number, number, number];
  intensity: number;
  layerMask: number;
  castsShadow: boolean;
}

interface AmbientLightPacket extends BaseLightPacket {
  kind: "ambient";
}

interface DirectionalLightPacket extends BaseLightPacket {
  kind: "directional";
  direction: [number, number, number];
}

interface PointLightPacket extends BaseLightPacket {
  kind: "point";
  position: [number, number, number];
  range: number;
}

interface SpotLightPacket extends BaseLightPacket {
  kind: "spot";
  position: [number, number, number];
  direction: [number, number, number];
  range: number;
  innerConeCos: number;
  outerConeCos: number;
}

interface EnvironmentPacket {
  enabled: boolean;
  intensity: number;
  layerMask: number;
  skyboxTexture?: TextureHandle;
  radianceMap?: EnvironmentMapHandle;
  irradianceSH?: Float32Array;
  rotationRadians?: number;
}

interface ShadowRequestPacket {
  lightEntity: Entity;
  lightKind: "directional" | "point" | "spot";
  mapSize: number;
  bias: number;
  normalBias: number;
  strength: number;
  casterLayerMask: number;
  receiverLayerMask: number;
}
```

The renderer may derive light buffers, clustered-lighting textures, shadow atlases, shadow cameras, and bind groups from these packets. It must not mutate ECS light components or store renderer light objects as the source of truth.

### Diagnostics

Lighting extraction should emit structured diagnostics for:

- Enabled directional, point, or spot light missing `WorldTransform`.
- Non-finite or negative `color`, `intensity`, `range`, cone, bias, or shadow strength fields.
- Point or spot light with unsupported infinite range.
- Spot light with `innerConeRadians > outerConeRadians` or `outerConeRadians > pi / 2`.
- Zero `layerMask` on a light, environment packet, shadow caster, or shadow receiver.
- Shadow requested on ambient light.
- Shadow requested for a light kind the current renderer does not support.
- Shadow map size outside supported power-of-two limits.
- Too many lights for the current MVP renderer limit.
- Missing or not-ready environment texture/radiance-map handles.
- Unsupported environment texture dimension, format, color space, mip layout, or sampler mode.

## MVP, Soon, Later

MVP:

- `Light` component for ambient, directional, point, and spot lights.
- Linear color, intensity, layer mask, point/spot range, and spot cone fields.
- Environment-lighting resource shape with ambient/skybox/environment handles.
- `ShadowCaster`, `ShadowReceiver`, and `LightShadowSettings` schemas.
- Extraction to `LightPacket[]`, optional `EnvironmentPacket`, and future-compatible `ShadowRequestPacket[]`.
- Diagnostics for invalid light, environment, and shadow authoring.

Soon:

- Basic forward lighting in the WebGPU shader path.
- Directional shadow-map rendering for one light.
- Spot-light shadows.
- Simple skybox rendering from a cube/environment texture.
- Basic environment diffuse/specular contribution once material lighting exists.
- Per-view light filtering by layer masks.

Later:

- Point-light cube shadows.
- Cascaded directional shadows.
- Shadow atlases, VSM/PCF/PCSS/contact-hardening filters, and transparent shadows.
- Clustered or tiled lighting for many local lights.
- Cookies, IES profiles, area/rect lights, LTC shading, light probes, reflection probes, lightmaps, baked GI, and environment-map preprocessing.
- Per-light photometric units and physically calibrated intensity modes.

## Future Implementation Acceptance Tests

Use these as acceptance tests when lighting moves from schema planning into runtime code:

- Extracts ambient, directional, point, and spot light packets from enabled ECS light entities.
- Skips disabled lights and emits no packet for them.
- Emits a diagnostic when a directional, point, or spot light is missing `WorldTransform`.
- Computes directional and spot directions from `WorldTransform` orientation using the documented local forward axis.
- Emits point and spot positions from `WorldTransform` translation.
- Converts spot inner/outer cone angles to cosine packet fields and rejects invalid cone ordering.
- Filters lights against camera/renderable layer masks without mutating ECS state.
- Emits a shadow request packet only for supported non-ambient lights with enabled shadow settings.
- Emits diagnostics for unsupported shadow requests while still extracting the non-shadow light packet.
- Emits an environment packet from ready environment handles and diagnostics for missing or unsupported handles.
- Rejects zero layer masks for enabled lights and environment lighting.
- Enforces a deterministic light packet ordering, such as stable entity id order after kind grouping if grouping is needed.
