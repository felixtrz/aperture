import {
  validateMaterialAsset,
  type MaterialValidationDiagnostic,
  type StandardMaterialAsset,
} from "@aperture-engine/render";
import {
  parseMaterialPipelineRenderStateTokens,
  resolveWebGpuPipelineRenderState,
  type MaterialPipelineRenderStateTokens,
} from "./material-render-state.js";

export type StandardMaterialRenderStateSummaryDiagnosticCode =
  | "standardMaterialRenderState.validation"
  | "standardMaterialRenderState.alphaModeMismatch"
  | "standardMaterialRenderState.cullModeMismatch"
  | "standardMaterialRenderState.depthWriteMismatch"
  | "standardMaterialRenderState.blendPresetMismatch"
  | "standardMaterialRenderState.renderPhaseMismatch";

export interface StandardMaterialRenderStateSummaryDiagnostic {
  readonly code: StandardMaterialRenderStateSummaryDiagnosticCode;
  readonly message: string;
  readonly severity: "warning";
  readonly field?: string;
  readonly sourceCode?: MaterialValidationDiagnostic["code"];
  readonly sourceValue?: string | number | boolean | null;
  readonly derivedValue?: string | number | boolean | null;
}

export interface StandardMaterialRenderStateSummarySource {
  readonly alphaMode: StandardMaterialAsset["renderState"]["alphaMode"];
  readonly alphaCutoff: number;
  readonly cullMode: StandardMaterialAsset["renderState"]["cullMode"];
  readonly frontFace: StandardMaterialAsset["renderState"]["frontFace"];
  readonly depth: {
    readonly test: boolean;
    readonly write: boolean;
    readonly compare: StandardMaterialAsset["renderState"]["depth"]["compare"];
  };
  readonly blendPreset: StandardMaterialAsset["renderState"]["blend"]["preset"];
  readonly colorWriteMask: StandardMaterialAsset["renderState"]["colorWriteMask"];
}

export interface StandardMaterialRenderStateSummaryFlags {
  readonly alphaMask: boolean;
  readonly alphaBlend: boolean;
  readonly doubleSided: boolean;
}

export interface StandardMaterialRenderStatePipelineSummary {
  readonly pipelineKey: string | null;
  readonly tokens: MaterialPipelineRenderStateTokens;
  readonly resolved: {
    readonly alphaMode: string;
    readonly cullMode: string;
    readonly depthCompare: string;
    readonly depthWriteEnabled: boolean;
    readonly blendPreset: string;
    readonly blendEnabled: boolean;
  };
}

export interface StandardMaterialRenderStateSummary {
  readonly materialKey: string | null;
  readonly materialKind: "standard";
  readonly renderPhase: string | null;
  readonly source: StandardMaterialRenderStateSummarySource;
  readonly flags: StandardMaterialRenderStateSummaryFlags;
  readonly pipeline: StandardMaterialRenderStatePipelineSummary;
  readonly diagnostics: readonly StandardMaterialRenderStateSummaryDiagnostic[];
}

export interface CreateStandardMaterialRenderStateSummaryInput {
  readonly material: StandardMaterialAsset;
  readonly materialKey?: string;
  readonly pipelineKey?: string;
  readonly renderPhase?: string;
  readonly depthFormat?: string | null;
}

const RENDER_STATE_VALIDATION_CODES = new Set<
  MaterialValidationDiagnostic["code"]
>(["material.invalidAlphaCutoff", "material.incompatibleRenderState"]);

export function createStandardMaterialRenderStateSummary(
  input: CreateStandardMaterialRenderStateSummaryInput,
): StandardMaterialRenderStateSummary {
  const pipelineKey = input.pipelineKey ?? null;
  const tokens = parseMaterialPipelineRenderStateTokens(input.pipelineKey);
  const resolved = resolveWebGpuPipelineRenderState(
    input.pipelineKey,
    input.depthFormat,
  );
  const source = sourceSummary(input.material);
  const diagnostics: StandardMaterialRenderStateSummaryDiagnostic[] =
    renderStateValidationDiagnostics(input.material);

  pushTokenMismatchDiagnostics({
    source,
    tokens,
    resolvedDepthWriteEnabled: resolved.depthWriteEnabled,
    depthFormat: input.depthFormat,
    diagnostics,
  });
  pushRenderPhaseDiagnostics({
    source,
    renderPhase: input.renderPhase,
    diagnostics,
  });

  return {
    materialKey: input.materialKey ?? null,
    materialKind: "standard",
    renderPhase: input.renderPhase ?? null,
    source,
    flags: {
      alphaMask: input.material.renderState.alphaMode === "mask",
      alphaBlend: input.material.renderState.alphaMode === "blend",
      doubleSided: input.material.renderState.cullMode === "none",
    },
    pipeline: {
      pipelineKey,
      tokens,
      resolved: {
        alphaMode: resolved.alphaMode,
        cullMode: resolved.cullMode,
        depthCompare: resolved.depthCompare,
        depthWriteEnabled: resolved.depthWriteEnabled,
        blendPreset: tokens.blendPreset ?? "none",
        blendEnabled: resolved.blend !== null,
      },
    },
    diagnostics,
  };
}

function sourceSummary(
  material: StandardMaterialAsset,
): StandardMaterialRenderStateSummarySource {
  const renderState = material.renderState;

  return {
    alphaMode: renderState.alphaMode,
    alphaCutoff: renderState.alphaCutoff,
    cullMode: renderState.cullMode,
    frontFace: renderState.frontFace,
    depth: {
      test: renderState.depth.test,
      write: renderState.depth.write,
      compare: renderState.depth.compare,
    },
    blendPreset: renderState.blend.preset,
    colorWriteMask: renderState.colorWriteMask,
  };
}

function renderStateValidationDiagnostics(
  material: StandardMaterialAsset,
): StandardMaterialRenderStateSummaryDiagnostic[] {
  return validateMaterialAsset(material)
    .diagnostics.filter((diagnostic) =>
      RENDER_STATE_VALIDATION_CODES.has(diagnostic.code),
    )
    .map((diagnostic) => ({
      code: "standardMaterialRenderState.validation",
      sourceCode: diagnostic.code,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
      severity: "warning",
      message: diagnostic.message,
    }));
}

function pushTokenMismatchDiagnostics(input: {
  readonly source: StandardMaterialRenderStateSummarySource;
  readonly tokens: MaterialPipelineRenderStateTokens;
  readonly resolvedDepthWriteEnabled: boolean;
  readonly depthFormat: string | null | undefined;
  readonly diagnostics: StandardMaterialRenderStateSummaryDiagnostic[];
}): void {
  pushStringMismatch({
    code: "standardMaterialRenderState.alphaModeMismatch",
    field: "pipelineKey.alphaMode",
    sourceValue: input.source.alphaMode,
    derivedValue: input.tokens.alphaMode,
    message:
      "StandardMaterial pipeline alpha token does not match source render state.",
    diagnostics: input.diagnostics,
  });
  pushStringMismatch({
    code: "standardMaterialRenderState.cullModeMismatch",
    field: "pipelineKey.cullMode",
    sourceValue: input.source.cullMode,
    derivedValue: input.tokens.cullMode,
    message:
      "StandardMaterial pipeline cull token does not match source render state.",
    diagnostics: input.diagnostics,
  });
  pushStringMismatch({
    code: "standardMaterialRenderState.blendPresetMismatch",
    field: "pipelineKey.blendPreset",
    sourceValue: input.source.blendPreset,
    derivedValue: input.tokens.blendPreset,
    message:
      "StandardMaterial pipeline blend token does not match source render state.",
    diagnostics: input.diagnostics,
  });

  if (
    input.depthFormat !== undefined &&
    input.depthFormat !== null &&
    input.source.depth.write !== input.resolvedDepthWriteEnabled
  ) {
    input.diagnostics.push({
      code: "standardMaterialRenderState.depthWriteMismatch",
      field: "renderState.depth.write",
      severity: "warning",
      sourceValue: input.source.depth.write,
      derivedValue: input.resolvedDepthWriteEnabled,
      message:
        "StandardMaterial source depth-write state does not match WebGPU pipeline depth-write behavior.",
    });
  }
}

function pushRenderPhaseDiagnostics(input: {
  readonly source: StandardMaterialRenderStateSummarySource;
  readonly renderPhase: string | undefined;
  readonly diagnostics: StandardMaterialRenderStateSummaryDiagnostic[];
}): void {
  if (input.renderPhase === undefined) {
    return;
  }

  const expected =
    input.source.alphaMode === "blend"
      ? "transparent"
      : input.source.alphaMode === "mask"
        ? "alpha-test"
        : "opaque";

  if (input.renderPhase !== expected) {
    input.diagnostics.push({
      code: "standardMaterialRenderState.renderPhaseMismatch",
      field: "renderPhase",
      severity: "warning",
      sourceValue: input.source.alphaMode,
      derivedValue: input.renderPhase,
      message: `StandardMaterial source alpha mode expects '${expected}' queue phase, not '${input.renderPhase}'.`,
    });
  }
}

function pushStringMismatch(input: {
  readonly code: StandardMaterialRenderStateSummaryDiagnosticCode;
  readonly field: string;
  readonly sourceValue: string;
  readonly derivedValue: string | null;
  readonly message: string;
  readonly diagnostics: StandardMaterialRenderStateSummaryDiagnostic[];
}): void {
  if (input.derivedValue === null || input.sourceValue === input.derivedValue) {
    return;
  }

  input.diagnostics.push({
    code: input.code,
    field: input.field,
    severity: "warning",
    sourceValue: input.sourceValue,
    derivedValue: input.derivedValue,
    message: input.message,
  });
}
