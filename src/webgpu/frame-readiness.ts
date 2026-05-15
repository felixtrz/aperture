import type {
  PackedSnapshotViewUniforms,
  RenderWorldDrawPackagePlan,
} from "../rendering/index.js";
import type { CreateMeshGpuBuffersResult } from "./mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import type { CreateUnlitMaterialGpuBufferResult } from "./unlit-material-buffer-resource.js";

export type FrameAssemblyReadinessSeverity = "info" | "warning" | "error";

export interface FrameAssemblyReadinessDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: FrameAssemblyReadinessSeverity;
}

export interface FrameAssemblyReadinessCounts {
  readonly drawPackages: number;
  readonly viewUniforms: number;
  readonly meshResourcesReady: number;
  readonly materialResourcesReady: number;
  readonly pipelineHits: number;
  readonly pipelineMisses: number;
  readonly blocked: number;
  readonly warnings: number;
  readonly errors: number;
}

export interface FrameAssemblyReadinessInput {
  readonly drawPackages: RenderWorldDrawPackagePlan;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly meshResources: readonly CreateMeshGpuBuffersResult[];
  readonly materialResources: readonly CreateUnlitMaterialGpuBufferResult[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
}

export interface FrameAssemblyReadinessReport {
  readonly ready: boolean;
  readonly counts: FrameAssemblyReadinessCounts;
  readonly diagnostics: readonly FrameAssemblyReadinessDiagnostic[];
}

export function createFrameAssemblyReadinessReport(
  input: FrameAssemblyReadinessInput,
): FrameAssemblyReadinessReport {
  const diagnostics: FrameAssemblyReadinessDiagnostic[] = [];

  diagnostics.push(
    ...input.drawPackages.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
    })),
  );
  diagnostics.push(
    ...input.viewUniforms.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity:
        diagnostic.code === "viewUniform.emptySnapshot"
          ? ("info" as const)
          : ("warning" as const),
    })),
  );

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

  for (const result of input.pipelines) {
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: result.ok ? ("warning" as const) : ("error" as const),
      })),
    );
  }

  if (input.drawPackages.packages.length === 0) {
    diagnostics.push({
      code: "frameReadiness.emptyFrame",
      message: "Frame assembly has no draw packages ready for submission.",
      severity: "info",
    });
  }

  const warnings = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const blocked =
    input.meshResources.filter((result) => !result.valid).length +
    input.materialResources.filter((result) => !result.valid).length +
    input.pipelines.filter((result) => !result.ok).length;

  return {
    ready:
      input.drawPackages.packages.length > 0 && blocked === 0 && errors === 0,
    counts: {
      drawPackages: input.drawPackages.packages.length,
      viewUniforms: input.viewUniforms.views.length,
      meshResourcesReady: input.meshResources.filter((result) => result.valid)
        .length,
      materialResourcesReady: input.materialResources.filter(
        (result) => result.valid,
      ).length,
      pipelineHits: input.pipelines.filter(
        (result) => result.ok && result.status === "hit",
      ).length,
      pipelineMisses: input.pipelines.filter(
        (result) => result.ok && result.status === "miss",
      ).length,
      blocked,
      warnings,
      errors,
    },
    diagnostics,
  };
}
