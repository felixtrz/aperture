import { EcsType, defineComponent } from "@aperture-engine/simulation";

import { FogMode } from "./authoring-types.js";
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
