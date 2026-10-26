import type {
  CameraInput,
  CustomWgslMaterialAsset,
  FogInput,
  LineListMeshOptions,
  LightInput,
  LightShadowSettingsInput,
  ParticleEmitterInput,
  ProceduralSkyInput,
  RuntimeUniformInput,
  SkyboxInput,
  StandardMaterialPatch,
  TorusMeshOptions,
  TriangleListMeshOptions,
  HeightfieldMeshOptions,
  LatheMeshOptions,
  ExtrudeMeshOptions,
  UnlitMaterialAsset,
} from "@aperture-engine/render";
import type {
  ColliderInput,
  ExternalForceInput,
  ExternalImpulseInput,
  KinematicTargetInput,
  PhysicsCharacterControllerInput,
  PhysicsDebugInput,
  PhysicsGravityInput,
  PhysicsJointInput,
  PhysicsMaterialInput,
  PhysicsVelocityInput,
  RigidBodyInput,
} from "@aperture-engine/physics";
import type { AnimationAccess } from "@aperture-engine/runtime";
import type {
  Entity,
  EnvironmentMapHandle,
  LocalTransformInput,
  MaterialHandle,
  MeshHandle,
  ParticleEffectHandle,
  PrefabFieldOverride,
  PrefabHandle,
  PrefabTransformOverride,
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type {
  SystemGltfAssetHandle,
  SystemAssetHandle,
  SystemParticleEffectAssetHandle,
  SystemShaderAssetHandle,
  SystemTextureAssetHandle,
} from "../assets.js";

export interface SpawnMetadata {
  readonly name?: string;
  readonly key?: string;
  readonly tags?: readonly string[];
}

export interface SystemTransformInput extends LocalTransformInput {
  readonly translation?: Vec3Like;
  /** Quaternion [x, y, z, w]; wins over rotationEulerDegrees and lookAt. */
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
  readonly parent?: Entity | null;
  /** Point -Z at this target (needs translation), like Object3D.lookAt. */
  readonly lookAt?: Vec3Like;
  /**
   * Euler angles in degrees, applied in three.js's default "XYZ" order
   * (q = qX * qY * qZ). Note `quatFromEuler()` defaults to "YXZ"; pass its
   * result as `rotation` when you need yaw-then-pitch composition.
   */
  readonly rotationEulerDegrees?: Vec3Like;
}

export interface SpawnCameraOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly fovYDegrees?: number;
  readonly camera?: CameraInput;
}

/** A transform-only ECS parent for a reusable assembly of authored entities. */
export interface SpawnGroupOptions extends SpawnMetadata {
  /** Local transform relative to transform.parent, or world-root transform. */
  readonly transform?: SystemTransformInput;
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  /** @deprecated Use `intensity`; Aperture does not currently convert lux. */
  readonly illuminance?: number;
  /**
   * Physically based like three.js: directional lights are a flat irradiance
   * (a sun around 2–4), point/spot lights fall off with inverse-square
   * distance inside `light.range` (a lamp 4–5 m from what it lights needs
   * roughly 15–40). Change at runtime with
   * `entity.setValue(Light, "intensity", value)`.
   */
  readonly intensity?: number;
  readonly light?: LightInput;
  /**
   * Enable shadow casting for this light. `true` uses defaults; an object
   * customizes map size, cascades, PCF radius, bias, etc. Attaches a
   * `LightShadowSettings` component (enabled). Only meshes spawned with
   * `castShadow`/`receiveShadow` participate.
   */
  readonly shadow?: boolean | LightShadowSettingsInput;
}

export type EnvironmentAssetDescriptorInput =
  | EnvironmentMapHandle
  | SystemAssetHandle<"hdr">;

export interface SpawnEnvironmentOptions extends SpawnMetadata {
  readonly source: EnvironmentAssetDescriptorInput;
  readonly intensity?: number;
  readonly color?: Vec4Like;
  readonly layerMask?: number;
  readonly transform?: SystemTransformInput;
}

export type LightRigPresetName = "studio-neutral" | "outdoor-neutral" | "none";

export interface SpawnLightRigOptions extends SpawnMetadata {
  readonly preset: LightRigPresetName;
  readonly environmentMap?: EnvironmentAssetDescriptorInput;
  readonly shadows?: boolean | LightShadowSettingsInput;
  readonly transform?: SystemTransformInput;
  readonly environment?:
    | (Partial<Omit<SpawnEnvironmentOptions, "source">> & {
        readonly source?: EnvironmentAssetDescriptorInput;
      })
    | false;
  readonly keyLight?: Partial<SpawnLightOptions> | false;
  readonly rimLight?: Partial<SpawnLightOptions> | false;
}

export interface SpawnedLightRig {
  readonly preset: LightRigPresetName;
  readonly root: Entity;
  readonly lights: readonly Entity[];
  remove(): void;
}

export interface SpawnFogOptions extends SpawnMetadata, FogInput {
  readonly transform?: SystemTransformInput;
}

export type SkyboxTextureDescriptorInput =
  | TextureHandle
  | SystemTextureAssetHandle;
export type SkyboxSamplerDescriptorInput = SamplerHandle;

export interface SpawnSkyboxOptions
  extends SpawnMetadata, Omit<SkyboxInput, "texture" | "sampler"> {
  readonly texture: SkyboxTextureDescriptorInput;
  readonly sampler?: SkyboxSamplerDescriptorInput | null;
  readonly transform?: SystemTransformInput;
}

export interface SpawnProceduralSkyOptions
  extends SpawnMetadata, ProceduralSkyInput {
  readonly transform?: SystemTransformInput;
}

export interface SpawnRuntimeUniformOptions extends SpawnMetadata {
  /**
   * Runtime uniform key matched by custom WGSL uniform bindings. Reusing a key
   * updates the existing runtime-uniform entity instead of spawning duplicates.
   */
  readonly uniformKey: RuntimeUniformInput["key"];
  readonly values: RuntimeUniformInput["values"];
  readonly version?: RuntimeUniformInput["version"];
}

export interface BoxMeshDescriptorOptions {
  readonly size?: number | Vec3Like;
}

export interface SphereMeshDescriptorOptions {
  readonly radius?: number;
  readonly segments?: number;
}

export interface CapsuleMeshDescriptorOptions {
  readonly radius?: number;
  /** Total height along Y, end caps included (clamped to >= 2 * radius). */
  readonly height?: number;
  /** Same as `height` (total height along Y); `height` wins when both are set. */
  readonly depth?: number;
  readonly segments?: number;
}

export interface PlaneMeshDescriptorOptions {
  readonly size?: number | readonly [number, number];
  /** Cells along each axis, floored and clamped to 1–128. Defaults to 1. */
  readonly subdivisions?: number;
}

export interface CylinderMeshDescriptorOptions {
  /** Radius for both ends unless radiusTop/radiusBottom override it. */
  readonly radius?: number;
  /**
   * Top radius (like three.js CylinderGeometry). Use a smaller top for tapered
   * trunks, posts, and tiers; 0 makes a cone.
   */
  readonly radiusTop?: number;
  readonly radiusBottom?: number;
  /** Total height along Y, centered on the origin. Defaults to 1. */
  readonly height?: number;
  /** Same as `height`; `height` wins when both are set. */
  readonly depth?: number;
  /** Radial segments; 5–8 gives a faceted low-poly look. */
  readonly segments?: number;
  readonly heightSegments?: number;
}

export interface ConeMeshDescriptorOptions {
  readonly radius?: number;
  /** Total height along Y, centered on the origin. Defaults to 1. */
  readonly height?: number;
  /** Same as `height`; `height` wins when both are set. */
  readonly depth?: number;
  readonly segments?: number;
  readonly heightSegments?: number;
}

export type LineListMeshDescriptorOptions = LineListMeshOptions;

/** Uses the render factory's major/tube radii and independent segment counts. */
export type TorusMeshDescriptorOptions = TorusMeshOptions;

/** Validated custom triangles; flat normals by default. */
export type TriangleListMeshDescriptorOptions = TriangleListMeshOptions;

/** Rectangular Y-up terrain with flat face normals and normalized grid UVs. */
export type HeightfieldMeshDescriptorOptions = HeightfieldMeshOptions;

/** Full Y-axis revolution with flat normals and explicit profile closure. */
export type LatheMeshDescriptorOptions = LatheMeshOptions;

/** Closed indexed XY polygon extrusion along +Z, with optional holes. */
export type ExtrudeMeshDescriptorOptions = ExtrudeMeshOptions;

/** Placement of one part inside `mesh.merge()`, relative to the merged origin. */
export interface MergeMeshPartTransform {
  readonly translation?: Vec3Like;
  readonly rotation?: Vec4Like;
  readonly rotationEulerDegrees?: Vec3Like;
  readonly scale?: Vec3Like;
}

/** One primitive baked into a merged mesh. */
export interface MergeMeshPartDescriptor {
  /** Any triangle primitive descriptor, including another `mesh.merge()`. */
  readonly mesh: PrimitiveMeshDescriptor;
  readonly transform?: MergeMeshPartTransform;
  /**
   * Linear RGB(A) vertex color for this part, multiplied into the material
   * base color. Lets one material (e.g. white, roughness 0.8) render a
   * multi-colored prop in a single draw.
   */
  readonly color?: Vec3Like | Vec4Like;
}

export interface MergeMeshDescriptorOptions {
  readonly parts: readonly MergeMeshPartDescriptor[];
  readonly label?: string;
  /**
   * One normal per triangle (three.js `flatShading: true`) for the faceted
   * low-poly look: `mesh.merge([{ mesh: mesh.sphere({ segments: 5 }) }],
   * { flatShading: true })` is a quick rock.
   */
  readonly flatShading?: boolean;
}

export type PrimitiveMeshDescriptor =
  | PrimitiveMeshDescriptorBase<"merge", MergeMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"extrude", ExtrudeMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"lathe", LatheMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"heightfield", HeightfieldMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"box", BoxMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"sphere", SphereMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"capsule", CapsuleMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"plane", PlaneMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"cylinder", CylinderMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"cone", ConeMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"torus", TorusMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"line-list", LineListMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<
      "triangle-list",
      TriangleListMeshDescriptorOptions
    >;

export interface PrimitiveMeshDescriptorBase<
  TKind extends string,
  TOptions extends object,
> {
  readonly kind: TKind;
  readonly options: Readonly<TOptions>;
}

type StandardMaterialRenderState = UnlitMaterialAsset["renderState"];

export interface StandardMaterialDescriptor {
  readonly kind: "standard";
  readonly options: StandardMaterialOptions;
}

export interface UnlitMaterialDescriptor {
  readonly kind: "unlit";
  readonly options: UnlitMaterialOptions;
}

export type CustomWgslShaderDescriptor =
  | {
      readonly kind: "shader-asset";
      readonly handle: ShaderHandle;
    }
  | {
      readonly kind: "inline-wgsl";
      readonly code: string;
      readonly virtualPath?: string;
    };

export type ShaderAssetDescriptorInput = ShaderHandle | SystemShaderAssetHandle;

export type CustomWgslMaterialDescriptor = Omit<
  CustomWgslMaterialAsset,
  | "sourceDiscriminator"
  | "shaderLanguage"
  | "renderState"
  | "pipelineKey"
  | "bindings"
  | "dependencies"
> & {
  readonly kind: "custom-wgsl";
  readonly shader: CustomWgslShaderDescriptor;
  readonly renderState?: Partial<CustomWgslMaterialAsset["renderState"]>;
  readonly pipelineKey?: Partial<CustomWgslMaterialAsset["pipelineKey"]>;
  readonly bindings?: CustomWgslMaterialAsset["bindings"];
  readonly dependencies?: CustomWgslMaterialAsset["dependencies"];
};

export type MaterialDescriptor =
  | StandardMaterialDescriptor
  | UnlitMaterialDescriptor
  | CustomWgslMaterialDescriptor;

/**
 * Surface options shared by `material.standard()` and `material.unlit()`; the
 * familiar three.js `transparent`/`opacity`/`side` knobs map onto these.
 */
export interface MaterialSurfaceOptions {
  /**
   * Multiplies the base color alpha (0 transparent → 1 opaque). A value
   * below 1 (or a baseColor alpha below 1) switches the material to alpha
   * blending with depth writes off — no render-state plumbing required.
   */
  readonly opacity?: number;
  /**
   * Render both faces (three.js `side: DoubleSide`) — for leaves, flags,
   * water planes and other open surfaces seen from both sides.
   */
  readonly doubleSided?: boolean;
}

export interface StandardMaterialOptions extends MaterialSurfaceOptions {
  /**
   * "blend" alpha-blends (implied by opacity/baseColor alpha below 1), "mask"
   * cuts out pixels whose alpha is below `alphaCutoff`, "opaque" ignores
   * alpha. Overrides the opacity-based default.
   */
  readonly alphaMode?: "opaque" | "mask" | "blend";
  /** Alpha threshold for `alphaMode: "mask"`. Defaults to 0.5. */
  readonly alphaCutoff?: number;
  /** Low-level render state, merged after the options above. */
  readonly renderState?: Partial<StandardMaterialRenderState>;
  readonly baseColor?: Vec4Like;
  /** Perceptual roughness (0 mirror → 1 diffuse). Defaults to 1. */
  readonly roughness?: number;
  /**
   * Metalness (0 dielectric → 1 metal). Defaults to 0: hand-authored
   * materials are dielectric unless stated, unlike glTF imports which keep
   * the spec default of 1. A metal with no environment map renders
   * near-black, so only set 1 when the scene has image-based lighting.
   */
  readonly metallic?: number;
  /**
   * Additive linear emissive color. Values may exceed 1 for HDR/bloom probes.
   */
  readonly emissiveFactor?: Vec3Like;
  readonly label?: string;
}

export interface UnlitMaterialOptions extends MaterialSurfaceOptions {
  readonly baseColor?: Vec4Like;
  readonly label?: string;
  readonly renderState?: Partial<UnlitMaterialAsset["renderState"]>;
}

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: MaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
  readonly physics?: PhysicsSpawnDescriptor;
  /** Attach a `ShadowCaster` component so this mesh casts shadows. */
  readonly castShadow?: boolean;
  /** Attach a `ShadowReceiver` component so this mesh receives shadows. */
  readonly receiveShadow?: boolean;
  /**
   * Per-entity linear RGBA multiplier on a `material.standard()` base color
   * (like per-instance colors on a three.js InstancedMesh): vary trees, cars or
   * buildings that share one material. Alpha multiplies opacity when the
   * material blends (e.g. fading smoke). Change it later with
   * `entity.getVectorView(InstanceTint, "color").set([r, g, b, a])`.
   */
  readonly tint?: Vec4Like;
}

export type ParticleEffectDescriptorInput =
  | ParticleEffectHandle
  | SystemParticleEffectAssetHandle;

export interface SpawnParticlesOptions
  extends SpawnMetadata, Omit<ParticleEmitterInput, "effect"> {
  readonly effect: ParticleEffectDescriptorInput;
  readonly transform?: SystemTransformInput;
}

export type PhysicsComponentDescriptor<TInput> = TInput | true;

export interface PhysicsSpawnDescriptor {
  readonly rigidBody?: PhysicsComponentDescriptor<RigidBodyInput>;
  readonly collider?: PhysicsComponentDescriptor<ColliderInput>;
  readonly velocity?: PhysicsComponentDescriptor<PhysicsVelocityInput>;
  readonly externalForce?: PhysicsComponentDescriptor<ExternalForceInput>;
  readonly externalImpulse?: PhysicsComponentDescriptor<ExternalImpulseInput>;
  readonly kinematicTarget?: PhysicsComponentDescriptor<KinematicTargetInput>;
  readonly gravity?: PhysicsComponentDescriptor<PhysicsGravityInput>;
  readonly characterController?: PhysicsComponentDescriptor<PhysicsCharacterControllerInput>;
  readonly material?: PhysicsComponentDescriptor<PhysicsMaterialInput>;
  readonly joint?: PhysicsComponentDescriptor<PhysicsJointInput>;
  readonly debug?: PhysicsComponentDescriptor<PhysicsDebugInput>;
}

export interface CustomWgslUniformBindingOptions {
  readonly binding: number;
  readonly visibility: CustomWgslMaterialAsset["bindings"][number]["visibility"];
  readonly fields: Extract<
    CustomWgslMaterialAsset["bindings"][number],
    { readonly kind: "uniform-buffer" }
  >["fields"];
  readonly values?: Extract<
    CustomWgslMaterialAsset["bindings"][number],
    { readonly kind: "uniform-buffer" }
  >["values"];
  readonly runtimeUniformKey?: Extract<
    CustomWgslMaterialAsset["bindings"][number],
    { readonly kind: "uniform-buffer" }
  >["runtimeUniformKey"];
  readonly label?: string;
}

export interface CustomWgslTextureBindingOptions {
  readonly binding: number;
  readonly visibility: CustomWgslMaterialAsset["bindings"][number]["visibility"];
  readonly texture: TextureHandle;
  readonly label?: string;
}

export interface CustomWgslSamplerBindingOptions {
  readonly binding: number;
  readonly visibility: CustomWgslMaterialAsset["bindings"][number]["visibility"];
  readonly sampler: SamplerHandle;
  readonly label?: string;
}

export interface SpawnGltfOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  /**
   * Clone/reuse patched imported material assets for this spawned subtree
   * without mutating the source GLTF material assets.
   * Accepts every uniform-level `StandardMaterialPatch` field or a versioned
   * descriptor from `material.preset(...)`. Useful for appearance and GLB
   * render-state adjustments without scanning or mutating source assets.
   * @see StandardMaterialPatch
   */
  readonly materials?: SpawnGltfMaterialOverrides;
  /** Attach `ShadowCaster` to every mesh in the spawned subtree. */
  readonly castShadow?: boolean;
  /** Attach `ShadowReceiver` to every mesh in the spawned subtree. */
  readonly receiveShadow?: boolean;
}

export interface SpawnGltfBatchInstance extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly materials?: SpawnGltfMaterialOverrides;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

export interface SpawnGltfBatchOptions {
  /**
   * Tags applied to every spawned root. Instance tags are appended and
   * de-duplicated.
   */
  readonly tags?: readonly string[];
  readonly materials?: SpawnGltfMaterialOverrides;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly instances: readonly SpawnGltfBatchInstance[];
}

export type MaterialAppearancePresetName =
  | "source"
  | "painted-stylized"
  | "matte"
  | "preview-safe";

export interface MaterialAppearancePresetDescriptor {
  readonly kind: "material-preset";
  readonly name: MaterialAppearancePresetName;
  readonly version: 1;
  readonly overrides: StandardMaterialPatch;
}

export type SpawnGltfMaterialOverrides =
  | StandardMaterialPatch
  | MaterialAppearancePresetDescriptor;

export interface SpawnPrefabOptions extends SpawnMetadata {
  /** Per-field override of the instance root's local transform. */
  readonly transform?: PrefabTransformOverride;
  /** Per-instance component-field overrides addressed by prefab-local id. */
  readonly overrides?: readonly PrefabFieldOverride[];
}

export interface SpawnPhysicsOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly physics: PhysicsSpawnDescriptor;
}

export interface SpawnCommands {
  /** Spawn an ordinary named/tagged ECS transform entity, with no render asset. */
  group(options?: SpawnGroupOptions): Entity;
  camera(options?: SpawnCameraOptions): Entity;
  light(options?: SpawnLightOptions): Entity;
  /** Spawn an ECS environment-light entity with a direct HDR source. */
  environment(options: SpawnEnvironmentOptions): Entity;
  /** Spawn a deterministic, inspectable ECS-owned presentation light rig. */
  lightRig(options: SpawnLightRigOptions): SpawnedLightRig;
  /** Spawn a distance-fog entity (linear/exp/exp2) consumed by render extraction. */
  fog(options?: SpawnFogOptions): Entity;
  /** Spawn an ECS-authored skybox consumed by render extraction. */
  skybox(options: SpawnSkyboxOptions): Entity;
  /** Spawn an ECS-authored procedural sky consumed by render extraction. */
  proceduralSky(options?: SpawnProceduralSkyOptions): Entity;
  /** Spawn keyed runtime uniform values consumed by dynamic custom WGSL bindings. */
  runtimeUniform(options: SpawnRuntimeUniformOptions): Entity;
  mesh(options: SpawnMeshOptions): Entity;
  /** Spawn a renderer-independent particle emitter entity. */
  particles(options: SpawnParticlesOptions): Entity;
  /** Spawn a non-render physics entity, useful for joints, triggers, and pure colliders. */
  physics(options: SpawnPhysicsOptions): Entity;
  gltf(handle: SystemGltfAssetHandle, options?: SpawnGltfOptions): Entity;
  /**
   * Spawn repeated GLTF instances with shared options while still authoring
   * ordinary ECS roots/subtrees through `spawn.gltf(...)`.
   */
  gltfBatch(
    handle: SystemGltfAssetHandle,
    options: SpawnGltfBatchOptions,
  ): readonly Entity[];
  /** Instantiate a registered prefab blueprint, returning the subtree root. */
  prefab(handle: PrefabHandle, options?: SpawnPrefabOptions): Entity;
  /** Engine-owned animation controls for a spawned (e.g. glTF) entity. */
  animation(entity: Entity): AnimationAccess;
}
