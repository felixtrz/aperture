import type {
  CameraInput,
  CustomWgslMaterialAsset,
  CustomWgslSamplerType,
  CustomWgslTextureBindingSource,
  CustomWgslTextureSampleType,
  FogInput,
  DecalInput,
  LineInput,
  LineListMeshOptions,
  LightInput,
  LightShadowSettingsInput,
  ParticleEmitterInput,
  PointsInput,
  ProceduralSkyInput,
  RuntimeBufferInput,
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
  BufferHandle,
  Entity,
  LocalTransformInput,
  MaterialHandle,
  MeshHandle,
  ParticleEffectHandle,
  PrefabFieldOverride,
  PrefabHandle,
  PrefabTransformOverride,
  RenderTargetHandle,
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type {
  SystemGltfAssetHandle,
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
  /**
   * Render into an offscreen render target instead of the canvas (B1).
   * Accepts the handle returned by `this.renderTargets.register(...)` or its
   * id; wins over `camera.renderTargetId` when both are provided. Pairing
   * with a cube target (`dimension: "cube"`) makes this a cube-capture camera
   * that renders six 90-degree faces per scheduled capture (B2).
   */
  readonly renderTarget?: RenderTargetHandle | string;
  /**
   * Cube-capture schedule sugar (B2): `{ every: N }` captures the six faces
   * every N extracted frames (`every: 0` = on-demand only via
   * `this.renderTargets.capture(...)`). Wins over `camera.captureEvery`.
   */
  readonly capture?: { readonly every?: number };
}

export interface SpawnLightOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  readonly kind?: LightInput["kind"];
  readonly color?: Vec4Like;
  /**
   * Hemisphere light ground color (E5). Meaningful only for
   * `kind: "hemisphere"`, where `color` is the sky color; ignored otherwise.
   */
  readonly groundColor?: Vec4Like;
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

export interface SpawnRuntimeBufferOptions extends SpawnMetadata {
  /**
   * Runtime buffer key matched by custom WGSL storage bindings declared with
   * `runtimeBufferKey`. Reusing a key updates the existing runtime-buffer
   * entity instead of spawning duplicates.
   */
  readonly bufferKey: RuntimeBufferInput["key"];
  /** Flat element components written at elementOffset (in elements). */
  readonly values: RuntimeBufferInput["values"];
  readonly elementOffset?: RuntimeBufferInput["elementOffset"];
  readonly version?: RuntimeBufferInput["version"];
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

export type LineListMeshDescriptorOptions = LineListMeshOptions;

export type PrimitiveMeshDescriptor =
  | PrimitiveMeshDescriptorBase<"box", BoxMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"sphere", SphereMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"capsule", CapsuleMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"plane", PlaneMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"cylinder", CylinderMeshDescriptorOptions>
  | PrimitiveMeshDescriptorBase<"cone", ConeMeshDescriptorOptions>
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
  readonly roughness?: number;
  readonly metallic?: number;
  /**
   * Additive linear emissive color. Values may exceed 1 for HDR/bloom probes.
   */
  readonly emissiveFactor?: Vec3Like;
  /** Strength multiplier applied to the normal map (asset `normalScale`). */
  readonly normalScale?: number;
  /** Occlusion texture strength in [0, 1] (asset `occlusionStrength`). */
  readonly occlusionStrength?: number;
  /** `KHR_materials_clearcoat` layer intensity; > 0 enables the clearcoat variant. */
  readonly clearcoatFactor?: number;
  readonly clearcoatRoughnessFactor?: number;
  /** `KHR_materials_transmission` factor; > 0 enables the transmission variant. */
  readonly transmissionFactor?: number;
  /** `KHR_materials_ior` index of refraction (default 1.5). */
  readonly ior?: number;
  /** `KHR_materials_volume` thickness in object space (0 = thin-walled). */
  readonly thickness?: number;
  readonly attenuationColor?: Vec3Like;
  /**
   * `KHR_materials_volume` attenuation distance. 0 is the JSON-safe sentinel
   * for "no Beer-Lambert absorption" (glTF's default of +Infinity).
   */
  readonly attenuationDistance?: number;
  /** `KHR_materials_sheen` color; any channel > 0 enables the sheen variant. */
  readonly sheenColorFactor?: Vec3Like;
  readonly sheenRoughnessFactor?: number;
  /** `KHR_materials_iridescence` factor; > 0 enables the iridescence variant. */
  readonly iridescenceFactor?: number;
  readonly iridescenceIor?: number;
  readonly iridescenceThicknessMinimum?: number;
  readonly iridescenceThicknessMaximum?: number;
  readonly renderState?: Partial<UnlitMaterialAsset["renderState"]>;
  readonly label?: string;
}

export interface UnlitMaterialOptions {
  readonly baseColor?: Vec4Like;
  readonly label?: string;
  readonly renderState?: Partial<UnlitMaterialAsset["renderState"]>;
}

export interface SpawnLodLevelOptions {
  /** Mesh drawn while this LOD level is active (descriptor or resolved handle). */
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  /** World-unit camera→object distance at which this level begins to show. */
  readonly distance: number;
}

export interface SpawnLodOptions {
  /**
   * Ordered LOD levels (nearest/highest-detail first, strictly ascending
   * distances) — the three.js `THREE.LOD` level list. Extraction selects one
   * per frame by camera distance and overrides the drawn mesh with its handle.
   */
  readonly levels: readonly SpawnLodLevelOptions[];
  /**
   * Symmetric hysteresis band half-width in world units (>= 0). A level only
   * switches once the distance crosses `threshold ± hysteresis`, so nudging the
   * camera within the band never repicks (no popping).
   */
  readonly hysteresis?: number;
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
   * Attach a `Lod` component (E2). The base `mesh` is the fallback; each level
   * supplies its own mesh + distance and the shared `material` is reused. When
   * omitted the mesh has no LOD and is byte-identical to today.
   */
  readonly lod?: SpawnLodOptions;
}

export type DecalTextureDescriptorInput =
  | TextureHandle
  | SystemTextureAssetHandle;

export interface SpawnDecalOptions
  extends SpawnMetadata, Omit<DecalInput, "texture" | "sampler"> {
  readonly texture: DecalTextureDescriptorInput;
  readonly sampler?: SamplerHandle | null;
  readonly transform?: SystemTransformInput;
  /** Render layer mask applied via a `RenderLayer` component (default 1). */
  readonly layer?: number;
}

export interface SpawnLineOptions extends SpawnMetadata, LineInput {
  readonly transform?: SystemTransformInput;
  /** Render layer mask applied via a `RenderLayer` component (default 1). */
  readonly layer?: number;
}

export interface SpawnPointsOptions extends SpawnMetadata, PointsInput {
  readonly transform?: SystemTransformInput;
  /** Render layer mask applied via a `RenderLayer` component (default 1). */
  readonly layer?: number;
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
  /**
   * A texture source asset (or facade render target). Omit when `source` names
   * a renderer-owned texture (B4, e.g. `"scene-depth"`).
   */
  readonly texture?: TextureHandle;
  /**
   * Renderer-owned texture source (B4): `"scene-depth"` binds the frame's
   * stored scene depth (read-only). A source-backed binding needs no `texture`
   * handle and must sit in a transparent material (alphaMode `"blend"`).
   */
  readonly source?: CustomWgslTextureBindingSource;
  /** Layout sample type (B4, default `"float"`). Scene-depth uses `"depth"`. */
  readonly sampleType?: CustomWgslTextureSampleType;
  readonly viewDimension?: "2d" | "cube";
  /** Sample the MSAA-resolved-in-place scene depth as multisampled (B4). */
  readonly multisampled?: boolean;
  readonly label?: string;
}

export interface CustomWgslSamplerBindingOptions {
  readonly binding: number;
  readonly visibility: CustomWgslMaterialAsset["bindings"][number]["visibility"];
  readonly sampler: SamplerHandle;
  /** Layout sampler type (B4, default `"filtering"`; `"comparison"` for depth). */
  readonly samplerType?: CustomWgslSamplerType;
  readonly label?: string;
}

export interface CustomWgslStorageBindingOptions {
  readonly binding: number;
  /** Defaults to ["vertex", "fragment"] for read-only storage bindings. */
  readonly visibility?: CustomWgslMaterialAsset["bindings"][number]["visibility"];
  /** Renderer-independent buffer source asset (this.buffers.register(...)). */
  readonly buffer: BufferHandle;
  /** Keyed dynamic-update channel fed by this.spawn.runtimeBuffer(...). */
  readonly runtimeBufferKey?: string;
  readonly label?: string;
}

export interface SpawnGltfOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
  /**
   * Clone/reuse patched imported material assets for this spawned subtree
   * without mutating the source GLTF material assets.
   * Useful for GLB render-state adjustments such as cull mode without scanning
   * or mutating every registered material in the app.
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

export type SpawnGltfMaterialOverrides = StandardMaterialPatch;

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
  /** Spawn a distance-fog entity (linear/exp/exp2) consumed by render extraction. */
  fog(options?: SpawnFogOptions): Entity;
  /** Spawn an ECS-authored skybox consumed by render extraction. */
  skybox(options: SpawnSkyboxOptions): Entity;
  /** Spawn an ECS-authored procedural sky consumed by render extraction. */
  proceduralSky(options?: SpawnProceduralSkyOptions): Entity;
  /** Spawn keyed runtime uniform values consumed by dynamic custom WGSL bindings. */
  runtimeUniform(options: SpawnRuntimeUniformOptions): Entity;
  /** Spawn keyed storage-buffer element updates consumed by custom WGSL storage bindings. */
  runtimeBuffer(options: SpawnRuntimeBufferOptions): Entity;
  mesh(options: SpawnMeshOptions): Entity;
  /**
   * Spawn a projected decal entity (D4). The entity transform is the decal
   * projector; the quad is depth-biased onto opaque scene geometry. `sequence`
   * defaults to a monotonic spawn stamp so the oldest-first live-decal cap
   * evicts in spawn order.
   */
  decal(options: SpawnDecalOptions): Entity;
  /**
   * Spawn a fat-line (Line2-style) entity (E1). Each polyline segment expands
   * to a screen-space-width quad with round caps/joins; `dashSize`/`gapSize`
   * drive world-continuous dashes.
   */
  line(options: SpawnLineOptions): Entity;
  /**
   * Spawn a point-cloud (PointsMaterial-style) entity (E1). Each point draws a
   * camera-facing quad sized in pixels or (with `sizeAttenuation`) world units.
   */
  points(options: SpawnPointsOptions): Entity;
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
