export type RenderPassAttachmentLoadOp = "clear" | "load";
export type RenderPassAttachmentStoreOp = "store" | "discard";
export type RenderPassAttachmentDiagnosticCode = "renderPassAttachment.missingColorTarget" | "renderPassAttachment.invalidClearColor" | "renderPassAttachment.invalidDepthClear";
export interface RenderPassAttachmentDiagnostic {
    readonly code: RenderPassAttachmentDiagnosticCode;
    readonly message: string;
    readonly targetIndex?: number;
}
export type RenderPassClearColorTuple = readonly [
    number,
    number,
    number,
    number
];
export interface RenderPassColorAttachmentInput {
    readonly view: unknown | null;
    readonly resolveTarget?: unknown | null;
    readonly clearColor?: readonly number[];
    readonly loadOp?: RenderPassAttachmentLoadOp;
    readonly storeOp?: RenderPassAttachmentStoreOp;
}
export interface RenderPassDepthAttachmentInput {
    readonly view: unknown | null;
    readonly depthClearValue?: number;
    readonly depthLoadOp?: RenderPassAttachmentLoadOp;
    readonly depthStoreOp?: RenderPassAttachmentStoreOp;
    readonly depthReadOnly?: boolean;
}
export interface PlannedRenderPassColorAttachment {
    readonly view: unknown;
    readonly clearValue?: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
    };
    readonly resolveTarget?: unknown;
    readonly loadOp: RenderPassAttachmentLoadOp;
    readonly storeOp: RenderPassAttachmentStoreOp;
}
export interface PlannedRenderPassDepthStencilAttachment {
    readonly view: unknown;
    readonly depthClearValue?: number;
    readonly depthLoadOp: RenderPassAttachmentLoadOp;
    readonly depthStoreOp: RenderPassAttachmentStoreOp;
    readonly depthReadOnly?: boolean;
}
export interface RenderPassAttachmentDescriptorPlan {
    readonly colorAttachments: readonly PlannedRenderPassColorAttachment[];
    readonly depthStencilAttachment?: PlannedRenderPassDepthStencilAttachment;
    readonly occlusionQuerySet?: unknown;
}
export interface CreateRenderPassAttachmentPlanOptions {
    readonly colorTargets: readonly RenderPassColorAttachmentInput[];
    readonly depthTarget?: RenderPassDepthAttachmentInput | null;
    readonly occlusionQuerySet?: unknown;
}
export interface CreateRenderPassAttachmentPlanResult {
    readonly valid: boolean;
    readonly plan: RenderPassAttachmentDescriptorPlan | null;
    readonly diagnostics: readonly RenderPassAttachmentDiagnostic[];
}
export declare function createRenderPassAttachmentPlan(options: CreateRenderPassAttachmentPlanOptions): CreateRenderPassAttachmentPlanResult;
//# sourceMappingURL=render-pass-attachments.d.ts.map