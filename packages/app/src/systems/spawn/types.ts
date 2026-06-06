import type { CameraInput, LightInput } from "@aperture-engine/render";
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
  LocalTransformInput,
  MaterialHandle,
  MeshHandle,
  PrefabFieldOverride,
  PrefabHandle,
  PrefabTransformOverride,
  SamplerHandle,
  ShaderHandle,
  TextureHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type { CustomWgslMaterialAsset } from "@aperture-engine/render";
import type {
  SystemGltfAssetHandle,
  SystemShaderAssetHandle,
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
  readonly illuminance?: number;
  readonly intensity?: number;
  readonly light?: LightInput;
}

export interface PrimitiveMeshDescriptor {
  readonly kind: "box" | "sphere" | "capsule" | "plane" | "cylinder" | "cone";
  readonly options: Record<string, unknown>;
}

export interface StandardMaterialDescriptor {
  readonly kind: "standard";
  readonly options: StandardMaterialOptions;
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
  | CustomWgslMaterialDescriptor;

export interface StandardMaterialOptions {
  readonly baseColor?: Vec4Like;
  readonly roughness?: number;
  readonly metallic?: number;
  readonly label?: string;
}

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: MaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
  readonly physics?: PhysicsSpawnDescriptor;
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
}

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
  mesh(options: SpawnMeshOptions): Entity;
  /** Spawn a non-render physics entity, useful for joints, triggers, and pure colliders. */
  physics(options: SpawnPhysicsOptions): Entity;
  gltf(handle: SystemGltfAssetHandle, options?: SpawnGltfOptions): Entity;
  /** Instantiate a registered prefab blueprint, returning the subtree root. */
  prefab(handle: PrefabHandle, options?: SpawnPrefabOptions): Entity;
  /** Engine-owned animation controls for a spawned (e.g. glTF) entity. */
  animation(entity: Entity): AnimationAccess;
}
