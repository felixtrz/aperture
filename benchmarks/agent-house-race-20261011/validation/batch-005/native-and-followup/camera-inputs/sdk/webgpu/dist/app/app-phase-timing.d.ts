export declare const WEBGPU_APP_RENDER_PHASES: readonly ["extract", "collect", "prepare", "queue", "sort", "submit"];
export type WebGpuAppRenderPhaseName = (typeof WEBGPU_APP_RENDER_PHASES)[number];
export declare const WEBGPU_APP_RENDER_PHASE_DETAILS: readonly ["prepareMain", "prepareMainMotionVectors", "prepareMainViews", "prepareMainTransforms", "prepareMainPreviousTransforms", "prepareMainInstanceTints", "prepareMainAreaLights", "prepareMainTransmission", "prepareMainAutoShadow", "prepareMainResources", "prepareOverlays", "prepareOverlayFeatures", "prepareOverlaySprites", "prepareOverlayText", "prepareOverlayParticles", "prepareOverlayUi"];
export type WebGpuAppRenderPhaseDetailName = (typeof WEBGPU_APP_RENDER_PHASE_DETAILS)[number];
export type WebGpuAppRenderPhaseTimingSamples = Partial<Record<WebGpuAppRenderPhaseName, number>>;
export interface WebGpuAppRenderPhaseTimingHistoryEntry {
    readonly phase: WebGpuAppRenderPhaseName;
    readonly latestMilliseconds: number;
    readonly averageMilliseconds: number;
    readonly minimumMilliseconds: number;
    readonly maximumMilliseconds: number;
    readonly sampleCount: number;
}
export interface WebGpuAppRenderPhaseTimingDetailEntry {
    readonly detail: WebGpuAppRenderPhaseDetailName;
    readonly latestMilliseconds: number;
    readonly averageMilliseconds: number;
    readonly minimumMilliseconds: number;
    readonly maximumMilliseconds: number;
    readonly sampleCount: number;
}
export interface WebGpuAppRenderPhaseTimingReport {
    readonly ready: boolean;
    readonly frame: number;
    readonly sampleWindow: number;
    readonly totalMilliseconds: number;
    readonly phases: readonly WebGpuAppRenderPhaseTimingHistoryEntry[];
    readonly details: readonly WebGpuAppRenderPhaseTimingDetailEntry[];
}
export interface WebGpuAppRenderPhaseTimingHistory {
    readonly sampleWindow: number;
    readonly samplesByPhase: ReadonlyMap<WebGpuAppRenderPhaseName, number[]>;
    readonly samplesByDetail: ReadonlyMap<WebGpuAppRenderPhaseDetailName, number[]>;
}
export interface WebGpuAppRenderPhaseTimer {
    add(phase: WebGpuAppRenderPhaseName, milliseconds: number): void;
    start(phase: WebGpuAppRenderPhaseName): void;
    finish(phase: WebGpuAppRenderPhaseName): void;
    addDetail(detail: WebGpuAppRenderPhaseDetailName, milliseconds: number): void;
    startDetail(detail: WebGpuAppRenderPhaseDetailName): void;
    finishDetail(detail: WebGpuAppRenderPhaseDetailName): void;
    report(history: WebGpuAppRenderPhaseTimingHistory, frame: number): WebGpuAppRenderPhaseTimingReport;
}
export declare function createWebGpuAppRenderPhaseTimingHistory(sampleWindow?: number): WebGpuAppRenderPhaseTimingHistory;
export declare function createWebGpuAppRenderPhaseTimer(externalSamples: WebGpuAppRenderPhaseTimingSamples | undefined): WebGpuAppRenderPhaseTimer;
//# sourceMappingURL=app-phase-timing.d.ts.map