import {
  EcsType,
  defineComponent,
  type Entity,
} from "@aperture-engine/simulation";

import { FogMode } from "./authoring-types.js";
import { tuple4 } from "./authoring-utils.js";

/**
 * Engine-owned skeleton structure stored on the {@link Skin} component's
 * `skeleton` Object field for imported skins. Holds live joint entity refs and
 * flat column-major inverse-bind matrices by reference (same-thread only).
 */
export interface SkinSkeleton {
  /** Live joint entities, in skin.joints order. */
  readonly joints: readonly Entity[];
  /** Flat column-major inverse-bind matrices, length === joints.length * 16. */
  readonly inverseBindMatrices: Float32Array;
}

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
    // Typed joint palette: a flat column-major `Float32Array` of jointCount*16
    // matrices, read directly by extraction with zero per-frame JSON.parse.
    // Held by reference (same-thread, never snapshot-transported). Null until a
    // palette is supplied (manual skins) or computed (M2-T6 for imported skins).
    jointMatrices: { type: EcsType.Object, default: null },
    // Engine-owned skeleton structure for imported skins: the live joint
    // entities and their flat column-major inverse-bind matrices. Held by
    // reference so the joint-palette system (M2-T6) can compute
    // palette_i = inverseMeshWorld * jointWorld_i * inverseBind_i in place.
    // Null for manually-authored skins that supply a precomputed palette.
    skeleton: { type: EcsType.Object, default: null },
  },
  "Renderer-independent per-entity skin palette stored as a typed joint-matrix buffer.",
);

export const MorphTargetWeights = defineComponent(
  "aperture.render.morphTargetWeights",
  {
    targetCount: { type: EcsType.Int32, default: 0 },
    // Typed per-entity morph weights: a flat `Float32Array` of `targetCount`
    // scalars, read directly by extraction with zero per-frame JSON.parse and
    // no [-1, 1] clamp. Held by reference (same-thread). Supports unlimited
    // targets (e.g. 52 ARKit blendshapes). Null until weights are supplied.
    weights: { type: EcsType.Object, default: null },
  },
  "Renderer-independent per-entity morph target weights stored as a typed scalar buffer.",
);
