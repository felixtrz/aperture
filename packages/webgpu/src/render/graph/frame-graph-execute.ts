// executeFrameGraph: the single-encoder graph executor (M3-T2).
//
// Walks a CompiledFrameGraph's ordered nodes and folds EVERY pass (render AND
// compute) into ONE GPUCommandEncoder, then finishes + submits exactly once —
// replacing the legacy "N encoders, N+1 submits" path. Render nodes go through
// encodeFrameBoundaryInto (so render-bundle caching + redundant-state elision in
// render-pass-command-executor.ts are preserved verbatim); compute nodes run
// their ComputePassCommand[] in a compute pass on the same encoder.
//
// WebGPU forbids an open pass while beginning another, so each node's pass is
// ended before the next begins (encodeFrameBoundaryInto / the compute branch end
// their own pass). Reference: references/engine/src/platform/graphics/render-pass.js
// (one encoder, explicit begin/end per pass, single submit) — concept borrowed.

import {
  createCommandEncoderResource,
  type CommandEncoderDeviceLike,
  type CreateCommandEncoderResult,
} from "../../gpu/command-encoder.js";
import {
  finishCommandEncoder,
  type CommandBufferResource,
  type FinishCommandEncoderResult,
} from "../../gpu/command-buffer.js";
import {
  submitCommandBuffers,
  type QueueSubmitLike,
  type SubmitCommandBuffersReport,
} from "../queues/queue-submit.js";
import {
  createRenderPassAttachmentPlan,
  type RenderPassColorAttachmentInput,
  type RenderPassDepthAttachmentInput,
} from "../passes/render-pass-attachments.js";
import {
  encodeFrameBoundaryInto,
  type EncodeFrameBoundaryIntoOptions,
  type FrameBoundaryDeviceLike,
  type FrameBoundaryEncodeReport,
  type FrameBoundaryEncoderHandle,
} from "../frame/frame-boundary.js";
import {
  executeComputePassCommands,
  type ComputePassCommandExecutionReport,
  type ComputePassEncoderLike,
} from "../passes/compute-pass-commands.js";
import {
  createMultiPassCommandSubmissionMetricsReport,
  type CommandSubmissionExecutionLike,
  type CommandSubmissionMetricsReport,
} from "../../gpu/command-submission-metrics.js";
import type { CompiledFrameGraph } from "./frame-graph-compile.js";
import type { ComputePassNode, RenderPassNode } from "./frame-graph.js";

/**
 * A handle resolved to a concrete GPU view for use as a render-pass attachment.
 * `kind` lets the executor route it to a color vs depth attachment slot.
 */
export interface FrameGraphResolvedAttachment {
  readonly kind: "color" | "depth";
  readonly view: unknown;
  readonly resolveTarget?: unknown;
}

/**
 * Resolves graph handle ids to concrete GPU resources at execute time. The graph
 * model stays GPU-free (M3-T1); this is where ids become device views, supplied
 * by the route/resource layer (T3+).
 */
export type FrameGraphRenderNodeBoundary = Omit<
  EncodeFrameBoundaryIntoOptions,
  "encoder"
>;

export interface FrameGraphResources {
  resolveAttachment(handleId: string): FrameGraphResolvedAttachment | null;
  resolveReadbackTexture?(handleId: string): unknown;
  /**
   * Optional fast path for real routes: a fully-resolved boundary encode payload
   * (attachments + commands + readback/timing/occlusion) for a render node, built
   * by existing route code so encoding stays byte-identical to the legacy
   * assembleFrameBoundary path. When it returns a payload, it takes precedence
   * over resolveAttachment; the executor injects the shared encoder.
   */
  resolveRenderBoundary?(
    node: RenderPassNode,
  ): FrameGraphRenderNodeBoundary | null;
}

export interface ComputeCommandEncoderLike {
  beginComputePass?: (
    descriptor?: unknown,
  ) => ComputePassEncoderLike & { end?: () => void };
}

export type FrameGraphExecuteEncoderHandle = FrameBoundaryEncoderHandle &
  ComputeCommandEncoderLike;

export interface ExecuteFrameGraphOptions {
  readonly device: FrameBoundaryDeviceLike & CommandEncoderDeviceLike;
  readonly queue: QueueSubmitLike;
  readonly compiled: CompiledFrameGraph;
  readonly resources: FrameGraphResources;
  readonly label?: string;
}

export type FrameGraphExecuteDiagnosticCode =
  | "frameGraphExecute.compileNotOk"
  | "frameGraphExecute.encoderUnavailable"
  | "frameGraphExecute.missingComputePass"
  | "frameGraphExecute.unresolvedWrite";

export interface FrameGraphExecuteDiagnostic {
  readonly code: FrameGraphExecuteDiagnosticCode;
  readonly message: string;
}

export interface FrameGraphRenderNodeReport {
  readonly name: string;
  readonly kind: "render";
  readonly valid: boolean;
  readonly encode: FrameBoundaryEncodeReport;
}

export interface FrameGraphComputeNodeReport {
  readonly name: string;
  readonly kind: "compute";
  readonly valid: boolean;
  readonly execution: ComputePassCommandExecutionReport | null;
}

export type FrameGraphNodeReport =
  | FrameGraphRenderNodeReport
  | FrameGraphComputeNodeReport;

export interface ExecuteFrameGraphReport {
  readonly valid: boolean;
  readonly encoder: CreateCommandEncoderResult | null;
  readonly nodes: readonly FrameGraphNodeReport[];
  readonly finish: FinishCommandEncoderResult | null;
  readonly submit: SubmitCommandBuffersReport | null;
  readonly metrics: CommandSubmissionMetricsReport;
  readonly diagnostics: readonly FrameGraphExecuteDiagnostic[];
}

export function executeFrameGraph(
  options: ExecuteFrameGraphOptions,
): ExecuteFrameGraphReport {
  const diagnostics: FrameGraphExecuteDiagnostic[] = [];
  const label = options.label ?? "frame-graph";

  if (!options.compiled.ok) {
    diagnostics.push({
      code: "frameGraphExecute.compileNotOk",
      message:
        "Cannot execute a frame graph that failed to compile (cyclic or invalid).",
    });
    return emptyExecuteReport(null, diagnostics, options.queue);
  }

  const encoder = createCommandEncoderResource({
    device: options.device,
    label,
  });
  const encoderHandle = encoder.resource?.encoder as
    | FrameGraphExecuteEncoderHandle
    | undefined;

  if (encoderHandle === undefined) {
    diagnostics.push({
      code: "frameGraphExecute.encoderUnavailable",
      message: "WebGPU device did not produce a usable command encoder.",
    });
    return emptyExecuteReport(encoder, diagnostics, options.queue);
  }

  const nodes: FrameGraphNodeReport[] = [];
  const executions: CommandSubmissionExecutionLike[] = [];

  for (const node of options.compiled.orderedNodes) {
    if (node.kind === "render") {
      const report = encodeRenderNode(
        node,
        options,
        encoderHandle,
        diagnostics,
      );
      nodes.push(report);
      if (report.encode.execution !== null) {
        executions.push(report.encode.execution);
      }
    } else {
      const report = executeComputeNode(node, encoderHandle, diagnostics);
      nodes.push(report);
      if (report.execution !== null) {
        executions.push(report.execution);
      }
    }
  }

  const finish = finishCommandEncoder({ encoder: encoderHandle, label });
  const submit =
    finish.resource === null
      ? submitCommandBuffers({ queue: options.queue, commandBuffers: [] })
      : submitCommandBuffers({
          queue: options.queue,
          commandBuffers: [finish.resource as CommandBufferResource],
        });

  const metrics = createMultiPassCommandSubmissionMetricsReport({
    executions,
    finish,
    submit,
  });

  const valid =
    diagnostics.length === 0 &&
    nodes.every((node) => node.valid) &&
    finish.valid &&
    submit.valid;

  return { valid, encoder, nodes, finish, submit, metrics, diagnostics };
}

function encodeRenderNode(
  node: RenderPassNode,
  options: ExecuteFrameGraphOptions,
  encoderHandle: FrameGraphExecuteEncoderHandle,
  diagnostics: FrameGraphExecuteDiagnostic[],
): FrameGraphRenderNodeReport {
  // Fast path: a route supplied a fully-resolved boundary payload (built by the
  // exact legacy attachment code). Encode it into the shared encoder verbatim.
  const boundary = options.resources.resolveRenderBoundary?.(node);
  if (boundary !== undefined && boundary !== null) {
    const encode = encodeFrameBoundaryInto({
      ...boundary,
      encoder: encoderHandle,
    });
    return { name: node.name, kind: "render", valid: encode.valid, encode };
  }

  const ops = options.compiled.perNodeLoadStoreOps.get(node.name);
  const colorTargets: RenderPassColorAttachmentInput[] = [];
  let depthTarget: RenderPassDepthAttachmentInput | null = null;
  let readbackTexture: unknown;

  node.writes.forEach((write, index) => {
    const resolved = options.resources.resolveAttachment(write.handle);
    if (resolved === null) {
      diagnostics.push({
        code: "frameGraphExecute.unresolvedWrite",
        message: `Render pass '${node.name}' write handle '${write.handle}' did not resolve to a view.`,
      });
      return;
    }

    const storeOp = ops?.writeStoreOps[index] ?? "store";

    if (resolved.kind === "depth") {
      depthTarget = {
        view: resolved.view,
        depthLoadOp: write.attachment,
        depthStoreOp: storeOp,
        ...(write.clearDepth === undefined
          ? {}
          : { depthClearValue: write.clearDepth }),
      };
    } else {
      colorTargets.push({
        view: resolved.view,
        ...(resolved.resolveTarget === undefined
          ? {}
          : { resolveTarget: resolved.resolveTarget }),
        loadOp: write.attachment,
        storeOp,
        ...(write.clearColor === undefined
          ? {}
          : { clearColor: write.clearColor }),
      });
    }

    if (readbackTexture === undefined) {
      readbackTexture = options.resources.resolveReadbackTexture?.(
        write.handle,
      );
    }
  });

  const attachments = createRenderPassAttachmentPlan({
    colorTargets,
    ...(depthTarget === null ? {} : { depthTarget }),
  });

  const encode = encodeFrameBoundaryInto({
    encoder: encoderHandle,
    device: options.device,
    attachments,
    commands: node.commands,
    label: node.name,
    colorTargetSource: "offscreen-target",
    ...(readbackTexture === undefined ? {} : { readbackTexture }),
    ...(node.viewport === undefined ? {} : { viewport: node.viewport }),
    ...(node.scissor === undefined ? {} : { scissor: node.scissor }),
  });

  return { name: node.name, kind: "render", valid: encode.valid, encode };
}

function executeComputeNode(
  node: ComputePassNode,
  encoderHandle: FrameGraphExecuteEncoderHandle,
  diagnostics: FrameGraphExecuteDiagnostic[],
): FrameGraphComputeNodeReport {
  if (encoderHandle.beginComputePass === undefined) {
    diagnostics.push({
      code: "frameGraphExecute.missingComputePass",
      message: `Command encoder cannot begin a compute pass for '${node.name}'.`,
    });
    return { name: node.name, kind: "compute", valid: false, execution: null };
  }

  const pass = encoderHandle.beginComputePass({ label: node.name });
  const execution = executeComputePassCommands({
    pass,
    commands: node.commands,
  });
  const ended = pass.end !== undefined;
  pass.end?.();

  return {
    name: node.name,
    kind: "compute",
    valid: execution.valid && ended,
    execution,
  };
}

function emptyExecuteReport(
  encoder: CreateCommandEncoderResult | null,
  diagnostics: FrameGraphExecuteDiagnostic[],
  queue: QueueSubmitLike,
): ExecuteFrameGraphReport {
  const finish: FinishCommandEncoderResult = {
    valid: false,
    resource: null,
    diagnostics: [],
  };
  const submit = submitCommandBuffers({ queue, commandBuffers: [] });
  const metrics = createMultiPassCommandSubmissionMetricsReport({
    executions: [],
    finish,
    submit,
  });

  return {
    valid: false,
    encoder,
    nodes: [],
    finish: null,
    submit: null,
    metrics,
    diagnostics,
  };
}
