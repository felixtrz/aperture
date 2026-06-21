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
import type {
  RenderPassAttachmentLoadOp,
  RenderPassAttachmentStoreOp,
} from "../render/passes/render-pass-attachments.js";
import {
  type WebGpuApp,
  type WebGpuAppDepthAttachmentReport,
  type WebGpuAppPostEffectSubmissionReport,
  type WebGpuAppPostGraphReport,
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
import { writeProceduralSkyCommandsForView } from "./procedural-sky.js";
import { writeSkyboxCommandsForView } from "./skybox.js";
import { assembleWebGpuAppPostProcessedSwapchainTarget } from "./post-processing.js";
import {
  buildUserPassNode,
  createUserPassSkippedOnLegacyRouteDiagnostic,
  type WebGpuAppPassResolvers,
} from "./user-pass.js";
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
  readonly renderBundleCommands?: readonly RenderPassCommand[];
  readonly overlayCommands?: readonly RenderPassCommand[];
  readonly label: string;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly motionVectorColorFormat?: string | null;
  readonly indirectColorFormat?: string | null;
  readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
  readonly clearColor?: readonly number[];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly gpuTimings?: boolean;
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
  const renderBundleViewCommands: RenderPassCommand[] = [];
  const submittedTargetCounts = new Map<string, number>();
  const submittedTargetLayerMasks = new Map<string, number>();
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
  // AI-12: the public user-pass API (app.addRenderPass / app.addComputePass)
  // runs on the FrameGraph routes only — the forward (no-post) graph below and
  // the post-effect graph in post-processing.ts. The legacy multi-submit
  // forward route cannot fold user nodes into its per-target encoders, so
  // registered passes there surface a structured diagnostic instead of
  // silently no-oping (the post legacy fallback reports its own).
  const enabledUserPassNames = (options.app.userPassRegistry?.list() ?? [])
    .filter((descriptor) => descriptor.enabled !== false)
    .map((descriptor) => descriptor.name);
  if (
    forwardGraph === null &&
    activePostEffects.length === 0 &&
    enabledUserPassNames.length > 0
  ) {
    diagnostics.push(
      createUserPassSkippedOnLegacyRouteDiagnostic(enabledUserPassNames),
    );
  }
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

    const proceduralSky = await writeProceduralSkyCommandsForView({
      app: options.app,
      cache: options.cache,
      snapshot: options.snapshot,
      view: target.view,
      target: options.cache.frameScratch.skyboxCommands,
      reuse: options.reuse,
    });
    const background =
      proceduralSky.commands.length > 0
        ? proceduralSky
        : await writeSkyboxCommandsForView({
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
      background.commands,
    );
    const renderBundleCommandsForView =
      options.renderBundleCommands === undefined
        ? commandsForView
        : writeCommandsForView(
            options.renderBundleCommands,
            options.snapshot,
            target.view,
            renderBundleViewCommands,
            background.commands,
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
    const occlusionFallback =
      occlusionRenderIds.length > 0 && occlusionQueries?.resources === null;
    const commandsForBoundary = occlusionFallback
      ? commandsWithoutOcclusionQueryCommands(
          commands,
          options.cache.frameScratch.occlusionFallbackCommands,
        )
      : commands;

    if (occlusionFallback) {
      recordWebGpuAppOcclusionCullingFallback(occlusionCulling, "unsupported");
    }
    occlusionQueryCount += occlusionRenderIds.length;
    occlusionQueryDiagnostics.push(...(occlusionQueries?.diagnostics ?? []));
    diagnostics.push(...(occlusionQueries?.diagnostics ?? []));
    // The unsupported-query-set fallback degrades deliberately: occlusion
    // commands are stripped, the culling report records the fallback, and a
    // warning diagnostic surfaces it — the frame itself still renders and
    // must stay valid.
    allTargetsValid &&=
      occlusionQueries === null || occlusionQueries.valid || occlusionFallback;
    diagnostics.push(...background.diagnostics);
    allTargetsValid &&= background.valid;
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
    const previousTargetLayerMask =
      submittedTargetLayerMasks.get(targetSubmissionKey);
    const canLoadExistingTargetDepth =
      previousTargetLayerMask === undefined ||
      renderLayerMasksOverlap(previousTargetLayerMask, target.view.layerMask);
    const storeMsaaColorForLaterLoad =
      msaaColorTarget.resource !== null &&
      previousTargetSubmissions + 1 < targetSubmissionTotal;
    const targetClearColor: number[] = Array.from(
      options.clearColor ?? target.view.clearColor,
    );
    const colorLoadOp: RenderPassAttachmentLoadOp = loadExistingTarget
      ? "load"
      : "clear";
    const depthLoadOp: RenderPassAttachmentLoadOp =
      loadExistingTarget &&
      canLoadExistingTargetDepth &&
      !isTransparentOverlayClearColor(targetClearColor)
        ? "load"
        : "clear";
    const colorStoreOp: RenderPassAttachmentStoreOp = storeMsaaColorForLaterLoad
      ? "store"
      : "discard";
    const finalTargetSubmission =
      previousTargetSubmissions + 1 >= targetSubmissionTotal;

    const includeReadback =
      options.readbackSamples !== undefined &&
      readbackBoundary === null &&
      target.source === "swapchain" &&
      targetIndex === lastSwapchainTargetIndex;
    const targetPassName =
      target.renderTargetKey === null
        ? "main"
        : `main:${target.renderTargetKey}`;
    const gpuTiming =
      options.gpuTimings === true
        ? await createWebGpuAppGpuTimingForTarget(
            options.app,
            options.cache,
            options.label,
            target,
          )
        : null;
    gpuTimingDiagnostics.push(...(gpuTiming?.diagnostics ?? []));

    if (gpuTiming?.resources !== null && gpuTiming?.resources !== undefined) {
      gpuTimingReadbacks.push({
        passName: gpuTiming.passName,
        resources: gpuTiming.resources,
        ...(gpuTiming.release === undefined
          ? {}
          : { release: gpuTiming.release }),
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
        sceneColorLoadOp: colorLoadOp,
        sceneDepthLoadOp: depthLoadOp,
        sceneMsaaColorStoreOp: colorStoreOp,
        present: finalTargetSubmission,
        ...(colorLoadOp === "clear" ? { clearColor: targetClearColor } : {}),
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
        ...(gpuTiming?.resources === undefined || gpuTiming.resources === null
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
        enableRenderBundles: options.enableRenderBundles === true,
        renderBundleCommandCount: renderBundleCommandsForView.length,
        ...((options.shadowCasterGraphPasses ?? []).length === 0
          ? {}
          : { shadowCasterGraphPasses: options.shadowCasterGraphPasses }),
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
          passName: gpuTiming?.passName ?? targetPassName,
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
        submittedTargetLayerMasks.set(
          targetSubmissionKey,
          target.view.layerMask,
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
        clearColor: targetClearColor,
        resources: options.transmissionSceneColorResources,
      };

      if (forwardGraph !== null) {
        // graph path: register the grab as a node BEFORE the main target node;
        // the grab stores its texture (same options as legacy) and the main
        // pass samples it — one shared encoder, grab encoded first (insertion).
        const grab =
          buildWebGpuAppTransmissionGrabBoundaryOptions(grabPassOptions);
        // The grab builder passes the per-view command scratch through when it
        // has nothing to strip, so its deferred node needs a snapshot too.
        const grabCommands = snapshotForwardGraphCommands(
          options.cache.frameScratch.forwardGraphCommandLists,
          forwardGraphPayloads.size,
          grab.boundaryOptions.commands,
        );
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
          commands: grabCommands,
        });
        forwardGraphPayloads.set(grabNodeName, {
          device: grab.boundaryOptions.device,
          attachments: grabPlan.attachments,
          commands: grabCommands,
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
    const renderBundleCommandCount = renderBundleCommandsForView.length;
    const renderBundleCommands =
      renderBundleCommandCount === commandsForBoundaryWithOverlay.length
        ? commandsForBoundaryWithOverlay
        : commandsForBoundaryWithOverlay.slice(0, renderBundleCommandCount);
    const renderBundleKey = createWebGpuAppRenderBundleCommandKey({
      target,
      descriptor: renderBundleDescriptor,
      commands: renderBundleCommands,
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
      ...(colorLoadOp === "clear" ? { clearColor: targetClearColor } : {}),
      depthTarget: {
        view: depthAttachment.view,
        ...(depthLoadOp === "clear"
          ? { depthClearValue: target.view.clearDepth }
          : {}),
        depthLoadOp,
        depthStoreOp: "store",
      },
      ...(commandsForBoundaryWithOverlay.length === 0 ||
      renderBundleCommands.length === 0 ||
      options.enableRenderBundles === false ||
      (overlayCommands.length > 0 &&
        options.renderBundleCommands === undefined) ||
      occlusionRenderIds.length > 0
        ? {}
        : {
            renderBundle: {
              cache: options.cache.renderBundles,
              key: renderBundleKey,
              descriptor: renderBundleDescriptor,
              ...(renderBundleCommandCount ===
              commandsForBoundaryWithOverlay.length
                ? {}
                : { bundledCommandCount: renderBundleCommandCount }),
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
      ...(gpuTiming?.resources === undefined || gpuTiming.resources === null
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
        boundaryOptions: {
          ...boundaryOptions,
          commands: snapshotForwardGraphCommands(
            options.cache.frameScratch.forwardGraphCommandLists,
            forwardGraphPayloads.size,
            commandsForBoundaryWithOverlay,
          ),
        },
        target,
        targetSubmissionKey,
        msaaSampleCount: msaaColorTarget.resource?.sampleCount ?? null,
        occlusionQueries,
        occlusionRenderIds,
        gpuTimingPassName: gpuTiming?.passName ?? targetPassName,
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
      submittedTargetLayerMasks.set(targetSubmissionKey, target.view.layerMask);
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
      submittedTargetLayerMasks.set(targetSubmissionKey, target.view.layerMask);
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
        passName: gpuTiming?.passName ?? targetPassName,
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

  // AI-12: append the registered user passes (app.addRenderPass /
  // app.addComputePass) as forward-graph nodes drawn over the presented
  // swapchain target — the forward-route mirror of the post path's user-pass
  // wiring (post-processing.ts). A frame with no registered passes is untouched.
  const forwardUserPasses =
    forwardGraph === null
      ? null
      : registerForwardGraphUserPasses({
          app: options.app,
          graph: forwardGraph,
          payloads: forwardGraphPayloads,
          entries: forwardGraphEntries,
          diagnostics,
        });
  if (forwardUserPasses !== null) {
    plannedCommands += forwardUserPasses.plannedCommands;
    drawCalls += forwardUserPasses.drawCalls;
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
    const compiled = compileFrameGraph(forwardGraph);
    const exec = executeFrameGraph({
      device,
      queue,
      compiled,
      resources: {
        resolveAttachment: () => null,
        resolveRenderBoundary: (node) =>
          forwardGraphPayloads.get(node.name) ?? null,
      } satisfies FrameGraphResources,
      label: options.label,
    });
    // Loud-over-silent: executor-level failures (compile not ok, unresolved
    // writes, missing compute support) surface as frame diagnostics.
    diagnostics.push(...exec.diagnostics);
    const frameOk = exec.finish?.valid === true && exec.submit?.valid === true;
    const encodeByName = new Map<string, FrameBoundaryEncodeReport>();
    for (const node of exec.nodes) {
      if (node.kind === "render") {
        encodeByName.set(node.name, node.encode);
      }
    }

    // AI-12: additive graph sub-report (compiled order + per-user-pass
    // execution), mirroring the post route's renderTarget.graph shape. Present
    // only when user passes are registered so a no-user-pass frame's report is
    // byte-identical to before.
    const userPassGraphReport: WebGpuAppPostGraphReport | null =
      forwardUserPasses === null
        ? null
        : {
            order: compiled.orderedNodes.map((node) => node.name),
            userPasses: forwardUserPasses.nodes.map((userNode) => {
              const node = exec.nodes.find(
                (entry) => entry.name === userNode.nodeName,
              );
              const executedCommands =
                node === undefined
                  ? 0
                  : node.kind === "compute"
                    ? (node.execution?.executedCommands ?? 0)
                    : (node.encode.execution?.executedCommands ?? 0);
              return {
                name: userNode.nodeName,
                kind: userNode.kind,
                ran: (node?.valid ?? false) && executedCommands > 0,
                executedCommands,
              };
            }),
          };

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
        // AI-12: the presented target that hosts the user passes carries the
        // graph order/user-pass report (same field the post route reports on).
        ...(userPassGraphReport !== null &&
        entry.nodeName === forwardUserPasses?.hostNodeName
          ? { graph: userPassGraphReport }
          : {}),
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

    // AI-12: user render passes synthesize legacy-compatible boundaries (their
    // encode validity + diagnostics fold into the frame exactly like target
    // nodes); user compute passes have no render boundary, so only their node
    // validity folds in. ran/executedCommands live in the graph report above.
    for (const userNode of forwardUserPasses?.nodes ?? []) {
      if (userNode.kind === "compute") {
        const computeNode = exec.nodes.find(
          (node) => node.name === userNode.nodeName,
        );
        allTargetsValid &&= (computeNode?.valid ?? false) && frameOk;
        continue;
      }
      const encode = encodeByName.get(userNode.nodeName);
      const boundary: FrameBoundaryAssemblyReport = {
        valid: (encode?.valid ?? false) && frameOk,
        texture: userNode.texture,
        attachments: userNode.attachments,
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
      boundaries.push(boundary);
      allTargetsValid &&= boundary.valid;
      diagnostics.push(
        ...boundary.texture.diagnostics,
        ...(boundary.attachments?.diagnostics ?? []),
        ...(boundary.begin?.diagnostics ?? []),
        ...(boundary.execution?.diagnostics ?? []),
        ...(boundary.end?.diagnostics ?? []),
        ...(boundary.rectangle?.diagnostics ?? []),
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
  // AI-12: what a user pass needs to draw over this target — its graph handle,
  // its color target (undefined ⇒ swapchain current-texture), and the depth
  // view its boundary attached (user overlays LOAD it for depth testing).
  readonly handle: string;
  readonly colorTarget: Parameters<
    typeof assembleFrameBoundary
  >[0]["colorTarget"];
  readonly depthView: unknown;
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
    handle,
    colorTarget: opts.colorTarget,
    depthView: opts.depthTarget?.view ?? null,
  });
}

/**
 * Snapshot a forward-graph node's commands out of the per-target assembly
 * scratch. The graph route encodes nodes AFTER the assembly loop, so a payload
 * holding `frameScratch.viewCommands` (or the occlusion/grab derivatives of
 * it) would replay whichever target was assembled LAST into every attachment.
 * Lists are persistent and reused across frames, indexed by the node's
 * registration order, so steady-state frames allocate nothing.
 */
function snapshotForwardGraphCommands(
  lists: RenderPassCommand[][],
  index: number,
  commands: readonly RenderPassCommand[],
): readonly RenderPassCommand[] {
  const target = (lists[index] ??= []);
  target.length = 0;

  for (const command of commands) {
    target.push(command);
  }

  return target;
}

type ForwardGraphUserPassNodeEntry =
  | {
      readonly kind: "render";
      readonly nodeName: string;
      readonly texture: ReturnType<
        typeof buildFrameBoundaryTargetPlan
      >["texture"];
      readonly attachments: ReturnType<
        typeof buildFrameBoundaryTargetPlan
      >["attachments"];
    }
  | {
      readonly kind: "compute";
      readonly nodeName: string;
    };

interface ForwardGraphUserPassRegistration {
  readonly nodes: readonly ForwardGraphUserPassNodeEntry[];
  /** The forward target node whose renderTarget report carries the graph. */
  readonly hostNodeName: string;
  readonly plannedCommands: number;
  readonly drawCalls: number;
}

// AI-12: user passes (app.addRenderPass / app.addComputePass) on the FORWARD
// (no-post) graph route, mirroring the post route's wiring
// (post-processing.ts user-pass block). The presented swapchain target is the
// forward route's "scene-color": user RENDER passes draw over it with LOAD
// (depth-tested against the target's depth attachment, also LOADed) and user
// COMPUTE passes run on the same shared encoder, declaring transient buffers
// for their writes. Resolvers map the public handle ids ("scene-color" /
// "depth") to this route's GPU resources; user pipelines/buffers/bind groups
// are owned by the encode closure.
function registerForwardGraphUserPasses(args: {
  readonly app: WebGpuApp;
  readonly graph: ReturnType<typeof createFrameGraph>;
  readonly payloads: Map<string, FrameGraphRenderNodeBoundary>;
  readonly entries: readonly ForwardGraphTargetEntry[];
  readonly diagnostics: unknown[];
}): ForwardGraphUserPassRegistration | null {
  // Optional chaining: the real app always has a registry, but lightweight
  // callers/tests may omit it — treat a missing registry as no user passes.
  const userPasses = (args.app.userPassRegistry?.list() ?? []).filter(
    (descriptor) => descriptor.enabled !== false,
  );
  if (userPasses.length === 0) {
    return null;
  }

  // The LAST swapchain submission is the presented image the user passes draw
  // over (mirrors the post route, which runs user passes on the swapchain post
  // target only). No swapchain target this frame ⇒ loud skip, not a silent one.
  let host: ForwardGraphTargetEntry | undefined;
  for (const entry of args.entries) {
    if (entry.target.source === "swapchain") {
      host = entry;
    }
  }
  if (host === undefined) {
    args.diagnostics.push({
      code: "webgpu.userPass.forwardTargetUnavailable",
      severity: "warning",
      message:
        "Registered user passes were skipped: the forward FrameGraph route rendered no swapchain target this frame to host them.",
      data: { passes: userPasses.map((descriptor) => descriptor.name) },
    });
    return null;
  }

  const device = args.app.initialization.device as Parameters<
    typeof assembleFrameBoundary
  >[0]["device"];
  const context = args.app.initialization.context as Parameters<
    typeof buildFrameBoundaryTargetPlan
  >[0]["context"];
  // Declare the public handle ids the descriptors reference so the compiled
  // report carries no unknown-handle diagnostics: both resolve to route-owned
  // imported resources (the forward color target + its depth attachment).
  if (args.graph.handle("scene-color") === undefined) {
    args.graph.declareResource({
      id: "scene-color",
      descriptor: { kind: "color-texture", lifetime: "imported" },
    });
  }
  if (args.graph.handle("depth") === undefined) {
    args.graph.importDepth("depth");
  }
  const sceneColorView = (
    host.texture.texture as { createView?: () => unknown } | undefined
  )?.createView?.();
  const resolvers: WebGpuAppPassResolvers = {
    view: (handle) =>
      handle === "scene-color"
        ? sceneColorView
        : handle === "depth"
          ? host.depthView
          : undefined,
    buffer: () => undefined,
    createBindGroup: (entries) =>
      (
        device as { createBindGroup?: (descriptor: unknown) => unknown }
      ).createBindGroup?.(entries),
  };

  const nodes: ForwardGraphUserPassNodeEntry[] = [];
  let plannedCommands = 0;
  let drawCalls = 0;

  for (const descriptor of userPasses) {
    const built = buildUserPassNode(descriptor, resolvers);
    if (built.kind === "compute") {
      for (const write of built.writes) {
        if (args.graph.handle(write.handle) === undefined) {
          args.graph.declareResource({
            id: write.handle,
            descriptor: { kind: "buffer", lifetime: "transient" },
          });
        }
      }
      args.graph.addComputePass(built);
      nodes.push({ kind: "compute", nodeName: built.name });
      plannedCommands += built.commands.length;
      continue;
    }

    // M3-T7 scope (audit B5): a user RENDER pass is drawn over scene-color with
    // LOAD; a declared write to anything other than scene-color is not honored
    // for render passes (compute passes do honor their declared transient
    // writes). Surface the coercion instead of dropping it silently — the same
    // diagnostic the post route emits.
    const coercedWrites = (descriptor.writes ?? [])
      .map((write) => (typeof write === "string" ? write : write.handle))
      .filter((handle) => handle !== "scene-color");
    if (coercedWrites.length > 0) {
      args.diagnostics.push({
        code: "webgpu.userPass.renderWriteCoercedToSceneColor",
        severity: "warning",
        message: `User render pass '${built.name}' declared write target(s) ${JSON.stringify(coercedWrites)} that are not honored; it is drawn over scene-color (LOAD). Use a compute pass for arbitrary writable targets, or write to "scene-color".`,
        data: { pass: built.name, coercedWrites },
      });
    }

    const plan = buildFrameBoundaryTargetPlan({
      context,
      ...(host.colorTarget === undefined
        ? {}
        : { colorTarget: host.colorTarget }),
      colorLoadOp: "load",
      depthTarget: {
        view: host.depthView,
        depthLoadOp: "load",
        depthStoreOp: "store",
      },
    });
    args.graph.addRenderPass({
      name: built.name,
      reads: [...built.reads],
      // The LOAD write of the forward color orders this node after the forward
      // target node(s) (write-after-write keeps insertion order) and forces
      // them to store the contents the overlay loads (store-on-no-clear).
      // Deliberately NOT also a read: a read edge from every writer would put
      // two load-writing user overlays in a cycle.
      writes: [{ handle: host.handle, attachment: "load" }],
      commands: built.commands,
      ...(built.before === undefined ? {} : { before: built.before }),
      ...(built.after === undefined ? {} : { after: built.after }),
    });
    args.payloads.set(built.name, {
      device,
      attachments: plan.attachments,
      commands: built.commands,
      label: built.name,
      colorTargetSource:
        host.colorTarget?.source === "offscreen-target"
          ? "offscreen-target"
          : "current-texture",
      readbackTexture: plan.texture.texture,
    });
    nodes.push({
      kind: "render",
      nodeName: built.name,
      texture: plan.texture,
      attachments: plan.attachments,
    });
    plannedCommands += built.commands.length;
    drawCalls += countDrawCommands(built.commands);
  }

  return {
    nodes,
    hostNodeName: host.nodeName,
    plannedCommands,
    drawCalls,
  };
}

function isTransparentOverlayClearColor(
  clearColor: ArrayLike<number> | undefined,
): boolean {
  const alpha = clearColor?.[3];
  return typeof alpha === "number" && Number.isFinite(alpha) && alpha < 1;
}

function renderLayerMasksOverlap(a: number, b: number): boolean {
  return (a & b) !== 0;
}
