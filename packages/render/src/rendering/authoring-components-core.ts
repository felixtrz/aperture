import {
  EcsType,
  defineComponent,
  type Entity,
} from "@aperture-engine/simulation";

import {
  AudioDistanceModel,
  AudioPanningModel,
  AudioSimulationSpace,
  FogMode,
  ParticleSimulationSpace,
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteCoordinateMode,
  SpriteSizeMode,
  UiLayoutMode,
  UiScreenScaleMode,
  UiTextAlign,
} from "./authoring-types.js";
import { tuple2, tuple4 } from "./authoring-utils.js";

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
    uvRect: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
    pivot: { type: EcsType.Vec2, default: tuple2(0.5, 0.5) },
    rotation: { type: EcsType.Float32, default: 0 },
    atlasFrame: { type: EcsType.Int32, default: 0 },
    coordinateMode: {
      type: EcsType.Enum,
      enum: SpriteCoordinateMode,
      default: SpriteCoordinateMode.World,
    },
    billboardMode: {
      type: EcsType.Enum,
      enum: SpriteBillboardMode,
      default: SpriteBillboardMode.Spherical,
    },
    sizeMode: {
      type: EcsType.Enum,
      enum: SpriteSizeMode,
      default: SpriteSizeMode.WorldUnits,
    },
    blendMode: {
      type: EcsType.Enum,
      enum: SpriteBlendMode,
      default: SpriteBlendMode.Alpha,
    },
  },
  "Renderer-independent sprite authoring component for camera-facing billboard quads.",
);

export const ParticleEmitter = defineComponent(
  "aperture.render.particleEmitter",
  {
    effectId: { type: EcsType.String, default: "" },
    capacity: { type: EcsType.Int32, default: 0 },
    seed: { type: EcsType.Int32, default: 1 },
    resetEpoch: { type: EcsType.Int32, default: 0 },
    timeScale: { type: EcsType.Float32, default: 1 },
    simulationSpace: {
      type: EcsType.Enum,
      enum: ParticleSimulationSpace,
      default: ParticleSimulationSpace.World,
    },
    boundsCenter: { type: EcsType.Vec3, default: [0, 0, 0] },
    boundsRadius: { type: EcsType.Float32, default: 1 },
    visible: { type: EcsType.Boolean, default: true },
  },
  "Renderer-independent GPU particle emitter authoring. ECS owns playback intent, seeds, reset epochs, bounds, and effect handles; live particle buffers remain WebGPU-owned.",
);

export const AudioEmitter = defineComponent(
  "aperture.render.audioEmitter",
  {
    clipId: { type: EcsType.String, default: "" },
    busId: { type: EcsType.String, default: "sfx" },
    gain: { type: EcsType.Float32, default: 1 },
    timeScale: { type: EcsType.Float32, default: 1 },
    loop: { type: EcsType.Boolean, default: false },
    autoplay: { type: EcsType.Boolean, default: false },
    playEpoch: { type: EcsType.Int32, default: 0 },
    stopEpoch: { type: EcsType.Int32, default: 0 },
    seed: { type: EcsType.Int32, default: 1 },
    priority: { type: EcsType.Int32, default: 0 },
    muted: { type: EcsType.Boolean, default: false },
    offsetSec: { type: EcsType.Float32, default: 0 },
    loopStart: { type: EcsType.Float32, default: 0 },
    loopEnd: { type: EcsType.Float32, default: 0 },
    simulationSpace: {
      type: EcsType.Enum,
      enum: AudioSimulationSpace,
      default: AudioSimulationSpace.World,
    },
    panningModel: {
      type: EcsType.Enum,
      enum: AudioPanningModel,
      default: AudioPanningModel.EqualPower,
    },
    distanceModel: {
      type: EcsType.Enum,
      enum: AudioDistanceModel,
      default: AudioDistanceModel.Inverse,
    },
    refDistance: { type: EcsType.Float32, default: 1 },
    maxDistance: { type: EcsType.Float32, default: 10000 },
    rolloffFactor: { type: EcsType.Float32, default: 1 },
    coneInnerAngle: { type: EcsType.Float32, default: 360 },
    coneOuterAngle: { type: EcsType.Float32, default: 360 },
    coneOuterGain: { type: EcsType.Float32, default: 0 },
    boundsCenter: { type: EcsType.Vec3, default: [0, 0, 0] },
    audibilityRadius: { type: EcsType.Float32, default: 1 },
    active: { type: EcsType.Boolean, default: true },
  },
  "Renderer-independent audio emitter authoring. ECS owns playback intent, epochs, seeds, gain, bus routing, " +
    "and clip handles; live AudioBufferSourceNodes/PannerNodes remain Web-Audio-owned on the main thread.",
);

export const AudioListener = defineComponent(
  "aperture.render.audioListener",
  {
    active: { type: EcsType.Boolean, default: true },
    masterGain: { type: EcsType.Float32, default: 1 },
  },
  "Marks the entity (usually the Camera) whose WORLD transform drives the Web Audio listener pose. " +
    "Pose comes from the WORLD matrix basis (not the inverted view matrix). No AudioContext.listener node lives here.",
);

export const UiScreen = defineComponent(
  "aperture.render.ui.screen",
  {
    width: { type: EcsType.Float32, default: 960 },
    height: { type: EcsType.Float32, default: 540 },
    scaleMode: {
      type: EcsType.Enum,
      enum: UiScreenScaleMode,
      default: UiScreenScaleMode.Fixed,
    },
    layerMask: { type: EcsType.Int32, default: 1 },
  },
  "Renderer-independent retained UI screen root. Child UiNode entities are laid out in screen pixels.",
);

export const UiNode = defineComponent(
  "aperture.render.ui.node",
  {
    x: { type: EcsType.Float32, default: 0 },
    y: { type: EcsType.Float32, default: 0 },
    width: { type: EcsType.Float32, default: 0 },
    height: { type: EcsType.Float32, default: 0 },
    padding: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 0) },
    gap: { type: EcsType.Float32, default: 0 },
    layoutMode: {
      type: EcsType.Enum,
      enum: UiLayoutMode,
      default: UiLayoutMode.Absolute,
    },
    zIndex: { type: EcsType.Int32, default: 0 },
    opacity: { type: EcsType.Float32, default: 1 },
    clip: { type: EcsType.Boolean, default: false },
    visible: { type: EcsType.Boolean, default: true },
  },
  "Retained UI node layout component. M6 starts with a worker-safe absolute/row/column fallback before a richer Taffy-compatible adapter.",
);

export const UiPanel = defineComponent(
  "aperture.render.ui.panel",
  {
    color: { type: EcsType.Color, default: tuple4(0, 0, 0, 0.75) },
  },
  "UI panel visual metadata for extracted screen-space quads.",
);

export const UiImage = defineComponent(
  "aperture.render.ui.image",
  {
    textureId: { type: EcsType.String, default: "" },
    samplerId: { type: EcsType.String, default: "" },
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
    uvRect: { type: EcsType.Vec4, default: tuple4(0, 0, 1, 1) },
  },
  "UI image visual metadata using renderer-independent texture and sampler handle ids.",
);

export const UiText = defineComponent(
  "aperture.render.ui.text",
  {
    text: { type: EcsType.String, default: "" },
    fontAtlasId: { type: EcsType.String, default: "" },
    fontSize: { type: EcsType.Float32, default: 16 },
    lineHeight: { type: EcsType.Float32, default: 0 },
    maxWidth: { type: EcsType.Float32, default: 0 },
    align: {
      type: EcsType.Enum,
      enum: UiTextAlign,
      default: UiTextAlign.Left,
    },
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
  },
  "UI text metadata for retained layout and later MSDF glyph extraction.",
);

export const UiHitTarget = defineComponent(
  "aperture.render.ui.hitTarget",
  {
    enabled: { type: EcsType.Boolean, default: true },
    blocksInput: { type: EcsType.Boolean, default: true },
    cursor: { type: EcsType.String, default: "" },
    priority: { type: EcsType.Int32, default: 0 },
  },
  "UI hit-test authoring component. Extraction mirrors computed rect/clip/stack data for worker-side interaction.",
);

export const UiScroll = defineComponent(
  "aperture.render.ui.scroll",
  {
    enabled: { type: EcsType.Boolean, default: true },
    offset: { type: EcsType.Vec2, default: tuple2(0, 0) },
  },
  "UI scroll offset metadata; M6-T4 uses it to shift child layout and force clipping.",
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
