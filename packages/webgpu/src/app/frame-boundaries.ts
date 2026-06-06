import type { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import {
  countWebGpuAppFrameBoundaryTargetSubmissions,
  createWebGpuAppFrameBoundaryTargets,
  findLastSwapchainTargetIndex,
  resolveWebGpuAppTargetViewRectangles,
  webGpuAppFrameBoundaryTargetSubmissionKey,
} from "./frame-target.js";
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
import type { GpuTimestampQueryDiagnostic } from "../gpu/gpu-timing.js";
import {
  planGpuOcclusionFeedbackCulling,
  type GpuOcclusionQueryDiagnostic,
} from "../gpu/occlusion-query.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import type { StandardFrameTransmissionSceneColorResources } from "../materials/standard/standard-frame-resources.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { RenderPassAttachmentLoadOp } from "../render/passes/render-pass-attachments.js";
import {
  type WebGpuApp,
  type WebGpuAppDepthAttachmentReport,
  type WebGpuAppPostEffectSubmissionReport,
  type WebGpuAppRenderBundleReport,
  type WebGpuAppRenderTargetSubmissionReport,
  type WebGpuAppResourceReuseReport,
  type WebGpuAppTransmissionGrabPassReport,
} from "./app.js";
import { createWebGpuAppDepthAttachmentReport } from "./report.js";
import {
  createWebGpuAppDepthAttachmentForTarget,
  createWebGpuAppMsaaColorTargetForTarget,
  createWebGpuAppMsaaReport,
  type WebGpuAppMsaaReport,
} from "./attachments.js";
import {
  createWebGpuAppGpuTimingForTarget,
  type WebGpuAppGpuTimingReadback,
  type WebGpuAppOcclusionQueryReadback,
} from "./gpu-readback.js";
import {
  assembleWebGpuAppTransmissionGrabPass,
  buildWebGpuAppTransmissionGrabBoundaryOptions,
} from "./transmission-grab.js";
import {
  buildShadowCasterDepthAttachmentPlan,
  type ShadowCasterGraphPass,
} from "./shadow-caster-graph-pass.js";
import {
  createWebGpuAppOcclusionQueryResources,
  createWebGpuAppRenderBundleCommandKey,
  createWebGpuAppRenderBundleReport,
} from "./frame-boundary-support.js";
import {
  appendWebGpuAppOcclusionCullingPlan,
  collectOcclusionQueryRenderIds,
  commandsWithoutOcclusionQueryCommands,
  commandsWithoutSkippedOcclusionDraws,
  createWebGpuAppOcclusionCullingReport,
  normalizeOcclusionQueryCommands,
  recordWebGpuAppOcclusionCullingFallback,
  type WebGpuAppOcclusionCullingReport,
} from "./occlusion-culling.js";
import { countDrawCommands, writeCommandsForView } from "./view-commands.js";
import { writeSkyboxCommandsForView } from "./skybox.js";
import { assembleWebGpuAppPostProcessedSwapchainTarget } from "./post-processing.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

export interface WebGpuAppFrameBoundaryAssemblyResult {
  readonly valid: boolean;
  readonly boundary: FrameBoundaryAssemblyReport | null;
  readonly boundaries: readonly FrameBoundaryAssemblyReport[];
  readonly renderTargets: readonly WebGpuAppRenderTargetSubmissionReport[];
  readonly postEffects: readonly WebGpuAppPostEffectSubmissionReport[];
  readonly transmissionGrabPass?: WebGpuAppTransmissionGrabPassReport;
  readonly msaa?: WebGpuAppMsaaReport;
  readonly depthAttachment?: WebGpuAppDepthAttachmentReport;
  readonly renderBundles?: WebGpuAppRenderBundleReport;
  readonly readbackBoundary: FrameBoundaryAssemblyReport | null;
  readonly gpuTimingReadbacks: readonly WebGpuAppGpuTimingReadback[];
  readonly gpuTimingDiagnostics: readonly GpuTimestampQueryDiagnostic[];
  readonly occlusionQueryReadbacks: readonly WebGpuAppOcclusionQueryReadback[];
  readonly occlusionQueryDiagnostics: readonly GpuOcclusionQueryDiagnostic[];
  readonly occlusionCulling: WebGpuAppOcclusionCullingReport;
  readonly occlusionQueryCount: number;
  readonly plannedCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: readonly unknown[];
}

export async function assembleWebGpuAppFrameBoundaries(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly commands: readonly RenderPassCommand[];
  readonly overlayCommands?: readonly RenderPassCommand[];
  readonly label: string;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly motionVectorColorFormat?: string | null;
  readonly indirectColorFormat?: string | null;
  readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
  readonly clearColor?: readonly number[];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly enableRenderBundles?: boolean;
  // M3-T5: shadow caster passes to fold into the forward encoder as depth-only
  // graph nodes the opaque pass reads (only used when useFrameGraph is on).
  readonly shadowCasterGraphPasses?: readonly ShadowCasterGraphPass[];
}): Promise<WebGpuAppFrameBoundaryAssemblyResult> {
  const targetPlan = createWebGpuAppFrameBoundaryTargets(
    options.app,
    options.assets,
    options.snapshot,
  );

  if (targetPlan.diagnostics.length > 0) {
    return {
      valid: false,
      boundary: null,
      boundaries: [],
      renderTargets: [],
      postEffects: [],
      readbackBoundary: null,
      gpuTimingReadbacks: [],
      gpuTimingDiagnostics: [],
      occlusionQueryReadbacks: [],
      occlusionQueryDiagnostics: [],
      occlusionCulling: createWebGpuAppOcclusionCullingReport(),
      occlusionQueryCount: 0,
      plannedCommands: 0,
      drawCalls: 0,
      diagnostics: targetPlan.diagnostics,
    };
  }

  const boundaries: FrameBoundaryAssemblyReport[] = [];
  const renderTargets: WebGpuAppRenderTargetSubmissionReport[] = [];
  const postEffects: WebGpuAppPostEffectSubmissionReport[] = [];
  const diagnostics: unknown[] = [];
  const activePostEffects = options.app.postEffects.filter(
    (effect) => effect.enabled !== false,
  );
  let firstBoundary: FrameBoundaryAssemblyReport | null = null;
  let firstDepthAttachment: WebGpuAppDepthAttachmentReport | undefined;
  let readbackBoundary: FrameBoundaryAssemblyReport | null = null;
  const gpuTimingReadbacks: WebGpuAppGpuTimingReadback[] = [];
  const gpuTimingDiagnostics: GpuTimestampQueryDiagnostic[] = [];
  const occlusionQueryReadbacks: WebGpuAppOcclusionQueryReadback[] = [];
  const occlusionQueryDiagnostics: GpuOcclusionQueryDiagnostic[] = [];
  const occlusionCulling = createWebGpuAppOcclusionCullingReport();
  let transmissionGrabPassReport:
    | WebGpuAppTransmissionGrabPassReport
    | undefined;
  let plannedCommands = 0;
  let drawCalls = 0;
  let occlusionQueryCount = 0;
  let msaaColorTargets = 0;
  let msaaColorTexturesCreated = 0;
  let msaaColorTexturesReused = 0;
  let allTargetsValid = true;
  const submittedTargetCounts = new Map<string, number>();
  const targetSubmissionTotals = countWebGpuAppFrameBoundaryTargetSubmissions(
    targetPlan.targets,
  );
  const lastSwapchainTargetIndex = findLastSwapchainTargetIndex(
    targetPlan.targets,
  );

  // M3-T4: route the whole multi-target forward frame through ONE FrameGraph
  // (single command buffer) when useFrameGraph is on and there are no post
  // effects or transmission-grab pass (those keep the legacy path for now).
  const forwardGraphEligible =
    options.app.useFrameGraph === true && activePostEffects.length === 0;
  const forwardGraph = forwardGraphEligible ? createFrameGraph() : null;
  const forwardGraphPayloads = new Map<string, FrameGraphRenderNodeBoundary>();
  const forwardGraphEntries: ForwardGraphTargetEntry[] = [];
  // M3-T4: transmission-grab passes collected as graph nodes (they render the
  // scene to the grab texture the main pass samples; same encoder, grab first).
  const forwardGraphGrabEntries: ForwardGraphGrabEntry[] = [];

  // M3-T5: shadow caster passes become DEPTH-ONLY graph nodes registered BEFORE
  // the forward target nodes; each forward node reads the shadow depth handles so
  // the compiler orders shadows first and the receiver samples a freshly-written,
  // single-encoder-consistent depth map (one encoder, one submit for shadows +
  // opaque). The caller (route/example) hands resolved caster passes in.
  const forwardGraphShadowEntries: ForwardGraphShadowEntry[] = [];
  const forwardGraphShadowReads: string[] = [];
  if (forwardGraph !== null) {
    const shadowDevice = options.app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"];
    for (const shadowPass of options.shadowCasterGraphPasses ?? []) {
      const handle = `shadow:${shadowPass.key}`;
      if (forwardGraph.handle(handle) === undefined) {
        forwardGraph.declareTransient(handle, {
          kind: "depth-texture",
          width: shadowPass.width,
          height: shadowPass.height,
          format: shadowPass.depthFormat,
          sampleCount: 1,
        });
      }
      const shadowNodeName = `${options.label}:shadow:${shadowPass.key}:fg`;
      forwardGraph.addRenderPass({
        name: shadowNodeName,
        reads: [],
        writes: [{ handle, attachment: shadowPass.depthLoadOp }],
        commands: shadowPass.commands,
      });
      forwardGraphPayloads.set(shadowNodeName, {
        device: shadowDevice,
        attachments: buildShadowCasterDepthAttachmentPlan(shadowPass),
        commands: shadowPass.commands,
        label: shadowNodeName,
        colorTargetSource: "offscreen-target",
      });
      forwardGraphShadowEntries.push({
        nodeName: shadowNodeName,
        key: shadowPass.key,
      });
      forwardGraphShadowReads.push(handle);
    }
  }

  for (
    let targetIndex = 0;
    targetIndex < targetPlan.targets.length;
    targetIndex += 1
  ) {
    const target = targetPlan.targets[targetIndex];

    if (target === undefined) {
      continue;
    }

    const viewRectangles = resolveWebGpuAppTargetViewRectangles(target);

    diagnostics.push(...viewRectangles.diagnostics);
    allTargetsValid &&= viewRectangles.valid;

    const skybox = await writeSkyboxCommandsForView({
      app: options.app,
      assets: options.assets,
      cache: options.cache,
      snapshot: options.snapshot,
      view: target.view,
      target: options.cache.frameScratch.skyboxCommands,
      reuse: options.reuse,
    });
    const commandsForView = writeCommandsForView(
      options.commands,
      options.snapshot,
      target.view,
      options.cache.frameScratch.viewCommands,
      skybox.commands,
    );
    const occlusionCandidateRenderIds =
      collectOcclusionQueryRenderIds(commandsForView);
    const occlusionCullingPlan = planGpuOcclusionFeedbackCulling({
      state: options.cache.occlusionFeedback,
      viewId: target.view.viewId,
      frame: options.snapshot.frame,
      candidateRenderIds: occlusionCandidateRenderIds,
    });
    appendWebGpuAppOcclusionCullingPlan(occlusionCulling, occlusionCullingPlan);
    const commands = commandsWithoutSkippedOcclusionDraws(
      commandsForView,
      occlusionCullingPlan.skippedRenderIds,
      options.cache.frameScratch.occlusionCulledCommands,
    );
    const occlusionRenderIds = normalizeOcclusionQueryCommands(commands);
    occlusionCulling.queriedDraws += occlusionRenderIds.length;
    const occlusionQueries =
      occlusionRenderIds.length === 0
        ? null
        : createWebGpuAppOcclusionQueryResources({
            app: options.app,
            cache: options.cache,
            label: options.label,
            target,
            queryCount: occlusionRenderIds.length,
          });
    const commandsForBoundary =
      occlusionRenderIds.length > 0 && occlusionQueries?.resources === null
        ? commandsWithoutOcclusionQueryCommands(
            commands,
            options.cache.frameScratch.occlusionFallbackCommands,
          )
        : commands;

    if (occlusionRenderIds.length > 0 && occlusionQueries?.resources === null) {
      recordWebGpuAppOcclusionCullingFallback(occlusionCulling, "unsupported");
    }
    occlusionQueryCount += occlusionRenderIds.length;
    occlusionQueryDiagnostics.push(...(occlusionQueries?.diagnostics ?? []));
    diagnostics.push(...(occlusionQueries?.diagnostics ?? []));
    allTargetsValid &&= occlusionQueries === null || occlusionQueries.valid;
    diagnostics.push(...skybox.diagnostics);
    allTargetsValid &&= skybox.valid;
    const depthAttachment = createWebGpuAppDepthAttachmentForTarget(
      options.app,
      options.cache,
      target,
    );
    const msaaColorTarget = createWebGpuAppMsaaColorTargetForTarget(
      options.app,
      options.cache,
      target,
    );
    diagnostics.push(...msaaColorTarget.diagnostics);
    allTargetsValid &&= msaaColorTarget.valid;

    if (msaaColorTarget.resource !== null) {
      msaaColorTargets += 1;

      if (msaaColorTarget.status === "created") {
        msaaColorTexturesCreated += 1;
      } else if (msaaColorTarget.status === "reused") {
        msaaColorTexturesReused += 1;
      }
    }

    const targetSubmissionKey =
      webGpuAppFrameBoundaryTargetSubmissionKey(target);
    const previousTargetSubmissions =
      submittedTargetCounts.get(targetSubmissionKey) ?? 0;
    const targetSubmissionTotal =
      targetSubmissionTotals.get(targetSubmissionKey) ?? 0;
    const loadExistingTarget = previousTargetSubmissions > 0;
    const storeMsaaColorForLaterLoad =
      msaaColorTarget.resource !== null &&
      previousTargetSubmissions + 1 < targetSubmissionTotal;
    const colorLoadOp: RenderPassAttachmentLoadOp = loadExistingTarget
      ? "load"
      : "clear";
    const depthLoadOp: RenderPassAttachmentLoadOp = loadExistingTarget
      ? "load"
      : "clear";

    const includeReadback =
      options.readbackSamples !== undefined &&
      readbackBoundary === null &&
      target.source === "swapchain" &&
      targetIndex === lastSwapchainTargetIndex;
    const gpuTiming = await createWebGpuAppGpuTimingForTarget(
      options.app,
      options.cache,
      options.label,
      target,
    );
    gpuTimingDiagnostics.push(...gpuTiming.diagnostics);

    if (gpuTiming.resources !== null) {
      gpuTimingReadbacks.push({
        passName: gpuTiming.passName,
        resources: gpuTiming.resources,
      });
    }

    const overlayCommands =
      target.source === "swapchain" ? (options.overlayCommands ?? []) : [];
    const commandsForBoundaryWithOverlay =
      overlayCommands.length === 0
        ? commandsForBoundary
        : [...commandsForBoundary, ...overlayCommands];

    if (target.source === "swapchain" && activePostEffects.length > 0) {
      const postTarget = assembleWebGpuAppPostProcessedSwapchainTarget({
        app: options.app,
        cache: options.cache,
        snapshot: options.snapshot,
        target,
        commands: commandsForBoundary,
        overlayCommands,
        depthAttachment,
        effects: activePostEffects,
        label: options.label,
        clearColor: options.clearColor ?? target.view.clearColor,
        useFrameGraph: options.app.useFrameGraph,
        ...(options.motionVectorColorFormat === undefined
          ? {}
          : { motionVectorColorFormat: options.motionVectorColorFormat }),
        ...(options.indirectColorFormat === undefined ||
        options.indirectColorFormat === null
          ? {}
          : { indirectColorFormat: options.indirectColorFormat }),
        ...(msaaColorTarget.resource === null
          ? {}
          : {
              msaaColorTarget: {
                view: msaaColorTarget.resource.view,
                sampleCount: msaaColorTarget.resource.sampleCount,
              },
            }),
        ...(includeReadback
          ? { readbackSamples: options.readbackSamples }
          : {}),
        ...(gpuTiming.resources === null
          ? {}
          : {
              gpuTiming: {
                passName: gpuTiming.passName,
                resources: gpuTiming.resources,
              },
            }),
        ...(occlusionQueries?.resources === undefined ||
        occlusionQueries.resources === null
          ? {}
          : {
              occlusionQueries: {
                resources: occlusionQueries.resources,
                queryCount: occlusionRenderIds.length,
              },
            }),
      });
      const sceneOcclusionQueries =
        postTarget.boundaries[0]?.occlusionQueries ?? null;

      for (const boundary of postTarget.boundaries) {
        occlusionQueryDiagnostics.push(
          ...(boundary.occlusionQueries?.diagnostics ?? []),
        );
      }

      if (
        occlusionQueries?.resources !== undefined &&
        occlusionQueries.resources !== null &&
        sceneOcclusionQueries?.valid === true
      ) {
        occlusionQueryReadbacks.push({
          passName: gpuTiming.passName,
          viewId: target.view.viewId,
          resources: occlusionQueries.resources,
          renderIds: [...occlusionRenderIds],
        });
      }

      firstBoundary ??= postTarget.boundaries[0] ?? null;
      firstDepthAttachment ??= createWebGpuAppDepthAttachmentReport(
        options.snapshot,
        depthAttachment,
      );
      readbackBoundary ??= postTarget.readbackBoundary;
      boundaries.push(...postTarget.boundaries);
      renderTargets.push(postTarget.renderTarget);
      postEffects.push(...postTarget.postEffects);
      plannedCommands += postTarget.plannedCommands;
      drawCalls += postTarget.drawCalls;
      allTargetsValid &&= postTarget.valid;
      if (postTarget.valid) {
        submittedTargetCounts.set(
          targetSubmissionKey,
          previousTargetSubmissions + 1,
        );
      }
      diagnostics.push(...postTarget.diagnostics);
      continue;
    }

    if (
      options.transmissionSceneColorResources !== undefined &&
      options.transmissionSceneColorResources !== null
    ) {
      const grabPassOptions = {
        app: options.app,
        target,
        commands: commandsForBoundary,
        depthAttachment,
        label: options.label,
        clearColor: options.clearColor ?? target.view.clearColor,
        resources: options.transmissionSceneColorResources,
      };

      if (forwardGraph !== null) {
        // graph path: register the grab as a node BEFORE the main target node;
        // the grab stores its texture (same options as legacy) and the main
        // pass samples it — one shared encoder, grab encoded first (insertion).
        const grab =
          buildWebGpuAppTransmissionGrabBoundaryOptions(grabPassOptions);
        const grabHandle = `transmission-grab:${targetSubmissionKey}`;
        if (forwardGraph.handle(grabHandle) === undefined) {
          forwardGraph.declareTransient(grabHandle, {
            kind: "color-texture",
            width: grab.reportBase.width,
            height: grab.reportBase.height,
            format: grab.reportBase.format,
            sampleCount: 1,
          });
        }
        const grabPlan = buildFrameBoundaryTargetPlan({
          context: grab.boundaryOptions.context,
          ...(grab.boundaryOptions.colorTarget === undefined
            ? {}
            : { colorTarget: grab.boundaryOptions.colorTarget }),
          ...(grab.boundaryOptions.clearColor === undefined
            ? {}
            : { clearColor: grab.boundaryOptions.clearColor }),
          ...(grab.boundaryOptions.depthTarget === undefined
            ? {}
            : { depthTarget: grab.boundaryOptions.depthTarget }),
        });
        const grabNodeName = `${grab.boundaryOptions.label}:fg`;
        forwardGraph.addRenderPass({
          name: grabNodeName,
          reads: [],
          writes: [{ handle: grabHandle, attachment: "clear" }],
          commands: grab.boundaryOptions.commands,
        });
        forwardGraphPayloads.set(grabNodeName, {
          device: grab.boundaryOptions.device,
          attachments: grabPlan.attachments,
          commands: grab.boundaryOptions.commands,
          label: grab.boundaryOptions.label,
          colorTargetSource: "offscreen-target",
          readbackTexture: grabPlan.texture.texture,
        });
        forwardGraphGrabEntries.push({
          nodeName: grabNodeName,
          texture: grabPlan.texture,
          attachments: grabPlan.attachments,
          reportBase: grab.reportBase,
        });
        plannedCommands += grab.reportBase.commands;
        drawCalls += grab.reportBase.drawCalls;
      } else {
        const transmissionGrabPass =
          assembleWebGpuAppTransmissionGrabPass(grabPassOptions);
        firstBoundary ??= transmissionGrabPass.boundary;
        boundaries.push(transmissionGrabPass.boundary);
        plannedCommands += transmissionGrabPass.report.commands;
        drawCalls += transmissionGrabPass.report.drawCalls;
        allTargetsValid &&= transmissionGrabPass.boundary.valid;
        transmissionGrabPassReport = transmissionGrabPass.report;
        diagnostics.push(...transmissionGrabPass.diagnostics);
      }
    }

    const sampleCount = msaaColorTarget.resource?.sampleCount ?? 1;
    const renderBundleDescriptor = {
      colorFormats: [target.format],
      depthStencilFormat: WEBGPU_APP_DEPTH_FORMAT,
      sampleCount,
    };
    const renderBundleKey = createWebGpuAppRenderBundleCommandKey({
      target,
      descriptor: renderBundleDescriptor,
      commands: commandsForBoundaryWithOverlay,
      cache: options.cache.renderBundles,
    });
    const boundaryOptions: Parameters<typeof assembleFrameBoundary>[0] = {
      context: options.app.initialization.context as Parameters<
        typeof assembleFrameBoundary
      >[0]["context"],
      device: options.app.initialization.device as Parameters<
        typeof assembleFrameBoundary
      >[0]["device"],
      queue: (options.app.initialization.device as { readonly queue: unknown })
        .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
      commands: commandsForBoundaryWithOverlay,
      label: `${options.label}:${target.renderTargetKey ?? "swapchain"}`,
      colorLoadOp,
      viewport: viewRectangles.viewport,
      scissor: viewRectangles.scissor,
      ...(target.source === "offscreen"
        ? {
            colorTarget: {
              source: "offscreen-target" as const,
              texture: target.texture,
            },
          }
        : {}),
      ...(colorLoadOp === "clear"
        ? { clearColor: options.clearColor ?? target.view.clearColor }
        : {}),
      depthTarget: {
        view: depthAttachment.view,
        ...(depthLoadOp === "clear"
          ? { depthClearValue: target.view.clearDepth }
          : {}),
        depthLoadOp,
        depthStoreOp: "store",
      },
      ...(commandsForBoundaryWithOverlay.length === 0 ||
      options.enableRenderBundles === false ||
      overlayCommands.length > 0 ||
      occlusionRenderIds.length > 0
        ? {}
        : {
            renderBundle: {
              cache: options.cache.renderBundles,
              key: renderBundleKey,
              descriptor: renderBundleDescriptor,
            },
          }),
      ...(msaaColorTarget.resource === null
        ? {}
        : {
            msaaColorTarget: {
              view: msaaColorTarget.resource.view,
              sampleCount: msaaColorTarget.resource.sampleCount,
            },
            ...(storeMsaaColorForLaterLoad
              ? { msaaColorStoreOp: "store" as const }
              : {}),
          }),
      ...(gpuTiming.resources === null
        ? {}
        : {
            gpuTiming: {
              passName: gpuTiming.passName,
              resources: gpuTiming.resources,
            },
          }),
      ...(occlusionQueries?.resources === undefined ||
      occlusionQueries.resources === null
        ? {}
        : {
            occlusionQueries: {
              resources: occlusionQueries.resources,
              queryCount: occlusionRenderIds.length,
            },
          }),
      ...(includeReadback
        ? {
            readback: {
              format: target.format,
              width: target.width,
              height: target.height,
              samples: options.readbackSamples,
            },
          }
        : {}),
    };

    // M3-T4: in FrameGraph mode, collect this target as a graph node + payload
    // and defer its boundary-dependent reads; the whole frame is encoded into
    // one command buffer after the loop. The boundary-independent bookkeeping
    // (depth report, planned counts, submission count for the next target's
    // load/clear) happens here so subsequent targets compute load/clear identically.
    if (forwardGraph !== null) {
      registerForwardGraphTarget({
        graph: forwardGraph,
        payloads: forwardGraphPayloads,
        entries: forwardGraphEntries,
        boundaryOptions,
        target,
        targetSubmissionKey,
        msaaSampleCount: msaaColorTarget.resource?.sampleCount ?? null,
        occlusionQueries,
        occlusionRenderIds,
        gpuTimingPassName: gpuTiming.passName,
        shadowReads: forwardGraphShadowReads,
      });
      firstDepthAttachment ??= createWebGpuAppDepthAttachmentReport(
        options.snapshot,
        depthAttachment,
      );
      plannedCommands += commandsForBoundaryWithOverlay.length;
      drawCalls += countDrawCommands(commandsForBoundaryWithOverlay);
      submittedTargetCounts.set(
        targetSubmissionKey,
        previousTargetSubmissions + 1,
      );
      continue;
    }

    const boundary = assembleFrameBoundary(boundaryOptions);

    firstBoundary ??= boundary;
    firstDepthAttachment ??= createWebGpuAppDepthAttachmentReport(
      options.snapshot,
      depthAttachment,
    );

    if (boundary.readback !== null && boundary.readback !== undefined) {
      readbackBoundary = boundary;
    }

    boundaries.push(boundary);
    allTargetsValid &&= boundary.valid;
    if (boundary.valid) {
      submittedTargetCounts.set(
        targetSubmissionKey,
        previousTargetSubmissions + 1,
      );
    }
    occlusionQueryDiagnostics.push(
      ...(boundary.occlusionQueries?.diagnostics ?? []),
    );

    if (
      occlusionQueries?.resources !== undefined &&
      occlusionQueries.resources !== null &&
      boundary.occlusionQueries?.valid === true
    ) {
      occlusionQueryReadbacks.push({
        passName: gpuTiming.passName,
        viewId: target.view.viewId,
        resources: occlusionQueries.resources,
        renderIds: [...occlusionRenderIds],
      });
    }

    renderTargets.push({
      viewId: target.view.viewId,
      source: target.source,
      renderTargetKey: target.renderTargetKey,
      width: target.width,
      height: target.height,
      format: target.format,
      ok: boundary.valid,
      drawCalls: boundary.execution?.drawCalls ?? 0,
      ...(msaaColorTarget.resource === null
        ? {}
        : { msaaSampleCount: msaaColorTarget.resource.sampleCount }),
    });
    plannedCommands += commandsForBoundaryWithOverlay.length;
    drawCalls += countDrawCommands(commandsForBoundaryWithOverlay);
    diagnostics.push(
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.renderBundle?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.occlusionQueries?.diagnostics ?? []),
      ...(boundary.rectangle?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    );
  }

  // M3-T4: execute the collected forward targets in ONE encoder, then rebuild
  // the legacy-compatible per-target boundaries + reports from the node results.
  if (
    forwardGraph !== null &&
    (forwardGraphEntries.length > 0 ||
      forwardGraphGrabEntries.length > 0 ||
      forwardGraphShadowEntries.length > 0)
  ) {
    const device = options.app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"];
    const queue = (
      options.app.initialization.device as { readonly queue: unknown }
    ).queue as Parameters<typeof assembleFrameBoundary>[0]["queue"];
    const exec = executeFrameGraph({
      device,
      queue,
      compiled: compileFrameGraph(forwardGraph),
      resources: {
        resolveAttachment: () => null,
        resolveRenderBoundary: (node) =>
          forwardGraphPayloads.get(node.name) ?? null,
      } satisfies FrameGraphResources,
      label: options.label,
    });
    const frameOk = exec.finish?.valid === true && exec.submit?.valid === true;
    const encodeByName = new Map<string, FrameBoundaryEncodeReport>();
    for (const node of exec.nodes) {
      if (node.kind === "render") {
        encodeByName.set(node.name, node.encode);
      }
    }

    // M3-T5: shadow caster nodes are ordered first (the forward nodes read their
    // depth handles). They are depth-only (no color boundary), so they fold their
    // encode validity + diagnostics into the frame rather than into boundaries[].
    for (const shadowEntry of forwardGraphShadowEntries) {
      const encode = encodeByName.get(shadowEntry.nodeName);
      allTargetsValid &&= (encode?.valid ?? false) && frameOk;
      diagnostics.push(
        ...(encode?.begin?.diagnostics ?? []),
        ...(encode?.execution?.diagnostics ?? []),
        ...(encode?.end?.diagnostics ?? []),
      );
    }

    // grab nodes are encoded first (insertion order) — synthesize their
    // boundaries + the transmission-grab report from the per-node encode reports.
    for (const grabEntry of forwardGraphGrabEntries) {
      const encode = encodeByName.get(grabEntry.nodeName);
      const grabBoundary: FrameBoundaryAssemblyReport = {
        valid: (encode?.valid ?? false) && frameOk,
        texture: grabEntry.texture,
        attachments: grabEntry.attachments,
        encoder: exec.encoder,
        begin: encode?.begin ?? null,
        rectangle: encode?.rectangle ?? null,
        execution: encode?.execution ?? null,
        renderBundle: encode?.renderBundle ?? null,
        end: encode?.end ?? null,
        finish: exec.finish,
        submit: exec.submit,
        readback: encode?.readback ?? null,
        gpuTiming: encode?.gpuTiming ?? null,
        occlusionQueries: encode?.occlusionQueries ?? null,
      };
      firstBoundary ??= grabBoundary;
      boundaries.push(grabBoundary);
      allTargetsValid &&= grabBoundary.valid;
      transmissionGrabPassReport = {
        ...grabEntry.reportBase,
        ok: grabBoundary.valid,
      };
      diagnostics.push(
        ...grabBoundary.texture.diagnostics,
        ...(grabBoundary.attachments?.diagnostics ?? []),
        ...(grabBoundary.encoder?.diagnostics ?? []),
        ...(grabBoundary.begin?.diagnostics ?? []),
        ...(grabBoundary.rectangle?.diagnostics ?? []),
        ...(grabBoundary.execution?.diagnostics ?? []),
        ...(grabBoundary.end?.diagnostics ?? []),
        ...(grabBoundary.finish?.diagnostics ?? []),
        ...(grabBoundary.submit?.diagnostics ?? []),
      );
    }

    for (const entry of forwardGraphEntries) {
      const encode = encodeByName.get(entry.nodeName);
      const boundary: FrameBoundaryAssemblyReport = {
        valid: (encode?.valid ?? false) && frameOk,
        texture: entry.texture,
        attachments: entry.attachments,
        encoder: exec.encoder,
        begin: encode?.begin ?? null,
        rectangle: encode?.rectangle ?? null,
        execution: encode?.execution ?? null,
        renderBundle: encode?.renderBundle ?? null,
        end: encode?.end ?? null,
        finish: exec.finish,
        submit: exec.submit,
        readback: encode?.readback ?? null,
        gpuTiming: encode?.gpuTiming ?? null,
        occlusionQueries: encode?.occlusionQueries ?? null,
      };

      firstBoundary ??= boundary;
      if (boundary.readback !== null && boundary.readback !== undefined) {
        readbackBoundary = boundary;
      }
      boundaries.push(boundary);
      allTargetsValid &&= boundary.valid;
      occlusionQueryDiagnostics.push(
        ...(boundary.occlusionQueries?.diagnostics ?? []),
      );
      if (
        entry.occlusionQueries?.resources !== undefined &&
        entry.occlusionQueries.resources !== null &&
        boundary.occlusionQueries?.valid === true
      ) {
        occlusionQueryReadbacks.push({
          passName: entry.gpuTimingPassName,
          viewId: entry.target.view.viewId,
          resources: entry.occlusionQueries.resources,
          renderIds: [...entry.occlusionRenderIds],
        });
      }
      renderTargets.push({
        viewId: entry.target.view.viewId,
        source: entry.target.source,
        renderTargetKey: entry.target.renderTargetKey,
        width: entry.target.width,
        height: entry.target.height,
        format: entry.target.format,
        ok: boundary.valid,
        drawCalls: boundary.execution?.drawCalls ?? 0,
        ...(entry.msaaSampleCount === null
          ? {}
          : { msaaSampleCount: entry.msaaSampleCount }),
      });
      diagnostics.push(
        ...boundary.texture.diagnostics,
        ...(boundary.attachments?.diagnostics ?? []),
        ...(boundary.encoder?.diagnostics ?? []),
        ...(boundary.begin?.diagnostics ?? []),
        ...(boundary.execution?.diagnostics ?? []),
        ...(boundary.renderBundle?.diagnostics ?? []),
        ...(boundary.end?.diagnostics ?? []),
        ...(boundary.occlusionQueries?.diagnostics ?? []),
        ...(boundary.rectangle?.diagnostics ?? []),
        ...(boundary.finish?.diagnostics ?? []),
        ...(boundary.submit?.diagnostics ?? []),
      );
    }
  }

  const renderBundleReport = createWebGpuAppRenderBundleReport(boundaries);

  return {
    valid:
      targetPlan.targets.length > 0 &&
      allTargetsValid &&
      boundaries.every((boundary) => boundary.valid) &&
      postEffects.every((effect) => effect.ok),
    boundary: firstBoundary,
    boundaries,
    renderTargets,
    postEffects,
    ...(transmissionGrabPassReport === undefined
      ? {}
      : { transmissionGrabPass: transmissionGrabPassReport }),
    ...(!options.app.msaa.enabled && !options.app.msaa.clamped
      ? {}
      : {
          msaa: createWebGpuAppMsaaReport({
            config: options.app.msaa,
            colorTargets: msaaColorTargets,
            colorTexturesCreated: msaaColorTexturesCreated,
            colorTexturesReused: msaaColorTexturesReused,
          }),
        }),
    ...(firstDepthAttachment === undefined
      ? {}
      : { depthAttachment: firstDepthAttachment }),
    ...(renderBundleReport === undefined
      ? {}
      : { renderBundles: renderBundleReport }),
    readbackBoundary,
    gpuTimingReadbacks,
    gpuTimingDiagnostics,
    occlusionQueryReadbacks,
    occlusionQueryDiagnostics,
    occlusionCulling,
    occlusionQueryCount,
    plannedCommands,
    drawCalls,
    diagnostics,
  };
}

type ForwardGraphTarget = ReturnType<
  typeof createWebGpuAppFrameBoundaryTargets
>["targets"][number];

interface ForwardGraphGrabEntry {
  readonly nodeName: string;
  readonly texture: ReturnType<typeof buildFrameBoundaryTargetPlan>["texture"];
  readonly attachments: ReturnType<
    typeof buildFrameBoundaryTargetPlan
  >["attachments"];
  readonly reportBase: Omit<WebGpuAppTransmissionGrabPassReport, "ok">;
}

interface ForwardGraphShadowEntry {
  readonly nodeName: string;
  readonly key: string;
}

interface ForwardGraphTargetEntry {
  readonly nodeName: string;
  readonly texture: ReturnType<typeof buildFrameBoundaryTargetPlan>["texture"];
  readonly attachments: ReturnType<
    typeof buildFrameBoundaryTargetPlan
  >["attachments"];
  readonly target: ForwardGraphTarget;
  readonly msaaSampleCount: number | null;
  readonly occlusionQueries: ReturnType<
    typeof createWebGpuAppOcclusionQueryResources
  > | null;
  readonly occlusionRenderIds: readonly number[];
  readonly gpuTimingPassName: string;
}

// M3-T4: convert one per-target assembleFrameBoundary options object into a
// FrameGraph render node + a resolveRenderBoundary payload, built through the
// EXACT same buildFrameBoundaryTargetPlan the legacy path uses so the encoded
// attachments are byte-identical — the single shared encoder is the only change.
function registerForwardGraphTarget(args: {
  readonly graph: ReturnType<typeof createFrameGraph>;
  readonly payloads: Map<string, FrameGraphRenderNodeBoundary>;
  readonly entries: ForwardGraphTargetEntry[];
  readonly boundaryOptions: Parameters<typeof assembleFrameBoundary>[0];
  readonly target: ForwardGraphTarget;
  readonly targetSubmissionKey: string;
  readonly msaaSampleCount: number | null;
  readonly occlusionQueries: ReturnType<
    typeof createWebGpuAppOcclusionQueryResources
  > | null;
  readonly occlusionRenderIds: readonly number[];
  readonly gpuTimingPassName: string;
  // M3-T5: shadow depth handles this forward node reads so the compiler orders
  // the shadow caster nodes strictly before it (one shared encoder).
  readonly shadowReads?: readonly string[];
}): void {
  const opts = args.boundaryOptions;
  const plan = buildFrameBoundaryTargetPlan({
    context: opts.context,
    ...(opts.colorTarget === undefined
      ? {}
      : { colorTarget: opts.colorTarget }),
    ...(opts.colorLoadOp === undefined
      ? {}
      : { colorLoadOp: opts.colorLoadOp }),
    ...(opts.clearColor === undefined ? {} : { clearColor: opts.clearColor }),
    ...(opts.msaaColorTarget === undefined
      ? {}
      : { msaaColorTarget: opts.msaaColorTarget }),
    ...(opts.msaaColorStoreOp === undefined
      ? {}
      : { msaaColorStoreOp: opts.msaaColorStoreOp }),
    ...(opts.depthTarget === undefined
      ? {}
      : { depthTarget: opts.depthTarget }),
    ...(args.occlusionQueries?.resources === undefined ||
    args.occlusionQueries.resources === null
      ? {}
      : { occlusionQuerySet: args.occlusionQueries.resources.querySet }),
  });

  const handle = `forward:${args.targetSubmissionKey}`;
  if (args.graph.handle(handle) === undefined) {
    if (args.target.source === "swapchain") {
      args.graph.importSwapchain(handle);
    } else {
      args.graph.declareTransient(handle, {
        kind: "color-texture",
        width: args.target.width,
        height: args.target.height,
        format: args.target.format,
        sampleCount: 1,
      });
    }
  }

  const nodeName = `${opts.label}:fg:${args.entries.length}`;
  args.graph.addRenderPass({
    name: nodeName,
    reads: args.shadowReads ?? [],
    writes: [
      { handle, attachment: opts.colorLoadOp === "load" ? "load" : "clear" },
    ],
    commands: opts.commands,
  });
  args.payloads.set(nodeName, {
    device: opts.device,
    attachments: plan.attachments,
    commands: opts.commands,
    label: opts.label,
    colorTargetSource:
      opts.colorTarget?.source === "offscreen-target"
        ? "offscreen-target"
        : "current-texture",
    readbackTexture: plan.texture.texture,
    ...(opts.viewport === undefined ? {} : { viewport: opts.viewport }),
    ...(opts.scissor === undefined ? {} : { scissor: opts.scissor }),
    ...(opts.readback === undefined ? {} : { readback: opts.readback }),
    ...(opts.gpuTiming === undefined ? {} : { gpuTiming: opts.gpuTiming }),
    ...(opts.occlusionQueries === undefined
      ? {}
      : { occlusionQueries: opts.occlusionQueries }),
    ...(opts.renderBundle === undefined
      ? {}
      : { renderBundle: opts.renderBundle }),
  });
  args.entries.push({
    nodeName,
    texture: plan.texture,
    attachments: plan.attachments,
    target: args.target,
    msaaSampleCount: args.msaaSampleCount,
    occlusionQueries: args.occlusionQueries,
    occlusionRenderIds: args.occlusionRenderIds,
    gpuTimingPassName: args.gpuTimingPassName,
  });
}
