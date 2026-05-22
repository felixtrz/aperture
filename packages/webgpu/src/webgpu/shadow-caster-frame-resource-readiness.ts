import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type {
  ShadowCasterPipelineDescriptorMetadata,
  ShadowCasterPipelineDescriptorReport,
} from "./shadow-caster-pipeline-descriptor.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";

const DEFAULT_MESH_LAYOUT_DESCRIPTOR_KEY = "__default_shadow_caster_layout__";

export type ShadowCasterFrameResourceReadinessStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "not-required";

export type ShadowCasterFrameResourceReadinessDiagnosticCode =
  | "shadowCasterFrameResource.missingPipelineDescriptor"
  | "shadowCasterFrameResource.missingMatrixBuffer"
  | "shadowCasterFrameResource.missingPreparedMesh"
  | "shadowCasterFrameResource.pipelineCreationDeferred"
  | "shadowCasterFrameResource.passSubmissionDeferred";

export interface ShadowCasterFrameResourceReadinessDiagnostic {
  readonly code: ShadowCasterFrameResourceReadinessDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly renderId?: number;
  readonly meshKey?: string;
}

export interface ShadowCasterPreparedMeshResourceView {
  readonly meshKey: string;
  readonly meshResourceKey: string;
  readonly vertexBufferResourceKeys: readonly string[];
  readonly indexBufferResourceKey: string | null;
}

export interface ShadowCasterFrameResourceRecord {
  readonly renderId: number;
  readonly meshKey: string;
  readonly meshLayoutKey: string;
  readonly passKey: string;
  readonly meshResourceKey: string | null;
  readonly vertexBufferResourceKeys: readonly string[];
  readonly indexBufferResourceKey: string | null;
  readonly matrixResourceKey: string | null;
  readonly pipelineKey: string | null;
  readonly ready: boolean;
}

export interface ShadowCasterFrameResourceReadinessReport {
  readonly ready: boolean;
  readonly status: ShadowCasterFrameResourceReadinessStatus;
  readonly counts: {
    readonly casterDraws: number;
    readonly readyDraws: number;
    readonly missingMeshBuffers: number;
    readonly pipelineDescriptors: number;
    readonly matrixBuffers: number;
  };
  readonly sections: {
    readonly casterDrawLists: boolean;
    readonly preparedMeshBuffers: boolean;
    readonly matrixBufferResource: boolean;
    readonly pipelineDescriptor: boolean;
    readonly pipelineCreation: false;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly records: readonly ShadowCasterFrameResourceRecord[];
  readonly diagnostics: readonly ShadowCasterFrameResourceReadinessDiagnostic[];
}

export type ShadowCasterFrameResourceReadinessReportJsonValue =
  ShadowCasterFrameResourceReadinessReport;

export interface CreateShadowCasterFrameResourceReadinessReportOptions {
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly pipelineDescriptor: ShadowCasterPipelineDescriptorReport;
}

export function createShadowCasterFrameResourceReadinessReport(
  options: CreateShadowCasterFrameResourceReadinessReportOptions,
): ShadowCasterFrameResourceReadinessReport {
  if (options.casterDrawList.requestCount === 0) {
    return report({
      status: "not-required",
      records: [],
      diagnostics: [],
      pipelineDescriptors: 0,
      matrixBuffers: 0,
    });
  }

  const diagnostics: ShadowCasterFrameResourceReadinessDiagnostic[] = [];
  const preparedByMesh = new Map(
    options.preparedMeshes.map((mesh) => [mesh.meshKey, mesh]),
  );
  const pipelineDescriptors =
    options.pipelineDescriptor.descriptors.length > 0
      ? options.pipelineDescriptor.descriptors
      : options.pipelineDescriptor.descriptor === null
        ? []
        : [options.pipelineDescriptor.descriptor];
  const pipelineDescriptorByLayout =
    createPipelineDescriptorByLayout(pipelineDescriptors);
  const matrixResourceKey =
    options.matrixBufferResource.resource?.resourceKey ?? null;

  if (pipelineDescriptors.length === 0) {
    diagnostics.push({
      code: "shadowCasterFrameResource.missingPipelineDescriptor",
      severity: "warning",
      message:
        "Shadow caster frame resources require a depth-only shadow caster pipeline descriptor.",
    });
  }

  if (matrixResourceKey === null) {
    diagnostics.push({
      code: "shadowCasterFrameResource.missingMatrixBuffer",
      severity: "warning",
      message:
        "Shadow caster frame resources require a live shadow matrix buffer resource.",
    });
  }

  const records: ShadowCasterFrameResourceRecord[] = [];

  for (const list of options.casterDrawList.lists) {
    for (const draw of list.draws) {
      const prepared = preparedByMesh.get(draw.meshKey);
      const pipelineDescriptor =
        pipelineDescriptors.length === 0
          ? null
          : resolvePipelineDescriptorForLayout(
              draw.meshLayoutKey,
              pipelineDescriptorByLayout,
            );
      const pipelineKey = pipelineDescriptor?.pipelineKey ?? null;

      if (prepared === undefined) {
        diagnostics.push({
          code: "shadowCasterFrameResource.missingPreparedMesh",
          severity: "warning",
          renderId: draw.renderId,
          meshKey: draw.meshKey,
          message: `Shadow caster draw '${draw.renderId}' has no prepared mesh buffer resource for '${draw.meshKey}'.`,
        });
      }

      if (pipelineDescriptors.length > 0 && pipelineDescriptor === null) {
        diagnostics.push({
          code: "shadowCasterFrameResource.missingPipelineDescriptor",
          severity: "warning",
          renderId: draw.renderId,
          meshKey: draw.meshKey,
          message: `Shadow caster draw '${draw.renderId}' has no depth-only pipeline descriptor for mesh layout '${draw.meshLayoutKey}'.`,
        });
      }

      records.push({
        renderId: draw.renderId,
        meshKey: draw.meshKey,
        meshLayoutKey: draw.meshLayoutKey,
        passKey: list.passKey,
        meshResourceKey: prepared?.meshResourceKey ?? null,
        vertexBufferResourceKeys: prepared?.vertexBufferResourceKeys ?? [],
        indexBufferResourceKey: prepared?.indexBufferResourceKey ?? null,
        matrixResourceKey,
        pipelineKey,
        ready:
          prepared !== undefined &&
          prepared.indexBufferResourceKey !== null &&
          matrixResourceKey !== null &&
          pipelineKey !== null,
      });
    }
  }

  if (pipelineDescriptors.length > 0) {
    diagnostics.push({
      code: "shadowCasterFrameResource.pipelineCreationDeferred",
      severity: "warning",
      message:
        "Shadow caster frame resources have pipeline descriptor metadata, but live pipeline creation is deferred.",
    });
  }

  if (records.length > 0) {
    diagnostics.push({
      code: "shadowCasterFrameResource.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow caster frame resources are planned, but shadow pass submission is deferred.",
    });
  }

  const missing = diagnostics.some(
    (diagnostic) =>
      diagnostic.code ===
        "shadowCasterFrameResource.missingPipelineDescriptor" ||
      diagnostic.code === "shadowCasterFrameResource.missingMatrixBuffer" ||
      diagnostic.code === "shadowCasterFrameResource.missingPreparedMesh",
  );

  return report({
    status: missing
      ? "missing"
      : options.casterDrawList.status === "deferred" ||
          options.pipelineDescriptor.status === "deferred"
        ? "deferred"
        : "ready",
    records,
    diagnostics,
    pipelineDescriptors: pipelineDescriptors.length,
    matrixBuffers: matrixResourceKey === null ? 0 : 1,
  });
}

export function shadowCasterFrameResourceReadinessReportToJsonValue(
  value: ShadowCasterFrameResourceReadinessReport,
): ShadowCasterFrameResourceReadinessReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    counts: { ...value.counts },
    sections: { ...value.sections },
    records: value.records.map((record) => ({
      ...record,
      vertexBufferResourceKeys: [...record.vertexBufferResourceKeys],
    })),
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterFrameResourceReadinessReportToJson(
  value: ShadowCasterFrameResourceReadinessReport,
): string {
  return JSON.stringify(
    shadowCasterFrameResourceReadinessReportToJsonValue(value),
  );
}

function report(input: {
  readonly status: ShadowCasterFrameResourceReadinessStatus;
  readonly records: readonly ShadowCasterFrameResourceRecord[];
  readonly diagnostics: readonly ShadowCasterFrameResourceReadinessDiagnostic[];
  readonly pipelineDescriptors: number;
  readonly matrixBuffers: number;
}): ShadowCasterFrameResourceReadinessReport {
  const readyDraws = input.records.filter((record) => record.ready).length;
  const missingMeshBuffers = input.records.filter(
    (record) => record.meshResourceKey === null,
  ).length;

  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    counts: {
      casterDraws: input.records.length,
      readyDraws,
      missingMeshBuffers,
      pipelineDescriptors: input.pipelineDescriptors,
      matrixBuffers: input.matrixBuffers,
    },
    sections: {
      casterDrawLists:
        input.records.length > 0 || input.status === "not-required",
      preparedMeshBuffers: missingMeshBuffers === 0,
      matrixBufferResource: input.matrixBuffers > 0,
      pipelineDescriptor: input.pipelineDescriptors > 0,
      pipelineCreation: false,
      passSubmission: false,
      shaderSampling: false,
    },
    records: input.records,
    diagnostics: input.diagnostics,
  };
}

function createPipelineDescriptorByLayout(
  descriptors: readonly ShadowCasterPipelineDescriptorMetadata[],
): ReadonlyMap<string, ShadowCasterPipelineDescriptorMetadata> {
  return new Map(
    descriptors.map((descriptor) => [
      descriptor.vertex.meshLayoutKey ?? DEFAULT_MESH_LAYOUT_DESCRIPTOR_KEY,
      descriptor,
    ]),
  );
}

function resolvePipelineDescriptorForLayout(
  meshLayoutKey: string,
  descriptors: ReadonlyMap<string, ShadowCasterPipelineDescriptorMetadata>,
): ShadowCasterPipelineDescriptorMetadata | null {
  return (
    descriptors.get(meshLayoutKey) ??
    descriptors.get(DEFAULT_MESH_LAYOUT_DESCRIPTOR_KEY) ??
    null
  );
}
