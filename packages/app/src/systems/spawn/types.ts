import type { CameraInput, LightInput } from "@aperture-engine/render";
import type {
  Entity,
  LocalTransformInput,
  MaterialHandle,
  MeshHandle,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import type { SystemGltfAssetHandle } from "../assets.js";

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

export interface StandardMaterialOptions {
  readonly baseColor?: Vec4Like;
  readonly roughness?: number;
  readonly metallic?: number;
  readonly label?: string;
}

export interface SpawnMeshOptions extends SpawnMetadata {
  readonly mesh: PrimitiveMeshDescriptor | MeshHandle;
  readonly material: StandardMaterialDescriptor | MaterialHandle;
  readonly transform?: SystemTransformInput;
}

export interface SpawnGltfOptions extends SpawnMetadata {
  readonly transform?: SystemTransformInput;
}

export interface SpawnCommands {
  camera(options?: SpawnCameraOptions): Entity;
  light(options?: SpawnLightOptions): Entity;
  mesh(options: SpawnMeshOptions): Entity;
  gltf(handle: SystemGltfAssetHandle, options?: SpawnGltfOptions): Entity;
}
