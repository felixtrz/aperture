import type {
  IblResourceDescriptorDiagnostic,
  IblResourceDescriptorReport,
} from "../../lighting/ibl-resource-descriptor.js";
import type { IblTexturePreparationReport } from "../../lighting/ibl-texture-preparation.js";
import type { StandardMaterialIblBindGroupResourceReport } from "./standard-material-ibl-bind-group.js";

export type StandardMaterialIblStatus =
  | "not-required"
  | "not-requested"
  | "source-missing"
  | "preparation-pending"
  | "preparation-failed"
  | "diffuse-ready"
  | "diffuse-specular-ready"
  | "pipeline-active";

export type StandardMaterialIblReadinessDiagnosticCode =
  | "standardMaterialIbl.missingDescriptors"
  | "standardMaterialIbl.preparationPending"
  | "standardMaterialIbl.preparationFailed"
  | "standardMaterialIbl.pipelineInactive"
  | "standardMaterialIbl.pipelineResourceMismatch";

export interface StandardMaterialIblReadinessDiagnostic {
  readonly code: StandardMaterialIblReadinessDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly descriptorDiagnostics: readonly IblResourceDescriptorDiagnostic[];
}

export interface StandardMaterialIblReadinessReport {
  readonly ready: boolean;
  readonly status: StandardMaterialIblStatus;
  readonly standardMaterialCount: number;
  readonly descriptorCount: number;
  readonly submittedStandardPipelineCount: number;
  readonly activeIblPipelineCount: number;
  readonly sections: {
    readonly environmentRequested: boolean;
    readonly environmentSource: boolean;
    readonly iblDescriptors: boolean;
    readonly diffuseIrradiance: boolean | null;
    readonly specularPrefilter: boolean | null;
    readonly bindGroupResource: boolean | null;
    readonly pipelineActive: boolean;
    /** Derived from the executable submitted pipeline, never a static flag. */
    readonly shaderSampling: boolean;
  };
  readonly diagnostics: readonly StandardMaterialIblReadinessDiagnostic[];
}

export type StandardMaterialIblReadinessReportJsonValue =
  StandardMaterialIblReadinessReport;

export interface StandardMaterialIblReadinessInput {
  readonly standardMaterialCount: number;
  readonly iblDescriptors: IblResourceDescriptorReport;
  readonly texturePreparation?: IblTexturePreparationReport;
  readonly bindGroupResource?: StandardMaterialIblBindGroupResourceReport;
  /** Pipeline keys actually selected for submitted StandardMaterial draws. */
  readonly submittedPipelineKeys?: readonly string[];
}

export function createStandardMaterialIblReadinessReport(
  input: StandardMaterialIblReadinessInput,
): StandardMaterialIblReadinessReport {
  const environmentRequested =
    input.iblDescriptors.requiredEnvironmentMapCount > 0;
  const submittedStandardPipelineKeys = uniqueSorted(
    (input.submittedPipelineKeys ?? []).filter((key) =>
      key.startsWith("standard|"),
    ),
  );
  const submittedIblPipelineKeys = submittedStandardPipelineKeys.filter((key) =>
    hasPipelineToken(key, "iblDiffuse"),
  );

  if (input.standardMaterialCount === 0 || !environmentRequested) {
    return report({
      status:
        input.standardMaterialCount === 0 ? "not-required" : "not-requested",
      ready: true,
      input,
      submittedStandardPipelineCount: submittedStandardPipelineKeys.length,
      activeIblPipelineCount: 0,
      sections: {
        environmentRequested,
        environmentSource: !environmentRequested,
        iblDescriptors: true,
        diffuseIrradiance: null,
        specularPrefilter: null,
        bindGroupResource: null,
        pipelineActive: false,
        shaderSampling: false,
      },
      diagnostics: [],
    });
  }

  const missingDescriptorDiagnostics = input.iblDescriptors.diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "iblResourceDescriptor.missingDescriptor",
  );
  const environmentSource = missingDescriptorDiagnostics.length === 0;
  const preparationStatus = input.texturePreparation?.status;
  const preparationFailed =
    preparationStatus === "missing" || preparationStatus === "unsupported";
  const preparationPending = preparationStatus === "deferred";
  const diffuseReady = slotReady(input, "diffuse");
  const specularReady = slotReady(input, "specular");
  const bindGroupReady =
    input.bindGroupResource === undefined
      ? null
      : input.bindGroupResource.status === "available" &&
        input.bindGroupResource.resource !== null;
  const pipelineResourcesReady =
    diffuseReady &&
    (bindGroupReady ?? true) &&
    submittedIblPipelineKeys.every(
      (key) =>
        (!hasPipelineToken(key, "iblSpecularProof") &&
          !hasPipelineToken(key, "iblSpecularBrdf")) ||
        specularReady,
    );
  const activeIblPipelineCount = pipelineResourcesReady
    ? submittedIblPipelineKeys.length
    : 0;
  const pipelineActive = activeIblPipelineCount > 0;
  const diagnostics: StandardMaterialIblReadinessDiagnostic[] = [];

  if (!environmentSource) {
    diagnostics.push({
      code: "standardMaterialIbl.missingDescriptors",
      severity: "warning",
      descriptorDiagnostics: missingDescriptorDiagnostics,
      message:
        "An environment was requested, but its renderer-owned IBL source descriptor is missing.",
    });
  }

  if (preparationFailed) {
    diagnostics.push({
      code: "standardMaterialIbl.preparationFailed",
      severity: "warning",
      descriptorDiagnostics: [],
      message:
        "The requested environment source exists, but diffuse/specular IBL preparation failed.",
    });
  } else if (preparationPending) {
    diagnostics.push({
      code: "standardMaterialIbl.preparationPending",
      severity: "warning",
      descriptorDiagnostics: [],
      message:
        "The requested environment source exists, but IBL preparation is not complete.",
    });
  }

  if (submittedIblPipelineKeys.length > 0 && !pipelineResourcesReady) {
    diagnostics.push({
      code: "standardMaterialIbl.pipelineResourceMismatch",
      severity: "error",
      descriptorDiagnostics: [],
      message:
        "The submitted StandardMaterial pipeline selects IBL, but the required prepared and bound resources are not ready.",
    });
  } else if (
    submittedStandardPipelineKeys.length > 0 &&
    submittedIblPipelineKeys.length === 0 &&
    (diffuseReady || specularReady)
  ) {
    diagnostics.push({
      code: "standardMaterialIbl.pipelineInactive",
      severity: "warning",
      descriptorDiagnostics: [],
      message:
        "IBL resources are ready, but the submitted StandardMaterial pipeline does not select IBL sampling.",
    });
  }

  const status = determineStatus({
    environmentSource,
    preparationFailed,
    preparationPending,
    diffuseReady,
    specularReady,
    pipelineActive,
  });

  return report({
    status,
    ready:
      environmentSource &&
      !preparationFailed &&
      !preparationPending &&
      (input.submittedPipelineKeys === undefined
        ? diffuseReady
        : pipelineActive),
    input,
    submittedStandardPipelineCount: submittedStandardPipelineKeys.length,
    activeIblPipelineCount,
    sections: {
      environmentRequested: true,
      environmentSource,
      iblDescriptors: environmentSource,
      diffuseIrradiance: diffuseReady,
      specularPrefilter: specularReady,
      bindGroupResource: bindGroupReady,
      pipelineActive,
      shaderSampling: pipelineActive,
    },
    diagnostics,
  });
}

export function standardMaterialIblReadinessReportToJsonValue(
  value: StandardMaterialIblReadinessReport,
): StandardMaterialIblReadinessReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    standardMaterialCount: value.standardMaterialCount,
    descriptorCount: value.descriptorCount,
    submittedStandardPipelineCount: value.submittedStandardPipelineCount,
    activeIblPipelineCount: value.activeIblPipelineCount,
    sections: { ...value.sections },
    diagnostics: value.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      descriptorDiagnostics: diagnostic.descriptorDiagnostics.map(
        (descriptorDiagnostic) => ({
          ...descriptorDiagnostic,
          environmentIds: [...descriptorDiagnostic.environmentIds],
        }),
      ),
    })),
  };
}

export function standardMaterialIblReadinessReportToJson(
  value: StandardMaterialIblReadinessReport,
): string {
  return JSON.stringify(standardMaterialIblReadinessReportToJsonValue(value));
}

function report(input: {
  readonly status: StandardMaterialIblStatus;
  readonly ready: boolean;
  readonly input: StandardMaterialIblReadinessInput;
  readonly submittedStandardPipelineCount: number;
  readonly activeIblPipelineCount: number;
  readonly sections: StandardMaterialIblReadinessReport["sections"];
  readonly diagnostics: readonly StandardMaterialIblReadinessDiagnostic[];
}): StandardMaterialIblReadinessReport {
  return {
    ready: input.ready,
    status: input.status,
    standardMaterialCount: input.input.standardMaterialCount,
    descriptorCount: input.input.iblDescriptors.descriptorCount,
    submittedStandardPipelineCount: input.submittedStandardPipelineCount,
    activeIblPipelineCount: input.activeIblPipelineCount,
    sections: input.sections,
    diagnostics: input.diagnostics,
  };
}

function slotReady(
  input: StandardMaterialIblReadinessInput,
  kind: "diffuse" | "specular",
): boolean {
  if (input.texturePreparation !== undefined) {
    const slots = input.texturePreparation.slots.filter(
      (slot) => slot.kind === kind,
    );
    return (
      slots.length > 0 && slots.every((slot) => slot.preparation === "ready")
    );
  }

  return (
    input.iblDescriptors.descriptors.length > 0 &&
    input.iblDescriptors.descriptors.every(
      (descriptor) => descriptor[kind].status === "ready",
    )
  );
}

function determineStatus(input: {
  readonly environmentSource: boolean;
  readonly preparationFailed: boolean;
  readonly preparationPending: boolean;
  readonly diffuseReady: boolean;
  readonly specularReady: boolean;
  readonly pipelineActive: boolean;
}): StandardMaterialIblStatus {
  if (!input.environmentSource) {
    return "source-missing";
  }
  if (input.preparationFailed) {
    return "preparation-failed";
  }
  if (input.preparationPending) {
    return "preparation-pending";
  }
  if (input.pipelineActive) {
    return "pipeline-active";
  }
  if (input.diffuseReady && input.specularReady) {
    return "diffuse-specular-ready";
  }
  if (input.diffuseReady) {
    return "diffuse-ready";
  }
  return "preparation-failed";
}

function hasPipelineToken(pipelineKey: string, token: string): boolean {
  return `|${pipelineKey}|`.includes(`|${token}|`);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
