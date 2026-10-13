// M3-T5: fold shadow caster passes into the single frame encoder.
//
// Today the shadow examples hand-roll their caster pipeline and submit their OWN
// command buffer, then pass the engine only the pre-baked receiver resources. To
// bring the caster passes into the SAME GPUCommandEncoder as the forward (opaque)
// pass, a caller hands the engine a list of `ShadowCasterGraphPass` (one per
// directional cascade / point face / spot). `assembleWebGpuAppFrameBoundaries`
// then registers each as a DEPTH-ONLY FrameGraph render node the forward node
// reads, so the compiler orders shadows first and one encoder/one submit covers
// shadows + opaque. The data here is encoder-agnostic — it never touches a device.

import type {
  CreateRenderPassAttachmentPlanResult,
  PlannedRenderPassDepthStencilAttachment,
  RenderPassAttachmentLoadOp,
  RenderPassAttachmentStoreOp,
} from "../render/passes/render-pass-attachments.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { ShadowPassAttachmentDescriptorReport } from "../shadows/shadow-pass-attachment-descriptor.js";
import { resolveShadowDepthTextureAttachmentView } from "../shadows/shadow-depth-texture-resource.js";
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
export function createShadowCasterGraphPasses(
  options: CreateShadowCasterGraphPassesOptions,
): readonly ShadowCasterGraphPass[] {
  const commandsByPassKey = new Map(
    options.commandRecords.map((record) => [record.passKey, record.commands]),
  );
  const passes: ShadowCasterGraphPass[] = [];

  for (const attachment of options.passAttachments.attachments) {
    const commands = commandsByPassKey.get(attachment.passKey);

    if (commands === undefined || commands.length === 0) {
      continue;
    }

    const depthView = resolveShadowDepthTextureAttachmentView(
      options.depthTextureResources,
      {
        shadowId: attachment.shadowId,
        lightId: attachment.lightId,
        viewKey: attachment.viewKey,
      },
    );

    if (depthView === null) {
      continue;
    }

    passes.push({
      key: attachment.passKey,
      depthView,
      depthLoadOp: attachment.depthLoadOp,
      depthStoreOp: attachment.depthStoreOp,
      depthClearValue: attachment.depthClearValue,
      width: attachment.width,
      height: attachment.height,
      depthFormat: attachment.depthFormat,
      commands,
    });
  }

  return passes;
}

/**
 * Build a depth-only render-pass attachment plan for a shadow caster node.
 * `createRenderPassAttachmentPlan` requires at least one color target, so the
 * single-encoder graph builds the depth-only result directly (mirroring the legacy
 * shadow encoder assembly's `{ colorAttachments: [], depthStencilAttachment }`).
 */
export function buildShadowCasterDepthAttachmentPlan(
  pass: ShadowCasterGraphPass,
): CreateRenderPassAttachmentPlanResult {
  const depthStencilAttachment: PlannedRenderPassDepthStencilAttachment = {
    view: pass.depthView,
    depthLoadOp: pass.depthLoadOp,
    depthStoreOp: pass.depthStoreOp,
    ...(pass.depthClearValue === undefined ||
    !Number.isFinite(pass.depthClearValue)
      ? {}
      : { depthClearValue: pass.depthClearValue }),
  };

  return {
    valid: true,
    plan: { colorAttachments: [], depthStencilAttachment },
    diagnostics: [],
  };
}
