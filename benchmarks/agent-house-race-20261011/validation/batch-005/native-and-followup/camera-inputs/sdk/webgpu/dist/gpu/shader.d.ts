export type WebGpuShaderDiagnosticSeverity = "error" | "warning" | "info";
export type WebGpuShaderFailureReason = "create-shader-module-unavailable" | "missing-entry-point" | "compilation-error";
export interface WebGpuShaderDiagnostic {
    readonly severity: WebGpuShaderDiagnosticSeverity;
    readonly message: string;
    readonly line?: number;
    readonly column?: number;
}
export interface WebGpuShaderModuleDescriptor {
    readonly label?: string;
    readonly code: string;
    readonly entryPoints?: readonly string[];
}
export interface WebGpuShaderCreateDescriptor {
    readonly label?: string;
    readonly code: string;
}
export interface WebGpuShaderModuleLike {
    compilationInfo?: () => Promise<{
        readonly messages: readonly WebGpuShaderCompilationMessageLike[];
    }>;
}
export interface WebGpuShaderCompilationMessageLike {
    readonly type?: string;
    readonly message: string;
    readonly lineNum?: number;
    readonly linePos?: number;
}
export interface WebGpuShaderDeviceLike {
    createShaderModule?: (descriptor: WebGpuShaderCreateDescriptor) => WebGpuShaderModuleLike;
}
export interface CreateWebGpuShaderModuleOptions {
    readonly device: WebGpuShaderDeviceLike;
    readonly descriptor: WebGpuShaderModuleDescriptor;
}
export interface WebGpuShaderModuleSuccess {
    readonly ok: true;
    readonly module: WebGpuShaderModuleLike;
    readonly diagnostics: readonly WebGpuShaderDiagnostic[];
}
export interface WebGpuShaderModuleFailure {
    readonly ok: false;
    readonly reason: WebGpuShaderFailureReason;
    readonly message: string;
    readonly diagnostics: readonly WebGpuShaderDiagnostic[];
}
export type WebGpuShaderModuleResult = WebGpuShaderModuleSuccess | WebGpuShaderModuleFailure;
export declare function createWebGpuShaderModule(options: CreateWebGpuShaderModuleOptions): Promise<WebGpuShaderModuleResult>;
//# sourceMappingURL=shader.d.ts.map