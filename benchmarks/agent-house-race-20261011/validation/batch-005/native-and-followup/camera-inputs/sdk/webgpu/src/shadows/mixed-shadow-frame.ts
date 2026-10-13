import {
  createShadowRequestCoverage,
  shadowRequestOmissionDiagnostics,
} from "./shadow-request-coverage.js";
import type { ShadowRequestPacket } from "@aperture-engine/render";
import {
  createRenderShadowFrame,
  type CreateRenderShadowFrameOptions,
  type RenderShadowFrameReport,
  type RenderShadowFrameResult,
} from "./render-shadow-frame.js";

/**
 * Compose the established per-kind caster builders. Keeping their matrix and
 * depth resources separate preserves point face indices and directional fitting.
 * The app folds every child pass into the same frame graph/queue submission.
 *
 * A single non-cascaded sun plus point lights is supported. Cascaded or multiple
 * suns, and mixed spot receivers, retain their existing selected-kind policy.
 */
export function createMixedDirectionalPointShadowFrame(
  options: CreateRenderShadowFrameOptions,
): RenderShadowFrameResult | null {
  const directional = options.snapshot.shadowRequests.filter(
    (request) =>
      request.lightKind === undefined || request.lightKind === "directional",
  );
  const point = options.snapshot.shadowRequests.filter(
    (request) => request.lightKind === "point",
  );
  if (
    directional.length !== 1 ||
    (options.shadowMap?.cascadeCount ?? directional[0]?.cascadeCount ?? 1) !==
      1 ||
    point.length === 0
  ) {
    return null;
  }

  // Standalone child encoders cannot share timestamp query indices. Integrated
  // graph timing remains per-pass; standalone mixed frames omit GPU timestamps.
  const { gpuTiming, ...childOptions } = options;
  void gpuTiming;
  const create = (
    requests: readonly ShadowRequestPacket[],
    kind: "directional" | "point",
  ) =>
    createRenderShadowFrame({
      ...childOptions,
      snapshot: { ...options.snapshot, shadowRequests: requests },
      ...(options.shadowMap?.resourceKey === undefined
        ? {}
        : {
            shadowMap: {
              ...options.shadowMap,
              resourceKey: `${options.shadowMap.resourceKey}:${kind}`,
            },
          }),
    });
  const sun = create(directional, "directional");
  const points = create(point, "point");
  const receiverResources =
    sun.receiverResources === null || points.receiverResources === null
      ? null
      : {
          ...sun.receiverResources,
          shadowKind: "directional-point-array" as const,
          pointShadowReceiverResources: points.receiverResources,
        };
  // Retain original packet references: child coverage contains serialized identities,
  // and neither child sees requests (such as spots) omitted by the composition.
  const requestCoverage = createShadowRequestCoverage(
    options.snapshot.shadowRequests,
    [...directional, ...point],
  );
  const report = combineReports(
    sun.report,
    points.report,
    receiverResources !== null,
  );
  return {
    ...sun,
    receiverResources,
    frames: [sun, points],
    report: {
      ...report,
      requestCoverage,
      diagnostics: [
        ...report.diagnostics,
        ...shadowRequestOmissionDiagnostics(
          requestCoverage,
          "directional-point-array",
        ),
      ],
    },
  };
}

function combineReports(
  sun: RenderShadowFrameReport,
  points: RenderShadowFrameReport,
  receiversReady: boolean,
): RenderShadowFrameReport {
  const ready = receiversReady && sun.ready && points.ready;
  const submitted = sun.status === "submitted" && points.status === "submitted";
  return {
    ...sun,
    ready,
    status: ready ? (submitted ? "submitted" : "ready") : "missing",
    shadowKind: receiversReady ? "directional-point-array" : null,
    requestCount: sun.requestCount + points.requestCount,
    passCount: sun.passCount + points.passCount,
    drawCalls: sun.drawCalls + points.drawCalls,
    ...(sun.casterCounts === undefined || points.casterCounts === undefined
      ? {}
      : { casterCounts: sumCounts(sun.casterCounts, points.casterCounts) }),
    depthTextureKeys: [...sun.depthTextureKeys, ...points.depthTextureKeys],
    sections: {
      shadowRequests:
        sun.sections.shadowRequests && points.sections.shadowRequests,
      depthTextureResources:
        sun.sections.depthTextureResources &&
        points.sections.depthTextureResources,
      matrixBufferResource:
        sun.sections.matrixBufferResource &&
        points.sections.matrixBufferResource,
      samplerResource:
        sun.sections.samplerResource && points.sections.samplerResource,
      pipelineResource:
        sun.sections.pipelineResource && points.sections.pipelineResource,
      matrixBindGroupResource:
        sun.sections.matrixBindGroupResource &&
        points.sections.matrixBindGroupResource,
      commandBufferSubmission: submitted,
      receiverResources: receiversReady,
    },
    resourceReuse: sumCounts(sun.resourceReuse, points.resourceReuse),
    commandBufferSubmission: {
      ...sun.commandBufferSubmission,
      status: submitted ? "submitted" : ready ? "ready" : "missing",
      assembledPasses:
        sun.commandBufferSubmission.assembledPasses +
        points.commandBufferSubmission.assembledPasses,
      commandBuffers:
        sun.commandBufferSubmission.commandBuffers +
        points.commandBufferSubmission.commandBuffers,
      submittedCommandBuffers:
        sun.commandBufferSubmission.submittedCommandBuffers +
        points.commandBufferSubmission.submittedCommandBuffers,
      commandBufferKeys: [
        ...sun.commandBufferSubmission.commandBufferKeys,
        ...points.commandBufferSubmission.commandBufferKeys,
      ],
      sections: {
        ...sun.commandBufferSubmission.sections,
      },
    },
    diagnostics: [...sun.diagnostics, ...points.diagnostics],
    lightKindReports: [sun, points],
  };
}

function sumCounts<T extends { readonly [K in keyof T]: number }>(
  a: T,
  b: T,
): T {
  return Object.fromEntries(
    Object.keys(a).map((key) => [key, a[key as keyof T] + b[key as keyof T]]),
  ) as T;
}
