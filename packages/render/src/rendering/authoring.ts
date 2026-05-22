import {
  EcsType,
  defineComponent,
  type ComponentInitialData,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  assetHandleKey,
  type EnvironmentMapHandle,
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
} as const;

export type LightKind = (typeof LightKind)[keyof typeof LightKind];

export interface CameraInput {
  readonly projection?: CameraProjection;
  readonly fovYRadians?: number;
  readonly aspect?: number;
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
}

export interface LightInput {
  readonly kind?: LightKind;
  readonly color?: Vec4Like;
  readonly intensity?: number;
  readonly range?: number;
  readonly innerConeAngle?: number;
  readonly outerConeAngle?: number;
  readonly layerMask?: number;
  readonly environmentMap?: EnvironmentMapHandle | null;
}

export interface LightShadowSettingsInput {
  readonly enabled?: boolean;
  readonly mapSize?: number;
  readonly bias?: number;
  readonly normalBias?: number;
  readonly casterLayerMask?: number;
  readonly receiverLayerMask?: number;
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
  | "light.invalidIntensity"
  | "light.invalidRange"
  | "light.invalidSpotCone"
  | "light.zeroLayerMask"
  | "shadow.invalidMapSize"
  | "shadow.invalidBias"
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

export const Visibility = defineComponent(
  "aperture.render.visibility",
  {
    visible: { type: EcsType.Boolean, default: true },
  },
  "Authoring visibility flag consumed by render extraction.",
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
    color: { type: EcsType.Color, default: tuple4(1, 1, 1, 1) },
    intensity: { type: EcsType.Float32, default: 1 },
    range: { type: EcsType.Float32, default: 10 },
    innerConeAngle: { type: EcsType.Float32, default: Math.PI / 8 },
    outerConeAngle: { type: EcsType.Float32, default: Math.PI / 6 },
    layerMask: { type: EcsType.Int32, default: 1 },
    environmentMapId: { type: EcsType.String, default: "" },
  },
  "Renderer-independent light authoring component.",
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
    casterLayerMask: { type: EcsType.Int32, default: -1 },
    receiverLayerMask: { type: EcsType.Int32, default: -1 },
  },
  "Renderer-independent per-light shadow request authoring component.",
);

export function registerRenderAuthoringComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(Mesh);
  world.registerComponent(Material);
  world.registerComponent(Camera);
  world.registerComponent(Visibility);
  world.registerComponent(RenderLayer);
  world.registerComponent(RenderOrder);
  world.registerComponent(InstanceTint);
  world.registerComponent(InstanceData);
  world.registerComponent(Skin);
  world.registerComponent(MorphTargetWeights);
  world.registerComponent(Light);
  world.registerComponent(ShadowCaster);
  world.registerComponent(ShadowReceiver);
  world.registerComponent(LightShadowSettings);
  return world;
}

export function createCamera(
  input: CameraInput = {},
): ComponentInitialData<typeof Camera> {
  return {
    projection: input.projection ?? CameraProjection.Perspective,
    fovYRadians: input.fovYRadians ?? Math.PI / 3,
    aspect: input.aspect ?? 1,
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
  };
}

export function createLight(
  input: LightInput = {},
): ComponentInitialData<typeof Light> {
  return {
    kind: input.kind ?? LightKind.Directional,
    color: toTuple4(input.color ?? [1, 1, 1, 1]),
    intensity: input.intensity ?? 1,
    range: input.range ?? 10,
    innerConeAngle: input.innerConeAngle ?? Math.PI / 8,
    outerConeAngle: input.outerConeAngle ?? Math.PI / 6,
    layerMask: input.layerMask ?? 1,
    environmentMapId:
      input.environmentMap === undefined || input.environmentMap === null
        ? ""
        : assetHandleKey(input.environmentMap),
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
    casterLayerMask: input.casterLayerMask ?? -1,
    receiverLayerMask: input.receiverLayerMask ?? -1,
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

  if (layerMask === 0) {
    diagnostics.push({
      code: "light.zeroLayerMask",
      field: "layerMask",
      message: "Light layerMask must not be zero.",
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

  if (casterLayerMask === 0 || receiverLayerMask === 0) {
    diagnostics.push({
      code: "shadow.zeroLayerMask",
      field: "casterLayerMask/receiverLayerMask",
      message: "Light shadow caster and receiver layer masks must not be zero.",
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

function read(values: ArrayLike<number>, index: number): number {
  const value = values[index];

  if (value === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return value;
}
