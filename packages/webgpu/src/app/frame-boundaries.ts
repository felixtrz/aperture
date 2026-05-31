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
import { assembleWebGpuAppTransmissionGrabPass } from "./transmission-grab.js";
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
  readonly label: string;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly motionVectorColorFormat?: string | null;
  readonly indirectColorFormat?: string | null;
  readonly transmissionSceneColorResources?: StandardFrameTransmissionSceneColorResources | null;
  readonly clearColor?: readonly number[];
  readonly readbackSamples?: readonly FrameBoundaryReadbackSampleRequest[];
  readonly enableRenderBundles?: boolean;
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
    options.app.useFrameGraph === true &&
    activePostEffects.length === 0 &&
    (options.transmissionSceneColorResources === undefined ||
      options.transmissionSceneColorResources === null);
  const forwardGraph = forwardGraphEligible ? createFrameGraph() : null;
  const forwardGraphPayloads = new Map<string, FrameGraphRenderNodeBoundary>();
  const forwardGraphEntries: ForwardGraphTargetEntry[] = [];

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

    if (target.source === "swapchain" && activePostEffects.length > 0) {
      const postTarget = assembleWebGpuAppPostProcessedSwapchainTarget({
        app: options.app,
        cache: options.cache,
        snapshot: options.snapshot,
        target,
        commands: commandsForBoundary,
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

    const transmissionGrabPass =
      options.transmissionSceneColorResources === undefined ||
      options.transmissionSceneColorResources === null
        ? null
        : assembleWebGpuAppTransmissionGrabPass({
            app: options.app,
            target,
            commands: commandsForBoundary,
            depthAttachment,
            label: options.label,
            clearColor: options.clearColor ?? target.view.clearColor,
            resources: options.transmissionSceneColorResources,
          });

    if (transmissionGrabPass !== null) {
      firstBoundary ??= transmissionGrabPass.boundary;
      boundaries.push(transmissionGrabPass.boundary);
      plannedCommands += transmissionGrabPass.report.commands;
      drawCalls += transmissionGrabPass.report.drawCalls;
      allTargetsValid &&= transmissionGrabPass.boundary.valid;
      transmissionGrabPassReport = transmissionGrabPass.report;
      diagnostics.push(...transmissionGrabPass.diagnostics);
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
      commands: commandsForBoundary,
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
      commands: commandsForBoundary,
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
      ...(commandsForBoundary.length === 0 ||
      options.enableRenderBundles === false ||
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
      });
      firstDepthAttachment ??= createWebGpuAppDepthAttachmentReport(
        options.snapshot,
        depthAttachment,
      );
      plannedCommands += commandsForBoundary.length;
      drawCalls += countDrawCommands(commandsForBoundary);
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
    plannedCommands += commandsForBoundary.length;
    drawCalls += countDrawCommands(commandsForBoundary);
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
  if (forwardGraph !== null && forwardGraphEntries.length > 0) {
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
    reads: [],
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
