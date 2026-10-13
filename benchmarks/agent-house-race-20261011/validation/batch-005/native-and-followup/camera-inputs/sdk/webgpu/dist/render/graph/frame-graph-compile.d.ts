import type { FrameGraph, PassNode } from "./frame-graph.js";
export type FrameGraphLoadOp = "clear" | "load" | "none";
export type FrameGraphStoreOp = "store" | "discard" | "none";
export type FrameGraphWriteStoreOp = "store" | "discard";
export type FrameGraphCompileDiagnosticCode = "frameGraph.cyclicDependency" | "frameGraph.duplicateNodeName" | "frameGraph.unknownReadHandle" | "frameGraph.unknownWriteHandle";
export interface FrameGraphCompileDiagnostic {
    readonly code: FrameGraphCompileDiagnosticCode;
    readonly message: string;
}
export interface CompiledPassLoadStoreOps {
    readonly colorLoadOp: FrameGraphLoadOp;
    readonly colorStoreOp: FrameGraphStoreOp;
    readonly depthLoadOp: FrameGraphLoadOp;
    readonly depthStoreOp: FrameGraphStoreOp;
    /** Store decision per node.writes entry, in declaration order. */
    readonly writeStoreOps: readonly FrameGraphWriteStoreOp[];
}
export interface FrameGraphAliasingAssignment {
    readonly handle: string;
    readonly slot: number;
    /** Id of the handle whose physical slot this handle reused, else null. */
    readonly aliasedFrom: string | null;
}
export interface FrameGraphCompilePassReportJsonValue {
    readonly name: string;
    readonly kind: "render" | "compute";
    readonly reads: readonly string[];
    readonly writes: readonly string[];
    readonly colorLoadOp: FrameGraphLoadOp;
    readonly depthLoadOp: FrameGraphLoadOp;
    readonly storeOps: readonly FrameGraphWriteStoreOp[];
    readonly aliasedFrom: string | null;
}
export interface FrameGraphCompileReportJsonValue {
    readonly ok: boolean;
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly order: readonly string[];
    readonly passes: readonly FrameGraphCompilePassReportJsonValue[];
    readonly cycles: readonly (readonly string[])[];
    readonly diagnostics: readonly FrameGraphCompileDiagnostic[];
}
export interface CompiledFrameGraph {
    readonly ok: boolean;
    readonly orderedNodes: readonly PassNode[];
    readonly perNodeLoadStoreOps: ReadonlyMap<string, CompiledPassLoadStoreOps>;
    /**
     * Liveness-based transient aliasing assignments. ANALYSIS ONLY (audit L15): the
     * executor does NOT consume these — every transient still allocates its own
     * physical texture, so there is no memory aliasing yet. This report exposes which
     * transients COULD share memory; realizing the saving requires a shared transient
     * texture pool keyed by descriptor+slot (tracked follow-up).
     */
    readonly aliasing: readonly FrameGraphAliasingAssignment[];
    readonly diagnostics: readonly FrameGraphCompileDiagnostic[];
    readonly report: FrameGraphCompileReportJsonValue;
}
export declare function compileFrameGraph(graph: FrameGraph): CompiledFrameGraph;
//# sourceMappingURL=frame-graph-compile.d.ts.map