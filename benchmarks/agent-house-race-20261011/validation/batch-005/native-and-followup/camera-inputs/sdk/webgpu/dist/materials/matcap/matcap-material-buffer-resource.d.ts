import { type WebGpuBufferDeviceLike, type WebGpuBufferFailureReason } from "../../gpu/buffer.js";
import type { MatcapMaterialBufferDescriptorPlan } from "./matcap-material-buffer.js";
export type MatcapMaterialGpuBufferDiagnosticCode = "matcapMaterialGpuBuffer.nullDescriptorPlan" | "matcapMaterialGpuBuffer.creationFailed";
export interface MatcapMaterialGpuBufferDiagnostic {
    readonly code: MatcapMaterialGpuBufferDiagnosticCode;
    readonly message: string;
    readonly reason?: WebGpuBufferFailureReason;
    readonly resourceKey?: string;
}
export interface MatcapMaterialGpuBufferResource {
    readonly resourceKey: string;
    readonly uniformBuffer: unknown;
    readonly dependencies: MatcapMaterialBufferDescriptorPlan["dependencies"];
}
export interface CreateMatcapMaterialGpuBufferOptions {
    readonly device: WebGpuBufferDeviceLike;
    readonly plan: MatcapMaterialBufferDescriptorPlan | null;
}
export interface CreateMatcapMaterialGpuBufferResult {
    readonly valid: boolean;
    readonly resource: MatcapMaterialGpuBufferResource | null;
    readonly diagnostics: readonly MatcapMaterialGpuBufferDiagnostic[];
}
export declare function createMatcapMaterialGpuBuffer(options: CreateMatcapMaterialGpuBufferOptions): CreateMatcapMaterialGpuBufferResult;
//# sourceMappingURL=matcap-material-buffer-resource.d.ts.map