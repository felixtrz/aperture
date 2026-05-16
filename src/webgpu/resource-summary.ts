import type { CreateMeshGpuBuffersResult } from "./mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import type { CreateShaderModuleResourceResult } from "./shader-resource.js";
import type {
  CreateSamplerGpuResourceResult,
  CreateTextureGpuResourceResult,
} from "./texture-resources.js";
import type { CreateUnlitMaterialGpuBufferResult } from "./unlit-material-buffer-resource.js";
import type { CreateViewUniformGpuBufferResult } from "./view-uniform-buffer-resource.js";

export type RenderResourceSummarySeverity = "warning" | "error";

export interface RenderResourceSummaryDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderResourceSummarySeverity;
}

export interface RenderResourceSummaryCounts {
  readonly meshResources: number;
  readonly meshVertexBuffers: number;
  readonly meshIndexBuffers: number;
  readonly materialBuffers: number;
  readonly textures: number;
  readonly samplers: number;
  readonly viewUniformBuffers: number;
  readonly shaderModules: number;
  readonly pipelineHits: number;
  readonly pipelineMisses: number;
  readonly warnings: number;
  readonly errors: number;
}

export interface RenderResourceSummaryInput {
  readonly meshResources: readonly CreateMeshGpuBuffersResult[];
  readonly materialResources: readonly CreateUnlitMaterialGpuBufferResult[];
  readonly textureResources?: readonly CreateTextureGpuResourceResult[];
  readonly samplerResources?: readonly CreateSamplerGpuResourceResult[];
  readonly viewUniformResources: readonly CreateViewUniformGpuBufferResult[];
  readonly shaderResources: readonly CreateShaderModuleResourceResult[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
}

export interface RenderResourceSummaryReport {
  readonly counts: RenderResourceSummaryCounts;
  readonly diagnostics: readonly RenderResourceSummaryDiagnostic[];
}

export function createRenderResourceSummaryReport(
  input: RenderResourceSummaryInput,
): RenderResourceSummaryReport {
  const diagnostics: RenderResourceSummaryDiagnostic[] = [];

  for (const result of input.meshResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: "warning" as const,
      })),
    );
  }

  for (const result of input.materialResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: "warning" as const,
      })),
    );
  }

  for (const result of input.textureResources ?? []) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: "warning" as const,
      })),
    );
  }

  for (const result of input.samplerResources ?? []) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: "warning" as const,
      })),
    );
  }

  for (const result of input.viewUniformResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: "warning" as const,
      })),
    );
  }

  for (const result of input.shaderResources) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity:
          !result.valid || diagnostic.severity === "error"
            ? ("error" as const)
            : ("warning" as const),
      })),
    );
  }

  for (const result of input.pipelines) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: result.ok ? ("warning" as const) : ("error" as const),
      })),
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
      viewUniformBuffers: sum(
        reports,
        (report) => report.counts.viewUniformBuffers,
      ),
      shaderModules: sum(reports, (report) => report.counts.shaderModules),
      pipelineHits: sum(reports, (report) => report.counts.pipelineHits),
      pipelineMisses: sum(reports, (report) => report.counts.pipelineMisses),
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
