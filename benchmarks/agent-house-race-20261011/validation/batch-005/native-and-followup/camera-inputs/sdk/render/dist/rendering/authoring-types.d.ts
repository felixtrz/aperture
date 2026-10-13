import type { AudioClipHandle, EnvironmentMapHandle, FontAtlasHandle, MaterialHandle, SamplerHandle, TextureHandle, Vec2Like, Vec3Like, Vec4Like } from "@aperture-engine/simulation";
import type { ParticleEmitterInput, ParticleSimulationSpace as ParticleSimulationSpaceType } from "@aperture-engine/particles";
import type { InstanceDataValues, JsonPrimitive } from "../materials/index.js";
export { type ParticleEmitterInput };
export declare const ParticleSimulationSpace: {
    readonly World: "world";
    readonly Local: "local";
};
export type ParticleSimulationSpace = ParticleSimulationSpaceType;
export declare const CameraProjection: {
    readonly Perspective: "perspective";
    readonly Orthographic: "orthographic";
};
export type CameraProjection = (typeof CameraProjection)[keyof typeof CameraProjection];
export declare const LightKind: {
    readonly Ambient: "ambient";
    readonly Environment: "environment";
    readonly Directional: "directional";
    readonly Point: "point";
    readonly Spot: "spot";
    readonly RectArea: "rect-area";
};
export type LightKind = (typeof LightKind)[keyof typeof LightKind];
export declare const AreaLightShape: {
    readonly Rect: "rect";
    readonly Disk: "disk";
    readonly Sphere: "sphere";
};
export type AreaLightShape = (typeof AreaLightShape)[keyof typeof AreaLightShape];
export declare const FogMode: {
    readonly Linear: "linear";
    readonly Exp: "exp";
    readonly Exp2: "exp2";
};
export type FogMode = (typeof FogMode)[keyof typeof FogMode];
export declare const ProceduralSkyModel: {
    readonly Gradient: "gradient";
};
export type ProceduralSkyModel = (typeof ProceduralSkyModel)[keyof typeof ProceduralSkyModel];
export declare const SpriteCoordinateMode: {
    readonly World: "world";
    readonly Screen: "screen";
};
export type SpriteCoordinateMode = (typeof SpriteCoordinateMode)[keyof typeof SpriteCoordinateMode];
export declare const SpriteBillboardMode: {
    readonly None: "none";
    readonly Spherical: "spherical";
    readonly Cylindrical: "cylindrical";
    readonly AxisLocked: "axis-locked";
};
export type SpriteBillboardMode = (typeof SpriteBillboardMode)[keyof typeof SpriteBillboardMode];
export declare const SpriteSizeMode: {
    readonly WorldUnits: "world-units";
    readonly ScreenPixels: "screen-pixels";
};
export type SpriteSizeMode = (typeof SpriteSizeMode)[keyof typeof SpriteSizeMode];
export declare const SpriteBlendMode: {
    readonly Opaque: "opaque";
    readonly Alpha: "alpha";
    readonly Additive: "additive";
    readonly Multiply: "multiply";
};
export type SpriteBlendMode = (typeof SpriteBlendMode)[keyof typeof SpriteBlendMode];
export declare const SpriteDepthMode: {
    readonly Test: "test";
    readonly Disabled: "disabled";
};
export type SpriteDepthMode = (typeof SpriteDepthMode)[keyof typeof SpriteDepthMode];
export declare const AudioSimulationSpace: {
    /** Spatialized through a PannerNode from the emitter's world transform. */
    readonly World: "world";
    /** Non-spatial / 2D (UI, music, ambience) — routed straight to its bus. */
    readonly Local: "local";
};
export type AudioSimulationSpace = (typeof AudioSimulationSpace)[keyof typeof AudioSimulationSpace];
export declare const AudioPanningModel: {
    readonly EqualPower: "equalpower";
    readonly Hrtf: "HRTF";
};
export type AudioPanningModel = (typeof AudioPanningModel)[keyof typeof AudioPanningModel];
export declare const AudioDistanceModel: {
    readonly Inverse: "inverse";
    readonly Linear: "linear";
    readonly Exponential: "exponential";
};
export type AudioDistanceModel = (typeof AudioDistanceModel)[keyof typeof AudioDistanceModel];
export declare const UiScreenScaleMode: {
    readonly Fixed: "fixed";
    readonly Viewport: "viewport";
};
export type UiScreenScaleMode = (typeof UiScreenScaleMode)[keyof typeof UiScreenScaleMode];
export declare const UiLayoutMode: {
    readonly Absolute: "absolute";
    readonly Row: "row";
    readonly Column: "column";
};
export type UiLayoutMode = (typeof UiLayoutMode)[keyof typeof UiLayoutMode];
export declare const UiTextAlign: {
    readonly Left: "left";
    readonly Center: "center";
    readonly Right: "right";
};
export type UiTextAlign = (typeof UiTextAlign)[keyof typeof UiTextAlign];
export declare const PickablePrecision: {
    readonly Bounds: "bounds";
    readonly VisualMesh: "visual-mesh";
    readonly Collider: "collider";
};
export type PickablePrecision = (typeof PickablePrecision)[keyof typeof PickablePrecision];
export declare const MeshQueryAccelerationMode: {
    readonly None: "none";
    readonly AutoBvh: "auto-bvh";
    readonly Bvh: "bvh";
};
export type MeshQueryAccelerationMode = (typeof MeshQueryAccelerationMode)[keyof typeof MeshQueryAccelerationMode];
export declare const MeshQueryAccelerationStrategy: {
    readonly Center: "center";
    readonly Average: "average";
    readonly Sah: "sah";
};
export type MeshQueryAccelerationStrategy = (typeof MeshQueryAccelerationStrategy)[keyof typeof MeshQueryAccelerationStrategy];
export declare const MeshQueryDynamicPolicy: {
    readonly Static: "static";
    readonly Refit: "refit";
    readonly Rebuild: "rebuild";
};
export type MeshQueryDynamicPolicy = (typeof MeshQueryDynamicPolicy)[keyof typeof MeshQueryDynamicPolicy];
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
    /**
     * Fixed directional shadow-camera center. Used when orthographicSize > 0;
     * defaults to the origin. Leave orthographicSize at 0/undefined for auto-fit.
     */
    readonly center?: Vec3Like;
    /**
     * Fixed directional shadow-camera vertical/horizontal span. A value > 0 opts
     * out of renderer auto-fit and mirrors authoring a three.js
     * DirectionalLight.shadow.camera box.
     */
    readonly orthographicSize?: number;
    /** Fixed directional shadow-camera near plane. Used with orthographicSize. */
    readonly near?: number;
    /** Fixed directional shadow-camera far plane. Used with orthographicSize. */
    readonly far?: number;
    /**
     * Distance from center back along the light direction to place the directional
     * shadow camera. Used with orthographicSize.
     */
    readonly lightDistance?: number;
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
    readonly depthMode?: SpriteDepthMode;
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
    /** Occlusion lowpass amount in [0,1]: 0 open, 1 fully muffled. */
    readonly occlusion?: number;
    /** Authored lowpass cutoff in Hz, composed with occlusion. */
    readonly lowpassFrequency?: number;
    /** Authored lowpass resonance/Q. */
    readonly lowpassQ?: number;
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
export interface ProceduralSkyInput {
    readonly model?: ProceduralSkyModel;
    readonly priority?: number;
    readonly topColor?: Vec3Like;
    readonly horizonColor?: Vec3Like;
    readonly bottomColor?: Vec3Like;
    readonly horizonPosition?: number;
    readonly horizonSoftness?: number;
    readonly intensity?: number;
    readonly sunDirection?: Vec3Like;
    readonly sunColor?: Vec3Like;
    readonly sunRadius?: number;
    readonly sunGlow?: number;
    readonly ditherStrength?: number;
}
export type RuntimeUniformValue = JsonPrimitive | readonly number[];
export type RuntimeUniformValues = Readonly<Record<string, RuntimeUniformValue>>;
export interface RuntimeUniformInput {
    readonly key: string;
    readonly values: RuntimeUniformValues;
    readonly version?: number;
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
export type RenderAuthoringDiagnosticCode = "camera.invalidProjection" | "camera.invalidViewport" | "camera.invalidClipRange" | "camera.zeroLayerMask" | "camera.invalidTemporalJitter" | "light.invalidIntensity" | "light.invalidRange" | "light.invalidSpotCone" | "light.invalidAreaSize" | "light.zeroLayerMask" | "lightCookie.invalidTexture" | "lightCookie.invalidIntensity" | "sprite.invalidTexture" | "sprite.invalidSize" | "sprite.invalidUvRect" | "sprite.invalidPivot" | "sprite.invalidRotation" | "sprite.invalidAtlasFrame" | "sprite.invalidCoordinateMode" | "sprite.invalidBillboardMode" | "sprite.invalidSizeMode" | "sprite.invalidBlendMode" | "sprite.invalidDepthMode" | "particle.invalidEffect" | "particle.invalidCapacity" | "particle.invalidSeed" | "particle.invalidResetEpoch" | "particle.invalidTimeScale" | "particle.invalidSimulationSpace" | "particle.invalidBounds" | "audio.invalidClip" | "audio.invalidBusId" | "audio.invalidGain" | "audio.invalidTimeScale" | "audio.invalidDistance" | "audio.invalidRolloff" | "audio.invalidCone" | "audio.invalidAudibilityRadius" | "audio.invalidLowpass" | "skybox.invalidTexture" | "skybox.invalidIntensity" | "proceduralSky.invalidModel" | "proceduralSky.invalidPriority" | "proceduralSky.invalidColor" | "proceduralSky.invalidHorizon" | "proceduralSky.invalidIntensity" | "proceduralSky.invalidSunDirection" | "proceduralSky.invalidSun" | "proceduralSky.invalidDither" | "runtimeUniform.invalidKey" | "runtimeUniform.invalidValues" | "runtimeUniform.invalidVersion" | "fog.invalidMode" | "fog.invalidColor" | "fog.invalidDensity" | "fog.invalidRange" | "shadow.invalidMapSize" | "shadow.invalidBias" | "shadow.invalidCascadeCount" | "shadow.zeroLayerMask" | "shadow.invalidShadowType" | "shadow.invalidStrength" | "shadow.invalidFilterRadius" | "shadow.invalidSlopeBias" | "shadow.invalidOrthographicSize" | "shadow.invalidFixedCamera";
export interface RenderAuthoringDiagnostic {
    readonly code: RenderAuthoringDiagnosticCode;
    readonly message: string;
    readonly field?: string;
}
export interface RenderAuthoringValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly RenderAuthoringDiagnostic[];
}
//# sourceMappingURL=authoring-types.d.ts.map