import { EcsType, defineComponent } from "@aperture-engine/simulation";
import {
  AreaLightShape,
  CameraProjection,
  FogMode,
  LightKind,
  MeshQueryAccelerationMode,
  MeshQueryAccelerationStrategy,
  MeshQueryDynamicPolicy,
  PickablePrecision,
} from "./authoring-types.js";
import { tuple4 } from "./authoring-utils.js";

export const Mesh = defineComponent(
  "aperture.render.mesh",
  {
    meshId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent mesh authoring component that stores a mesh asset handle id only.",
);

export const Material = defineComponent(
  "aperture.render.material",
  {
    materialId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent material authoring component that stores a material asset handle id only.",
);

export const MaterialSlots = defineComponent(
  "aperture.render.materialSlots",
  {
    slotsJson: { type: EcsType.String, default: "[]" },
  },
  "Renderer-independent material slot overrides for multi-submesh mesh draws.",
);

export const Sprite = defineComponent(
  "aperture.render.sprite",
  {
    textureId: { type: EcsType.String, default: "" },
    samplerId: { type: EcsType.String, default: "" },
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
    width: { type: EcsType.Float32, default: 1 },
    height: { type: EcsType.Float32, default: 1 },
  },
  "Renderer-independent sprite authoring component for camera-facing billboard quads.",
);

export const Skybox = defineComponent(
  "aperture.render.skybox",
  {
    textureId: { type: EcsType.String, default: "" },
    samplerId: { type: EcsType.String, default: "" },
    intensity: { type: EcsType.Float32, default: 1 },
  },
  "Renderer-independent skybox authoring component that stores cube texture and sampler handle ids only.",
);

export const Fog = defineComponent(
  "aperture.render.fog",
  {
    mode: {
      type: EcsType.Enum,
      enum: FogMode,
      default: FogMode.Linear,
    },
    color: { type: EcsType.Color, default: tuple4(0, 0, 0, 1) },
    density: { type: EcsType.Float32, default: 0.00025 },
    start: { type: EcsType.Float32, default: 1 },
    end: { type: EcsType.Float32, default: 1000 },
  },
  "Renderer-independent distance fog authoring component for linear, exponential, and exponential-squared falloff.",
);

export const Visibility = defineComponent(
  "aperture.render.visibility",
  {
    visible: { type: EcsType.Boolean, default: true },
  },
  "Authoring visibility flag consumed by render extraction.",
);

export const OcclusionQuery = defineComponent(
  "aperture.render.occlusionQuery",
  {
    enabled: { type: EcsType.Boolean, default: true },
  },
  "Opt-in renderer-owned GPU occlusion-query feedback for mesh draws.",
);

export const RenderLayer = defineComponent(
  "aperture.render.layer",
  {
    mask: { type: EcsType.Int32, default: 1 },
  },
  "Render layer mask used for camera and light filtering.",
);

export const Pickable = defineComponent(
  "aperture.spatial.pickable",
  {
    enabled: { type: EcsType.Boolean, default: true },
    layerMask: { type: EcsType.Int32, default: 1 },
    precision: {
      type: EcsType.Enum,
      enum: PickablePrecision,
      default: PickablePrecision.Bounds,
    },
    blocksLower: { type: EcsType.Boolean, default: false },
    priority: { type: EcsType.Int32, default: 0 },
  },
  "Renderer-independent pickability component consumed by worker-side spatial query systems.",
);

export const MeshQueryAcceleration = defineComponent(
  "aperture.spatial.meshQueryAcceleration",
  {
    mode: {
      type: EcsType.Enum,
      enum: MeshQueryAccelerationMode,
      default: MeshQueryAccelerationMode.AutoBvh,
    },
    strategy: {
      type: EcsType.Enum,
      enum: MeshQueryAccelerationStrategy,
      default: MeshQueryAccelerationStrategy.Center,
    },
    maxLeafSize: { type: EcsType.Int32, default: 8 },
    maxDepth: { type: EcsType.Int32, default: 40 },
    dynamicPolicy: {
      type: EcsType.Enum,
      enum: MeshQueryDynamicPolicy,
      default: MeshQueryDynamicPolicy.Static,
    },
    simplifiedMeshId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent mesh query acceleration policy for exact CPU spatial queries.",
);

export const RenderOrder = defineComponent(
  "aperture.render.order",
  {
    value: { type: EcsType.Int32, default: 0 },
  },
  "Stable authoring order hint consumed by render sorting.",
);

export const InstanceTint = defineComponent(
  "aperture.render.instanceTint",
  {
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
  },
  "Per-entity tint packed for instanced StandardMaterial draws.",
);

export const InstanceData = defineComponent(
  "aperture.render.instanceData",
  {
    materialKind: { type: EcsType.String, default: "" },
    valuesJson: { type: EcsType.String, default: "{}" },
  },
  "Per-entity named instance data packed for custom material instance attributes.",
);

export const Skin = defineComponent(
  "aperture.render.skin",
  {
    jointCount: { type: EcsType.Int32, default: 0 },
    jointMatricesJson: { type: EcsType.String, default: "[]" },
  },
  "Renderer-independent per-entity skin palette stored as serialized joint matrices.",
);

export const MorphTargetWeights = defineComponent(
  "aperture.render.morphTargetWeights",
  {
    targetCount: { type: EcsType.Int32, default: 0 },
    weightsJson: { type: EcsType.String, default: "[]" },
  },
  "Renderer-independent per-entity morph target weights stored as serialized scalar values.",
);

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
  },
  "Renderer-independent per-light shadow request authoring component.",
);
