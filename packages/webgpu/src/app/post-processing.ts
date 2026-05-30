import type { RenderSnapshot } from "@aperture-engine/render";
import {
  assembleFrameBoundary,
  type FrameBoundaryAssemblyReport,
  type FrameBoundaryReadbackSampleRequest,
} from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import {
  createOrReuseWebGpuPostPassTexture,
  type WebGpuPostEffect,
  type WebGpuPostPassDepthTextureResource,
  type WebGpuPostPassTextureResource,
  type WebGpuPreparedPostEffectGraph,
} from "../post/post-pass.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import { encodePostPassMotionVectorClearColor } from "./motion-vectors.js";
import { countDrawCommands } from "./view-commands.js";
import type {
  WebGpuApp,
  WebGpuAppPostEffectSubmissionReport,
  WebGpuAppRenderTargetSubmissionReport,
} from "./app.js";

interface WebGpuAppPostProcessedSwapchainTargetResult {
  readonly valid: boolean;
  readonly boundaries: readonly FrameBoundaryAssemblyReport[];
  readonly renderTarget: WebGpuAppRenderTargetSubmissionReport;
  readonly postEffects: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly plannedCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: readonly unknown[];
}

export function assembleWebGpuAppPostProcessedSwapchainTarget(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly target: Extract<
    WebGpuAppFrameBoundaryTarget,
    { source: "swapchain" }
  >;
  readonly commands: readonly RenderPassCommand[];
  readonly depthAttachment: CachedWebGpuDepthTextureResource;
  readonly effects: readonly WebGpuPostEffect[];
  readonly label: string;
  readonly clearColor?: readonly number[];
  readonly motionVectorColorFormat?: string | null;
  readonly indirectColorFormat?: string | null;
  readonly msaaColorTarget?: Parameters<
    typeof assembleFrameBoundary
  >[0]["msaaColorTarget"];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly gpuTiming?: Parameters<typeof assembleFrameBoundary>[0]["gpuTiming"];
  readonly occlusionQueries?: Parameters<
    typeof assembleFrameBoundary
  >[0]["occlusionQueries"];
}): WebGpuAppPostProcessedSwapchainTargetResult {
  const boundaries: FrameBoundaryAssemblyReport[] = [];
  const postEffects: WebGpuAppPostEffectSubmissionReport[] = [];
  const diagnostics: unknown[] = [];
  const device = options.app.initialization.device as Parameters<
    typeof assembleFrameBoundary
  >[0]["device"];
  const queue = (
    options.app.initialization.device as { readonly queue: unknown }
  ).queue as Parameters<typeof assembleFrameBoundary>[0]["queue"];
  const context = options.app.initialization.context as Parameters<
    typeof assembleFrameBoundary
  >[0]["context"];
  const sceneTexture = createOrReuseWebGpuPostPassTexture({
    device: options.app.initialization.device as Parameters<
      typeof createOrReuseWebGpuPostPassTexture
    >[0]["device"],
    slot: options.cache.postPasses.scene,
    width: options.target.width,
    height: options.target.height,
    // The lit scene renders into the app's scene-render format: the 8-bit
    // swapchain format by default, rgba16float when the HDR scene buffer is
    // active (M5-T4). The final post stage tonemaps it back to the swapchain.
    format: options.app.sceneRenderFormat,
    label: `${options.label}:post:scene`,
  });

  diagnostics.push(...sceneTexture.diagnostics);

  if (!sceneTexture.valid || sceneTexture.resource === null) {
    return {
      valid: false,
      boundaries,
      renderTarget: {
        viewId: options.target.view.viewId,
        source: "swapchain",
        renderTargetKey: null,
        width: options.target.width,
        height: options.target.height,
        format: options.target.format,
        ok: false,
        drawCalls: 0,
        ...(options.msaaColorTarget === undefined ||
        options.msaaColorTarget === null
          ? {}
          : { msaaSampleCount: options.msaaColorTarget.sampleCount }),
      },
      postEffects,
      readbackBoundary: null,
      plannedCommands: 0,
      drawCalls: 0,
      diagnostics,
    };
  }

  const requiresMotionVectors = options.effects.some(
    (effect) => effect.requiresMotionVectors === true,
  );
  let motionVectorTexture: WebGpuPostPassTextureResource | undefined;

  if (requiresMotionVectors) {
    const motionVector = createOrReuseWebGpuPostPassTexture({
      device: options.app.initialization.device as Parameters<
        typeof createOrReuseWebGpuPostPassTexture
      >[0]["device"],
      slot: options.cache.postPasses.motionVector,
      width: options.target.width,
      height: options.target.height,
      format: options.motionVectorColorFormat ?? options.target.format,
      label: `${options.label}:post:motion-vector`,
    });

    diagnostics.push(...motionVector.diagnostics);

    if (motionVector.valid && motionVector.resource !== null) {
      motionVectorTexture = motionVector.resource;
    }
  }

  // M5-T6: the separated indirect (ambient+IBL) color the lit pass writes to a
  // second attachment, consumed by an SSAO effect to attenuate only indirect
  // light. Mutually exclusive with motion vectors (both @location(1)).
  let indirectColorTexture: WebGpuPostPassTextureResource | undefined;

  if (
    options.indirectColorFormat !== undefined &&
    options.indirectColorFormat !== null
  ) {
    const indirect = createOrReuseWebGpuPostPassTexture({
      device: options.app.initialization.device as Parameters<
        typeof createOrReuseWebGpuPostPassTexture
      >[0]["device"],
      slot: options.cache.postPasses.indirectColor,
      width: options.target.width,
      height: options.target.height,
      format: options.indirectColorFormat,
      label: `${options.label}:post:indirect`,
    });

    diagnostics.push(...indirect.diagnostics);

    if (indirect.valid && indirect.resource !== null) {
      indirectColorTexture = indirect.resource;
    }
  }

  const requiresDepthTexture = options.effects.some(
    (effect) => effect.requiresDepthTexture === true,
  );
  const depthTexture: WebGpuPostPassDepthTextureResource | undefined =
    requiresDepthTexture
      ? {
          texture: options.depthAttachment.texture,
          width: options.depthAttachment.width,
          height: options.depthAttachment.height,
          format: options.depthAttachment.format,
          sampleCount: options.depthAttachment.sampleCount,
          label: `${options.label}:post:depth`,
        }
      : undefined;

  const motionVectorAttachmentView =
    options.motionVectorColorFormat === undefined ||
    options.motionVectorColorFormat === null
      ? undefined
      : motionVectorTexture?.texture.createView?.();
  const useSceneMotionVectorAttachment =
    motionVectorTexture !== undefined &&
    motionVectorAttachmentView !== undefined;
  const indirectColorAttachmentView =
    options.indirectColorFormat === undefined ||
    options.indirectColorFormat === null
      ? undefined
      : indirectColorTexture?.texture.createView?.();
  const useSceneIndirectAttachment =
    indirectColorTexture !== undefined &&
    indirectColorAttachmentView !== undefined;
  // Motion vectors and the indirect channel are mutually exclusive second
  // attachments; emit at most one.
  const sceneAdditionalColorTargets = useSceneMotionVectorAttachment
    ? [
        {
          view: motionVectorAttachmentView,
          clearColor: [0.5, 0.5, 0.5, 1],
          loadOp: "clear" as const,
          storeOp: "store" as const,
        },
      ]
    : useSceneIndirectAttachment
      ? [
          {
            view: indirectColorAttachmentView,
            clearColor: [0, 0, 0, 1],
            loadOp: "clear" as const,
            storeOp: "store" as const,
          },
        ]
      : undefined;
  const sceneBoundary = assembleFrameBoundary({
    context,
    device,
    queue,
    commands: options.commands,
    label: `${options.label}:swapchain:scene`,
    colorTarget: {
      source: "offscreen-target",
      texture: sceneTexture.resource.texture,
    },
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.msaaColorTarget === undefined
      ? {}
      : { msaaColorTarget: options.msaaColorTarget }),
    ...(sceneAdditionalColorTargets === undefined
      ? {}
      : { additionalColorTargets: sceneAdditionalColorTargets }),
    depthTarget: {
      view: options.depthAttachment.view,
      depthClearValue: options.target.view.clearDepth,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
    ...(options.gpuTiming === undefined
      ? {}
      : { gpuTiming: options.gpuTiming }),
    ...(options.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: options.occlusionQueries }),
  });
  let input: WebGpuPostPassTextureResource = sceneTexture.resource;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  let plannedCommands = options.commands.length;
  let drawCalls = countDrawCommands(options.commands);
  let valid = sceneBoundary.valid;

  boundaries.push(sceneBoundary);
  appendFrameBoundaryDiagnostics(diagnostics, sceneBoundary);

  if (requiresMotionVectors) {
    if (motionVectorTexture === undefined) {
      valid = false;
    } else if (!useSceneMotionVectorAttachment) {
      const motionBoundary = assembleFrameBoundary({
        context,
        device,
        queue,
        commands: [],
        label: `${options.label}:post:motion-vector`,
        colorTarget: {
          source: "offscreen-target",
          texture: motionVectorTexture.texture,
        },
        clearColor: encodePostPassMotionVectorClearColor({
          snapshot: options.snapshot,
          view: options.target.view,
          cache: options.cache.postPasses,
        }),
      });

      boundaries.push(motionBoundary);
      appendFrameBoundaryDiagnostics(diagnostics, motionBoundary);
      valid &&= motionBoundary.valid;
    }
  }

  for (
    let effectIndex = 0;
    effectIndex < options.effects.length;
    effectIndex += 1
  ) {
    const effect = options.effects[effectIndex];

    if (effect === undefined) {
      continue;
    }

    const isLast = effectIndex === options.effects.length - 1;
    let outputTexture: WebGpuPostPassTextureResource | null = null;

    if (!isLast) {
      const intermediate = createOrReuseWebGpuPostPassTexture({
        device: options.app.initialization.device as Parameters<
          typeof createOrReuseWebGpuPostPassTexture
        >[0]["device"],
        slot:
          (effectIndex + options.snapshot.frame) % 2 === 0
            ? options.cache.postPasses.ping
            : options.cache.postPasses.pong,
        width: options.target.width,
        height: options.target.height,
        format: options.target.format,
        label: `${options.label}:post:${effectIndex}:intermediate`,
      });

      diagnostics.push(...intermediate.diagnostics);
      outputTexture = intermediate.resource;

      if (!intermediate.valid || outputTexture === null) {
        valid = false;
        break;
      }
    }

    const prepared = effect.prepare({
      device: options.app.initialization.device as Parameters<
        WebGpuPostEffect["prepare"]
      >[0]["device"],
      input,
      outputFormat: options.target.format,
      width: options.target.width,
      height: options.target.height,
      frame: options.snapshot.frame,
      passIndex: effectIndex,
      isLast,
      ...(motionVectorTexture === undefined
        ? {}
        : { motionVector: motionVectorTexture }),
      ...(indirectColorTexture === undefined
        ? {}
        : { indirectColor: indirectColorTexture }),
      ...(depthTexture === undefined ? {} : { depth: depthTexture }),
      ...(outputTexture === null ? {} : { output: outputTexture }),
      label: `${options.label}:post:${effect.id}`,
    });

    diagnostics.push(...prepared.diagnostics);

    if (prepared.graph !== undefined) {
      const graphResult = assembleWebGpuAppPreparedPostEffectGraph({
        context,
        device,
        queue,
        effectId: prepared.effectId,
        label: `${options.label}:post:${effectIndex}:${effect.id}`,
        graph: prepared.graph,
        isLast,
        outputFormat: options.target.format,
        ...(options.readbackSamples === undefined
          ? {}
          : { readbackSamples: options.readbackSamples }),
      });

      boundaries.push(...graphResult.boundaries);
      diagnostics.push(...graphResult.diagnostics);
      postEffects.push({
        effectId: prepared.effectId,
        label: prepared.label,
        viewId: options.target.view.viewId,
        input: input.label,
        output: graphResult.output,
        ok:
          graphResult.valid &&
          prepared.diagnostics.length === 0 &&
          (isLast || graphResult.outputResource !== null),
        drawCalls: graphResult.drawCalls,
        graph: prepared.graph.report,
      });
      plannedCommands += graphResult.plannedCommands;
      drawCalls += graphResult.drawCalls;
      valid &&=
        graphResult.valid &&
        prepared.diagnostics.length === 0 &&
        (isLast || graphResult.outputResource !== null);

      if (graphResult.readbackBoundary !== null) {
        readbackBoundary = graphResult.readbackBoundary;
      }

      if (!isLast) {
        if (graphResult.outputResource === null) {
          valid = false;
          break;
        }

        input = graphResult.outputResource;
      }

      continue;
    }

    const postBoundary = assembleFrameBoundary({
      context,
      device,
      queue,
      commands: prepared.commands,
      label: `${options.label}:post:${effectIndex}:${effect.id}`,
      ...(isLast
        ? {}
        : {
            colorTarget: {
              source: "offscreen-target" as const,
              texture: outputTexture?.texture,
            },
          }),
      clearColor: [0, 0, 0, 1],
      ...(isLast && options.readbackSamples !== undefined
        ? {
            readback: {
              format: options.target.format,
              width: options.target.width,
              height: options.target.height,
              samples: options.readbackSamples,
            },
          }
        : {}),
    });

    const postOk =
      postBoundary.valid &&
      prepared.diagnostics.length === 0 &&
      (isLast || outputTexture !== null);

    postEffects.push({
      effectId: prepared.effectId,
      label: prepared.label,
      viewId: options.target.view.viewId,
      input: input.label,
      output: isLast ? "swapchain" : "offscreen",
      ok: postOk,
      drawCalls: postBoundary.execution?.drawCalls ?? 0,
    });
    boundaries.push(postBoundary);
    appendFrameBoundaryDiagnostics(diagnostics, postBoundary);
    plannedCommands += prepared.commands.length;
    drawCalls += countDrawCommands(prepared.commands);
    valid &&= postOk;

    if (postBoundary.readback !== null && postBoundary.readback !== undefined) {
      readbackBoundary = postBoundary;
    }

    if (!isLast && outputTexture !== null) {
      input = outputTexture;
    }
  }

  return {
    valid,
    boundaries,
    renderTarget: {
      viewId: options.target.view.viewId,
      source: "swapchain",
      renderTargetKey: null,
      width: options.target.width,
      height: options.target.height,
      format: options.target.format,
      ok: valid,
      drawCalls: sceneBoundary.execution?.drawCalls ?? 0,
      ...(options.msaaColorTarget === undefined ||
      options.msaaColorTarget === null
        ? {}
        : { msaaSampleCount: options.msaaColorTarget.sampleCount }),
    },
    postEffects,
    readbackBoundary,
    plannedCommands,
    drawCalls,
    diagnostics,
  };
}

function assembleWebGpuAppPreparedPostEffectGraph(options: {
  readonly context: Parameters<typeof assembleFrameBoundary>[0]["context"];
  readonly device: Parameters<typeof assembleFrameBoundary>[0]["device"];
  readonly queue: Parameters<typeof assembleFrameBoundary>[0]["queue"];
  readonly effectId: string;
  readonly label: string;
  readonly graph: WebGpuPreparedPostEffectGraph;
  readonly isLast: boolean;
  readonly outputFormat: string;
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
}): {
  readonly valid: boolean;
  readonly boundaries: readonly FrameBoundaryAssemblyReport[];
  readonly diagnostics: readonly unknown[];
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly output: "swapchain" | "offscreen";
  readonly outputResource: WebGpuPostPassTextureResource | null;
  readonly plannedCommands: number;
  readonly drawCalls: number;
} {
  const boundaries: FrameBoundaryAssemblyReport[] = [];
  const diagnostics: unknown[] = [];
  let valid = options.graph.passes.length > 0;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  let output: "swapchain" | "offscreen" = options.isLast
    ? "swapchain"
    : "offscreen";
  let outputResource: WebGpuPostPassTextureResource | null = null;
  let plannedCommands = 0;
  let drawCalls = 0;

  if (options.graph.passes.length === 0) {
    diagnostics.push({
      code: "webGpuPostPass.outputTextureUnavailable",
      effectId: options.effectId,
      message: `Post effect '${options.effectId}' prepared an empty post-effect graph.`,
    });
  }

  for (
    let graphPassIndex = 0;
    graphPassIndex < options.graph.passes.length;
    graphPassIndex += 1
  ) {
    const graphPass = options.graph.passes[graphPassIndex];

    if (graphPass === undefined) {
      continue;
    }

    diagnostics.push(...graphPass.diagnostics);
    plannedCommands += graphPass.commands.length;
    drawCalls += countDrawCommands(graphPass.commands);
    output = graphPass.output;
    outputResource =
      graphPass.output === "offscreen"
        ? (graphPass.outputResource ?? null)
        : null;

    const graphPassOutputResource = graphPass.outputResource;

    if (
      graphPass.output === "offscreen" &&
      graphPassOutputResource === undefined
    ) {
      diagnostics.push({
        code: "webGpuPostPass.outputTextureUnavailable",
        effectId: options.effectId,
        message: `Post effect '${options.effectId}' graph pass '${graphPass.label}' did not provide an off-screen output texture.`,
      });
      valid = false;
      continue;
    }

    const postBoundary =
      graphPass.output === "offscreen"
        ? assembleFrameBoundary({
            context: options.context,
            device: options.device,
            queue: options.queue,
            commands: graphPass.commands,
            label: `${options.label}:${graphPassIndex}:${graphPass.kind}`,
            colorTarget: {
              source: "offscreen-target" as const,
              texture: graphPassOutputResource!.texture,
            },
            clearColor: [0, 0, 0, 1],
          })
        : assembleFrameBoundary({
            context: options.context,
            device: options.device,
            queue: options.queue,
            commands: graphPass.commands,
            label: `${options.label}:${graphPassIndex}:${graphPass.kind}`,
            clearColor: [0, 0, 0, 1],
            ...(options.isLast && options.readbackSamples !== undefined
              ? {
                  readback: {
                    format: options.outputFormat,
                    width: graphPass.width,
                    height: graphPass.height,
                    samples: options.readbackSamples,
                  },
                }
              : {}),
          });

    boundaries.push(postBoundary);
    appendFrameBoundaryDiagnostics(diagnostics, postBoundary);
    valid &&= postBoundary.valid && graphPass.diagnostics.length === 0;

    if (postBoundary.readback !== null && postBoundary.readback !== undefined) {
      readbackBoundary = postBoundary;
    }
  }

  return {
    valid,
    boundaries,
    diagnostics,
    readbackBoundary,
    output,
    outputResource,
    plannedCommands,
    drawCalls,
  };
}

function appendFrameBoundaryDiagnostics(
  diagnostics: unknown[],
  boundary: FrameBoundaryAssemblyReport,
): void {
  diagnostics.push(
    ...boundary.texture.diagnostics,
    ...(boundary.attachments?.diagnostics ?? []),
    ...(boundary.encoder?.diagnostics ?? []),
    ...(boundary.begin?.diagnostics ?? []),
    ...(boundary.execution?.diagnostics ?? []),
    ...(boundary.end?.diagnostics ?? []),
    ...(boundary.occlusionQueries?.diagnostics ?? []),
    ...(boundary.finish?.diagnostics ?? []),
    ...(boundary.submit?.diagnostics ?? []),
  );
}
