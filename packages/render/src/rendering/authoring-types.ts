import type {
  AudioClipHandle,
  EnvironmentMapHandle,
  FontAtlasHandle,
  MaterialHandle,
  ParticleEffectHandle,
  SamplerHandle,
  TextureHandle,
  Vec2Like,
  Vec3Like,
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

export const SpriteCoordinateMode = {
  World: "world",
  Screen: "screen",
} as const;

export type SpriteCoordinateMode =
  (typeof SpriteCoordinateMode)[keyof typeof SpriteCoordinateMode];

export const SpriteBillboardMode = {
  None: "none",
  Spherical: "spherical",
  Cylindrical: "cylindrical",
  AxisLocked: "axis-locked",
} as const;

export type SpriteBillboardMode =
  (typeof SpriteBillboardMode)[keyof typeof SpriteBillboardMode];

export const SpriteSizeMode = {
  WorldUnits: "world-units",
  ScreenPixels: "screen-pixels",
} as const;

export type SpriteSizeMode =
  (typeof SpriteSizeMode)[keyof typeof SpriteSizeMode];

export const SpriteBlendMode = {
  Opaque: "opaque",
  Alpha: "alpha",
  Additive: "additive",
  Multiply: "multiply",
} as const;

export type SpriteBlendMode =
  (typeof SpriteBlendMode)[keyof typeof SpriteBlendMode];

export const ParticleSimulationSpace = {
  World: "world",
  Local: "local",
} as const;

export type ParticleSimulationSpace =
  (typeof ParticleSimulationSpace)[keyof typeof ParticleSimulationSpace];

export const AudioSimulationSpace = {
  /** Spatialized through a PannerNode from the emitter's world transform. */
  World: "world",
  /** Non-spatial / 2D (UI, music, ambience) — routed straight to its bus. */
  Local: "local",
} as const;

export type AudioSimulationSpace =
  (typeof AudioSimulationSpace)[keyof typeof AudioSimulationSpace];

export const AudioPanningModel = {
  EqualPower: "equalpower",
  Hrtf: "HRTF",
} as const;

export type AudioPanningModel =
  (typeof AudioPanningModel)[keyof typeof AudioPanningModel];

export const AudioDistanceModel = {
  Inverse: "inverse",
  Linear: "linear",
  Exponential: "exponential",
} as const;

export type AudioDistanceModel =
  (typeof AudioDistanceModel)[keyof typeof AudioDistanceModel];

export const UiScreenScaleMode = {
  Fixed: "fixed",
  Viewport: "viewport",
} as const;

export type UiScreenScaleMode =
  (typeof UiScreenScaleMode)[keyof typeof UiScreenScaleMode];

export const UiLayoutMode = {
  Absolute: "absolute",
  Row: "row",
  Column: "column",
} as const;

export type UiLayoutMode = (typeof UiLayoutMode)[keyof typeof UiLayoutMode];

export const UiTextAlign = {
  Left: "left",
  Center: "center",
  Right: "right",
} as const;

export type UiTextAlign = (typeof UiTextAlign)[keyof typeof UiTextAlign];

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
  readonly uvRect?: Vec4Like;
  readonly pivot?: Vec2Like;
  readonly rotation?: number;
  readonly atlasFrame?: number;
  readonly coordinateMode?: SpriteCoordinateMode;
  readonly billboardMode?: SpriteBillboardMode;
  readonly sizeMode?: SpriteSizeMode;
  readonly blendMode?: SpriteBlendMode;
}

export interface ParticleEmitterInput {
  readonly effect: ParticleEffectHandle;
  readonly capacity?: number;
  readonly seed?: number;
  readonly resetEpoch?: number;
  readonly timeScale?: number;
  readonly simulationSpace?: ParticleSimulationSpace;
  readonly boundsCenter?: Vec3Like;
  readonly boundsRadius?: number;
  readonly visible?: boolean;
}

export interface AudioEmitterInput {
  readonly clip: AudioClipHandle;
  readonly busId?: string;
  readonly gain?: number;
  readonly timeScale?: number;
  readonly loop?: boolean;
  readonly autoplay?: boolean;
  readonly muted?: boolean;
  readonly playEpoch?: number;
  readonly stopEpoch?: number;
  readonly seed?: number;
  readonly priority?: number;
  readonly offsetSec?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
  readonly simulationSpace?: AudioSimulationSpace;
  readonly panningModel?: AudioPanningModel;
  readonly distanceModel?: AudioDistanceModel;
  readonly refDistance?: number;
  readonly maxDistance?: number;
  readonly rolloffFactor?: number;
  readonly coneInnerAngle?: number;
  readonly coneOuterAngle?: number;
  readonly coneOuterGain?: number;
  readonly boundsCenter?: Vec3Like;
  readonly audibilityRadius?: number;
  readonly active?: boolean;
}

export interface AudioListenerInput {
  readonly active?: boolean;
  readonly masterGain?: number;
}

export interface UiScreenInput {
  readonly width?: number;
  readonly height?: number;
  readonly scaleMode?: UiScreenScaleMode;
  readonly layerMask?: number;
}

export interface UiNodeInput {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly padding?: Vec4Like;
  readonly gap?: number;
  readonly layoutMode?: UiLayoutMode;
  readonly zIndex?: number;
  readonly opacity?: number;
  readonly clip?: boolean;
  readonly visible?: boolean;
}

export interface UiPanelInput {
  readonly color?: Vec4Like;
}

export interface UiImageInput {
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly color?: Vec4Like;
  readonly uvRect?: Vec4Like;
}

export interface UiTextInput {
  readonly text: string;
  readonly fontAtlas?: FontAtlasHandle | null;
  readonly fontSize?: number;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
  readonly align?: UiTextAlign;
  readonly color?: Vec4Like;
}

export interface UiHitTargetInput {
  readonly enabled?: boolean;
  readonly blocksInput?: boolean;
  readonly cursor?: string;
  readonly priority?: number;
}

export interface UiScrollInput {
  readonly enabled?: boolean;
  readonly offset?: Vec2Like;
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
  | "sprite.invalidUvRect"
  | "sprite.invalidPivot"
  | "sprite.invalidRotation"
  | "sprite.invalidAtlasFrame"
  | "sprite.invalidCoordinateMode"
  | "sprite.invalidBillboardMode"
  | "sprite.invalidSizeMode"
  | "sprite.invalidBlendMode"
  | "particle.invalidEffect"
  | "particle.invalidCapacity"
  | "particle.invalidSeed"
  | "particle.invalidResetEpoch"
  | "particle.invalidTimeScale"
  | "particle.invalidSimulationSpace"
  | "particle.invalidBounds"
  | "audio.invalidClip"
  | "audio.invalidBusId"
  | "audio.invalidGain"
  | "audio.invalidTimeScale"
  | "audio.invalidDistance"
  | "audio.invalidRolloff"
  | "audio.invalidCone"
  | "audio.invalidAudibilityRadius"
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
