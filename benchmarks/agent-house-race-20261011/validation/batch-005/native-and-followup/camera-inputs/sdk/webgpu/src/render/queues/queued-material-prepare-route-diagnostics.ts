import type {
  MaterialQueueItem,
  MeshDrawPacket,
} from "@aperture-engine/render";

export interface WebGpuAppUnsupportedMaterialQueueDiagnostic {
  readonly code:
    | "webGpuApp.unsupportedMaterialQueueFamily"
    | "webGpuApp.unsupportedMaterialQueuePhase"
    | "webGpuApp.unsupportedMaterialQueueAlphaTestFamily"
    | "webGpuApp.unsupportedMaterialQueueTransparentFamily"
    | "webGpuApp.unsupportedMaterialQueueBlendPreset"
    | "webGpuApp.materialQueueAssetMismatch";
  readonly message: string;
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily?: string;
  readonly materialKind?: string;
  readonly renderPhase?: string;
  readonly blendPreset?: string | null;
  readonly entity?: MeshDrawPacket["entity"];
}

export function queuedPrepareRouteDiagnosticToWebGpuAppDiagnostic(
  diagnostic: unknown,
  queueItem: MaterialQueueItem,
): unknown {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return diagnostic;
  }

  const candidate = diagnostic as {
    readonly code?: unknown;
    readonly materialKind?: unknown;
  };

  if (candidate.code === "queuedMaterialPrepareRoute.missingAdapter") {
    return {
      code: "webGpuApp.unsupportedMaterialQueueFamily",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      materialFamily: queueItem.materialFamily,
      entity: queueItem.entity,
      message: `WebGPU app material queue routing supports unlit, matcap, standard, and debug-normal materials, not '${queueItem.materialFamily}'.`,
    } satisfies WebGpuAppUnsupportedMaterialQueueDiagnostic;
  }

  if (candidate.code === "queuedMaterialPrepareRoute.materialMismatch") {
    return {
      code: "webGpuApp.materialQueueAssetMismatch",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      materialFamily: queueItem.materialFamily,
      ...optionalString("materialKind", candidate.materialKind),
      entity: queueItem.entity,
      message: `Render object ${queueItem.renderId} pipeline family '${queueItem.materialFamily}' does not match material asset kind '${String(candidate.materialKind)}'.`,
    } satisfies WebGpuAppUnsupportedMaterialQueueDiagnostic;
  }

  return diagnostic;
}

function optionalString<Key extends "materialKind">(
  key: Key,
  value: unknown,
): { readonly [Property in Key]?: string } {
  return typeof value === "string"
    ? ({ [key]: value } as { readonly [Property in Key]?: string })
    : {};
}
