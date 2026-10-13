export declare const RENDER_FRAME_PHASES: readonly ["apply", "prepare", "queue", "resolve", "command", "submit"];
export type RenderFramePhase = (typeof RENDER_FRAME_PHASES)[number];
export type RenderFramePhaseCounts = Readonly<Record<string, number>>;
export interface RenderFramePhaseDescriptor {
    readonly phase: RenderFramePhase;
    readonly summary: string;
    readonly consumes: readonly string[];
    readonly produces: readonly string[];
}
export interface RenderFramePhaseReport<Diagnostic> {
    readonly phase: RenderFramePhase;
    readonly ready: boolean;
    readonly counts: RenderFramePhaseCounts;
    readonly diagnostics: readonly Diagnostic[];
}
export type RenderFramePhaseReports<Diagnostic> = {
    readonly [Phase in RenderFramePhase]: RenderFramePhaseReport<Diagnostic>;
};
export declare const RENDER_FRAME_PHASE_DESCRIPTORS: readonly RenderFramePhaseDescriptor[];
export declare function describeRenderFramePhases(): readonly RenderFramePhaseDescriptor[];
//# sourceMappingURL=render-frame-phases.d.ts.map