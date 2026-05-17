import { parseMaterialPipelineRenderStateTokens } from "./material-render-state.js";

export interface BuiltInMaterialQueuePhaseEntityRef {
  readonly index: number;
  readonly generation: number;
}

export interface BuiltInMaterialQueuePhaseItem {
  readonly renderId: number;
  readonly drawIndex: number;
  readonly renderPhase: string;
  readonly materialFamily: string;
  readonly pipelineKey: string;
  readonly entity?: BuiltInMaterialQueuePhaseEntityRef;
}

export type BuiltInMaterialQueuePhaseDiagnosticCode =
  | "webGpuApp.unsupportedMaterialQueuePhase"
  | "webGpuApp.unsupportedMaterialQueueAlphaTestFamily"
  | "webGpuApp.unsupportedMaterialQueueTransparentFamily"
  | "webGpuApp.unsupportedMaterialQueueBlendPreset";

export interface BuiltInMaterialQueuePhaseDiagnostic {
  readonly code: BuiltInMaterialQueuePhaseDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily: string;
  readonly renderPhase?: string;
  readonly blendPreset?: string | null;
  readonly entity?: BuiltInMaterialQueuePhaseEntityRef;
}

export function createUnsupportedBuiltInMaterialQueuePhaseDiagnostic(
  queueItem: BuiltInMaterialQueuePhaseItem,
): BuiltInMaterialQueuePhaseDiagnostic | null {
  if (queueItem.renderPhase === "opaque") {
    return null;
  }

  if (
    queueItem.renderPhase === "alpha-test" &&
    queueItem.materialFamily === "standard"
  ) {
    return null;
  }

  if (queueItem.renderPhase === "alpha-test") {
    return {
      code: "webGpuApp.unsupportedMaterialQueueAlphaTestFamily",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      renderPhase: queueItem.renderPhase,
      materialFamily: queueItem.materialFamily,
      ...optionalEntity(queueItem),
      message: `WebGPU app material queue routing supports alpha-test draws for StandardMaterial, not '${queueItem.materialFamily}'.`,
    };
  }

  if (
    queueItem.renderPhase === "transparent" &&
    queueItem.materialFamily === "standard"
  ) {
    const tokens = parseMaterialPipelineRenderStateTokens(
      queueItem.pipelineKey,
    );

    if (tokens.blendPreset === "alpha") {
      return null;
    }

    return {
      code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      renderPhase: queueItem.renderPhase,
      materialFamily: queueItem.materialFamily,
      blendPreset: tokens.blendPreset,
      ...optionalEntity(queueItem),
      message: `WebGPU app material queue routing supports StandardMaterial transparent draws with alpha blending, not blend preset '${String(tokens.blendPreset)}'.`,
    };
  }

  if (queueItem.renderPhase === "transparent") {
    return {
      code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
      renderId: queueItem.renderId,
      drawIndex: queueItem.drawIndex,
      renderPhase: queueItem.renderPhase,
      materialFamily: queueItem.materialFamily,
      ...optionalEntity(queueItem),
      message: `WebGPU app material queue routing supports transparent draws for StandardMaterial, not '${queueItem.materialFamily}'.`,
    };
  }

  return {
    code: "webGpuApp.unsupportedMaterialQueuePhase",
    renderId: queueItem.renderId,
    drawIndex: queueItem.drawIndex,
    renderPhase: queueItem.renderPhase,
    materialFamily: queueItem.materialFamily,
    ...optionalEntity(queueItem),
    message: `WebGPU app material queue routing currently supports opaque and StandardMaterial alpha-test draws, not '${queueItem.renderPhase}'.`,
  };
}

function optionalEntity(queueItem: BuiltInMaterialQueuePhaseItem): {
  readonly entity?: BuiltInMaterialQueuePhaseEntityRef;
} {
  return queueItem.entity === undefined ? {} : { entity: queueItem.entity };
}
