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
  readonly rotation?: Vec4Like;
  readonly scale?: Vec3Like;
  readonly parent?: Entity | null;
  readonly lookAt?: Vec3Like;
  readonly rotationEulerDegrees?: Vec3Like;
}

export interface SpawnCameraOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly fovYDegrees?: number;
  readonly camera?: CameraInput;
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  /** @deprecated Use `intensity`; Aperture does not currently convert lux. */
  readonly illuminance?: number;
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
  readonly depth?: number;
  readonly segments?: number;
}

export interface PlaneMeshDescriptorOptions {
  readonly size?: number | readonly [number, number];
  readonly subdivisions?: number;
}

export interface CylinderMeshDescriptorOptions {
  readonly radius?: number;
  readonly depth?: number;
  readonly segments?: number;
}

export interface ConeMeshDescriptorOptions {
  readonly radius?: number;
  readonly depth?: number;
  readonly segments?: number;
}

/**
 * Ring/tube primitive, laid out flat in XZ around +Y — the mesh a ground
 * decal, a selection ring or a health arc wants.
 *
 * `radius` is the distance from the center to the middle of the tube and
 * `thickness` is the tube's DIAMETER (its drawn width), so a band that reads
 * `thickness` wide on screen is authored with the number you measured.
 */
export interface TorusMeshDescriptorOptions {
  readonly radius?: number;
  readonly thickness?: number;
  /** Segments around the ring. */
  readonly segments?: number;
  /** Segments around the tube's cross-section. */
  readonly tubeSegments?: number;
}

export type LineListMeshDescriptorOptions = LineListMeshOptions;

export type PrimitiveMeshDescriptor =
  | PrimitiveMeshDescriptorBase<"box", BoxMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"sphere", SphereMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"capsule", CapsuleMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"plane", PlaneMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"cylinder", CylinderMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"cone", ConeMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"torus", TorusMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"line-list", LineListMeshDescriptorOptions>;

export interface PrimitiveMeshDescriptorBase<
  TKind extends string,
  TOptions extends object,
> {
  readonly kind: TKind;
  readonly options: Readonly<TOptions>;
}

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

export interface StandardMaterialOptions {
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
  /** Base-colour texture, multiplied by `baseColor`. See MaterialTextureInput. */
  readonly baseColorTexture?: MaterialTextureInput;
  readonly label?: string;
}

export interface UnlitMaterialOptions {
  readonly baseColor?: Vec4Like;
  /**
   * Base-colour texture, multiplied by `baseColor`.
   *
   * `transform` addresses a sub-rect, which is what makes texture atlases and
   * sprite sheets usable: point several materials at one texture and give each
   * a different offset/scale instead of shipping a texture per tile.
   */
  readonly baseColorTexture?: MaterialTextureInput;
  readonly label?: string;
  readonly renderState?: Partial<UnlitMaterialAsset["renderState"]>;
  /**
   * `"scene"` (default) draws with the lit scene, so an HDR app blends the
   * material in LINEAR space and the post stack tone-maps the result.
   * `"post-tonemap"` draws after the post stack instead, compositing into the
   * presentation target so the material blends in DISPLAY space against
   * already-tone-mapped pixels.
   *
   * Pair it with `toneMapped: false` to reproduce a three.js
   * `MeshBasicMaterial({ toneMapped: false })` overlay — translucent board
   * decals, glow discs, reticles and rings whose authored color must survive
   * the blend unchanged. Writing that color into the HDR scene buffer instead
   * washes it out, and pre-inverting the tonemap cannot fix a TRANSLUCENT
   * overlay: the inverse pushes the color above 1, and the blended fraction of
   * that HDR value tone-maps to a completely different result.
   *
   * The draw is still depth-tested against the scene at every
   * `render.sampleCount`, so a decal on the ground is occluded by whatever
   * stands on it. It never WRITES depth, so post-tonemap draws do not occlude
   * each other and are composited in snapshot order.
   *
   * Author the color LINEAR, as every Aperture material color is: the stage
   * owns the output encode, so `baseColor` must be the sRGB-decoded value of
   * the byte you want on screen (`0x7ef6dc` -> `[0.2086, 0.9216, 0.7158]`),
   * not the raw byte over 255.
   *
   * This is the mesh sibling of the particle renderer's `renderStage`. Only
   * unlit materials accept it; see `UnlitMaterialAsset.renderStage`.
   */
  readonly renderStage?: UnlitMaterialAsset["renderStage"];
  /**
   * Apply the app's tonemap operator inside a post-tonemap pipeline.
   * Defaults to `true` (matching the particle renderer). Scene-stage draws
   * ignore it — the app's output pass tone-maps those.
   */
  readonly toneMapped?: boolean;
}

/**
 * A texture binding for a hand-authored material.
 *
 * Accepts the `SystemTextureAssetHandle` returned by `this.assets.texture(id)`
 * directly, so callers do not have to reach for `.renderHandle`.
 */
export interface MaterialTextureInput {
  readonly texture: TextureDescriptorInput;
  /**
   * Sampler to read the texture with. Required by the renderer — a binding
   * without one is dropped with `render.material.missingSamplerHandle`.
   */
  readonly sampler?: SamplerHandle;
  /** Sub-rect / tiling. Offset and scale are in UV space. */
  readonly transform?: {
    readonly offset?: readonly [number, number];
    readonly scale?: readonly [number, number];
    readonly rotation?: number;
  };
  readonly texCoord?: number;
}

export type TextureDescriptorInput = TextureHandle | SystemTextureAssetHandle;

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: MaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
  readonly physics?: PhysicsSpawnDescriptor;
  /** Attach a `ShadowCaster` component so this mesh casts shadows. */
  readonly castShadow?: boolean;
  /** Attach a `ShadowReceiver` component so this mesh receives shadows. */
  readonly receiveShadow?: boolean;
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
