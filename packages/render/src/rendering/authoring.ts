import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  assetHandleKey,
  type EnvironmentMapHandle,
  type MaterialHandle,
  type SamplerHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type { Vec4Like } from "@aperture-engine/simulation";
import type { InstanceDataValues } from "../materials/index.js";

export const CameraProjection = {
  Perspective: "perspective",
  Orthographic: "orthographic",
} as const;

export type CameraProjection =
  (typeof CameraProjection)[keyof typeof CameraProjection];

export const LightKind = {
  Ambient: "ambient",
  Environment: "environment",
  Directional: "directional",
  Point: "point",
  Spot: "spot",
  RectArea: "rect-area",
} as const;

export type LightKind = (typeof LightKind)[keyof typeof LightKind];

export const AreaLightShape = {
  Rect: "rect",
  Disk: "disk",
  Sphere: "sphere",
} as const;

export type AreaLightShape =
  (typeof AreaLightShape)[keyof typeof AreaLightShape];

export const FogMode = {
  Linear: "linear",
  Exp: "exp",
  Exp2: "exp2",
} as const;

export type FogMode = (typeof FogMode)[keyof typeof FogMode];

export const PickablePrecision = {
  Bounds: "bounds",
  VisualMesh: "visual-mesh",
  Collider: "collider",
} as const;

export type PickablePrecision =
  (typeof PickablePrecision)[keyof typeof PickablePrecision];

export const MeshQueryAccelerationMode = {
  None: "none",
  AutoBvh: "auto-bvh",
  Bvh: "bvh",
} as const;

export type MeshQueryAccelerationMode =
  (typeof MeshQueryAccelerationMode)[keyof typeof MeshQueryAccelerationMode];

export const MeshQueryAccelerationStrategy = {
  Center: "center",
  Average: "average",
  Sah: "sah",
} as const;

export type MeshQueryAccelerationStrategy =
  (typeof MeshQueryAccelerationStrategy)[keyof typeof MeshQueryAccelerationStrategy];

export const MeshQueryDynamicPolicy = {
  Static: "static",
  Refit: "refit",
  Rebuild: "rebuild",
} as const;

export type MeshQueryDynamicPolicy =
  (typeof MeshQueryDynamicPolicy)[keyof typeof MeshQueryDynamicPolicy];

export interface CameraInput {
  readonly projection?: CameraProjection;
  readonly fovYRadians?: number;
  readonly aspect?: number;
  readonly autoAspect?: boolean;
  readonly near?: number;
  readonly far?: number;
  readonly orthographicHeight?: number;
  readonly viewport?: Vec4Like;
  readonly scissor?: Vec4Like;
  readonly clearColor?: Vec4Like;
  readonly clearDepth?: number;
  readonly clearStencil?: number;
  readonly clearFlags?: number;
  readonly layerMask?: number;
  readonly priority?: number;
  readonly renderTargetId?: string;
  readonly frustumCulling?: boolean;
  readonly temporalJitter?: readonly [number, number];
}

export interface LightInput {
  readonly kind?: LightKind;
  readonly shape?: AreaLightShape;
  readonly color?: Vec4Like;
  readonly intensity?: number;
  readonly range?: number;
  readonly innerConeAngle?: number;
  readonly outerConeAngle?: number;
  readonly width?: number;
  readonly height?: number;
  readonly layerMask?: number;
  readonly environmentMap?: EnvironmentMapHandle | null;
}

export interface LightCookieInput {
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly intensity?: number;
}

export interface LightShadowSettingsInput {
  readonly enabled?: boolean;
  readonly mapSize?: number;
  readonly bias?: number;
  readonly normalBias?: number;
  readonly cascadeCount?: number;
  readonly casterLayerMask?: number;
  readonly receiverLayerMask?: number;
}

export interface SpriteInput {
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly size?: number | readonly [number, number];
  readonly color?: Vec4Like;
}

export interface SkyboxInput {
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly intensity?: number;
}

export interface FogInput {
  readonly mode?: FogMode;
  readonly color?: Vec4Like;
  readonly density?: number;
  readonly start?: number;
  readonly end?: number;
}

export interface PickableInput {
  readonly enabled?: boolean;
  readonly layerMask?: number;
  readonly precision?: PickablePrecision;
  readonly blocksLower?: boolean;
  readonly priority?: number;
}

export interface MeshQueryAccelerationInput {
  readonly mode?: MeshQueryAccelerationMode;
  readonly strategy?: MeshQueryAccelerationStrategy;
  readonly maxLeafSize?: number;
  readonly maxDepth?: number;
  readonly dynamicPolicy?: MeshQueryDynamicPolicy;
  readonly simplifiedMeshId?: string;
}

export interface OcclusionQueryInput {
  readonly enabled?: boolean;
}

export interface MaterialSlotBindingInput {
  readonly slot: number;
  readonly material: MaterialHandle;
}

export interface MaterialSlotsInput {
  readonly slots: readonly MaterialSlotBindingInput[];
}

export interface InstanceTintInput {
  readonly color?: Vec4Like;
}

export interface InstanceDataInput {
  readonly materialKind: string;
  readonly values: InstanceDataValues;
}

export interface SkinInput {
  readonly jointMatrices: ArrayLike<number>;
}

export interface MorphTargetWeightsInput {
  readonly weights: ArrayLike<number>;
}

export type RenderAuthoringDiagnosticCode =
  | "camera.invalidProjection"
  | "camera.invalidViewport"
  | "camera.invalidClipRange"
  | "camera.zeroLayerMask"
  | "camera.invalidTemporalJitter"
  | "light.invalidIntensity"
  | "light.invalidRange"
  | "light.invalidSpotCone"
  | "light.invalidAreaSize"
  | "light.zeroLayerMask"
  | "lightCookie.invalidTexture"
  | "lightCookie.invalidIntensity"
  | "sprite.invalidTexture"
  | "sprite.invalidSize"
  | "skybox.invalidTexture"
  | "skybox.invalidIntensity"
  | "fog.invalidMode"
  | "fog.invalidColor"
  | "fog.invalidDensity"
  | "fog.invalidRange"
  | "shadow.invalidMapSize"
  | "shadow.invalidBias"
  | "shadow.invalidCascadeCount"
  | "shadow.zeroLayerMask";

export interface RenderAuthoringDiagnostic {
  readonly code: RenderAuthoringDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface RenderAuthoringValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly RenderAuthoringDiagnostic[];
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

export function registerRenderAuthoringComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(Mesh);
  world.registerComponent(Material);
  world.registerComponent(MaterialSlots);
  world.registerComponent(Sprite);
  world.registerComponent(Skybox);
  world.registerComponent(Fog);
  world.registerComponent(Camera);
  world.registerComponent(Visibility);
  world.registerComponent(OcclusionQuery);
  world.registerComponent(RenderLayer);
  world.registerComponent(Pickable);
  world.registerComponent(MeshQueryAcceleration);
  world.registerComponent(RenderOrder);
  world.registerComponent(InstanceTint);
  world.registerComponent(InstanceData);
  world.registerComponent(Skin);
  world.registerComponent(MorphTargetWeights);
  world.registerComponent(Light);
  world.registerComponent(LightCookie);
  world.registerComponent(ShadowCaster);
  world.registerComponent(ShadowReceiver);
  world.registerComponent(LightShadowSettings);
  return world;
}

export function createPickable(
  input: PickableInput = {},
): ComponentInitialData<typeof Pickable> {
  return {
    enabled: input.enabled ?? true,
    layerMask: input.layerMask ?? 1,
    precision: input.precision ?? PickablePrecision.Bounds,
    blocksLower: input.blocksLower ?? false,
    priority: input.priority ?? 0,
  };
}

export function createMeshQueryAcceleration(
  input: MeshQueryAccelerationInput = {},
): ComponentInitialData<typeof MeshQueryAcceleration> {
  return {
    mode: input.mode ?? MeshQueryAccelerationMode.AutoBvh,
    strategy: input.strategy ?? MeshQueryAccelerationStrategy.Center,
    maxLeafSize: input.maxLeafSize ?? 8,
    maxDepth: input.maxDepth ?? 40,
    dynamicPolicy: input.dynamicPolicy ?? MeshQueryDynamicPolicy.Static,
    simplifiedMeshId: input.simplifiedMeshId ?? "",
  };
}

export function createCamera(
  input: CameraInput = {},
): ComponentInitialData<typeof Camera> {
  return {
    projection: input.projection ?? CameraProjection.Perspective,
    fovYRadians: input.fovYRadians ?? Math.PI / 3,
    aspect: input.aspect ?? 1,
    autoAspect: input.autoAspect ?? input.aspect === undefined,
    near: input.near ?? 0.1,
    far: input.far ?? 1000,
    orthographicHeight: input.orthographicHeight ?? 10,
    viewport: toTuple4(input.viewport ?? [0, 0, 1, 1]),
    scissor: toTuple4(input.scissor ?? [0, 0, 1, 1]),
    clearColor: toTuple4(input.clearColor ?? [0, 0, 0, 1]),
    clearDepth: input.clearDepth ?? 1,
    clearStencil: input.clearStencil ?? 0,
    clearFlags: input.clearFlags ?? 3,
    layerMask: input.layerMask ?? 1,
    priority: input.priority ?? 0,
    renderTargetId: input.renderTargetId ?? "",
    frustumCulling: input.frustumCulling ?? true,
    temporalJitterX: input.temporalJitter?.[0] ?? 0,
    temporalJitterY: input.temporalJitter?.[1] ?? 0,
  };
}

export function createLight(
  input: LightInput = {},
): ComponentInitialData<typeof Light> {
  return {
    kind: input.kind ?? LightKind.Directional,
    shape: input.shape ?? AreaLightShape.Rect,
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
    intensity: input.intensity ?? 1,
    range: input.range ?? 10,
    innerConeAngle: input.innerConeAngle ?? Math.PI / 8,
    outerConeAngle: input.outerConeAngle ?? Math.PI / 6,
    width: input.width ?? 2,
    height: input.height ?? 2,
    layerMask: input.layerMask ?? 1,
    environmentMapId:
      input.environmentMap === undefined || input.environmentMap === null
        ? ""
        : assetHandleKey(input.environmentMap),
  };
}

export function createLightCookie(
  input: LightCookieInput,
): ComponentInitialData<typeof LightCookie> {
  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    intensity: input.intensity ?? 1,
  };
}

export function createLightShadowSettings(
  input: LightShadowSettingsInput = {},
): ComponentInitialData<typeof LightShadowSettings> {
  return {
    enabled: input.enabled ?? false,
    mapSize: input.mapSize ?? 1024,
    bias: input.bias ?? 0,
    normalBias: input.normalBias ?? 0,
    cascadeCount: input.cascadeCount ?? 1,
    casterLayerMask: input.casterLayerMask ?? -1,
    receiverLayerMask: input.receiverLayerMask ?? -1,
  };
}

export function createSprite(
  input: SpriteInput,
): ComponentInitialData<typeof Sprite> {
  const size = spriteSize(input.size);

  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
    width: size[0],
    height: size[1],
  };
}

export function createSkybox(
  input: SkyboxInput,
): ComponentInitialData<typeof Skybox> {
  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    intensity: input.intensity ?? 1,
  };
}

export function createFog(
  input: FogInput = {},
): ComponentInitialData<typeof Fog> {
  const mode = input.mode ?? FogMode.Linear;

  return {
    mode,
    color: toTuple4(input.color ?? [0, 0, 0, 1]),
    density: input.density ?? (mode === FogMode.Linear ? 0 : 0.00025),
    start: input.start ?? 1,
    end: input.end ?? 1000,
  };
}

export function createOcclusionQuery(
  input: OcclusionQueryInput = {},
): ComponentInitialData<typeof OcclusionQuery> {
  return {
    enabled: input.enabled ?? true,
  };
}

export function createMaterialSlots(
  input: MaterialSlotsInput,
): ComponentInitialData<typeof MaterialSlots> {
  return {
    slotsJson: JSON.stringify(
      input.slots.map((slot) => ({
        slot: Math.trunc(slot.slot),
        materialId: assetHandleKey(slot.material),
      })),
    ),
  };
}

export function createInstanceTint(
  input: InstanceTintInput = {},
): ComponentInitialData<typeof InstanceTint> {
  return {
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
  };
}

export function createInstanceData(
  input: InstanceDataInput,
): ComponentInitialData<typeof InstanceData> {
  return {
    materialKind: input.materialKind,
    valuesJson: JSON.stringify(input.values),
  };
}

export function createSkin(
  input: SkinInput,
): ComponentInitialData<typeof Skin> {
  const jointMatrices = Array.from(input.jointMatrices);

  return {
    jointCount: Math.floor(jointMatrices.length / 16),
    jointMatricesJson: JSON.stringify(jointMatrices),
  };
}

export function createMorphTargetWeights(
  input: MorphTargetWeightsInput,
): ComponentInitialData<typeof MorphTargetWeights> {
  const weights = Array.from(input.weights);

  return {
    targetCount: weights.length,
    weightsJson: JSON.stringify(weights),
  };
}

export function validateCameraInput(
  input: CameraInput,
): RenderAuthoringValidationReport {
  const camera = createCamera(input);
  const projection = camera.projection ?? CameraProjection.Perspective;
  const fovYRadians = camera.fovYRadians ?? Math.PI / 3;
  const aspect = camera.aspect ?? 1;
  const near = camera.near ?? 0.1;
  const far = camera.far ?? 1000;
  const orthographicHeight = camera.orthographicHeight ?? 10;
  const viewport = camera.viewport ?? tuple4(0, 0, 1, 1);
  const scissor = camera.scissor ?? tuple4(0, 0, 1, 1);
  const layerMask = camera.layerMask ?? 1;
  const temporalJitterX = camera.temporalJitterX ?? 0;
  const temporalJitterY = camera.temporalJitterY ?? 0;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (
    projection === CameraProjection.Perspective &&
    (fovYRadians <= 0 || fovYRadians >= Math.PI || aspect <= 0)
  ) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "projection",
      message:
        "Perspective cameras require 0 < fovYRadians < PI and aspect > 0.",
    });
  }

  if (projection === CameraProjection.Orthographic && orthographicHeight <= 0) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "orthographicHeight",
      message: "Orthographic cameras require orthographicHeight > 0.",
    });
  }

  if (near <= 0 || far <= near) {
    diagnostics.push({
      code: "camera.invalidClipRange",
      field: "near/far",
      message: "Cameras require near > 0 and far > near.",
    });
  }

  validateRect(viewport, "viewport", diagnostics);
  validateRect(scissor, "scissor", diagnostics);

  if (layerMask === 0) {
    diagnostics.push({
      code: "camera.zeroLayerMask",
      field: "layerMask",
      message: "Camera layerMask must not be zero.",
    });
  }

  if (!Number.isFinite(temporalJitterX) || !Number.isFinite(temporalJitterY)) {
    diagnostics.push({
      code: "camera.invalidTemporalJitter",
      field: "temporalJitter",
      message: "Camera temporalJitter values must be finite numbers.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateLightInput(
  input: LightInput,
): RenderAuthoringValidationReport {
  const light = createLight(input);
  const kind = light.kind ?? LightKind.Directional;
  const intensity = light.intensity ?? 1;
  const range = light.range ?? 10;
  const innerConeAngle = light.innerConeAngle ?? Math.PI / 8;
  const outerConeAngle = light.outerConeAngle ?? Math.PI / 6;
  const width = light.width ?? 2;
  const height = light.height ?? 2;
  const layerMask = light.layerMask ?? 1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (intensity < 0) {
    diagnostics.push({
      code: "light.invalidIntensity",
      field: "intensity",
      message: "Light intensity must be non-negative.",
    });
  }

  if ((kind === LightKind.Point || kind === LightKind.Spot) && range <= 0) {
    diagnostics.push({
      code: "light.invalidRange",
      field: "range",
      message: "Point and spot lights require range > 0.",
    });
  }

  if (
    kind === LightKind.Spot &&
    (outerConeAngle <= 0 ||
      innerConeAngle < 0 ||
      innerConeAngle > outerConeAngle)
  ) {
    diagnostics.push({
      code: "light.invalidSpotCone",
      field: "innerConeAngle/outerConeAngle",
      message: "Spot lights require 0 <= innerConeAngle <= outerConeAngle.",
    });
  }

  if (
    kind === LightKind.RectArea &&
    (!Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0)
  ) {
    diagnostics.push({
      code: "light.invalidAreaSize",
      field: "width/height",
      message: "Area lights require finite width > 0 and height > 0.",
    });
  }

  if (layerMask === 0) {
    diagnostics.push({
      code: "light.zeroLayerMask",
      field: "layerMask",
      message: "Light layerMask must not be zero.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateLightCookieInput(
  input: LightCookieInput,
): RenderAuthoringValidationReport {
  const diagnostics: RenderAuthoringDiagnostic[] = [];
  const textureKey = assetHandleKey(input.texture);
  const intensity = input.intensity ?? 1;

  if (!textureKey.startsWith("texture:")) {
    diagnostics.push({
      code: "lightCookie.invalidTexture",
      field: "texture",
      message: "Light cookie texture must be a texture asset handle.",
    });
  }

  if (!Number.isFinite(intensity) || intensity < 0) {
    diagnostics.push({
      code: "lightCookie.invalidIntensity",
      field: "intensity",
      message: "Light cookie intensity must be a finite non-negative number.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateLightShadowSettingsInput(
  input: LightShadowSettingsInput,
): RenderAuthoringValidationReport {
  const settings = createLightShadowSettings(input);
  const mapSize = settings.mapSize ?? 1024;
  const bias = settings.bias ?? 0;
  const normalBias = settings.normalBias ?? 0;
  const cascadeCount = settings.cascadeCount ?? 1;
  const casterLayerMask = settings.casterLayerMask ?? -1;
  const receiverLayerMask = settings.receiverLayerMask ?? -1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (!Number.isInteger(mapSize) || mapSize <= 0) {
    diagnostics.push({
      code: "shadow.invalidMapSize",
      field: "mapSize",
      message: "Light shadow mapSize must be a positive integer.",
    });
  }

  if (bias < 0 || normalBias < 0) {
    diagnostics.push({
      code: "shadow.invalidBias",
      field: "bias/normalBias",
      message: "Light shadow bias and normalBias must be non-negative.",
    });
  }

  if (!Number.isInteger(cascadeCount) || cascadeCount < 1 || cascadeCount > 4) {
    diagnostics.push({
      code: "shadow.invalidCascadeCount",
      field: "cascadeCount",
      message:
        "Directional shadow cascadeCount must be an integer from 1 to 4.",
    });
  }

  if (casterLayerMask === 0 || receiverLayerMask === 0) {
    diagnostics.push({
      code: "shadow.zeroLayerMask",
      field: "casterLayerMask/receiverLayerMask",
      message: "Light shadow caster and receiver layer masks must not be zero.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateSpriteInput(
  input: SpriteInput,
): RenderAuthoringValidationReport {
  const sprite = createSprite(input);
  const textureId = sprite.textureId ?? "";
  const width = sprite.width ?? 1;
  const height = sprite.height ?? 1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (textureId.trim().length === 0) {
    diagnostics.push({
      code: "sprite.invalidTexture",
      field: "texture",
      message: "Sprites require a texture handle.",
    });
  }

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    diagnostics.push({
      code: "sprite.invalidSize",
      field: "size",
      message: "Sprites require finite positive width and height.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateSkyboxInput(
  input: SkyboxInput,
): RenderAuthoringValidationReport {
  const skybox = createSkybox(input);
  const textureId = skybox.textureId ?? "";
  const intensity = skybox.intensity ?? 1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (textureId.trim().length === 0) {
    diagnostics.push({
      code: "skybox.invalidTexture",
      field: "texture",
      message: "Skyboxes require a cube texture handle.",
    });
  }

  if (!Number.isFinite(intensity) || intensity < 0) {
    diagnostics.push({
      code: "skybox.invalidIntensity",
      field: "intensity",
      message: "Skybox intensity must be a finite non-negative number.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateFogInput(
  input: FogInput,
): RenderAuthoringValidationReport {
  const fog = createFog(input);
  const mode = fog.mode ?? FogMode.Linear;
  const color = fog.color ?? tuple4(0, 0, 0, 1);
  const density = fog.density ?? 0;
  const start = fog.start ?? 1;
  const end = fog.end ?? 1000;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (!Object.values(FogMode).includes(mode as FogMode)) {
    diagnostics.push({
      code: "fog.invalidMode",
      field: "mode",
      message: "Fog mode must be 'linear', 'exp', or 'exp2'.",
    });
  }

  if (color.some((value) => !Number.isFinite(value))) {
    diagnostics.push({
      code: "fog.invalidColor",
      field: "color",
      message: "Fog color components must be finite numbers.",
    });
  }

  if (
    (mode === FogMode.Exp || mode === FogMode.Exp2) &&
    (!Number.isFinite(density) || density < 0)
  ) {
    diagnostics.push({
      code: "fog.invalidDensity",
      field: "density",
      message: "Exponential fog density must be a finite non-negative number.",
    });
  }

  if (
    mode === FogMode.Linear &&
    (!Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start)
  ) {
    diagnostics.push({
      code: "fog.invalidRange",
      field: "start/end",
      message:
        "Linear fog requires finite start >= 0 and end greater than start.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

function validateRect(
  rect: readonly [number, number, number, number],
  field: string,
  diagnostics: RenderAuthoringDiagnostic[],
): void {
  if (
    rect.some((value) => !Number.isFinite(value)) ||
    rect[2] < 0 ||
    rect[3] < 0
  ) {
    diagnostics.push({
      code: "camera.invalidViewport",
      field,
      message: `${field} values must be finite with non-negative width and height.`,
    });
  }
}

function toTuple4(values: Vec4Like): [number, number, number, number] {
  return [read(values, 0), read(values, 1), read(values, 2), read(values, 3)];
}

function tuple4(
  x: number,
  y: number,
  z: number,
  w: number,
): [number, number, number, number] {
  return [x, y, z, w];
}

function spriteSize(size: SpriteInput["size"]): readonly [number, number] {
  if (size === undefined) {
    return [1, 1];
  }

  return typeof size === "number" ? [size, size] : [size[0] ?? 1, size[1] ?? 1];
}

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}
