import type { ColliderInput, ExternalForceInput, ExternalImpulseInput, KinematicTargetInput, PhysicsCharacterControllerInput, PhysicsDebugInput, PhysicsJointInput, PhysicsMaterialInput, PhysicsVelocityInput, RigidBodyInput } from "@aperture-engine/physics";
import type { StandardMaterialPatch } from "@aperture-engine/render";
import type { BoxMeshDescriptorOptions, RoundedBoxMeshDescriptorOptions, CapsuleMeshDescriptorOptions, ConeMeshDescriptorOptions, CustomWgslMaterialDescriptor, CustomWgslSamplerBindingOptions, CustomWgslShaderDescriptor, CustomWgslTextureBindingOptions, CustomWgslUniformBindingOptions, CylinderMeshDescriptorOptions, LineListMeshDescriptorOptions, MaterialAppearancePresetName, PlaneMeshDescriptorOptions, PrimitiveMeshDescriptor, PhysicsSpawnDescriptor, SphereMeshDescriptorOptions, StandardMaterialDescriptor, StandardMaterialInputOptions, TorusMeshDescriptorOptions, TriangleListMeshDescriptorOptions, HeightfieldMeshDescriptorOptions, LatheMeshDescriptorOptions, ExtrudeMeshDescriptorOptions, ShaderAssetDescriptorInput, UnlitMaterialDescriptor, UnlitMaterialInputOptions } from "./types.js";
export declare const mesh: Readonly<{
    /** Closed indexed XY outline and holes extruded from z=0 along +Z. */
    extrude(options: ExtrudeMeshDescriptorOptions): PrimitiveMeshDescriptor;
    /** Full Y-axis revolution of explicit [radius, y] points, with flat normals. */
    lathe(options: LatheMeshDescriptorOptions): PrimitiveMeshDescriptor;
    /** Y-up terrain: heights[row][column] advances +Z by row and +X by column. */
    heightfield(options: HeightfieldMeshDescriptorOptions): PrimitiveMeshDescriptor;
    /** Custom triangles with flat face normals unless explicit normals are supplied. */
    triangleList(options: TriangleListMeshDescriptorOptions): PrimitiveMeshDescriptor;
    box(options?: BoxMeshDescriptorOptions): PrimitiveMeshDescriptor;
    /** Centered rounded box: positive halfExtents, fitting radius and 1–32 bevelSegments. */
    roundedBox(options?: RoundedBoxMeshDescriptorOptions): PrimitiveMeshDescriptor;
    sphere(options?: SphereMeshDescriptorOptions): PrimitiveMeshDescriptor;
    capsule(options?: CapsuleMeshDescriptorOptions): PrimitiveMeshDescriptor;
    plane(options?: PlaneMeshDescriptorOptions): PrimitiveMeshDescriptor;
    cylinder(options?: CylinderMeshDescriptorOptions): PrimitiveMeshDescriptor;
    cone(options?: ConeMeshDescriptorOptions): PrimitiveMeshDescriptor;
    /** A Y-up ring; reduce radial/tube segments for low-poly procedural parts. */
    torus(options?: TorusMeshDescriptorOptions): PrimitiveMeshDescriptor;
    /**
     * Native GPU line-list mesh. Positions are consumed in pairs unless indices
     * are provided; indexed line lists consume indices in pairs.
     */
    lineList(options: LineListMeshDescriptorOptions): PrimitiveMeshDescriptor;
}>;
export declare const material: Readonly<{
    standard(options?: StandardMaterialInputOptions): StandardMaterialDescriptor;
    unlit(options?: UnlitMaterialInputOptions): UnlitMaterialDescriptor;
    preset(name: MaterialAppearancePresetName, overrides?: StandardMaterialPatch): import("./types.js").MaterialAppearancePresetDescriptor;
    customWgsl(options: Omit<CustomWgslMaterialDescriptor, "kind">): CustomWgslMaterialDescriptor;
    uniform(name: string, options: CustomWgslUniformBindingOptions): Readonly<{
        label?: string;
        runtimeUniformKey?: string;
        values?: Readonly<Record<string, readonly number[] | import("@aperture-engine/render").JsonPrimitive>>;
        kind: "uniform-buffer";
        name: string;
        binding: number;
        visibility: import("@aperture-engine/render").CustomWgslShaderStage[];
        fields: Readonly<Record<string, import("@aperture-engine/render").CustomWgslUniformField>>;
    }>;
    texture(name: string, options: CustomWgslTextureBindingOptions): Readonly<{
        label?: string;
        kind: "texture";
        name: string;
        binding: number;
        visibility: import("@aperture-engine/render").CustomWgslShaderStage[];
        texture: import("@aperture-engine/simulation").TextureHandle;
    }>;
    sampler(name: string, options: CustomWgslSamplerBindingOptions): Readonly<{
        label?: string;
        kind: "sampler";
        name: string;
        binding: number;
        visibility: import("@aperture-engine/render").CustomWgslShaderStage[];
        sampler: import("@aperture-engine/simulation").SamplerHandle;
    }>;
}>;
export declare const shader: Readonly<{
    asset(input: ShaderAssetDescriptorInput): CustomWgslShaderDescriptor;
    inlineWgsl(code: string, options?: {
        readonly virtualPath?: string;
    }): CustomWgslShaderDescriptor;
}>;
export declare const physics: Readonly<{
    rigidBody(input?: RigidBodyInput): RigidBodyInput;
    collider(input?: ColliderInput): ColliderInput;
    velocity(input?: PhysicsVelocityInput): PhysicsVelocityInput;
    externalForce(input?: ExternalForceInput): ExternalForceInput;
    externalImpulse(input?: ExternalImpulseInput): ExternalImpulseInput;
    kinematicTarget(input?: KinematicTargetInput): KinematicTargetInput;
    characterController(input?: PhysicsCharacterControllerInput): PhysicsCharacterControllerInput;
    material(input?: PhysicsMaterialInput): PhysicsMaterialInput;
    joint(input?: PhysicsJointInput): PhysicsJointInput;
    debug(input?: PhysicsDebugInput): PhysicsDebugInput;
    body(input?: PhysicsSpawnDescriptor): PhysicsSpawnDescriptor;
}>;
//# sourceMappingURL=descriptors.d.ts.map