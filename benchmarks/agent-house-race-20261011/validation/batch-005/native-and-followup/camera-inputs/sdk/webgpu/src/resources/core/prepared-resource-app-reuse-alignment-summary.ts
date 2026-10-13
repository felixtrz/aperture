export interface PreparedResourceAppReuseFacadeSummary {
  readonly preparedMeshes: { readonly totalEntries: number };
  readonly preparedMaterials: { readonly totalEntries: number };
  readonly drawReadiness: {
    readonly ready: number;
    readonly blocked: number;
  };
}

export interface PreparedResourceAppReuseReportSummary {
  readonly preparedMeshFacade: { readonly totalEntries: number };
  readonly preparedMaterialFacade: { readonly totalEntries: number };
  readonly preparedMeshBuffersCreated: number;
  readonly preparedMeshBuffersReused: number;
  readonly preparedMaterialBuffersCreated: number;
  readonly preparedMaterialBuffersReused: number;
  readonly preparedMaterialBindGroupsCreated: number;
  readonly preparedMaterialBindGroupsReused: number;
  readonly textureResourcesCreated: number;
  readonly textureResourcesReused: number;
  readonly samplerResourcesCreated: number;
  readonly samplerResourcesReused: number;
  readonly dynamicBufferWrites: number;
}

export type PreparedResourceAppReuseAlignmentDiagnosticCode =
  | "preparedResourceAppReuse.meshFacadeMismatch"
  | "preparedResourceAppReuse.materialFacadeMismatch";

export interface PreparedResourceAppReuseAlignmentDiagnostic {
  readonly code: PreparedResourceAppReuseAlignmentDiagnosticCode;
  readonly message: string;
  readonly severity: "warning";
  readonly renderPreparedCount: number;
  readonly appPreparedCount: number;
}

export interface PreparedResourceAppReuseAlignmentSummary {
  readonly facade: {
    readonly preparedMeshes: number;
    readonly preparedMaterials: number;
    readonly readyDraws: number;
    readonly blockedDraws: number;
  };
  readonly appFacade: {
    readonly preparedMeshes: number;
    readonly preparedMaterials: number;
  };
  readonly reuse: {
    readonly preparedMeshBuffersCreated: number;
    readonly preparedMeshBuffersReused: number;
    readonly preparedMaterialBuffersCreated: number;
    readonly preparedMaterialBuffersReused: number;
    readonly preparedMaterialBindGroupsCreated: number;
    readonly preparedMaterialBindGroupsReused: number;
    readonly textureResourcesCreated: number;
    readonly textureResourcesReused: number;
    readonly samplerResourcesCreated: number;
    readonly samplerResourcesReused: number;
    readonly dynamicBufferWrites: number;
  };
  readonly diagnostics: readonly PreparedResourceAppReuseAlignmentDiagnostic[];
}

export type PreparedResourceAppReuseAlignmentSummaryJsonValue =
  PreparedResourceAppReuseAlignmentSummary;

export function createPreparedResourceAppReuseAlignmentSummary(input: {
  readonly facade: PreparedResourceAppReuseFacadeSummary;
  readonly reuse: PreparedResourceAppReuseReportSummary;
}): PreparedResourceAppReuseAlignmentSummary {
  const facadePreparedMeshes = input.facade.preparedMeshes.totalEntries;
  const facadePreparedMaterials = input.facade.preparedMaterials.totalEntries;
  const appPreparedMeshes = input.reuse.preparedMeshFacade.totalEntries;
  const appPreparedMaterials = input.reuse.preparedMaterialFacade.totalEntries;
  const diagnostics: PreparedResourceAppReuseAlignmentDiagnostic[] = [];

  if (facadePreparedMeshes !== appPreparedMeshes) {
    diagnostics.push({
      code: "preparedResourceAppReuse.meshFacadeMismatch",
      severity: "warning",
      renderPreparedCount: facadePreparedMeshes,
      appPreparedCount: appPreparedMeshes,
      message:
        "Render prepared mesh facade count differs from the app prepared mesh facade count.",
    });
  }

  if (facadePreparedMaterials !== appPreparedMaterials) {
    diagnostics.push({
      code: "preparedResourceAppReuse.materialFacadeMismatch",
      severity: "warning",
      renderPreparedCount: facadePreparedMaterials,
      appPreparedCount: appPreparedMaterials,
      message:
        "Render prepared material facade count differs from the app prepared material facade count.",
    });
  }

  return {
    facade: {
      preparedMeshes: facadePreparedMeshes,
      preparedMaterials: facadePreparedMaterials,
      readyDraws: input.facade.drawReadiness.ready,
      blockedDraws: input.facade.drawReadiness.blocked,
    },
    appFacade: {
      preparedMeshes: appPreparedMeshes,
      preparedMaterials: appPreparedMaterials,
    },
    reuse: {
      preparedMeshBuffersCreated: input.reuse.preparedMeshBuffersCreated,
      preparedMeshBuffersReused: input.reuse.preparedMeshBuffersReused,
      preparedMaterialBuffersCreated:
        input.reuse.preparedMaterialBuffersCreated,
      preparedMaterialBuffersReused: input.reuse.preparedMaterialBuffersReused,
      preparedMaterialBindGroupsCreated:
        input.reuse.preparedMaterialBindGroupsCreated,
      preparedMaterialBindGroupsReused:
        input.reuse.preparedMaterialBindGroupsReused,
      textureResourcesCreated: input.reuse.textureResourcesCreated,
      textureResourcesReused: input.reuse.textureResourcesReused,
      samplerResourcesCreated: input.reuse.samplerResourcesCreated,
      samplerResourcesReused: input.reuse.samplerResourcesReused,
      dynamicBufferWrites: input.reuse.dynamicBufferWrites,
    },
    diagnostics,
  };
}

export function preparedResourceAppReuseAlignmentSummaryToJsonValue(
  summary: PreparedResourceAppReuseAlignmentSummary,
): PreparedResourceAppReuseAlignmentSummaryJsonValue {
  return {
    facade: { ...summary.facade },
    appFacade: { ...summary.appFacade },
    reuse: { ...summary.reuse },
    diagnostics: summary.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}
