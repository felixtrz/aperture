import type {
  EnvironmentMapHandle,
  MaterialHandle,
  SamplerHandle,
  TextureHandle,
  Vec4Like,
} from "@aperture-engine/simulation";
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
  /** Filtering mode: 0 = hard, 1 = PCF (default), 2 = PCSS contact-hardening. */
  readonly shadowType?: number;
  /** Authored shadow opacity in [0,1]; 1 = fully dark capable. */
  readonly strength?: number;
  /** PCF/PCSS filter radius in texels (>= 0). */
  readonly filterRadius?: number;
  /** Slope-scaled depth bias for the caster pipeline (>= 0). */
  readonly slopeBias?: number;
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
  | "shadow.zeroLayerMask"
  | "shadow.invalidShadowType"
  | "shadow.invalidStrength"
  | "shadow.invalidFilterRadius"
  | "shadow.invalidSlopeBias";

export interface RenderAuthoringDiagnostic {
  readonly code: RenderAuthoringDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export interface RenderAuthoringValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly RenderAuthoringDiagnostic[];
}
