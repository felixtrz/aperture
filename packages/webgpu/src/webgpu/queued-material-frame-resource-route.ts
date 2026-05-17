import type { QueuedMaterialPrepareRouteResult } from "./queued-material-prepare-route.js";

export type QueuedMaterialFrameResourceRouteStatus = "prepared" | "failed";

export interface QueuedMaterialFrameResourceResultLike<TDiagnostic = unknown> {
  readonly valid: boolean;
  readonly diagnostics: readonly TDiagnostic[];
}

export interface QueuedMaterialFrameResourceRouteShell<TDiagnostic = unknown> {
  readonly valid: boolean;
  readonly status: QueuedMaterialFrameResourceRouteStatus;
  readonly family: string;
  readonly facadeMeshResourceKey: string | null;
  readonly facadeMaterialResourceKey: string | null;
  readonly backendMeshKey: string;
  readonly backendMaterialKey: string;
  readonly pipelineKey: string;
  readonly sourceVersion: number;
  readonly frame: number;
  readonly diagnostics: readonly TDiagnostic[];
}

export function createQueuedMaterialFrameResourceRouteShell<
  TDiagnostic = unknown,
>(options: {
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly backendMeshKey: string;
  readonly backendMaterialKey: string;
  readonly frameResources: QueuedMaterialFrameResourceResultLike<TDiagnostic>;
}): QueuedMaterialFrameResourceRouteShell<TDiagnostic> {
  return {
    valid: options.prepareRoute.valid && options.frameResources.valid,
    status:
      options.prepareRoute.valid && options.frameResources.valid
        ? "prepared"
        : "failed",
    family: options.prepareRoute.family,
    facadeMeshResourceKey: options.prepareRoute.meshResourceKey,
    facadeMaterialResourceKey: options.prepareRoute.materialResourceKey,
    backendMeshKey: options.backendMeshKey,
    backendMaterialKey: options.backendMaterialKey,
    pipelineKey: options.prepareRoute.pipelineKey,
    sourceVersion: options.prepareRoute.sourceVersion,
    frame: options.prepareRoute.frame,
    diagnostics: options.frameResources.diagnostics,
  };
}
