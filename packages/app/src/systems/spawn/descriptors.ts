import type {
  ColliderInput,
  ExternalForceInput,
  ExternalImpulseInput,
  KinematicTargetInput,
  PhysicsCharacterControllerInput,
  PhysicsDebugInput,
  PhysicsJointInput,
  PhysicsMaterialInput,
  PhysicsVelocityInput,
  RigidBodyInput,
} from "@aperture-engine/physics";
import type { ShaderHandle, Vec3Like } from "@aperture-engine/simulation";
import type {
  CustomWgslMaterialDescriptor,
  CustomWgslSamplerBindingOptions,
  CustomWgslShaderDescriptor,
  CustomWgslTextureBindingOptions,
  CustomWgslUniformBindingOptions,
  PrimitiveMeshDescriptor,
  PhysicsSpawnDescriptor,
  StandardMaterialDescriptor,
  StandardMaterialOptions,
  ShaderAssetDescriptorInput,
} from "./types.js";

export const mesh = Object.freeze({
  box(
    options: {
      readonly size?: number | Vec3Like;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  sphere(
    options: {
      readonly radius?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(
    options: {
      readonly size?: number | readonly [number, number];
      readonly subdivisions?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
});

export const material = Object.freeze({
  standard(options: StandardMaterialOptions = {}): StandardMaterialDescriptor {
    return Object.freeze({ kind: "standard", options: { ...options } });
  },
  customWgsl(
    options: Omit<CustomWgslMaterialDescriptor, "kind">,
  ): CustomWgslMaterialDescriptor {
    return Object.freeze({
      kind: "custom-wgsl",
      ...options,
      bindings: [...(options.bindings ?? [])],
      dependencies: [...(options.dependencies ?? [])],
    });
  },
  uniform(name: string, options: CustomWgslUniformBindingOptions) {
    return Object.freeze({
      kind: "uniform-buffer" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      fields: options.fields,
      ...(options.values === undefined ? {} : { values: options.values }),
      ...(options.runtimeUniformKey === undefined
        ? {}
        : { runtimeUniformKey: options.runtimeUniformKey }),
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  texture(name: string, options: CustomWgslTextureBindingOptions) {
    return Object.freeze({
      kind: "texture" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      texture: options.texture,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  sampler(name: string, options: CustomWgslSamplerBindingOptions) {
    return Object.freeze({
      kind: "sampler" as const,
      name,
      binding: options.binding,
      visibility: [...options.visibility],
      sampler: options.sampler,
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
});

export const shader = Object.freeze({
  asset(input: ShaderAssetDescriptorInput): CustomWgslShaderDescriptor {
    return Object.freeze({
      kind: "shader-asset",
      handle: readShaderHandle(input),
    });
  },
  inlineWgsl(
    code: string,
    options: { readonly virtualPath?: string } = {},
  ): CustomWgslShaderDescriptor {
    return Object.freeze({
      kind: "inline-wgsl",
      code,
      ...(options.virtualPath === undefined
        ? {}
        : { virtualPath: options.virtualPath }),
    });
  },
});

export const physics = Object.freeze({
  rigidBody(input: RigidBodyInput = {}): RigidBodyInput {
    return Object.freeze({ ...input });
  },
  collider(input: ColliderInput = {}): ColliderInput {
    return Object.freeze({ ...input });
  },
  velocity(input: PhysicsVelocityInput = {}): PhysicsVelocityInput {
    return Object.freeze({ ...input });
  },
  externalForce(input: ExternalForceInput = {}): ExternalForceInput {
    return Object.freeze({ ...input });
  },
  externalImpulse(input: ExternalImpulseInput = {}): ExternalImpulseInput {
    return Object.freeze({ ...input });
  },
  kinematicTarget(input: KinematicTargetInput = {}): KinematicTargetInput {
    return Object.freeze({ ...input });
  },
  characterController(
    input: PhysicsCharacterControllerInput = {},
  ): PhysicsCharacterControllerInput {
    return Object.freeze({ ...input });
  },
  material(input: PhysicsMaterialInput = {}): PhysicsMaterialInput {
    return Object.freeze({ ...input });
  },
  joint(input: PhysicsJointInput = {}): PhysicsJointInput {
    return Object.freeze({ ...input });
  },
  debug(input: PhysicsDebugInput = {}): PhysicsDebugInput {
    return Object.freeze({ ...input });
  },
  body(input: PhysicsSpawnDescriptor = {}): PhysicsSpawnDescriptor {
    return Object.freeze({ ...input });
  },
});

function descriptor(
  kind: PrimitiveMeshDescriptor["kind"],
  options: Record<string, unknown>,
): PrimitiveMeshDescriptor {
  return Object.freeze({ kind, options: { ...options } });
}

function readShaderHandle(input: ShaderAssetDescriptorInput): ShaderHandle {
  if ("renderHandle" in input) {
    return input.renderHandle;
  }

  return input;
}
