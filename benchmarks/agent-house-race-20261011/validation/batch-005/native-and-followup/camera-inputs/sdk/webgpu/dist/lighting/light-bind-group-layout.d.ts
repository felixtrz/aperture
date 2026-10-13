import type { WebGpuBindGroupLayoutDescriptor, WebGpuBindGroupLayoutEntryDescriptor, WebGpuBindGroupLayoutDeviceLike } from "../gpu/bind-group-layout-cache.js";
export declare const DEFAULT_LIGHT_BIND_GROUP = 3;
export declare const DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY = 2;
export type LightBindGroupLayoutDiagnosticCode = "lightBindGroupLayout.missingDeviceSupport" | "lightBindGroupLayout.creationFailed";
export interface LightBindGroupLayoutDiagnostic {
    readonly code: LightBindGroupLayoutDiagnosticCode;
    readonly message: string;
    readonly layoutKey?: string;
}
export interface CreateLightBindGroupLayoutDescriptorOptions {
    readonly group?: number;
    readonly label?: string;
    readonly visibility?: number;
    readonly transmissionSceneColor?: boolean;
    readonly clusteredLocalLights?: boolean;
    readonly clusteredLocalLightCookies?: boolean;
    readonly clusteredLocalLightCookieTextureViewDimension?: "2d" | "2d-array" | "cube";
}
export interface CreateLightBindGroupLayoutResourceOptions extends CreateLightBindGroupLayoutDescriptorOptions {
    readonly device: WebGpuBindGroupLayoutDeviceLike;
    readonly layoutKey?: string;
}
export interface LightBindGroupLayoutResource {
    readonly group: number;
    readonly layoutKey: string;
    readonly layout: unknown;
    readonly descriptor: WebGpuBindGroupLayoutDescriptor;
}
export interface CreateLightBindGroupLayoutResourceResult {
    readonly valid: boolean;
    readonly resource: LightBindGroupLayoutResource | null;
    readonly diagnostics: readonly LightBindGroupLayoutDiagnostic[];
}
export declare function lightBindGroupLayoutResourceKey(group?: number): string;
export declare function createLightBindGroupLayoutDescriptor(options?: CreateLightBindGroupLayoutDescriptorOptions): WebGpuBindGroupLayoutDescriptor;
export declare function appendClusteredLocalLightLayoutEntries(entries: WebGpuBindGroupLayoutEntryDescriptor[], visibility: number, enabled: boolean, cookiesEnabled?: boolean, cookieTextureViewDimension?: "2d" | "2d-array" | "cube", cookieMatrixBufferEnabled?: boolean): void;
export declare function createLightBindGroupLayoutResource(options: CreateLightBindGroupLayoutResourceOptions): CreateLightBindGroupLayoutResourceResult;
//# sourceMappingURL=light-bind-group-layout.d.ts.map