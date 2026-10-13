import type { RenderPassAttachmentLoadOp, RenderPassAttachmentStoreOp, RenderPassColorAttachmentInput } from "../../render/passes/render-pass-attachments.js";
export type CurrentTextureViewDiagnosticCode = "currentTextureView.missingCurrentTexture" | "currentTextureView.missingTexture" | "currentTextureView.missingTextureView";
export interface CurrentTextureViewDiagnostic {
    readonly code: CurrentTextureViewDiagnosticCode;
    readonly message: string;
    readonly targetIndex?: number;
}
export interface CurrentTextureContextLike {
    getCurrentTexture?: () => CurrentTextureLike | null;
}
export interface CurrentTextureLike {
    createView?: () => unknown;
}
export interface CreateCurrentTextureColorTargetOptions {
    readonly context: CurrentTextureContextLike;
    readonly clearColor?: readonly number[];
    readonly loadOp?: RenderPassAttachmentLoadOp;
    readonly storeOp?: RenderPassAttachmentStoreOp;
}
export interface CreateOffscreenColorTargetOptions {
    readonly texture: CurrentTextureLike | null | undefined;
    readonly clearColor?: readonly number[];
    readonly loadOp?: RenderPassAttachmentLoadOp;
    readonly storeOp?: RenderPassAttachmentStoreOp;
}
export interface CreateOffscreenColorTargetsOptions {
    readonly textures: readonly (CurrentTextureLike | null | undefined)[];
    readonly clearColor?: readonly number[];
    readonly clearColors?: readonly (readonly number[] | undefined)[];
    readonly loadOp?: RenderPassAttachmentLoadOp;
    readonly loadOps?: readonly (RenderPassAttachmentLoadOp | undefined)[];
    readonly storeOp?: RenderPassAttachmentStoreOp;
    readonly storeOps?: readonly (RenderPassAttachmentStoreOp | undefined)[];
}
export interface CreateCurrentTextureColorTargetResult {
    readonly valid: boolean;
    readonly texture?: CurrentTextureLike | null;
    readonly target: RenderPassColorAttachmentInput | null;
    readonly diagnostics: readonly CurrentTextureViewDiagnostic[];
}
export interface CreateOffscreenColorTargetsResult {
    readonly valid: boolean;
    readonly textures: readonly (CurrentTextureLike | null)[];
    readonly targets: readonly RenderPassColorAttachmentInput[];
    readonly diagnostics: readonly CurrentTextureViewDiagnostic[];
}
export declare function createCurrentTextureColorTarget(options: CreateCurrentTextureColorTargetOptions): CreateCurrentTextureColorTargetResult;
export declare function createOffscreenColorTarget(options: CreateOffscreenColorTargetOptions): CreateCurrentTextureColorTargetResult;
export declare function createOffscreenColorTargets(options: CreateOffscreenColorTargetsOptions): CreateOffscreenColorTargetsResult;
//# sourceMappingURL=current-texture-view.d.ts.map