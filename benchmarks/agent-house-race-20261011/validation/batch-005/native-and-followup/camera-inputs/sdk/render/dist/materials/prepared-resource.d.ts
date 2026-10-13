import type { CreatePreparedMaterialResourceDescriptorOptions, CreatePreparedMaterialResourceDescriptorResult } from "./prepared-resource-types.js";
export type { CreatePreparedMaterialResourceDescriptorOptions, CreatePreparedMaterialResourceDescriptorResult, PreparedMaterialResourceDescriptor, PreparedMaterialResourceDiagnostic, PreparedMaterialTextureBindingResource, } from "./prepared-resource-types.js";
export declare function createPreparedMaterialResourceDescriptor(options: CreatePreparedMaterialResourceDescriptorOptions): CreatePreparedMaterialResourceDescriptorResult;
export declare function createUnlitPreparedMaterialResourceDescriptor(options: Omit<CreatePreparedMaterialResourceDescriptorOptions, "expectedMaterialFamily">): CreatePreparedMaterialResourceDescriptorResult;
export declare function createMatcapPreparedMaterialResourceDescriptor(options: Omit<CreatePreparedMaterialResourceDescriptorOptions, "expectedMaterialFamily">): CreatePreparedMaterialResourceDescriptorResult;
export declare function createStandardPreparedMaterialResourceDescriptor(options: Omit<CreatePreparedMaterialResourceDescriptorOptions, "expectedMaterialFamily">): CreatePreparedMaterialResourceDescriptorResult;
export declare function createDebugNormalPreparedMaterialResourceDescriptor(options: Omit<CreatePreparedMaterialResourceDescriptorOptions, "expectedMaterialFamily">): CreatePreparedMaterialResourceDescriptorResult;
export declare function preparedMaterialResourceKey(sourceMaterialKey: string, version: number): string;
export declare function preparedMaterialBindGroupResourceKey(input: {
    readonly sourceMaterialKey: string;
    readonly pipelineKey: string;
    readonly version: number;
}): string;
//# sourceMappingURL=prepared-resource.d.ts.map