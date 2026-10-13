import type { ShadowCasterExecutableMeshResourceView } from "./shadow-caster-command-record-plan.js";
import type { ShadowCasterPreparedMeshResourceView } from "./shadow-caster-frame-resource-readiness.js";
export interface ShadowCasterPreparedMeshFacadeEntryLike {
    readonly assetKey: string;
    readonly sourceVersion?: number;
    readonly label: string;
    readonly meshResourceKey?: string;
}
export interface ShadowCasterMeshGpuResourceLike {
    readonly resourceKey: string;
    readonly vertexBuffers: readonly ShadowCasterMeshGpuVertexBufferLike[];
    readonly indexBuffer?: ShadowCasterMeshGpuIndexBufferLike | null;
}
export interface ShadowCasterMeshGpuVertexBufferLike {
    readonly resourceKey: string;
    readonly buffer?: unknown;
    readonly vertexCount?: number;
}
export interface ShadowCasterMeshGpuIndexBufferLike {
    readonly resourceKey: string;
    readonly buffer?: unknown;
    readonly format?: string;
    readonly indexCount?: number;
}
export interface ShadowCasterPreparedMeshSourceLike {
    readonly resources?: {
        readonly resources?: {
            readonly meshResources?: readonly ShadowCasterMeshGpuResourceLike[];
        };
    };
    readonly resourceReuse?: {
        readonly preparedMeshFacade?: {
            readonly entries?: readonly ShadowCasterPreparedMeshFacadeEntryLike[];
        };
    };
}
export interface ShadowCasterMeshViews {
    readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
    readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
}
export declare function createShadowCasterMeshViewsFromAppReport(report: ShadowCasterPreparedMeshSourceLike): ShadowCasterMeshViews;
export declare function createShadowCasterPreparedMeshViews(report: ShadowCasterPreparedMeshSourceLike): readonly ShadowCasterPreparedMeshResourceView[];
export declare function createShadowCasterExecutableMeshViews(report: ShadowCasterPreparedMeshSourceLike): readonly ShadowCasterExecutableMeshResourceView[];
//# sourceMappingURL=render-shadow-frame-caster-meshes.d.ts.map