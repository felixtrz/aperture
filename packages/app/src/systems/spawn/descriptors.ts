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
import type { ShaderHandle } from "@aperture-engine/simulation";
import type {
  BoxMeshDescriptorOptions,
  CapsuleMeshDescriptorOptions,
  CircleMeshDescriptorOptions,
  ConeMeshDescriptorOptions,
  CustomWgslMaterialDescriptor,
  CustomWgslSamplerBindingOptions,
  CustomWgslShaderDescriptor,
  CustomWgslStorageBindingOptions,
  CustomWgslTextureBindingOptions,
  CustomWgslUniformBindingOptions,
  CylinderMeshDescriptorOptions,
  LineListMeshDescriptorOptions,
  PlaneMeshDescriptorOptions,
  PlatonicSolidMeshDescriptorOptions,
  PrimitiveMeshDescriptor,
  PhysicsSpawnDescriptor,
  RingMeshDescriptorOptions,
  RoundedBoxMeshDescriptorOptions,
  SphereMeshDescriptorOptions,
  StandardMaterialDescriptor,
  StandardMaterialOptions,
  ShaderAssetDescriptorInput,
  TorusKnotMeshDescriptorOptions,
  TorusMeshDescriptorOptions,
  UnlitMaterialDescriptor,
  UnlitMaterialOptions,
} from "./types.js";

export const mesh = Object.freeze({
  box(options: BoxMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  sphere(options: SphereMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(options: CapsuleMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(options: PlaneMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: CylinderMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(options: ConeMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
  /** Flat disc in the XY plane facing +Z (three.js `CircleGeometry`). */
  circle(options: CircleMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("circle", options);
  },
  /** Annulus in the XY plane facing +Z (three.js `RingGeometry`). */
  ring(options: RingMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("ring", options);
  },
  /** Torus (three.js `TorusGeometry`). */
  torus(options: TorusMeshDescriptorOptions = {}): PrimitiveMeshDescriptor {
    return descriptor("torus", options);
  },
  /** Torus knot (three.js `TorusKnotGeometry`). */
  torusKnot(
    options: TorusKnotMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("torus-knot", options);
  },
  /** Tetrahedron via the shared polyhedron builder. */
  tetrahedron(
    options: PlatonicSolidMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("tetrahedron", options);
  },
  /** Octahedron via the shared polyhedron builder. */
  octahedron(
    options: PlatonicSolidMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("octahedron", options);
  },
  /** Icosahedron via the shared polyhedron builder. */
  icosahedron(
    options: PlatonicSolidMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("icosahedron", options);
  },
  /** Dodecahedron via the shared polyhedron builder. */
  dodecahedron(
    options: PlatonicSolidMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("dodecahedron", options);
  },
  /** Box with rounded edges/corners (three.js `RoundedBoxGeometry`). */
  roundedBox(
    options: RoundedBoxMeshDescriptorOptions = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("rounded-box", options);
  },
  /**
   * Native GPU line-list mesh. Positions are consumed in pairs unless indices
   * are provided; indexed line lists consume indices in pairs.
   */
  lineList(options: LineListMeshDescriptorOptions): PrimitiveMeshDescriptor {
    return descriptor("line-list", options);
  },
});

export const material = Object.freeze({
  standard(options: StandardMaterialOptions = {}): StandardMaterialDescriptor {
    return Object.freeze({ kind: "standard", options: { ...options } });
  },
  unlit(options: UnlitMaterialOptions = {}): UnlitMaterialDescriptor {
    return Object.freeze({ kind: "unlit", options: { ...options } });
  },
  customWgsl(
    options: Omit<CustomWgslMaterialDescriptor, "kind">,
  ): CustomWgslMaterialDescriptor {
    return Object.freeze({
      kind: "custom-wgsl",
      ...options,
      bindings: [...(options.bindings ?? [])],
      // Leave dependencies undefined unless explicitly provided so the asset
      // factory derives them from the shader ref and binding declarations
      // (texture/sampler/storage-buffer handles).
      ...(options.dependencies === undefined
        ? {}
        : { dependencies: [...options.dependencies] }),
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
      // B4: a source-backed texture (scene-depth) carries no handle.
      ...(options.texture === undefined ? {} : { texture: options.texture }),
      ...(options.source === undefined ? {} : { source: options.source }),
      ...(options.sampleType === undefined
        ? {}
        : { sampleType: options.sampleType }),
      ...(options.viewDimension === undefined
        ? {}
        : { viewDimension: options.viewDimension }),
      ...(options.multisampled === undefined
        ? {}
        : { multisampled: options.multisampled }),
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
      ...(options.samplerType === undefined
        ? {}
        : { samplerType: options.samplerType }),
      ...(options.label === undefined ? {} : { label: options.label }),
    });
  },
  /**
   * Read-only storage-buffer binding backed by a renderer-independent
   * `BufferAsset` handle (register one with `this.buffers.register(...)`).
   * Declare `runtimeBufferKey` to stream element updates each frame via
   * `this.spawn.runtimeBuffer(...)` without pipeline rebuilds.
   */
  storage(name: string, options: CustomWgslStorageBindingOptions) {
    return Object.freeze({
      kind: "storage-buffer" as const,
      name,
      binding: options.binding,
      visibility: [...(options.visibility ?? ["vertex", "fragment"])],
      buffer: options.buffer,
      ...(options.runtimeBufferKey === undefined
        ? {}
        : { runtimeBufferKey: options.runtimeBufferKey }),
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
  kind: "box",
  options: BoxMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "box" }>;
function descriptor(
  kind: "sphere",
  options: SphereMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "sphere" }>;
function descriptor(
  kind: "capsule",
  options: CapsuleMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "capsule" }>;
function descriptor(
  kind: "plane",
  options: PlaneMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "plane" }>;
function descriptor(
  kind: "cylinder",
  options: CylinderMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "cylinder" }>;
function descriptor(
  kind: "cone",
  options: ConeMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "cone" }>;
function descriptor(
  kind: "circle",
  options: CircleMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "circle" }>;
function descriptor(
  kind: "ring",
  options: RingMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "ring" }>;
function descriptor(
  kind: "torus",
  options: TorusMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "torus" }>;
function descriptor(
  kind: "torus-knot",
  options: TorusKnotMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "torus-knot" }>;
function descriptor(
  kind: "tetrahedron",
  options: PlatonicSolidMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "tetrahedron" }>;
function descriptor(
  kind: "octahedron",
  options: PlatonicSolidMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "octahedron" }>;
function descriptor(
  kind: "icosahedron",
  options: PlatonicSolidMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "icosahedron" }>;
function descriptor(
  kind: "dodecahedron",
  options: PlatonicSolidMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "dodecahedron" }>;
function descriptor(
  kind: "rounded-box",
  options: RoundedBoxMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "rounded-box" }>;
function descriptor(
  kind: "line-list",
  options: LineListMeshDescriptorOptions,
): Extract<PrimitiveMeshDescriptor, { readonly kind: "line-list" }>;
function descriptor(
  kind: PrimitiveMeshDescriptor["kind"],
  options: object,
): PrimitiveMeshDescriptor {
  return Object.freeze({
    kind,
    options: { ...options },
  }) as PrimitiveMeshDescriptor;
}

function readShaderHandle(input: ShaderAssetDescriptorInput): ShaderHandle {
  if ("renderHandle" in input) {
    return input.renderHandle;
  }

  return input;
}
