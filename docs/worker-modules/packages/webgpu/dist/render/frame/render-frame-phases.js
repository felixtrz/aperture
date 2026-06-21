export const RENDER_FRAME_PHASES = [
    "apply",
    "prepare",
    "queue",
    "resolve",
    "command",
    "submit",
];
export const RENDER_FRAME_PHASE_DESCRIPTORS = [
    {
        phase: "apply",
        summary: "Apply the latest render snapshot to the renderer-owned render world.",
        consumes: ["RenderSnapshot", "optional RenderSnapshotChangeSet"],
        produces: ["render world apply result"],
    },
    {
        phase: "prepare",
        summary: "Plan and apply snapshot resource bindings against prepared GPU resources.",
        consumes: ["render world", "prepared mesh/material resources"],
        produces: ["resource binding plan", "resource binding results"],
    },
    {
        phase: "queue",
        summary: "Build ready render-world draw packages from packed snapshot transforms.",
        consumes: ["draw readiness", "packed transforms"],
        produces: ["draw packages"],
    },
    {
        phase: "resolve",
        summary: "Resolve draw packages into draw descriptors, draw lists, and pass resources.",
        consumes: ["draw packages", "pipelines", "bind groups", "GPU resources"],
        produces: ["draw descriptors", "draw list", "resolved pass resources"],
    },
    {
        phase: "command",
        summary: "Encode resolved pass resources into a render-pass command plan.",
        consumes: ["resolved pass resources"],
        produces: ["render-pass commands"],
    },
    {
        phase: "submit",
        summary: "Report WebGPU command submission readiness for the encoded frame.",
        consumes: ["render-pass commands"],
        produces: ["GPU command submission"],
    },
];
export function describeRenderFramePhases() {
    return RENDER_FRAME_PHASE_DESCRIPTORS;
}
//# sourceMappingURL=render-frame-phases.js.map