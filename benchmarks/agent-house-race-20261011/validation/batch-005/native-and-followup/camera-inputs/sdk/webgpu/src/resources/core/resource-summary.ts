import type { CreateMeshGpuBuffersResult } from "../meshes/mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "../../gpu/pipeline-cache-integration.js";
import type { EnvironmentResourcePlan } from "../../lighting/environment-resource-planning.js";
import type {
  CreateLightGpuBuffersResult,
  LightBufferDescriptor,
} from "../../lighting/light-packing.js";
import type { CreateLightBindGroupResourceResult } from "../../lighting/light-bind-group.js";
import type { CreateShaderModuleResourceResult } from "../../gpu/shader-resource.js";
import type {
  CreateSamplerGpuResourceResult,
  CreateTextureGpuResourceResult,
} from "../textures/texture-resources.js";
import type { CreateMatcapMaterialGpuBufferResult } from "../../materials/matcap/matcap-material-buffer-resource.js";
import type { CreateStandardMaterialGpuBufferResult } from "../../materials/standard/standard-material-buffer-resource.js";
import type { CreateUnlitMaterialGpuBufferResult } from "../../materials/unlit/unlit-material-buffer-resource.js";
import type { CreateViewUniformGpuBufferResult } from "../views/view-uniform-buffer-resource.js";
import type { RenderResourceInspectionReport } from "./resource-lifecycle.js";

export type RenderResourceSummarySeverity = "warning" | "error";

export interface RenderResourceSummaryDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderResourceSummarySeverity;
  readonly resourceKey?: string;
}

export interface RenderResourceSummaryCounts {
  readonly meshResources: number;
  readonly meshVertexBuffers: number;
  readonly meshIndexBuffers: number;
  readonly materialBuffers: number;
  readonly textures: number;
  readonly samplers: number;
  readonly lightBuffers: number;
  readonly lightGpuBuffers: number;
  readonly lightBindGroups: number;
  readonly environmentMaps: number;
  readonly viewUniformBuffers: number;
  readonly shaderModules: number;
  readonly pipelineHits: number;
  readonly pipelineMisses: number;
  readonly inspectedResources: number;
  readonly staleResources: number;
  readonly missingResources: number;
  readonly pendingDestroyResources: number;
  readonly warnings: number;
  readonly errors: number;
}

export type CreateMaterialGpuBufferResult =
  | CreateUnlitMaterialGpuBufferResult
  | CreateMatcapMaterialGpuBufferResult
  | CreateStandardMaterialGpuBufferResult;

export interface RenderResourceSummaryInput {
  readonly meshResources: readonly CreateMeshGpuBuffersResult[];
  readonly materialResources: readonly CreateMaterialGpuBufferResult[];
  readonly textureResources?: readonly CreateTextureGpuResourceResult[];
  readonly samplerResources?: readonly CreateSamplerGpuResourceResult[];
  readonly lightBuffers?: readonly LightBufferDescriptor[];
  readonly lightGpuBufferResources?: readonly CreateLightGpuBuffersResult[];
  readonly lightBindGroupResources?: readonly CreateLightBindGroupResourceResult[];
  readonly environmentResources?: readonly EnvironmentResourcePlan[];
  readonly viewUniformResources: readonly CreateViewUniformGpuBufferResult[];
  readonly shaderResources: readonly CreateShaderModuleResourceResult[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly resourceInspection?: RenderResourceInspectionReport;
}

export interface RenderResourceSummaryReport {
  readonly counts: RenderResourceSummaryCounts;
  readonly diagnostics: readonly RenderResourceSummaryDiagnostic[];
}

export interface RenderResourceSummaryDiagnosticJsonValue {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderResourceSummarySeverity;
  readonly resourceKey?: string;
}

export interface RenderResourceSummaryReportJsonValue {
  readonly counts: RenderResourceSummaryCounts;
  readonly diagnostics: readonly RenderResourceSummaryDiagnosticJsonValue[];
}

export function createRenderResourceSummaryReport(
  input: RenderResourceSummaryInput,
): RenderResourceSummaryReport {
  const diagnostics: RenderResourceSummaryDiagnostic[] = [];

  for (const result of input.meshResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.materialResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.textureResources ?? []) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.samplerResources ?? []) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.lightGpuBufferResources ?? []) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.lightBindGroupResources ?? []) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.viewUniformResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, "warning"),
      ),
    );
  }

  for (const result of input.shaderResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(
          diagnostic,
          !result.valid || diagnostic.severity === "error"
            ? "error"
            : "warning",
        ),
      ),
    );
  }

  for (const result of input.pipelines) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) =>
        resourceDiagnostic(diagnostic, result.ok ? "warning" : "error"),
      ),
    );
  }

  if (input.resourceInspection !== undefined) {
    diagnostics.push(
      ...input.resourceInspection.diagnostics.map((diagnostic) =>
        resourceDiagnostic(
          diagnostic,
          diagnostic.code === "renderResourceInspection.missingResource"
            ? "error"
            : "warning",
        ),
      ),
    );
  }

  return {
    counts: {
      meshResources: input.meshResources.filter((result) => result.valid)
        .length,
      meshVertexBuffers: input.meshResources.reduce(
        (sum, result) => sum + (result.resource?.vertexBuffers.length ?? 0),
        0,
      ),
      meshIndexBuffers: input.meshResources.filter(
        (result) => result.resource?.indexBuffer !== undefined,
      ).length,
      materialBuffers: input.materialResources.filter((result) => result.valid)
        .length,
      textures: (input.textureResources ?? []).filter((result) => result.valid)
        .length,
      samplers: (input.samplerResources ?? []).filter((result) => result.valid)
        .length,
      lightBuffers: input.lightBuffers?.length ?? 0,
      lightGpuBuffers: (input.lightGpuBufferResources ?? []).filter(
        (result) => result.valid,
      ).length,
      lightBindGroups: (input.lightBindGroupResources ?? []).filter(
        (result) => result.valid,
      ).length,
      environmentMaps: (input.environmentResources ?? []).reduce(
        (sum, plan) => sum + plan.requirements.length,
        0,
      ),
      viewUniformBuffers: input.viewUniformResources.filter(
        (result) => result.valid,
      ).length,
      shaderModules: input.shaderResources.filter((result) => result.valid)
        .length,
      pipelineHits: input.pipelines.filter(
        (result) => result.ok && result.status === "hit",
      ).length,
      pipelineMisses: input.pipelines.filter(
        (result) => result.ok && result.status === "miss",
      ).length,
      inspectedResources: input.resourceInspection?.counts.total ?? 0,
      staleResources: input.resourceInspection?.counts.stale ?? 0,
      missingResources: input.resourceInspection?.counts.missing ?? 0,
      pendingDestroyResources:
        input.resourceInspection?.counts.pendingDestroy ?? 0,
      warnings: diagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
      errors: diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ).length,
    },
    diagnostics,
  };
}

export function renderResourceSummaryReportToJsonValue(
  report: RenderResourceSummaryReport,
): RenderResourceSummaryReportJsonValue {
  return {
    counts: { ...report.counts },
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
      ...(diagnostic.resourceKey === undefined
        ? {}
        : { resourceKey: diagnostic.resourceKey }),
    })),
  };
}

export function renderResourceSummaryReportToJson(
  report: RenderResourceSummaryReport,
): string {
  return JSON.stringify(renderResourceSummaryReportToJsonValue(report));
}

export function mergeRenderResourceSummaryReports(
  reports: readonly RenderResourceSummaryReport[],
): RenderResourceSummaryReport {
  const diagnostics = reports.flatMap((report) => [...report.diagnostics]);

  return {
    counts: {
      meshResources: sum(reports, (report) => report.counts.meshResources),
      meshVertexBuffers: sum(
        reports,
        (report) => report.counts.meshVertexBuffers,
      ),
      meshIndexBuffers: sum(
        reports,
        (report) => report.counts.meshIndexBuffers,
      ),
      materialBuffers: sum(reports, (report) => report.counts.materialBuffers),
      textures: sum(reports, (report) => report.counts.textures),
      samplers: sum(reports, (report) => report.counts.samplers),
      lightBuffers: sum(reports, (report) => report.counts.lightBuffers),
      lightGpuBuffers: sum(reports, (report) => report.counts.lightGpuBuffers),
      lightBindGroups: sum(reports, (report) => report.counts.lightBindGroups),
      environmentMaps: sum(reports, (report) => report.counts.environmentMaps),
      viewUniformBuffers: sum(
        reports,
        (report) => report.counts.viewUniformBuffers,
      ),
      shaderModules: sum(reports, (report) => report.counts.shaderModules),
      pipelineHits: sum(reports, (report) => report.counts.pipelineHits),
      pipelineMisses: sum(reports, (report) => report.counts.pipelineMisses),
      inspectedResources: sum(
        reports,
        (report) => report.counts.inspectedResources,
      ),
      staleResources: sum(reports, (report) => report.counts.staleResources),
      missingResources: sum(
        reports,
        (report) => report.counts.missingResources,
      ),
      pendingDestroyResources: sum(
        reports,
        (report) => report.counts.pendingDestroyResources,
      ),
      warnings: diagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
      errors: diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ).length,
    },
    diagnostics,
  };
}

function sum(
  reports: readonly RenderResourceSummaryReport[],
  read: (report: RenderResourceSummaryReport) => number,
): number {
  return reports.reduce((total, report) => total + read(report), 0);
}

function resourceDiagnostic(
  diagnostic: {
    readonly code: string;
    readonly message: string;
    readonly resourceKey?: string;
  },
  severity: RenderResourceSummarySeverity,
): RenderResourceSummaryDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity,
    ...(diagnostic.resourceKey === undefined
      ? {}
      : { resourceKey: diagnostic.resourceKey }),
  };
}
