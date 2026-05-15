import type { CommandBufferResource } from "./command-buffer.js";
import {
  finishCommandEncoder,
  type CommandEncoderFinishLike,
  type FinishCommandEncoderResult,
} from "./command-buffer.js";
import {
  createCommandEncoderResource,
  type CommandEncoderDeviceLike,
  type CreateCommandEncoderResult,
} from "./command-encoder.js";
import {
  createCurrentTextureColorTarget,
  type CreateCurrentTextureColorTargetResult,
  type CurrentTextureContextLike,
} from "./current-texture-view.js";
import { submitCommandBuffers, type QueueSubmitLike } from "./queue-submit.js";
import type { SubmitCommandBuffersReport } from "./queue-submit.js";
import {
  createRenderPassAttachmentPlan,
  type CreateRenderPassAttachmentPlanResult,
} from "./render-pass-attachments.js";
import {
  executeRenderPassCommands,
  type RenderPassCommandExecutionReport,
  type RenderPassEncoderLike,
} from "./render-pass-command-executor.js";
import type { RenderPassCommand } from "./render-pass-commands.js";
import {
  beginPlannedRenderPass,
  endPlannedRenderPass,
  type BeginRenderPassResult,
  type EndRenderPassResult,
  type RenderPassCommandEncoderLike,
  type RenderPassEncoderWithEndLike,
} from "./render-pass-lifecycle.js";

export interface FrameBoundaryDeviceLike extends CommandEncoderDeviceLike {
  createCommandEncoder?: () => RenderPassCommandEncoderLike &
    CommandEncoderFinishLike;
}

export interface AssembleFrameBoundaryOptions {
  readonly context: CurrentTextureContextLike;
  readonly device: FrameBoundaryDeviceLike;
  readonly queue: QueueSubmitLike;
  readonly commands: readonly RenderPassCommand[];
  readonly label: string;
  readonly clearColor?: readonly number[];
}

export interface FrameBoundaryAssemblyReport {
  readonly valid: boolean;
  readonly texture: CreateCurrentTextureColorTargetResult;
  readonly attachments: CreateRenderPassAttachmentPlanResult | null;
  readonly encoder: CreateCommandEncoderResult | null;
  readonly begin: BeginRenderPassResult | null;
  readonly execution: RenderPassCommandExecutionReport | null;
  readonly end: EndRenderPassResult | null;
  readonly finish: FinishCommandEncoderResult | null;
  readonly submit: SubmitCommandBuffersReport | null;
}

export function assembleFrameBoundary(
  options: AssembleFrameBoundaryOptions,
): FrameBoundaryAssemblyReport {
  const texture = createCurrentTextureColorTarget({
    context: options.context,
    loadOp: "clear",
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
  });
  const attachments =
    texture.target === null
      ? null
      : createRenderPassAttachmentPlan({ colorTargets: [texture.target] });
  const encoder =
    attachments?.valid === true
      ? createCommandEncoderResource({
          device: options.device,
          label: options.label,
        })
      : null;
  const encoderHandle = encoder?.resource?.encoder as
    | (RenderPassCommandEncoderLike & CommandEncoderFinishLike)
    | undefined;
  const begin =
    attachments?.plan === undefined || encoderHandle === undefined
      ? null
      : beginPlannedRenderPass({
          encoder: encoderHandle,
          plan: attachments.plan,
        });
  const pass = begin?.pass ?? null;
  const execution =
    pass === null
      ? null
      : executeRenderPassCommands({
          pass: pass as RenderPassEncoderLike,
          commands: options.commands,
        });
  const end =
    pass === null
      ? null
      : endPlannedRenderPass(pass as RenderPassEncoderWithEndLike);
  const finish =
    encoderHandle === undefined || end?.valid !== true
      ? null
      : finishCommandEncoder({
          encoder: encoderHandle,
          label: options.label,
        });
  const submit =
    finish?.resource === undefined || finish.resource === null
      ? null
      : submitCommandBuffers({
          queue: options.queue,
          commandBuffers: [finish.resource as CommandBufferResource],
        });

  return {
    valid:
      texture.valid &&
      attachments?.valid === true &&
      encoder?.valid === true &&
      begin?.valid === true &&
      execution?.valid === true &&
      end?.valid === true &&
      finish?.valid === true &&
      submit?.valid === true,
    texture,
    attachments,
    encoder,
    begin,
    execution,
    end,
    finish,
    submit,
  };
}
