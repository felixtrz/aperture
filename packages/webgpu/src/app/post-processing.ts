import type { RenderSnapshot } from "@aperture-engine/render";
import {
  assembleFrameBoundary,
  buildFrameBoundaryTargetPlan,
  type FrameBoundaryAssemblyReport,
  type FrameBoundaryEncodeReport,
  type FrameBoundaryReadbackSampleRequest,
} from "../render/frame/frame-boundary.js";
import { createFrameGraph } from "../render/graph/frame-graph.js";
import { compileFrameGraph } from "../render/graph/frame-graph-compile.js";
import {
  executeFrameGraph,
  type FrameGraphRenderNodeBoundary,
  type FrameGraphResources,
} from "../render/graph/frame-graph-execute.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { CachedWebGpuDepthTextureResource } from "../resources/textures/depth-texture-resource.js";
import {
  createOrReuseWebGpuPostPassTexture,
  type WebGpuPostEffect,
  type WebGpuPostPassDepthTextureResource,
  type WebGpuPostPassTextureResource,
  type WebGpuPreparedPostEffectGraph,
} from "../post/post-pass.js";
import {
  resolveWebGpuAppPostPassColorHistory,
  type WebGpuAppPostPassColorHistory,
} from "../post/post-color-history.js";
import { buildUserPassNode, type WebGpuAppPassResolvers } from "./user-pass.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import { encodePostPassMotionVectorClearColor } from "./motion-vectors.js";
import { countDrawCommands } from "./view-commands.js";
import type {
  WebGpuApp,
  WebGpuAppPostEffectSubmissionReport,
  WebGpuAppPostGraphReport,
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
  // M3-T7: additive graph sub-report (only present on the graph path). Existing
  // fields above are unchanged, per D4.
  readonly graph?: WebGpuAppPostGraphReport;
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
  // M3-T3: opt this swapchain post target into the single-encoder FrameGraph
  // path. Undefined/false keeps the legacy N-submit path. The graph path returns
  // null (→ legacy) for cases it does not yet cover (motion vectors / MSAA /
  // indirect channel / occlusion / gpu timing), so the flag is a safe no-op for
  // those routes; default stays OFF until each route's E2E is green.
  readonly useFrameGraph?: boolean;
}): WebGpuAppPostProcessedSwapchainTargetResult {
  if (options.useFrameGraph === true) {
    const viaGraph =
      assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(options);
    if (viaGraph !== null) {
      return viaGraph;
    }
  }

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

type PostProcessedSwapchainTargetOptions = Parameters<
  typeof assembleWebGpuAppPostProcessedSwapchainTarget
>[0];

interface PostGraphNodeRecord {
  readonly name: string;
  readonly texture: ReturnType<typeof buildFrameBoundaryTargetPlan>["texture"];
  readonly attachments: ReturnType<
    typeof buildFrameBoundaryTargetPlan
  >["attachments"];
}

interface PostGraphEffectMeta {
  readonly kind: "single" | "graph";
  readonly effectId: string;
  readonly label: string;
  readonly inputLabel: string;
  readonly isLast: boolean;
  readonly nodeNames: readonly string[];
  readonly preparedOk: boolean;
  readonly outputPresent: boolean;
  readonly output: "swapchain" | "offscreen";
  readonly plannedDrawCalls: number | null; // graph effects report planned draws
  readonly graphReport?: WebGpuPreparedPostEffectGraph["report"];
}

/**
 * M3-T3: the single-encoder FrameGraph variant of
 * assembleWebGpuAppPostProcessedSwapchainTarget. Builds the SAME per-pass
 * boundaries the legacy path builds (via buildFrameBoundaryTargetPlan) but
 * registers them as graph nodes + resolveRenderBoundary payloads and runs them
 * through executeFrameGraph ONCE, so the whole post stack submits a single
 * command buffer. Returns null to fall back to the legacy path for anything this
 * v1 does not cover (motion vectors / MSAA / indirect channel / occlusion / gpu
 * timing, or any resource allocation failure), keeping the flag a safe no-op.
 */
export function assembleWebGpuAppPostProcessedSwapchainTargetViaGraph(
  options: PostProcessedSwapchainTargetOptions,
): WebGpuAppPostProcessedSwapchainTargetResult | null {
  const requiresMotionVectors = options.effects.some(
    (effect) => effect.requiresMotionVectors === true,
  );
  const motionVectorColorFormat =
    options.motionVectorColorFormat === undefined ||
    options.motionVectorColorFormat === null
      ? null
      : options.motionVectorColorFormat;
  if (
    (options.msaaColorTarget !== undefined &&
      options.msaaColorTarget !== null) ||
    (options.indirectColorFormat !== undefined &&
      options.indirectColorFormat !== null) ||
    options.occlusionQueries !== undefined ||
    options.effects.length === 0 ||
    // M3-T6: the graph path produces motion vectors only as a scene attachment
    // (motionVectorColorFormat set). When motion vectors are required but fall
    // back to a flat clear (colorFormat null: msaa / sprite+skybox packets /
    // unsupported target / missing previous-transform buffer) the graph path
    // declines, so the legacy path handles the fallback. The reported
    // WebGpuAppMotionVectorFallbackReason is computed upstream
    // (queued-built-in-frame.ts) and is identical regardless of which post path
    // runs, so TAA's fallback reporting is unchanged under the flag.
    (requiresMotionVectors && motionVectorColorFormat === null)
  ) {
    return null;
  }

  const device = options.app.initialization.device as Parameters<
    typeof assembleFrameBoundary
  >[0]["device"];
  const queue = (
    options.app.initialization.device as { readonly queue: unknown }
  ).queue as Parameters<typeof assembleFrameBoundary>[0]["queue"];
  const context = options.app.initialization.context as Parameters<
    typeof buildFrameBoundaryTargetPlan
  >[0]["context"];

  const sceneTexture = createOrReuseWebGpuPostPassTexture({
    device: options.app.initialization.device as Parameters<
      typeof createOrReuseWebGpuPostPassTexture
    >[0]["device"],
    slot: options.cache.postPasses.scene,
    width: options.target.width,
    height: options.target.height,
    format: options.app.sceneRenderFormat,
    label: `${options.label}:post:scene`,
  });

  if (!sceneTexture.valid || sceneTexture.resource === null) {
    return null;
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

  const diagnostics: unknown[] = [...sceneTexture.diagnostics];
  const graph = createFrameGraph();
  graph.importSwapchain();

  const colorHandleDescriptor = {
    kind: "color-texture" as const,
    width: options.target.width,
    height: options.target.height,
    format: options.app.sceneRenderFormat,
    sampleCount: 1,
  };
  const sceneColorHandle = "post:scene-color";
  graph.declareTransient(sceneColorHandle, colorHandleDescriptor);

  // M3-T6: when an effect needs motion vectors and they are available as a
  // scene attachment (the bail above guaranteed motionVectorColorFormat is set
  // in that case), produce them on the scene node as a second color target —
  // exactly as the legacy path does — so TAA can sample per-object velocity.
  let motionVectorTexture: WebGpuPostPassTextureResource | null = null;
  let motionVectorHandle: string | null = null;
  let motionVectorAttachment:
    | {
        readonly view: unknown;
        readonly clearColor: readonly [number, number, number, number];
        readonly loadOp: "clear";
        readonly storeOp: "store";
      }
    | undefined;
  if (requiresMotionVectors && motionVectorColorFormat !== null) {
    const motionVector = createOrReuseWebGpuPostPassTexture({
      device: options.app.initialization.device as Parameters<
        typeof createOrReuseWebGpuPostPassTexture
      >[0]["device"],
      slot: options.cache.postPasses.motionVector,
      width: options.target.width,
      height: options.target.height,
      format: motionVectorColorFormat,
      label: `${options.label}:post:motion-vector`,
    });
    diagnostics.push(...motionVector.diagnostics);
    const motionVectorView = motionVector.resource?.texture.createView?.();
    if (
      !motionVector.valid ||
      motionVector.resource === null ||
      motionVectorView === undefined
    ) {
      return null;
    }
    motionVectorTexture = motionVector.resource;
    motionVectorHandle = "post:motion-vector";
    motionVectorAttachment = {
      view: motionVectorView,
      // Neutral camera-relative motion; geometry shaders overwrite per pixel.
      clearColor: [0.5, 0.5, 0.5, 1],
      loadOp: "clear",
      storeOp: "store",
    };
  }

  const records: PostGraphNodeRecord[] = [];
  const payloads = new Map<string, FrameGraphRenderNodeBoundary>();

  const registerNode = (args: {
    readonly name: string;
    readonly reads: readonly string[];
    readonly writeHandle: string;
    readonly planOptions: Parameters<typeof buildFrameBoundaryTargetPlan>[0];
    readonly commands: readonly RenderPassCommand[];
    readonly colorTargetSource: "current-texture" | "offscreen-target";
    readonly readback?: FrameGraphRenderNodeBoundary["readback"];
    // M3-T7: GPU timestamp queries for this node's pass (the scene node carries
    // them, matching the legacy path which times the scene pass) — lets the graph
    // path preserve the gpuTiming diagnostic instead of bailing to legacy.
    readonly gpuTiming?: FrameGraphRenderNodeBoundary["gpuTiming"];
    // Extra color attachments written alongside writeHandle (e.g. the scene
    // node's motion-vector target). Each is recorded as an additional graph
    // write so a downstream node (TAA) can declare a read edge on it.
    readonly additionalWriteHandles?: readonly string[];
  }): void => {
    // Declare the write handle as a transient unless it is the imported
    // swapchain or was already declared (a persistent declareHistory handle
    // must not be overwritten with a transient).
    if (
      args.writeHandle !== "swapchain" &&
      graph.handle(args.writeHandle) === undefined
    ) {
      graph.declareTransient(args.writeHandle, colorHandleDescriptor);
    }
    const writes = [{ handle: args.writeHandle, attachment: "clear" as const }];
    for (const extra of args.additionalWriteHandles ?? []) {
      if (graph.handle(extra) === undefined) {
        graph.declareTransient(extra, colorHandleDescriptor);
      }
      writes.push({ handle: extra, attachment: "clear" as const });
    }
    const plan = buildFrameBoundaryTargetPlan(args.planOptions);
    graph.addRenderPass({
      name: args.name,
      reads: args.reads,
      writes,
      commands: args.commands,
    });
    payloads.set(args.name, {
      device,
      attachments: plan.attachments,
      commands: args.commands,
      label: args.name,
      colorTargetSource: args.colorTargetSource,
      readbackTexture: plan.texture.texture,
      ...(args.readback === undefined ? {} : { readback: args.readback }),
      ...(args.gpuTiming === undefined ? {} : { gpuTiming: args.gpuTiming }),
    });
    records.push({
      name: args.name,
      texture: plan.texture,
      attachments: plan.attachments,
    });
  };

  // ---- scene node ----
  const sceneNodeName = `${options.label}:swapchain:scene`;
  registerNode({
    name: sceneNodeName,
    reads: [],
    writeHandle: sceneColorHandle,
    planOptions: {
      context,
      colorTarget: {
        source: "offscreen-target",
        texture: sceneTexture.resource.texture,
      },
      ...(options.clearColor === undefined
        ? {}
        : { clearColor: options.clearColor }),
      ...(motionVectorAttachment === undefined
        ? {}
        : { additionalColorTargets: [motionVectorAttachment] }),
      depthTarget: {
        view: options.depthAttachment.view,
        depthClearValue: options.target.view.clearDepth,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    },
    commands: options.commands,
    colorTargetSource: "offscreen-target",
    ...(options.gpuTiming === undefined
      ? {}
      : { gpuTiming: options.gpuTiming }),
    ...(motionVectorHandle === null
      ? {}
      : { additionalWriteHandles: [motionVectorHandle] }),
  });

  let input: WebGpuPostPassTextureResource = sceneTexture.resource;
  let inputHandle = sceneColorHandle;
  let plannedCommands = options.commands.length;
  let drawCalls = countDrawCommands(options.commands);
  const effectMetas: PostGraphEffectMeta[] = [];
  // M3-T6: the double-buffered color-history pool used by a requiresColorHistory
  // effect (TAA) this frame. Swapped exactly once, after the single execute.
  let taaColorHistory: WebGpuAppPostPassColorHistory | null = null;

  // ---- M3-T7: user passes (app.addRenderPass / app.addComputePass) ----
  // Inserted after the scene node so they run between 'opaque' (the scene
  // render) and the post effects. Render passes write the offscreen scene-color
  // with LOAD (the scene + depth they draw over are preserved — a depth-tested
  // overlay draws over the scene); compute passes read scene-color and write a
  // user-owned resource. The present effect then samples the (possibly overlaid)
  // scene-color. Resolvers map the public built-in handle ids to this route's GPU
  // resources; user pipelines/buffers/bind groups are owned by the encode closure.
  const userPassNodeNames: string[] = [];
  // Optional chaining: the real app always has a registry, but lightweight
  // callers/tests may omit it — treat a missing registry as no user passes.
  const userPasses = (options.app.userPassRegistry?.list() ?? []).filter(
    (descriptor) => descriptor.enabled !== false,
  );
  if (userPasses.length > 0) {
    const sceneView = sceneTexture.resource.texture.createView?.();
    const userResolvers: WebGpuAppPassResolvers = {
      view: (handle) =>
        handle === "scene-color"
          ? sceneView
          : handle === "depth"
            ? options.depthAttachment.view
            : undefined,
      buffer: () => undefined,
      createBindGroup: (entries) =>
        (
          device as { createBindGroup?: (descriptor: unknown) => unknown }
        ).createBindGroup?.(entries),
    };
    for (const descriptor of userPasses) {
      const built = buildUserPassNode(descriptor, userResolvers);
      if (built.kind === "compute") {
        for (const write of built.writes) {
          if (graph.handle(write.handle) === undefined) {
            graph.declareResource({
              id: write.handle,
              descriptor: { kind: "buffer", lifetime: "transient" },
            });
          }
        }
        graph.addComputePass(built);
        userPassNodeNames.push(built.name);
        plannedCommands += built.commands.length;
      } else {
        // M3-T7 scope (audit B5): a user RENDER pass is drawn over scene-color with
        // LOAD; a declared write to anything other than scene-color is not honored
        // for render passes (compute passes do honor their declared transient
        // writes). Surface the coercion instead of dropping it silently.
        const coercedWrites = (descriptor.writes ?? [])
          .map((write) => (typeof write === "string" ? write : write.handle))
          .filter((handle) => handle !== "scene-color");
        if (coercedWrites.length > 0) {
          diagnostics.push({
            code: "webgpu.userPass.renderWriteCoercedToSceneColor",
            severity: "warning",
            message: `User render pass '${built.name}' declared write target(s) ${JSON.stringify(coercedWrites)} that are not honored; it is drawn over scene-color (LOAD). Use a compute pass for arbitrary writable targets, or write to "scene-color".`,
            data: { pass: built.name, coercedWrites },
          });
        }
        const plan = buildFrameBoundaryTargetPlan({
          context,
          colorTarget: {
            source: "offscreen-target",
            texture: sceneTexture.resource.texture,
          },
          colorLoadOp: "load",
          depthTarget: {
            view: options.depthAttachment.view,
            depthLoadOp: "load",
            depthStoreOp: "store",
          },
        });
        graph.addRenderPass({
          name: built.name,
          // LOAD ⇒ also a read of scene-color, so the compiler orders this after
          // the scene node and forces it to store scene-color for the overlay.
          reads: [...built.reads, sceneColorHandle],
          writes: [{ handle: sceneColorHandle, attachment: "load" }],
          commands: built.commands,
        });
        payloads.set(built.name, {
          device,
          attachments: plan.attachments,
          commands: built.commands,
          label: built.name,
          colorTargetSource: "offscreen-target",
          readbackTexture: plan.texture.texture,
        });
        records.push({
          name: built.name,
          texture: plan.texture,
          attachments: plan.attachments,
        });
        userPassNodeNames.push(built.name);
        plannedCommands += built.commands.length;
        drawCalls += countDrawCommands(built.commands);
      }
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
    const usesColorHistory = effect.requiresColorHistory === true;

    // A history effect must write its accumulation buffer off-screen (the pool's
    // current buffer) so the next frame can sample it; it cannot be the final
    // swapchain write. The graph path declines such a chain to the legacy path.
    if (usesColorHistory && isLast) {
      return null;
    }

    let outputTexture: WebGpuPostPassTextureResource | null = null;
    let historyForEffect: WebGpuPostPassTextureResource | undefined;
    let effectHistoryHandle: string | null = null;
    if (usesColorHistory) {
      // M3-T6: source this frame's write target (current) and last frame's
      // history (previous) from the persistent double-buffered pool, replacing
      // the per-effect ping/pong + closure. The graph owns history.
      const resolved = resolveWebGpuAppPostPassColorHistory({
        device: options.app.initialization.device as Parameters<
          typeof resolveWebGpuAppPostPassColorHistory
        >[0]["device"],
        slot: options.cache.postPasses.taaColorHistory,
        width: options.target.width,
        height: options.target.height,
        format: options.target.format,
        label: `${options.label}:post:${effectIndex}`,
      });
      diagnostics.push(...resolved.diagnostics);
      if (resolved.history === null) {
        return null;
      }
      taaColorHistory = resolved.history;
      outputTexture = resolved.history.pool.current();
      historyForEffect = resolved.history.pool.hasPrevious()
        ? resolved.history.pool.previous()
        : undefined;
      effectHistoryHandle = `post:${effectIndex}:color-history`;
      graph.declareHistory(effectHistoryHandle, {
        width: options.target.width,
        height: options.target.height,
        format: options.target.format,
        sampleCount: 1,
      });
    } else if (!isLast) {
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
      if (!intermediate.valid || intermediate.resource === null) {
        return null;
      }
      outputTexture = intermediate.resource;
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
      ...(depthTexture === undefined ? {} : { depth: depthTexture }),
      ...(motionVectorTexture === null
        ? {}
        : { motionVector: motionVectorTexture }),
      ...(historyForEffect === undefined ? {} : { history: historyForEffect }),
      ...(outputTexture === null ? {} : { output: outputTexture }),
      label: `${options.label}:post:${effect.id}`,
    });
    diagnostics.push(...prepared.diagnostics);

    const readback =
      isLast && options.readbackSamples !== undefined
        ? {
            format: options.target.format,
            width: options.target.width,
            height: options.target.height,
            samples: options.readbackSamples,
          }
        : undefined;

    if (prepared.graph !== undefined) {
      const passes = prepared.graph.passes;
      if (passes.length === 0) {
        return null;
      }
      const nodeNames: string[] = [];
      let passInputHandle = inputHandle;
      let plannedDrawCalls = 0;
      let lastOutputResource: WebGpuPostPassTextureResource | null = null;
      let lastOutput: "swapchain" | "offscreen" = "offscreen";

      for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
        const graphPass = passes[passIndex];
        if (graphPass === undefined) {
          continue;
        }
        diagnostics.push(...graphPass.diagnostics);
        const isSwapchainPass = graphPass.output === "swapchain";
        if (!isSwapchainPass && graphPass.outputResource === undefined) {
          return null;
        }
        const writeHandle = isSwapchainPass
          ? "swapchain"
          : `post:${effectIndex}:gp:${passIndex}`;
        const nodeName = `${options.label}:post:${effectIndex}:${effect.id}:${passIndex}:${graphPass.kind}`;
        const graphPassOutput = graphPass.outputResource;
        registerNode({
          name: nodeName,
          reads: [passInputHandle],
          writeHandle,
          planOptions: {
            context,
            ...(isSwapchainPass || graphPassOutput === undefined
              ? {}
              : {
                  colorTarget: {
                    source: "offscreen-target",
                    texture: graphPassOutput.texture,
                  },
                }),
            clearColor: [0, 0, 0, 1],
          },
          commands: graphPass.commands,
          colorTargetSource: isSwapchainPass
            ? "current-texture"
            : "offscreen-target",
          ...(isSwapchainPass && readback !== undefined ? { readback } : {}),
        });
        nodeNames.push(nodeName);
        plannedDrawCalls += countDrawCommands(graphPass.commands);
        plannedCommands += graphPass.commands.length;
        drawCalls += countDrawCommands(graphPass.commands);
        passInputHandle = writeHandle;
        lastOutput = graphPass.output;
        lastOutputResource = isSwapchainPass
          ? null
          : (graphPass.outputResource ?? null);
      }

      const outputPresent = isLast || lastOutputResource !== null;
      effectMetas.push({
        kind: "graph",
        effectId: prepared.effectId,
        label: prepared.label,
        inputLabel: input.label,
        isLast,
        nodeNames,
        preparedOk: prepared.diagnostics.length === 0,
        outputPresent,
        output: lastOutput,
        plannedDrawCalls,
        graphReport: prepared.graph.report,
      });

      if (!isLast) {
        if (lastOutputResource === null) {
          return null;
        }
        input = lastOutputResource;
        inputHandle = passInputHandle;
      }
      continue;
    }

    // ---- single-boundary effect ----
    // A history effect writes the pool's 'current' buffer (its declareHistory
    // handle); other non-last effects write a transient intermediate.
    const writeHandle = isLast
      ? "swapchain"
      : (effectHistoryHandle ?? `post:${effectIndex}`);
    // A motion-vector consumer reads the scene node's motion target, ordering it
    // after the scene pass. The history 'previous' buffer is last frame's data,
    // so it needs no intra-frame read edge.
    const effectReads =
      motionVectorHandle !== null && effect.requiresMotionVectors === true
        ? [inputHandle, motionVectorHandle]
        : [inputHandle];
    const nodeName = `${options.label}:post:${effectIndex}:${effect.id}`;
    registerNode({
      name: nodeName,
      reads: effectReads,
      writeHandle,
      planOptions: {
        context,
        ...(isLast || outputTexture === null
          ? {}
          : {
              colorTarget: {
                source: "offscreen-target",
                texture: outputTexture.texture,
              },
            }),
        clearColor: [0, 0, 0, 1],
      },
      commands: prepared.commands,
      colorTargetSource: isLast ? "current-texture" : "offscreen-target",
      ...(isLast && readback !== undefined ? { readback } : {}),
    });
    effectMetas.push({
      kind: "single",
      effectId: prepared.effectId,
      label: prepared.label,
      inputLabel: input.label,
      isLast,
      nodeNames: [nodeName],
      preparedOk: prepared.diagnostics.length === 0,
      outputPresent: isLast || outputTexture !== null,
      output: isLast ? "swapchain" : "offscreen",
      plannedDrawCalls: null,
    });
    plannedCommands += prepared.commands.length;
    drawCalls += countDrawCommands(prepared.commands);
    if (!isLast && outputTexture !== null) {
      input = outputTexture;
      inputHandle = writeHandle;
    }
  }

  // ---- execute the whole post stack in ONE encoder ----
  const resources: FrameGraphResources = {
    resolveAttachment: () => null,
    resolveRenderBoundary: (node) => payloads.get(node.name) ?? null,
  };
  const compiled = compileFrameGraph(graph);
  const exec = executeFrameGraph({
    device,
    queue,
    compiled,
    resources,
    label: options.label,
  });

  // M3-T7: additive graph sub-report — the compiled node order + each inserted
  // user pass's execution (names/counts only, JSON-safe).
  const graphReport: WebGpuAppPostGraphReport = {
    order: compiled.orderedNodes.map((node) => node.name),
    userPasses: userPassNodeNames.map((name) => {
      const node = exec.nodes.find((entry) => entry.name === name);
      const executedCommands =
        node === undefined
          ? 0
          : node.kind === "compute"
            ? (node.execution?.executedCommands ?? 0)
            : (node.encode.execution?.executedCommands ?? 0);
      return {
        name,
        kind: node?.kind === "compute" ? "compute" : "render",
        ran: (node?.valid ?? false) && executedCommands > 0,
        executedCommands,
      };
    }),
  };

  // M3-T6: advance the history pool exactly ONCE per frame, at end-of-execute —
  // this frame's write (current) becomes next frame's history (previous). All
  // bind groups were already built against the pre-swap views during prepare(),
  // so the swap only rotates which buffer the next frame samples/writes; doing
  // it once here (not per node) keeps a frame that touches history consistent.
  taaColorHistory?.pool.swap();

  const frameOk = exec.finish?.valid === true && exec.submit?.valid === true;
  const encodeByName = new Map<string, FrameBoundaryEncodeReport>();
  for (const node of exec.nodes) {
    if (node.kind === "render") {
      encodeByName.set(node.name, node.encode);
    }
  }

  // ---- synthesize legacy-compatible boundaries + reports ----
  const boundaries: FrameBoundaryAssemblyReport[] = records.map((record) => {
    const encode = encodeByName.get(record.name);
    return synthesizePostGraphBoundary({
      encode,
      frameOk,
      texture: record.texture,
      attachments: record.attachments,
      encoder: exec.encoder,
      finish: exec.finish,
      submit: exec.submit,
    });
  });

  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  for (const boundary of boundaries) {
    if (boundary.readback !== null && boundary.readback !== undefined) {
      readbackBoundary = boundary;
    }
  }

  const sceneEncode = encodeByName.get(sceneNodeName);
  let valid = (sceneEncode?.valid ?? false) && frameOk;

  const postEffects: WebGpuAppPostEffectSubmissionReport[] = effectMetas.map(
    (meta) => {
      const nodeEncodes = meta.nodeNames.map((name) => encodeByName.get(name));
      const nodesValid = nodeEncodes.every((encode) => encode?.valid === true);
      const effectDrawCalls =
        meta.plannedDrawCalls !== null
          ? meta.plannedDrawCalls
          : (nodeEncodes[0]?.execution?.drawCalls ?? 0);
      const ok = nodesValid && frameOk && meta.preparedOk && meta.outputPresent;
      valid &&= ok;
      return {
        effectId: meta.effectId,
        label: meta.label,
        viewId: options.target.view.viewId,
        input: meta.inputLabel,
        output: meta.output,
        ok,
        drawCalls: effectDrawCalls,
        ...(meta.graphReport === undefined ? {} : { graph: meta.graphReport }),
      };
    },
  );

  const renderTarget: WebGpuAppRenderTargetSubmissionReport = {
    viewId: options.target.view.viewId,
    source: "swapchain",
    renderTargetKey: null,
    width: options.target.width,
    height: options.target.height,
    format: options.target.format,
    ok: valid,
    drawCalls: sceneEncode?.execution?.drawCalls ?? 0,
    graph: graphReport,
  };

  return {
    valid,
    boundaries,
    renderTarget,
    postEffects,
    readbackBoundary,
    plannedCommands,
    drawCalls,
    diagnostics,
    graph: graphReport,
  };
}

function synthesizePostGraphBoundary(args: {
  readonly encode: FrameBoundaryEncodeReport | undefined;
  readonly frameOk: boolean;
  readonly texture: ReturnType<typeof buildFrameBoundaryTargetPlan>["texture"];
  readonly attachments: ReturnType<
    typeof buildFrameBoundaryTargetPlan
  >["attachments"];
  readonly encoder: ReturnType<typeof executeFrameGraph>["encoder"];
  readonly finish: ReturnType<typeof executeFrameGraph>["finish"];
  readonly submit: ReturnType<typeof executeFrameGraph>["submit"];
}): FrameBoundaryAssemblyReport {
  const encode = args.encode;
  return {
    valid: (encode?.valid ?? false) && args.frameOk,
    texture: args.texture,
    attachments: args.attachments,
    encoder: args.encoder,
    begin: encode?.begin ?? null,
    rectangle: encode?.rectangle ?? null,
    execution: encode?.execution ?? null,
    renderBundle: encode?.renderBundle ?? null,
    end: encode?.end ?? null,
    finish: args.finish,
    submit: args.submit,
    readback: encode?.readback ?? null,
    gpuTiming: encode?.gpuTiming ?? null,
    occlusionQueries: encode?.occlusionQueries ?? null,
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
