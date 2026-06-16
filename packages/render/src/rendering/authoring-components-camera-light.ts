import { EcsType, defineComponent } from "@aperture-engine/simulation";

import {
  AreaLightShape,
  CameraProjection,
  LightKind,
} from "./authoring-types.js";
import { tuple4 } from "./authoring-utils.js";

export const Camera = defineComponent(
  "aperture.render.camera",
  {
    projection: {
      type: EcsType.Enum,
      enum: CameraProjection,
      default: CameraProjection.Perspective,
    },
    fovYRadians: { type: EcsType.Float32, default: Math.PI / 3 },
    aspect: { type: EcsType.Float32, default: 1 },
    autoAspect: { type: EcsType.Boolean, default: true },
    near: { type: EcsType.Float32, default: 0.1 },
    far: { type: EcsType.Float32, default: 1000 },
    orthographicHeight: { type: EcsType.Float32, default: 10 },
    viewport: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    scissor: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    clearColor: { type: EcsType.Color, default: tuple4(0, 0, 0, 1) },
    clearDepth: { type: EcsType.Float32, default: 1 },
    clearStencil: { type: EcsType.Int32, default: 0 },
    clearFlags: { type: EcsType.Int32, default: 3 },
    layerMask: { type: EcsType.Int32, default: 1 },
    priority: { type: EcsType.Int32, default: 0 },
    renderTargetId: { type: EcsType.String, default: "" },
    frustumCulling: { type: EcsType.Boolean, default: true },
    temporalJitterX: { type: EcsType.Float32, default: 0 },
    temporalJitterY: { type: EcsType.Float32, default: 0 },
  },
  "Renderer-independent camera authoring component.",
);

export const Light = defineComponent(
  "aperture.render.light",
  {
    kind: {
      type: EcsType.Enum,
      enum: LightKind,
      default: LightKind.Directional,
    },
    shape: {
      type: EcsType.Enum,
      enum: AreaLightShape,
      default: AreaLightShape.Rect,
    },
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
    intensity: { type: EcsType.Float32, default: 1 },
    range: { type: EcsType.Float32, default: 10 },
    innerConeAngle: { type: EcsType.Float32, default: Math.PI / 8 },
    outerConeAngle: { type: EcsType.Float32, default: Math.PI / 6 },
    width: { type: EcsType.Float32, default: 2 },
    height: { type: EcsType.Float32, default: 2 },
    layerMask: { type: EcsType.Int32, default: 1 },
    environmentMapId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent light authoring component.",
);

export const LightCookie = defineComponent(
  "aperture.render.lightCookie",
  {
    textureId: { type: EcsType.String, default: "" },
    samplerId: { type: EcsType.String, default: "" },
    intensity: { type: EcsType.Float32, default: 1 },
  },
  "Renderer-independent local-light cookie request component.",
);

export const ShadowCaster = defineComponent(
  "aperture.render.shadowCaster",
  {
    enabled: { type: EcsType.Boolean, default: true },
  },
  "Marks an entity as eligible to cast shadows.",
);

export const ShadowReceiver = defineComponent(
  "aperture.render.shadowReceiver",
  {
    enabled: { type: EcsType.Boolean, default: true },
  },
  "Marks an entity as eligible to receive shadows.",
);

export const LightShadowSettings = defineComponent(
  "aperture.render.lightShadowSettings",
  {
    enabled: { type: EcsType.Boolean, default: false },
    mapSize: { type: EcsType.Int32, default: 1024 },
    bias: { type: EcsType.Float32, default: 0 },
    normalBias: { type: EcsType.Float32, default: 0 },
    cascadeCount: { type: EcsType.Int32, default: 1 },
    casterLayerMask: { type: EcsType.Int32, default: -1 },
    receiverLayerMask: { type: EcsType.Int32, default: -1 },
    // Filtering mode: 0 = hard, 1 = PCF (default, matches the existing 3x3 box
    // filter), 2 = PCSS contact-hardening (consumed in M4-T7).
    shadowType: { type: EcsType.Int32, default: 1 },
    // Authored shadow opacity in [0,1]; 1 = fully dark capable (consumed in
    // M4-T4, replacing the hard-coded MIN_VISIBILITY floor).
    strength: { type: EcsType.Float32, default: 1 },
    // PCF/PCSS filter radius in texels (consumed in M4-T5/T7).
    filterRadius: { type: EcsType.Float32, default: 1 },
    // Slope-scaled depth bias for the caster pipeline (consumed in M4-T5).
    slopeBias: { type: EcsType.Float32, default: 0 },
    // Fixed directional shadow-camera center. Active when orthographicSize > 0.
    centerX: { type: EcsType.Float32, default: 0 },
    centerY: { type: EcsType.Float32, default: 0 },
    centerZ: { type: EcsType.Float32, default: 0 },
    // Fixed directional shadow-camera span. 0 keeps renderer auto-fit enabled.
    orthographicSize: { type: EcsType.Float32, default: 0 },
    // Fixed directional shadow-camera clip/depth placement. 0 means default.
    near: { type: EcsType.Float32, default: 0 },
    far: { type: EcsType.Float32, default: 0 },
    lightDistance: { type: EcsType.Float32, default: 0 },
  },
  "Renderer-independent per-light shadow request authoring component.",
);
