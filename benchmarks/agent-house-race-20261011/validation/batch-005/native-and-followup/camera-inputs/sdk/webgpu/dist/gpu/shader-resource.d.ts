import { type WebGpuShaderDeviceLike, type WebGpuShaderFailureReason, type WebGpuShaderModuleDescriptor, type WebGpuShaderDiagnostic } from "./shader.js";
export type ShaderModuleResourceDiagnosticCode = "shaderResource.nullDescriptor" | "shaderResource.creationFailed" | "shaderResource.compilationDiagnostic";
export interface ShaderModuleResourceDiagnostic {
    readonly code: ShaderModuleResourceDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuShaderFailureReason;
    readonly severity?: WebGpuShaderDiagnostic["severity"];
}
export interface ShaderModuleResource {
    readonly resourceKey: string;
    readonly module: unknown;
    readonly entryPoints: readonly string[];
}
export interface CreateShaderModuleResourceOptions {
    readonly device: WebGpuShaderDeviceLike;
    readonly descriptor: WebGpuShaderModuleDescriptor | null;
}
export interface CreateShaderModuleResourceResult {
    readonly valid: boolean;
    readonly resource: ShaderModuleResource | null;
    readonly diagnostics: readonly ShaderModuleResourceDiagnostic[];
}
export declare function createShaderModuleResource(options: CreateShaderModuleResourceOptions): Promise<CreateShaderModuleResourceResult>;
//# sourceMappingURL=shader-resource.d.ts.map