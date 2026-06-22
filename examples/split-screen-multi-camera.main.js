import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  initializeWebGpuWithOptionalReadbackUsage,
  mapCurrentTextureReadbackSamples,
  markReadbackClearOk,
} from "./webgpu-readback.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const routeConfig = routeConfigForPath(window.location.pathname);

const baseStatus = {
  example: routeConfig.example,
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const initialization = await initializeWebGpuWithOptionalReadbackUsage({
      aperture,
      canvas,
    });
    const { initialized, readbackUsage } = initialization;

    if (!initialized.ok) {
      publishStatus({
        ...failure(
          "initialize-webgpu",
          initialized.reason,
          initialized.message,
        ),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
    } else {
      publishStatus(
        await renderSplitScreenScene(
          aperture,
          initialized,
          {
            width: canvas.width,
            height: canvas.height,
          },
          readbackUsage,
        ),
      );
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture workspace packages could not be imported.",
    ),
  );
}

async function renderSplitScreenScene(
  aperture,
  initialized,
  canvasSize,
  readbackUsage,
) {
  if (routeConfig.viewportResizeMatrix === true) {
    return renderViewportResizeMatrixScene(
      aperture,
      initialized,
      canvasSize,
      readbackUsage,
    );
  }

  const workerSnapshot = await requestSplitScreenSnapshot(aperture, canvasSize);

  if (!workerSnapshot.ok) {
    return {
      ...failure("worker", workerSnapshot.reason, workerSnapshot.message),
      ...(workerSnapshot.diagnostics === undefined
        ? {}
        : { diagnostics: workerSnapshot.diagnostics }),
      diagnosticCounts: diagnosticCounts({}),
    };
  }

  const { snapshot, scene } = workerSnapshot;
  const firstDraw = snapshot.meshDraws[0];
  const expectedExtractedDrawCount = expectedExtractedDrawCountForScene(scene);

  if (
    firstDraw === undefined ||
    snapshot.views.length !== (scene.expectedViewCount ?? 2) ||
    snapshot.meshDraws.length !== expectedExtractedDrawCount
  ) {
    return {
      ...failure(
        "extract",
        "multi-view-snapshot-unavailable",
        `${routeConfig.label} did not extract the expected views and mesh draws.`,
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: snapshot.diagnostics,
      diagnosticCounts: diagnosticCounts({
        extraction: Math.max(1, snapshot.diagnostics.length),
      }),
    };
  }

  const pipelineResource = await aperture.createUnlitRenderPipelineResource({
    device: initialized.device,
    colorFormat: initialized.format,
    batchKey: firstDraw.batchKey,
  });

  if (!pipelineResource.valid || pipelineResource.resource === null) {
    return {
      ...failure(
        "pipeline",
        "pipeline-unavailable",
        "The split-screen unlit render pipeline could not be created.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: pipelineResource.diagnostics,
      diagnosticCounts: diagnosticCounts({
        resources: pipelineResource.diagnostics.length,
      }),
    };
  }

  const pipeline = pipelineResource.resource.pipeline;
  const layouts = unlitPipelineLayouts(pipeline);

  if (layouts === null) {
    return {
      ...failure(
        "pipeline-layouts",
        "pipeline-layouts-unavailable",
        "The split-screen unlit pipeline does not expose bind group layouts.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnosticCounts: diagnosticCounts({ resources: 1 }),
    };
  }

  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const packedFirstView = aperture.packSnapshotViewUniforms(
    snapshotForView(snapshot, snapshot.views[0]),
  );
  const frameResources = aperture.createMultiMaterialUnlitFrameGpuResources({
    device: initialized.device,
    mesh: scene.mesh,
    viewUniforms: packedFirstView,
    worldTransforms: packedTransforms,
    materials: scene.materials.map((entry) => entry.asset),
    layouts,
    materialLayouts: scene.materials.map(() => layouts),
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return {
      ...failure(
        "resources",
        "frame-resources-unavailable",
        "The split-screen frame resources could not be uploaded.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: frameResources.diagnostics,
      diagnosticCounts: diagnosticCounts({
        resources: frameResources.diagnostics.length,
      }),
    };
  }

  const pipelineResult = {
    ok: true,
    status: "miss",
    key: firstDraw.batchKey.pipelineKey,
    pipeline,
    diagnostics: [],
  };
  const meshResourceKey = frameResources.resources.mesh.resourceKey;
  const materialResourceKeys = new Map(
    scene.materials.map((entry, index) => [
      entry.key,
      frameResources.resources.materials[index]?.resourceKey ?? null,
    ]),
  );
  const viewPlansResult = createViewPlans({
    aperture,
    device: initialized.device,
    layouts,
    snapshot,
    scene,
    frameResources: frameResources.resources,
    packedTransforms,
    pipelineResult,
    meshResourceKey,
    materialResourceKeys,
    canvasSize,
  });

  if (!viewPlansResult.ok) {
    return {
      ...failure("draw-plan", viewPlansResult.reason, viewPlansResult.message),
      extraction: snapshotCounts(snapshot),
      diagnostics: viewPlansResult.diagnostics,
      diagnosticCounts: diagnosticCounts({
        resources: viewPlansResult.resourcesDiagnostics,
        draw: viewPlansResult.drawDiagnostics,
      }),
    };
  }

  const submitted = await submitSplitScreenFrame(
    aperture,
    initialized,
    viewPlansResult.viewPlans,
    canvasSize,
    readbackUsage,
    scene.samplePoints,
  );

  if (!submitted.ok) {
    return {
      ...failure("submit", submitted.reason, submitted.message),
      extraction: snapshotCounts(snapshot),
      diagnostics: submitted.diagnostics,
      diagnosticCounts: diagnosticCounts({
        submission: submitted.diagnostics.length,
      }),
    };
  }

  const framePlanDiagnostics = viewPlansResult.viewPlans.flatMap(
    (plan) => plan.summaryDiagnostics,
  );
  const bindingPlanCount = viewPlansResult.viewPlans.reduce(
    (sum, plan) => sum + plan.framePlan.bindingPlan.bindings.length,
    0,
  );
  const bindingAppliedCount = viewPlansResult.viewPlans.reduce(
    (sum, plan) =>
      sum + plan.framePlan.bindingResults.filter((result) => result.ok).length,
    0,
  );
  const readiness = viewPlansResult.viewPlans.reduce(
    (totals, plan) => ({
      active: totals.active + plan.framePlan.apply.active,
      ready: totals.ready + plan.framePlan.readiness.ready.length,
      blocked: totals.blocked + plan.framePlan.readiness.blocked.length,
    }),
    { active: 0, ready: 0, blocked: 0 },
  );
  const drawCounts = viewPlansResult.viewPlans.reduce(
    (totals, plan) => ({
      packages: totals.packages + plan.framePlan.packages.packages.length,
      descriptors:
        totals.descriptors + plan.framePlan.drawCommands.descriptors.length,
      drawList: totals.drawList + plan.framePlan.drawList.draws.length,
      resolved: totals.resolved + plan.framePlan.resources.draws.length,
    }),
    { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
  );
  const commandCounts = viewPlansResult.viewPlans.reduce(
    (totals, plan) => ({
      commands: totals.commands + plan.framePlan.commandPlan.commands.length,
      drawCount: totals.drawCount + plan.framePlan.commandPlan.drawCount,
      indexedDrawCount:
        totals.indexedDrawCount + plan.framePlan.commandPlan.indexedDrawCount,
      nonIndexedDrawCount:
        totals.nonIndexedDrawCount +
        plan.framePlan.commandPlan.nonIndexedDrawCount,
    }),
    {
      commands: 0,
      drawCount: 0,
      indexedDrawCount: 0,
      nonIndexedDrawCount: 0,
    },
  );

  return {
    ...baseStatus,
    ok: true,
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: initialized.format,
    clearColor,
    worker: workerSnapshot.worker,
    transport: workerSnapshot.transport,
    extraction: snapshotCounts(snapshot),
    resources: {
      materials: frameResources.resources.materials.length,
      bindGroups: frameResources.resources.bindGroups.length,
      perViewBindGroups: viewPlansResult.viewPlans.reduce(
        (sum, plan) => sum + plan.viewBindGroups.length,
        0,
      ),
    },
    binding: {
      planned: bindingPlanCount,
      applied: bindingAppliedCount,
      diagnostics: viewPlansResult.bindingDiagnostics,
    },
    renderWorld: readiness,
    draw: drawCounts,
    command: commandCounts,
    viewports: viewPlansResult.viewPlans.map((plan) => ({
      viewId: plan.view.viewId,
      priority: plan.view.priority,
      layerMask: plan.view.layerMask,
      viewport: Array.from(plan.view.viewport),
      scissor: Array.from(plan.view.scissor),
      viewportPixels: plan.viewport,
      scissorPixels: plan.scissor,
    })),
    viewPasses: viewPlansResult.viewPlans.map((plan) => ({
      viewId: plan.view.viewId,
      priority: plan.view.priority,
      layerMask: plan.view.layerMask,
      clearBehavior: plan.clearBehavior,
      commands: plan.framePlan.commandPlan.commands.length,
      drawCalls: plan.framePlan.commandPlan.drawCount,
      indexedDrawCalls: plan.framePlan.commandPlan.indexedDrawCount,
      includedDraws: plan.includedDraws,
      skippedDraws: plan.skippedDraws,
      includedMaterialKeys: plan.includedMaterialKeys,
      skippedMaterialKeys: plan.skippedMaterialKeys,
      viewportPixels: plan.viewport,
      scissorPixels: plan.scissor,
    })),
    cameraPassOrder: viewPlansResult.viewPlans.map((plan) => ({
      viewId: plan.view.viewId,
      priority: plan.view.priority,
      layerMask: plan.view.layerMask,
      clearBehavior: plan.clearBehavior,
      drawCalls: plan.framePlan.commandPlan.drawCount,
    })),
    submission: submitted.summary,
    readback: submitted.readback,
    renderControl: {
      capabilities: globalThis.__APERTURE_EXAMPLE_CONTROL__?.capabilities ?? {
        status: true,
        warnings: true,
        screenshot: true,
        pause: false,
        resume: false,
        step: false,
        scenario: false,
        snapshot: true,
        readback: false,
      },
    },
    ...(scene.camera === undefined ? {} : { camera: scene.camera }),
    ...(scene.linePrimitives === undefined
      ? {}
      : { linePrimitives: scene.linePrimitives }),
    ...(scene.layerIsolation === undefined
      ? {}
      : { layerIsolation: scene.layerIsolation }),
    ...(scene.priorityOverlay === undefined
      ? {}
      : { priorityOverlay: scene.priorityOverlay }),
    ...(scene.subViewCrop === undefined
      ? {}
      : { subViewCrop: scene.subViewCrop }),
    ...(scene.viewportGrid === undefined
      ? {}
      : { viewportGrid: scene.viewportGrid }),
    ...(scene.clearLoadMatrix === undefined
      ? {}
      : { clearLoadMatrix: scene.clearLoadMatrix }),
    ...(scene.pictureInPicture === undefined
      ? {}
      : { pictureInPicture: scene.pictureInPicture }),
    ...(scene.proof === undefined ? {} : { proof: scene.proof }),
    diagnostics: framePlanDiagnostics,
    diagnosticCounts: diagnosticCounts({
      extraction: snapshot.diagnostics.length,
      binding: viewPlansResult.bindingDiagnostics,
      draw: framePlanDiagnostics.length,
      submission: submitted.diagnosticCount,
      readback: submitted.readback.ok ? 0 : 1,
    }),
  };
}

async function renderViewportResizeMatrixScene(
  aperture,
  initialized,
  canvasSize,
  readbackUsage,
) {
  const workerSnapshots = await requestViewportResizeSnapshots(
    aperture,
    canvasSize,
  );

  if (!workerSnapshots.ok) {
    return {
      ...failure("worker", workerSnapshots.reason, workerSnapshots.message),
      ...(workerSnapshots.diagnostics === undefined
        ? {}
        : { diagnostics: workerSnapshots.diagnostics }),
      diagnosticCounts: diagnosticCounts({}),
    };
  }

  const frames = workerSnapshots.frames;
  const firstFrame = frames[0];
  const finalFrame = frames[frames.length - 1];
  const scene = workerSnapshots.scene;

  if (
    firstFrame === undefined ||
    finalFrame === undefined ||
    frames.length !== (scene.expectedFrameCount ?? 2) ||
    frames.some(
      (entry) =>
        entry.snapshot.views.length !== (scene.expectedViewCount ?? 1) ||
        entry.snapshot.meshDraws.length !==
          expectedExtractedDrawCountForScene(scene),
    )
  ) {
    return {
      ...failure(
        "extract",
        "viewport-resize-snapshot-unavailable",
        "The camera viewport resize route did not extract the expected two camera frames.",
      ),
      extraction:
        finalFrame === undefined
          ? { frames: frames.length }
          : { frames: frames.length, ...snapshotCounts(finalFrame.snapshot) },
      diagnostics: frames.flatMap((entry) => entry.snapshot.diagnostics),
      diagnosticCounts: diagnosticCounts({
        extraction: Math.max(
          1,
          frames.reduce(
            (sum, entry) => sum + entry.snapshot.diagnostics.length,
            0,
          ),
        ),
      }),
    };
  }

  const firstDraw = firstFrame.snapshot.meshDraws[0];

  if (firstDraw === undefined) {
    return {
      ...failure(
        "extract",
        "viewport-resize-draw-unavailable",
        "The camera viewport resize route did not extract a drawable mesh.",
      ),
      extraction: {
        frames: frames.length,
        ...snapshotCounts(firstFrame.snapshot),
      },
      diagnostics: firstFrame.snapshot.diagnostics,
      diagnosticCounts: diagnosticCounts({
        extraction: Math.max(1, firstFrame.snapshot.diagnostics.length),
      }),
    };
  }

  const pipelineResource = await aperture.createUnlitRenderPipelineResource({
    device: initialized.device,
    colorFormat: initialized.format,
    batchKey: firstDraw.batchKey,
  });

  if (!pipelineResource.valid || pipelineResource.resource === null) {
    return {
      ...failure(
        "pipeline",
        "pipeline-unavailable",
        "The viewport resize unlit render pipeline could not be created.",
      ),
      extraction: {
        frames: frames.length,
        ...snapshotCounts(firstFrame.snapshot),
      },
      diagnostics: pipelineResource.diagnostics,
      diagnosticCounts: diagnosticCounts({
        resources: pipelineResource.diagnostics.length,
      }),
    };
  }

  const pipeline = pipelineResource.resource.pipeline;
  const layouts = unlitPipelineLayouts(pipeline);

  if (layouts === null) {
    return {
      ...failure(
        "pipeline-layouts",
        "pipeline-layouts-unavailable",
        "The viewport resize unlit pipeline does not expose bind group layouts.",
      ),
      extraction: {
        frames: frames.length,
        ...snapshotCounts(firstFrame.snapshot),
      },
      diagnosticCounts: diagnosticCounts({ resources: 1 }),
    };
  }

  const firstPackedTransforms = aperture.packSnapshotTransforms(
    firstFrame.snapshot,
  );
  const packedFirstView = aperture.packSnapshotViewUniforms(
    snapshotForView(firstFrame.snapshot, firstFrame.snapshot.views[0]),
  );
  const frameResources = aperture.createMultiMaterialUnlitFrameGpuResources({
    device: initialized.device,
    mesh: scene.mesh,
    viewUniforms: packedFirstView,
    worldTransforms: firstPackedTransforms,
    materials: scene.materials.map((entry) => entry.asset),
    layouts,
    materialLayouts: scene.materials.map(() => layouts),
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return {
      ...failure(
        "resources",
        "frame-resources-unavailable",
        "The viewport resize frame resources could not be uploaded.",
      ),
      extraction: {
        frames: frames.length,
        ...snapshotCounts(firstFrame.snapshot),
      },
      diagnostics: frameResources.diagnostics,
      diagnosticCounts: diagnosticCounts({
        resources: frameResources.diagnostics.length,
      }),
    };
  }

  const pipelineResult = {
    ok: true,
    status: "miss",
    key: firstDraw.batchKey.pipelineKey,
    pipeline,
    diagnostics: [],
  };
  const meshResourceKey = frameResources.resources.mesh.resourceKey;
  const materialResourceKeys = new Map(
    scene.materials.map((entry, index) => [
      entry.key,
      frameResources.resources.materials[index]?.resourceKey ?? null,
    ]),
  );
  const frameResults = [];

  for (const frameEntry of frames) {
    const packedTransforms = aperture.packSnapshotTransforms(
      frameEntry.snapshot,
    );
    const viewPlansResult = createViewPlans({
      aperture,
      device: initialized.device,
      layouts,
      snapshot: frameEntry.snapshot,
      scene,
      frameResources: frameResources.resources,
      packedTransforms,
      pipelineResult,
      meshResourceKey,
      materialResourceKeys,
      canvasSize,
    });

    if (!viewPlansResult.ok) {
      return {
        ...failure(
          "draw-plan",
          viewPlansResult.reason,
          viewPlansResult.message,
        ),
        extraction: {
          frames: frames.length,
          ...snapshotCounts(frameEntry.snapshot),
        },
        diagnostics: viewPlansResult.diagnostics,
        diagnosticCounts: diagnosticCounts({
          resources: viewPlansResult.resourcesDiagnostics,
          draw: viewPlansResult.drawDiagnostics,
        }),
      };
    }

    const submitted = await submitSplitScreenFrame(
      aperture,
      initialized,
      viewPlansResult.viewPlans,
      canvasSize,
      readbackUsage,
      samplePointsForFrame(scene, frameEntry.frame),
    );

    if (!submitted.ok) {
      return {
        ...failure("submit", submitted.reason, submitted.message),
        extraction: {
          frames: frames.length,
          ...snapshotCounts(frameEntry.snapshot),
        },
        diagnostics: submitted.diagnostics,
        diagnosticCounts: diagnosticCounts({
          submission: submitted.diagnostics.length,
        }),
      };
    }

    frameResults.push({
      frame: frameEntry.frame,
      role: frameEntry.role ?? `frame-${frameEntry.frame}`,
      snapshot: frameEntry.snapshot,
      viewPlansResult,
      metrics: summarizeViewPlanMetrics(viewPlansResult.viewPlans),
      submitted,
      samples: samplePointsForFrame(scene, frameEntry.frame),
    });
  }

  const aggregate = aggregateViewportResizeFrameResults(frameResults);
  const finalResult = frameResults[frameResults.length - 1];

  return {
    ...baseStatus,
    ok: true,
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: initialized.format,
    clearColor,
    worker: workerSnapshots.worker,
    transport: workerSnapshots.transport,
    extraction: {
      frames: frames.length,
      ...snapshotCounts(finalFrame.snapshot),
    },
    resources: {
      materials: frameResources.resources.materials.length,
      bindGroups: frameResources.resources.bindGroups.length,
      perViewBindGroups: aggregate.perViewBindGroups,
    },
    binding: {
      planned: aggregate.binding.planned,
      applied: aggregate.binding.applied,
      diagnostics: aggregate.binding.diagnostics,
    },
    renderWorld: aggregate.renderWorld,
    draw: aggregate.draw,
    command: aggregate.command,
    viewports: finalResult.viewPlansResult.viewPlans.map((plan) => ({
      viewId: plan.view.viewId,
      priority: plan.view.priority,
      layerMask: plan.view.layerMask,
      viewport: Array.from(plan.view.viewport),
      scissor: Array.from(plan.view.scissor),
      viewportPixels: plan.viewport,
      scissorPixels: plan.scissor,
    })),
    viewPasses: frameResults.flatMap((result) =>
      result.viewPlansResult.viewPlans.map((plan) =>
        viewPassStatus(result.frame, plan),
      ),
    ),
    cameraPassOrder: frameResults.flatMap((result) =>
      result.viewPlansResult.viewPlans.map((plan) =>
        cameraPassOrderStatus(result.frame, plan),
      ),
    ),
    submission: aggregate.submission,
    readback: finalResult.submitted.readback,
    viewportResizeMatrix: viewportResizeMatrixStatus(scene, frameResults),
    renderControl: {
      capabilities: globalThis.__APERTURE_EXAMPLE_CONTROL__?.capabilities ?? {
        status: true,
        warnings: true,
        screenshot: true,
        pause: false,
        resume: false,
        step: false,
        scenario: false,
        snapshot: true,
        readback: false,
      },
    },
    ...(scene.proof === undefined ? {} : { proof: scene.proof }),
    diagnostics: aggregate.diagnostics,
    diagnosticCounts: diagnosticCounts({
      extraction: frames.reduce(
        (sum, entry) => sum + entry.snapshot.diagnostics.length,
        0,
      ),
      binding: aggregate.binding.diagnostics,
      draw: aggregate.diagnostics.length,
      submission: aggregate.submissionDiagnostics,
      readback: frameResults.reduce(
        (sum, result) => sum + (result.submitted.readback.ok ? 0 : 1),
        0,
      ),
    }),
  };
}

function createViewPlans({
  aperture,
  device,
  layouts,
  snapshot,
  scene,
  frameResources,
  packedTransforms,
  pipelineResult,
  meshResourceKey,
  materialResourceKeys,
  canvasSize,
}) {
  const viewPlans = [];
  const diagnostics = [];
  let resourcesDiagnostics = 0;
  let drawDiagnostics = 0;
  let bindingDiagnostics = 0;

  for (const view of snapshot.views) {
    const viewUniform = createViewUniformResources({
      aperture,
      device,
      layouts,
      snapshot,
      view,
    });

    diagnostics.push(...viewUniform.diagnostics);
    resourcesDiagnostics += viewUniform.diagnostics.length;

    if (!viewUniform.ok) {
      return {
        ok: false,
        reason: viewUniform.reason,
        message: viewUniform.message,
        diagnostics,
        resourcesDiagnostics,
        drawDiagnostics,
      };
    }

    const viewport = aperture.resolveNormalizedViewRectangle({
      rect: view.viewport,
      target: canvasSize,
      label: `view ${view.viewId} viewport`,
    });
    const scissor = aperture.resolveNormalizedViewRectangle({
      rect: view.scissor,
      target: canvasSize,
      label: `view ${view.viewId} scissor`,
    });

    diagnostics.push(...viewport.diagnostics, ...scissor.diagnostics);
    drawDiagnostics += viewport.diagnostics.length + scissor.diagnostics.length;

    if (!viewport.valid || viewport.rect === null) {
      return {
        ok: false,
        reason: "viewport-unavailable",
        message: `View ${view.viewId} did not resolve to a drawable viewport.`,
        diagnostics,
        resourcesDiagnostics,
        drawDiagnostics,
      };
    }

    if (!scissor.valid || scissor.rect === null) {
      return {
        ok: false,
        reason: "scissor-unavailable",
        message: `View ${view.viewId} did not resolve to a drawable scissor rectangle.`,
        diagnostics,
        resourcesDiagnostics,
        drawDiagnostics,
      };
    }

    const viewSnapshot = snapshotForView(snapshot, view, scene);
    const expectedDrawCount = expectedDrawCountForView(scene, view);
    const includedMaterialKeys = viewSnapshot.meshDraws.map((draw) =>
      aperture.assetHandleKey(draw.material),
    );
    const skippedMaterialKeys = snapshot.meshDraws
      .filter((draw) => !viewSnapshot.meshDraws.includes(draw))
      .map((draw) => aperture.assetHandleKey(draw.material));
    const bindGroups = [
      ...viewUniform.bindGroups,
      ...frameResources.bindGroups.filter((bindGroup) => bindGroup.group !== 0),
    ];
    const renderWorld = new aperture.RenderWorld();
    const framePlan = aperture.planRenderFrameFromSnapshot({
      snapshot: viewSnapshot,
      renderWorld,
      transforms: packedTransforms,
      resolveMeshResourceKey: (draw) =>
        aperture.assetHandleKey(draw.mesh) === scene.meshKey
          ? meshResourceKey
          : null,
      resolveMaterialResourceKey: (draw) =>
        materialResourceKeys.get(aperture.assetHandleKey(draw.material)) ??
        null,
      meshResources: [frameResources.mesh],
      pipelines: [pipelineResult],
      bindGroups,
    });

    const summaryDiagnostics = diagnosticsForExpectedDrawCount(
      framePlan.summary.diagnostics,
      expectedDrawCount,
    );

    bindingDiagnostics += framePlan.bindingPlan.diagnostics.length;
    drawDiagnostics += summaryDiagnostics.length;

    if (
      (!framePlan.summary.ready && summaryDiagnostics.length > 0) ||
      framePlan.commandPlan.drawCount !== expectedDrawCount
    ) {
      diagnostics.push(...summaryDiagnostics);
      return {
        ok: false,
        reason: "draw-plan-unavailable",
        message: `View ${view.viewId} did not produce ${expectedDrawCount} drawable command(s).`,
        diagnostics,
        resourcesDiagnostics,
        drawDiagnostics,
      };
    }

    viewPlans.push({
      view,
      viewport: viewport.rect,
      scissor: scissor.rect,
      framePlan,
      summaryDiagnostics,
      viewBindGroups: viewUniform.bindGroups,
      clearBehavior:
        viewPlans.length === 0
          ? "target-cleared-before-view"
          : "load-existing-target",
      includedDraws: viewSnapshot.meshDraws.length,
      skippedDraws: snapshot.meshDraws.length - viewSnapshot.meshDraws.length,
      includedMaterialKeys,
      skippedMaterialKeys,
    });
  }

  return {
    ok: true,
    viewPlans,
    diagnostics,
    resourcesDiagnostics,
    drawDiagnostics,
    bindingDiagnostics,
  };
}

function createViewUniformResources({
  aperture,
  device,
  layouts,
  snapshot,
  view,
}) {
  const packed = aperture.packSnapshotViewUniforms(
    snapshotForView(snapshot, view),
  );
  const descriptor = aperture.createViewUniformBufferDescriptor(packed, {
    label: `SplitScreen/ViewUniforms/${view.viewId}`,
  });
  const gpuBuffer = aperture.createViewUniformGpuBuffer({
    device,
    plan: descriptor.plan,
  });
  const bindGroups =
    gpuBuffer.resource === null
      ? { valid: false, resources: [], diagnostics: [] }
      : aperture.createUnlitBindGroupsFromGpuResources({
          device,
          plan: {
            valid: true,
            entries: [
              {
                group: 0,
                binding: 0,
                resourceKey: gpuBuffer.resource.resourceKey,
                resourceKind: "buffer",
              },
            ],
            diagnostics: [],
          },
          layouts,
          buffers: [
            {
              resourceKey: gpuBuffer.resource.resourceKey,
              buffer: gpuBuffer.resource.buffer,
            },
          ],
        });
  const diagnostics = [
    ...packed.diagnostics,
    ...descriptor.diagnostics,
    ...gpuBuffer.diagnostics,
    ...bindGroups.diagnostics,
  ];

  if (
    packed.diagnostics.length > 0 ||
    !descriptor.valid ||
    !gpuBuffer.valid ||
    !bindGroups.valid
  ) {
    return {
      ok: false,
      reason: "view-uniform-unavailable",
      message: `View ${view.viewId} uniform resources could not be created.`,
      diagnostics,
      bindGroups: [],
    };
  }

  return {
    ok: true,
    diagnostics,
    bindGroups: bindGroups.resources,
  };
}

function summarizeViewPlanMetrics(viewPlans) {
  const diagnostics = viewPlans.flatMap((plan) => plan.summaryDiagnostics);
  const binding = viewPlans.reduce(
    (totals, plan) => ({
      planned: totals.planned + plan.framePlan.bindingPlan.bindings.length,
      applied:
        totals.applied +
        plan.framePlan.bindingResults.filter((result) => result.ok).length,
      diagnostics:
        totals.diagnostics + plan.framePlan.bindingPlan.diagnostics.length,
    }),
    { planned: 0, applied: 0, diagnostics: 0 },
  );
  const renderWorld = viewPlans.reduce(
    (totals, plan) => ({
      active: totals.active + plan.framePlan.apply.active,
      ready: totals.ready + plan.framePlan.readiness.ready.length,
      blocked: totals.blocked + plan.framePlan.readiness.blocked.length,
    }),
    { active: 0, ready: 0, blocked: 0 },
  );
  const draw = viewPlans.reduce(
    (totals, plan) => ({
      packages: totals.packages + plan.framePlan.packages.packages.length,
      descriptors:
        totals.descriptors + plan.framePlan.drawCommands.descriptors.length,
      drawList: totals.drawList + plan.framePlan.drawList.draws.length,
      resolved: totals.resolved + plan.framePlan.resources.draws.length,
    }),
    { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
  );
  const command = viewPlans.reduce(
    (totals, plan) => ({
      commands: totals.commands + plan.framePlan.commandPlan.commands.length,
      drawCount: totals.drawCount + plan.framePlan.commandPlan.drawCount,
      indexedDrawCount:
        totals.indexedDrawCount + plan.framePlan.commandPlan.indexedDrawCount,
      nonIndexedDrawCount:
        totals.nonIndexedDrawCount +
        plan.framePlan.commandPlan.nonIndexedDrawCount,
    }),
    {
      commands: 0,
      drawCount: 0,
      indexedDrawCount: 0,
      nonIndexedDrawCount: 0,
    },
  );

  return { diagnostics, binding, renderWorld, draw, command };
}

function aggregateViewportResizeFrameResults(frameResults) {
  return frameResults.reduce(
    (totals, result) => ({
      diagnostics: [...totals.diagnostics, ...result.metrics.diagnostics],
      perViewBindGroups:
        totals.perViewBindGroups +
        result.viewPlansResult.viewPlans.reduce(
          (sum, plan) => sum + plan.viewBindGroups.length,
          0,
        ),
      binding: {
        planned: totals.binding.planned + result.metrics.binding.planned,
        applied: totals.binding.applied + result.metrics.binding.applied,
        diagnostics:
          totals.binding.diagnostics + result.metrics.binding.diagnostics,
      },
      renderWorld: {
        active: totals.renderWorld.active + result.metrics.renderWorld.active,
        ready: totals.renderWorld.ready + result.metrics.renderWorld.ready,
        blocked:
          totals.renderWorld.blocked + result.metrics.renderWorld.blocked,
      },
      draw: {
        packages: totals.draw.packages + result.metrics.draw.packages,
        descriptors: totals.draw.descriptors + result.metrics.draw.descriptors,
        drawList: totals.draw.drawList + result.metrics.draw.drawList,
        resolved: totals.draw.resolved + result.metrics.draw.resolved,
      },
      command: {
        commands: totals.command.commands + result.metrics.command.commands,
        drawCount: totals.command.drawCount + result.metrics.command.drawCount,
        indexedDrawCount:
          totals.command.indexedDrawCount +
          result.metrics.command.indexedDrawCount,
        nonIndexedDrawCount:
          totals.command.nonIndexedDrawCount +
          result.metrics.command.nonIndexedDrawCount,
      },
      submission: {
        commandBuffers:
          totals.submission.commandBuffers +
          result.submitted.summary.commandBuffers,
        viewPasses:
          totals.submission.viewPasses + result.submitted.summary.viewPasses,
        commands:
          totals.submission.commands + result.submitted.summary.commands,
        drawCalls:
          totals.submission.drawCalls + result.submitted.summary.drawCalls,
        indexedDrawCalls:
          totals.submission.indexedDrawCalls +
          result.submitted.summary.indexedDrawCalls,
      },
      submissionDiagnostics:
        totals.submissionDiagnostics + result.submitted.diagnosticCount,
    }),
    {
      diagnostics: [],
      perViewBindGroups: 0,
      binding: { planned: 0, applied: 0, diagnostics: 0 },
      renderWorld: { active: 0, ready: 0, blocked: 0 },
      draw: { packages: 0, descriptors: 0, drawList: 0, resolved: 0 },
      command: {
        commands: 0,
        drawCount: 0,
        indexedDrawCount: 0,
        nonIndexedDrawCount: 0,
      },
      submission: {
        commandBuffers: 0,
        viewPasses: 0,
        commands: 0,
        drawCalls: 0,
        indexedDrawCalls: 0,
      },
      submissionDiagnostics: 0,
    },
  );
}

function viewPassStatus(frame, plan) {
  return {
    frame,
    viewId: plan.view.viewId,
    priority: plan.view.priority,
    layerMask: plan.view.layerMask,
    clearBehavior: plan.clearBehavior,
    drawCalls: plan.framePlan.commandPlan.drawCount,
    indexedDrawCalls: plan.framePlan.commandPlan.indexedDrawCount,
    includedDraws: plan.includedDraws,
    skippedDraws: plan.skippedDraws,
    includedMaterialKeys: plan.includedMaterialKeys,
    skippedMaterialKeys: plan.skippedMaterialKeys,
    viewportPixels: plan.viewport,
    scissorPixels: plan.scissor,
  };
}

function cameraPassOrderStatus(frame, plan) {
  return {
    frame,
    viewId: plan.view.viewId,
    priority: plan.view.priority,
    layerMask: plan.view.layerMask,
    clearBehavior: plan.clearBehavior,
    drawCalls: plan.framePlan.commandPlan.drawCount,
  };
}

function viewportResizeMatrixStatus(scene, frameResults) {
  const frames = frameResults.map((result) => {
    const plan = result.viewPlansResult.viewPlans[0];

    return {
      frame: result.frame,
      role: result.role,
      cameraHandle: scene.viewportResizeMatrix?.cameraHandle ?? null,
      viewId: plan?.view.viewId ?? null,
      priority: plan?.view.priority ?? null,
      layerMask: plan?.view.layerMask ?? null,
      viewport: plan === undefined ? [] : Array.from(plan.view.viewport),
      scissor: plan === undefined ? [] : Array.from(plan.view.scissor),
      viewportPixels: plan?.viewport ?? null,
      scissorPixels: plan?.scissor ?? null,
      passOrder:
        plan === undefined ? [] : [cameraPassOrderStatus(result.frame, plan)],
      sampleIds: result.samples.map((sample) => sample.id),
      readback: result.submitted.readback,
    };
  });

  return {
    ...(scene.viewportResizeMatrix ?? {}),
    framesRendered: frameResults.length,
    before: frames[0] ?? null,
    after: frames[frames.length - 1] ?? null,
    frames,
  };
}

function samplePointsForFrame(scene, frame) {
  return scene.samplePointsByFrame?.[frame] ?? scene.samplePoints ?? [];
}

async function submitSplitScreenFrame(
  aperture,
  initialized,
  viewPlans,
  canvasSize,
  readbackUsage,
  samples,
) {
  const colorTarget = createCurrentTextureColorTargetWithTexture({
    context: initialized.context,
    clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
  });

  if (!colorTarget.valid || colorTarget.target === null) {
    return stepFailure(
      "current-texture-unavailable",
      "The WebGPU context did not provide a current texture view.",
      colorTarget.diagnostics,
    );
  }

  const attachments = aperture.createRenderPassAttachmentPlan({
    colorTargets: [colorTarget.target],
  });

  if (!attachments.valid || attachments.plan === null) {
    return stepFailure(
      "attachments-unavailable",
      "The split-screen render pass attachments could not be planned.",
      attachments.diagnostics,
    );
  }

  const encoderResource = aperture.createCommandEncoderResource({
    device: initialized.device,
    label: "split-screen-multi-camera",
  });

  if (!encoderResource.valid || encoderResource.resource === null) {
    return stepFailure(
      "encoder-unavailable",
      "The WebGPU command encoder could not be created.",
      encoderResource.diagnostics,
    );
  }

  const begin = aperture.beginPlannedRenderPass({
    encoder: encoderResource.resource.encoder,
    plan: attachments.plan,
  });

  if (!begin.valid || begin.pass === null) {
    return stepFailure(
      "render-pass-unavailable",
      "The split-screen render pass could not begin.",
      begin.diagnostics,
    );
  }

  const executions = [];

  for (const viewPlan of viewPlans) {
    applyPassRectangle(begin.pass, viewPlan.viewport, viewPlan.scissor);
    executions.push(
      aperture.executeRenderPassCommands({
        pass: begin.pass,
        commands: viewPlan.framePlan.commandPlan.commands,
      }),
    );
  }

  const end = aperture.endPlannedRenderPass(begin.pass);
  const readbackPlan = readbackUsage.ok
    ? copyCurrentTextureReadbackSamples({
        device: initialized.device,
        encoder: encoderResource.resource.encoder,
        texture: colorTarget.texture,
        format: initialized.format,
        width: canvasSize.width,
        height: canvasSize.height,
        samples,
      })
    : readbackUsage;
  const finished = aperture.finishCommandEncoder({
    encoder: encoderResource.resource.encoder,
    label: "split-screen-multi-camera",
  });
  const executionDiagnostics = executions.flatMap(
    (execution) => execution.diagnostics,
  );

  if (
    executions.some((execution) => !execution.valid) ||
    !end.valid ||
    !finished.valid
  ) {
    return stepFailure(
      "commands-unavailable",
      "The split-screen render pass commands could not be submitted.",
      [...executionDiagnostics, ...end.diagnostics, ...finished.diagnostics],
    );
  }

  const submitted = aperture.submitCommandBuffers({
    queue: initialized.device.queue,
    commandBuffers: [finished.resource],
  });

  if (!submitted.valid) {
    return stepFailure(
      "queue-submit-unavailable",
      "The split-screen command buffer could not be submitted.",
      submitted.diagnostics,
    );
  }

  await waitForSubmittedWork(initialized.device);

  const readback = readbackPlan.ok
    ? await mapCurrentTextureReadbackSamples(readbackPlan)
    : markReadbackClearOk(readbackPlan, true);
  const drawCalls = executions.reduce(
    (sum, execution) => sum + execution.drawCalls,
    0,
  );
  const indexedDrawCalls = executions.reduce(
    (sum, execution) => sum + execution.indexedDrawCalls,
    0,
  );

  return {
    ok: true,
    summary: {
      commandBuffers: submitted.submitted,
      viewPasses: viewPlans.length,
      commands: executions.reduce(
        (sum, execution, index) =>
          sum + viewPlans[index].framePlan.commandPlan.commands.length,
        0,
      ),
      drawCalls,
      indexedDrawCalls,
    },
    diagnosticCount:
      attachments.diagnostics.length +
      encoderResource.diagnostics.length +
      begin.diagnostics.length +
      executionDiagnostics.length +
      end.diagnostics.length +
      finished.diagnostics.length +
      submitted.diagnostics.length,
    readback,
  };
}

function applyPassRectangle(pass, viewport, scissor) {
  pass.setViewport?.(
    viewport.x,
    viewport.y,
    viewport.width,
    viewport.height,
    0,
    1,
  );
  pass.setScissorRect?.(scissor.x, scissor.y, scissor.width, scissor.height);
}

function requestViewportResizeSnapshots(aperture, canvasSize) {
  return new Promise((resolve) => {
    const worker = new Worker(routeConfig.workerUrl, {
      name: routeConfig.workerName,
      type: "module",
    });

    worker.addEventListener("message", (event) => {
      const message = event.data;

      if (message?.type === "error") {
        worker.terminate();
        resolve({
          ok: false,
          reason: message.reason ?? "worker-error",
          message: message.message ?? `${routeConfig.label} worker failed.`,
        });
        return;
      }

      if (message?.type !== "snapshots") {
        return;
      }

      const frames = Array.isArray(message.frames) ? message.frames : [];

      worker.terminate();
      resolve({
        ok: true,
        frames,
        scene: message.scene,
        worker: {
          running: false,
          scene: {
            meshKey: message.scene?.meshKey ?? null,
            materialKeys:
              message.scene?.materials?.map((entry) => entry.key) ?? [],
          },
          frames: frames.map((entry) => entry.frame),
        },
        transport: {
          mode: "structured-clone-postMessage",
          jsonRoundTrip: false,
          snapshotsReceived: frames.length,
          typedArraysPreserved: frames.map((entry) => ({
            frame: entry.frame,
            ...inspectStructuredCloneSnapshot(entry.snapshot),
          })),
        },
      });
    });
    worker.addEventListener(
      "error",
      (event) => {
        worker.terminate();
        resolve({
          ok: false,
          reason: "worker-error",
          message:
            event.message ||
            `${routeConfig.label} simulation worker reported an error.`,
        });
      },
      { once: true },
    );
    worker.postMessage({
      type: "snapshot",
      frame: 1,
      canvas: canvasSize,
    });
  });
}

function requestSplitScreenSnapshot(aperture, canvasSize) {
  return new Promise((resolve) => {
    const worker = new Worker(routeConfig.workerUrl, {
      name: routeConfig.workerName,
      type: "module",
    });

    worker.addEventListener("message", (event) => {
      const message = event.data;

      if (message?.type === "error") {
        worker.terminate();
        resolve({
          ok: false,
          reason: message.reason ?? "worker-error",
          message: message.message ?? `${routeConfig.label} worker failed.`,
        });
        return;
      }

      if (message?.type !== "snapshot") {
        return;
      }

      worker.terminate();
      resolve({
        ok: true,
        snapshot: message.snapshot,
        scene: message.scene,
        worker: {
          running: false,
          scene: {
            meshKey: message.scene?.meshKey ?? null,
            materialKeys:
              message.scene?.materials?.map((entry) => entry.key) ?? [],
          },
          frame: message.frame,
        },
        transport: {
          mode: "structured-clone-postMessage",
          jsonRoundTrip: false,
          snapshotsReceived: 1,
          typedArraysPreserved: inspectStructuredCloneSnapshot(
            message.snapshot,
          ),
        },
      });
    });
    worker.addEventListener(
      "error",
      (event) => {
        worker.terminate();
        resolve({
          ok: false,
          reason: "worker-error",
          message:
            event.message ||
            `${routeConfig.label} simulation worker reported an error.`,
        });
      },
      { once: true },
    );
    worker.postMessage({
      type: "snapshot",
      frame: 1,
      canvas: canvasSize,
    });
  });
}

function routeConfigForPath(pathname) {
  if (pathname.endsWith("/line-primitives.html")) {
    return {
      example: "line-primitives",
      label: "The line primitives route",
      workerUrl: "/worker-modules/examples/line-primitives.worker.js",
      workerName: "aperture-line-primitives-simulation",
    };
  }

  if (pathname.endsWith("/orthographic-camera.html")) {
    return {
      example: "orthographic-camera",
      label: "The orthographic camera route",
      workerUrl: "/worker-modules/examples/orthographic-camera.worker.js",
      workerName: "aperture-orthographic-camera-simulation",
    };
  }

  if (pathname.endsWith("/camera-render-layers.html")) {
    return {
      example: "camera-render-layers",
      label: "The camera render-layer isolation route",
      workerUrl: "/worker-modules/examples/camera-render-layers.worker.js",
      workerName: "aperture-camera-render-layers-simulation",
    };
  }

  if (pathname.endsWith("/camera-priority-overlay.html")) {
    return {
      example: "camera-priority-overlay",
      label: "The camera priority overlay route",
      workerUrl: "/worker-modules/examples/camera-priority-overlay.worker.js",
      workerName: "aperture-camera-priority-overlay-simulation",
    };
  }

  if (pathname.endsWith("/camera-sub-view-crop.html")) {
    return {
      example: "camera-sub-view-crop",
      label: "The camera sub-view crop route",
      workerUrl: "/worker-modules/examples/camera-sub-view-crop.worker.js",
      workerName: "aperture-camera-sub-view-crop-simulation",
    };
  }

  if (pathname.endsWith("/camera-viewport-grid.html")) {
    return {
      example: "camera-viewport-grid",
      label: "The camera viewport grid route",
      workerUrl: "/worker-modules/examples/camera-viewport-grid.worker.js",
      workerName: "aperture-camera-viewport-grid-simulation",
    };
  }

  if (pathname.endsWith("/camera-clear-load-matrix.html")) {
    return {
      example: "camera-clear-load-matrix",
      label: "The camera clear/load matrix route",
      workerUrl: "/worker-modules/examples/camera-clear-load-matrix.worker.js",
      workerName: "aperture-camera-clear-load-matrix-simulation",
    };
  }

  if (pathname.endsWith("/camera-picture-in-picture.html")) {
    return {
      example: "camera-picture-in-picture",
      label: "The camera picture-in-picture route",
      workerUrl: "/worker-modules/examples/camera-picture-in-picture.worker.js",
      workerName: "aperture-camera-picture-in-picture-simulation",
    };
  }

  if (pathname.endsWith("/camera-viewport-resize.html")) {
    return {
      example: "camera-viewport-resize",
      label: "The camera viewport resize route",
      workerUrl: "/worker-modules/examples/camera-viewport-resize.worker.js",
      workerName: "aperture-camera-viewport-resize-simulation",
      viewportResizeMatrix: true,
    };
  }

  return {
    example: "split-screen-multi-camera",
    label: "The split-screen multi-camera route",
    workerUrl: "/worker-modules/examples/split-screen-multi-camera.worker.js",
    workerName: "aperture-split-screen-multi-camera-simulation",
  };
}

function diagnosticsForExpectedDrawCount(diagnostics, expectedDrawCount) {
  if (expectedDrawCount !== 0) {
    return diagnostics;
  }

  return diagnostics.filter(
    (diagnostic) => diagnostic.code !== "renderWorld.empty",
  );
}

function snapshotForView(snapshot, view, scene = null) {
  const meshDraws =
    scene?.filterDrawsByViewLayer === true
      ? snapshot.meshDraws.filter(
          (draw) => (draw.layerMask & view.layerMask) !== 0,
        )
      : snapshot.meshDraws;

  return { ...snapshot, views: [view], meshDraws };
}

function expectedExtractedDrawCountForScene(scene) {
  return scene.expectedExtractedDrawCount ?? scene.expectedDrawCount;
}

function expectedDrawCountForView(scene, view) {
  return (
    scene.expectedDrawCountsByViewId?.[view.viewId] ??
    scene.expectedViewDrawCount ??
    scene.expectedDrawCount
  );
}

function unlitPipelineLayouts(pipeline) {
  if (typeof pipeline.getBindGroupLayout !== "function") {
    return null;
  }

  return [0, 1, 2].map((group) => ({
    group,
    layoutKey: `unlit/pipeline-layout-${group}`,
    layout: pipeline.getBindGroupLayout(group),
  }));
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    environments: snapshot.environments.length,
    shadowRequests: snapshot.shadowRequests.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function diagnosticCounts(counts) {
  return {
    extraction: 0,
    resources: 0,
    binding: 0,
    draw: 0,
    submission: 0,
    readback: 0,
    ...counts,
  };
}

function stepFailure(reason, message, diagnostics) {
  return { ok: false, reason, message, diagnostics };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}
