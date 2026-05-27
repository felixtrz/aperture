import {
  createMaterialQueuePhaseSummary,
  renderQueueSortPolicyForPhase,
  type RenderQueueSortPhaseReport,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  createDirectLightReadinessReport,
  directLightReadinessResourceStateFromStandardFrameResources,
} from "../lighting/direct-light-readiness.js";
import type { QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue } from "../materials/core/built-in-material-app-resource-adapter.js";
import {
  createStandardAreaLightLtcResources,
  type StandardAreaLightLtcResources,
} from "../materials/standard/standard-area-light-ltc-resource.js";
import type { PlanRenderFrameFromSnapshotResult } from "../render/frame/render-frame-plan.js";
import {
  type QueuedBuiltInAppResourceItem,
  type QueuedBuiltInAppResourceSet,
} from "../render/queues/queued-built-in-app-resource-set.js";
import type { QueuedBuiltInFrameResources } from "../render/queues/queued-built-in-frame-resource-set.js";
import { createQueuedMaterialFrameResourceSetSummary } from "../render/queues/queued-material-frame-resource-set-summary.js";
import { createRenderFrameQueueDiagnosticsSummary } from "../render/frame/render-frame-plan.js";
import {
  collectWebGpuAppMaterialQueueRouteReport,
  createWebGpuAppDiagnosticsSummary,
  type WebGpuAppDiagnosticsSummary,
} from "./app-diagnostics-summary.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

interface QueuedBuiltInSupportAppContext {
  readonly initialization: {
    readonly device: unknown;
  };
}

export function snapshotUsesTransmission(snapshot: RenderSnapshot): boolean {
  return snapshot.meshDraws.some((draw) =>
    draw.batchKey.pipelineKey.split("|").includes("transmission"),
  );
}

export function queuedBuiltInResourceSetHasStandardMaterial(
  resourceSet: QueuedBuiltInAppResourceSet,
): boolean {
  return resourceSet.items.some((item) => item.adapter.kind === "standard");
}

export function createQueuedBuiltInAppDiagnosticsSummary(input: {
  readonly snapshot: RenderSnapshot;
  readonly resourceSet: QueuedBuiltInAppResourceSet;
  readonly resources: QueuedBuiltInFrameResources | null;
  readonly adapterValidation: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
  readonly framePlan?: Pick<
    PlanRenderFrameFromSnapshotResult,
    "readiness" | "packages"
  >;
}): WebGpuAppDiagnosticsSummary {
  const hasStandardRoute = input.resourceSet.items.some(
    (item) => item.queueItem.materialFamily === "standard",
  );

  return createWebGpuAppDiagnosticsSummary({
    materialQueue: createMaterialQueuePhaseSummary(
      input.resourceSet.items.map((item) => item.queueItem),
    ),
    routedResourceSet: createQueuedMaterialFrameResourceSetSummary(
      input.resourceSet.items.map((item) => ({
        materialFamily: item.queueItem.materialFamily,
        pipelineKey: item.draw.batchKey.pipelineKey,
        renderPhase: item.queueItem.renderPhase,
      })),
      input.resources === null
        ? {}
        : { byFamily: input.resources.byFamilySummary },
    ),
    renderQueueSortPhases: createQueuedBuiltInAppSortPhaseSummary(
      input.resourceSet.items,
    ),
    ...(input.framePlan === undefined
      ? {}
      : {
          renderFrameQueue: createRenderFrameQueueDiagnosticsSummary(
            input.framePlan,
          ),
        }),
    builtInAppResourceAdapters: input.adapterValidation,
    ...(hasStandardRoute
      ? {
          directLighting: createDirectLightReadinessReport({
            snapshot: input.snapshot,
            resources:
              input.resources === null
                ? null
                : directLightReadinessResourceStateFromStandardFrameResources(
                    input.resources.standard[0] ?? null,
                  ),
          }),
        }
      : {}),
  });
}

export function collectInstanceTintResources(
  resources: QueuedBuiltInFrameResources,
): NonNullable<
  QueuedBuiltInFrameResources["standard"][number]["instanceTints"]
>[] {
  const result: NonNullable<
    QueuedBuiltInFrameResources["standard"][number]["instanceTints"]
  >[] = [];
  const seen = new Set<string>();

  for (const standard of resources.standard) {
    const instanceTints = standard.instanceTints;

    if (instanceTints === undefined || seen.has(instanceTints.resourceKey)) {
      continue;
    }

    seen.add(instanceTints.resourceKey);
    result.push(instanceTints);
  }

  return result;
}

export function createQueuedBuiltInRouteFailureDiagnosticsSummary(
  diagnostics: readonly unknown[],
  adapterValidation: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue,
): WebGpuAppDiagnosticsSummary | undefined {
  const materialQueueRoute =
    collectWebGpuAppMaterialQueueRouteReport(diagnostics);

  return materialQueueRoute === null
    ? undefined
    : createWebGpuAppDiagnosticsSummary({
        materialQueueRoute,
        builtInAppResourceAdapters: adapterValidation,
      });
}

export function resolveStandardAreaLightLtcResources(options: {
  readonly app: QueuedBuiltInSupportAppContext;
  readonly cache: WebGpuAppResourceCache;
  readonly required: boolean;
}): {
  readonly valid: boolean;
  readonly resources: StandardAreaLightLtcResources | null;
  readonly diagnostics: readonly unknown[];
} {
  if (!options.required) {
    return { valid: true, resources: null, diagnostics: [] };
  }

  const result = createStandardAreaLightLtcResources({
    device: options.app.initialization.device as Parameters<
      typeof createStandardAreaLightLtcResources
    >[0]["device"],
    textureCache: options.cache.textures,
    samplerCache: options.cache.samplers,
  });

  return {
    valid: result.valid,
    resources: result.resources,
    diagnostics: result.diagnostics,
  };
}

function createQueuedBuiltInAppSortPhaseSummary(
  items: readonly QueuedBuiltInAppResourceItem[],
): readonly RenderQueueSortPhaseReport[] {
  let opaque = 0;
  let transparent = 0;

  for (const item of items) {
    if (item.queueItem.renderPhase === "transparent") {
      transparent += 1;
    } else {
      opaque += 1;
    }
  }

  const phases: RenderQueueSortPhaseReport[] = [];

  if (opaque > 0) {
    phases.push({
      phase: "opaque",
      recordCount: opaque,
      sortPolicy: renderQueueSortPolicyForPhase("opaque"),
    });
  }

  if (transparent > 0) {
    phases.push({
      phase: "transparent",
      recordCount: transparent,
      sortPolicy: renderQueueSortPolicyForPhase("transparent"),
    });
  }

  return phases;
}
