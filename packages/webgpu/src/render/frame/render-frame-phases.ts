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

export const RENDER_FRAME_PHASE_DESCRIPTORS: readonly RenderFramePhaseDescriptor[] =
  [
    {
      phase: "apply",
      summary:
        "Apply the latest render snapshot to the renderer-owned render world.",
      consumes: ["RenderSnapshot", "optional RenderSnapshotChangeSet"],
      produces: ["render world apply result"],
    },
    {
      phase: "prepare",
      summary:
        "Plan and apply snapshot resource bindings against prepared GPU resources.",
      consumes: ["render world", "prepared mesh/material resources"],
      produces: ["resource binding plan", "resource binding results"],
    },
    {
      phase: "queue",
      summary:
        "Build ready render-world draw packages from packed snapshot transforms.",
      consumes: ["draw readiness", "packed transforms"],
      produces: ["draw packages"],
    },
    {
      phase: "resolve",
      summary:
        "Resolve draw packages into draw descriptors, draw lists, and pass resources.",
      consumes: ["draw packages", "pipelines", "bind groups", "GPU resources"],
      produces: ["draw descriptors", "draw list", "resolved pass resources"],
    },
    {
      phase: "command",
      summary:
        "Encode resolved pass resources into a render-pass command plan.",
      consumes: ["resolved pass resources"],
      produces: ["render-pass commands"],
    },
    {
      phase: "submit",
      summary:
        "Report WebGPU command submission readiness for the encoded frame.",
      consumes: ["render-pass commands"],
      produces: ["GPU command submission"],
    },
  ];

export function describeRenderFramePhases(): readonly RenderFramePhaseDescriptor[] {
  return RENDER_FRAME_PHASE_DESCRIPTORS;
}
