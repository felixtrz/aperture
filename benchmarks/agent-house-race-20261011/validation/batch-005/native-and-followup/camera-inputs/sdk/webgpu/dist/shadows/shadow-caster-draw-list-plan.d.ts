import type { MeshDrawPacket, ShadowRequestPacket } from "@aperture-engine/render";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";
export type ShadowCasterCullMode = "back" | "front" | "none";
export type ShadowCasterDrawListStatus = "ready" | "deferred" | "missing" | "not-required";
export type ShadowCasterDrawListMode = "ready" | "deferred";
export type ShadowCasterDrawListDiagnosticCode = "shadowCasterDrawList.missingPassPlan" | "shadowCasterDrawList.noCasters" | "shadowCasterDrawList.unsupportedAlphaBlendCaster" | "shadowCasterDrawList.unsupportedAlphaTestCaster" | "shadowCasterDrawList.commandEncodingDeferred";
export declare function isDepthOnlyShadowCasterDrawSupported(draw: Pick<MeshDrawPacket, "batchKey">): boolean;
export interface ShadowCasterDrawRecord {
    readonly renderId: number;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly meshLayoutKey: string;
    /**
     * Cull mode for rendering this caster into the depth map. three.js shadowSide
     * parity: single-sided casters render the opposite side by default;
     * double-sided casters stay "none".
     */
    readonly casterCullMode: ShadowCasterCullMode;
    readonly submesh: number;
    readonly vertexStart?: number;
    readonly vertexCount?: number;
    readonly indexStart?: number;
    readonly indexCount?: number;
    readonly layerMask: number;
    /** Index into `snapshot.bounds` for this caster's world bounds. */
    readonly boundsIndex: number;
    /** Float offset into `snapshot.transforms` for this caster's WORLD matrix (16 floats). */
    readonly worldTransformOffset: number;
}
export interface ShadowCasterDrawList {
    readonly shadowId: number;
    readonly lightId: number;
    readonly passKey: string;
    readonly casterLayerMask: number;
    readonly receiverLayerMask: number;
    readonly includedDrawCount: number;
    readonly skippedDrawCount: number;
    readonly commandEncoding: ShadowCasterDrawListMode;
    readonly draws: readonly ShadowCasterDrawRecord[];
}
export interface ShadowCasterDrawListDiagnostic {
    readonly code: ShadowCasterDrawListDiagnosticCode;
    readonly severity: "warning" | "error";
    readonly shadowId: number;
    readonly lightId: number;
    readonly renderId?: number;
    readonly passKey?: string;
    readonly meshKey?: string;
    readonly message: string;
}
export interface ShadowCasterDrawListPlanReport {
    readonly ready: boolean;
    readonly status: ShadowCasterDrawListStatus;
    readonly requestCount: number;
    readonly meshDrawCount: number;
    readonly listCount: number;
    readonly includedDrawCount: number;
    readonly skippedDrawCount: number;
    readonly sections: {
        readonly shadowRequests: boolean;
        readonly passPlans: boolean;
        readonly casterFiltering: boolean;
        readonly commandEncoding: boolean;
    };
    readonly lists: readonly ShadowCasterDrawList[];
    readonly diagnostics: readonly ShadowCasterDrawListDiagnostic[];
}
export type ShadowCasterDrawListPlanReportJsonValue = ShadowCasterDrawListPlanReport;
export interface ShadowCasterDrawListPlanInput {
    readonly shadowRequests: readonly ShadowRequestPacket[];
    readonly meshDraws: readonly MeshDrawPacket[];
    readonly shadowPassPlan: ShadowPassPlanReport;
    readonly commandEncoding?: ShadowCasterDrawListMode;
}
export declare function createShadowCasterDrawListPlanReport(input: ShadowCasterDrawListPlanInput): ShadowCasterDrawListPlanReport;
export declare function shadowCasterDrawListPlanReportToJsonValue(report: ShadowCasterDrawListPlanReport): ShadowCasterDrawListPlanReportJsonValue;
export declare function shadowCasterDrawListPlanReportToJson(report: ShadowCasterDrawListPlanReport): string;
//# sourceMappingURL=shadow-caster-draw-list-plan.d.ts.map