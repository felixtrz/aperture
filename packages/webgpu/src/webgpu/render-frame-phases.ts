export const RENDER_FRAME_PHASES = [
  "apply",
  "prepare",
  "queue",
  "resolve",
  "command",
  "submit",
] as const;

export type RenderFramePhase = (typeof RENDER_FRAME_PHASES)[number];

export type RenderFramePhaseCounts = Readonly<Record<string, number>>;

export interface RenderFramePhaseReport<Diagnostic> {
  readonly phase: RenderFramePhase;
  readonly ready: boolean;
  readonly counts: RenderFramePhaseCounts;
  readonly diagnostics: readonly Diagnostic[];
}

export type RenderFramePhaseReports<Diagnostic> = {
  readonly [Phase in RenderFramePhase]: RenderFramePhaseReport<Diagnostic>;
};
