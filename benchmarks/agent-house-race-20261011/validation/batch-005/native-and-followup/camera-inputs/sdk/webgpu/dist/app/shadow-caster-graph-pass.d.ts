import type { CreateRenderPassAttachmentPlanResult, RenderPassAttachmentLoadOp, RenderPassAttachmentStoreOp } from "../render/passes/render-pass-attachments.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { ShadowPassAttachmentDescriptorReport } from "../shadows/shadow-pass-attachment-descriptor.js";
import type { ShadowDepthTextureResourceReport } from "../shadows/shadow-depth-texture-resource.js";
/**
 * One shadow caster render pass, resolved to a concrete depth view + caster draw
 * commands but NOT yet encoded. The engine encodes these into the shared forward
 * encoder as depth-only nodes the opaque pass reads.
 */
export interface ShadowCasterGraphPass {
    /** Unique handle id within the frame (e.g. the ShadowPassPlan passKey). */
    readonly key: string;
    /** The resolved GPU depth view to render into (cascade slice / cube face). */
    readonly depthView: unknown;
    readonly depthLoadOp: RenderPassAttachmentLoadOp;
    readonly depthStoreOp: RenderPassAttachmentStoreOp;
    readonly depthClearValue?: number;
    readonly width: number;
    readonly height: number;
    readonly depthFormat: string;
    /** Shadow caster draw commands for this pass (same RenderPassCommand union). */
    readonly commands: readonly RenderPassCommand[];
}
export interface CreateShadowCasterGraphPassesOptions {
    readonly passAttachments: ShadowPassAttachmentDescriptorReport;
    readonly depthTextureResources: ShadowDepthTextureResourceReport;
    readonly commandRecords: readonly {
        readonly passKey: string;
        readonly commands: readonly RenderPassCommand[];
    }[];
}
/**
 * Pair each planned shadow depth attachment with its caster commands (by passKey)
 * and resolve its live depth view — the bridge from the hand-rolled shadow
 * pipeline reports to the engine's `shadowCasterGraphPasses` input. Passes whose
 * depth view or commands cannot be resolved are dropped (the frame still renders;
 * the missing shadow simply is not folded), keeping this a pure planning step.
 */
export declare function createShadowCasterGraphPasses(options: CreateShadowCasterGraphPassesOptions): readonly ShadowCasterGraphPass[];
/**
 * Build a depth-only render-pass attachment plan for a shadow caster node.
 * `createRenderPassAttachmentPlan` requires at least one color target, so the
 * single-encoder graph builds the depth-only result directly (mirroring the legacy
 * shadow encoder assembly's `{ colorAttachments: [], depthStencilAttachment }`).
 */
export declare function buildShadowCasterDepthAttachmentPlan(pass: ShadowCasterGraphPass): CreateRenderPassAttachmentPlanResult;
//# sourceMappingURL=shadow-caster-graph-pass.d.ts.map