import type { BuiltInShaderBindingResource } from "./unlit-shader.js";
import { DEFAULT_LIGHT_BIND_GROUP } from "./light-bind-group-layout.js";
import type { WebGpuBindGroupLayoutDescriptor } from "./bind-group-layout-cache.js";
import type { RenderResourceSummaryDiagnostic } from "./resource-summary.js";

export type LightShaderBindingId = "lightFloats" | "lightMetadata";

export interface LightShaderBindingMetadata {
  readonly id: LightShaderBindingId;
  readonly label: string;
  readonly group: number;
  readonly binding: number;
  readonly resource: BuiltInShaderBindingResource;
}

export interface LightShaderBindingMetadataContract {
  readonly group: number;
  readonly bindings: readonly LightShaderBindingMetadata[];
}

export const LIGHT_SHADER_BINDING_METADATA: LightShaderBindingMetadataContract =
  {
    group: DEFAULT_LIGHT_BIND_GROUP,
    bindings: [
      {
        id: "lightFloats",
        label: "Packed light float storage",
        group: DEFAULT_LIGHT_BIND_GROUP,
        binding: 0,
        resource: "read-only-storage-buffer",
      },
      {
        id: "lightMetadata",
        label: "Packed light metadata storage",
        group: DEFAULT_LIGHT_BIND_GROUP,
        binding: 1,
        resource: "read-only-storage-buffer",
      },
    ],
  };

export type LightShaderBindingValidationDiagnosticCode =
  | "lightShaderBinding.missingBinding"
  | "lightShaderBinding.resourceMismatch";

export interface LightShaderBindingValidationDiagnostic {
  readonly code: LightShaderBindingValidationDiagnosticCode;
  readonly message: string;
  readonly bindingId?: LightShaderBindingId;
  readonly binding?: number;
}

export interface LightShaderBindingValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly LightShaderBindingValidationDiagnostic[];
}

export type LightShaderResourceReadinessDiagnosticCode =
  | "lightShaderReadiness.missingLightGpuBuffers"
  | "lightShaderReadiness.missingLayout"
  | "lightShaderReadiness.missingBindGroup"
  | "lightShaderReadiness.metadataInvalid";

export interface LightShaderResourceReadinessDiagnostic {
  readonly code: LightShaderResourceReadinessDiagnosticCode;
  readonly message: string;
  readonly resourceKey?: string;
  readonly layoutKey?: string;
}

export interface LightShaderResourceReadinessInput {
  readonly lightGpuBufferResourceKey: string | null;
  readonly layoutKey: string | null;
  readonly bindGroupResourceKey: string | null;
  readonly metadata: LightShaderBindingValidationReport;
}

export interface LightShaderResourceReadinessReport {
  readonly ready: boolean;
  readonly sections: {
    readonly lightGpuBuffers: boolean;
    readonly layout: boolean;
    readonly bindGroup: boolean;
    readonly metadata: boolean;
  };
  readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}

export interface LightShaderResourceReadinessReportJsonValue {
  readonly ready: boolean;
  readonly sections: LightShaderResourceReadinessReport["sections"];
  readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}

export function validateLightBindGroupLayoutMetadata(
  layout: WebGpuBindGroupLayoutDescriptor,
  metadata: LightShaderBindingMetadataContract = LIGHT_SHADER_BINDING_METADATA,
): LightShaderBindingValidationReport {
  const diagnostics: LightShaderBindingValidationDiagnostic[] = [];

  for (const binding of metadata.bindings) {
    const entry = layout.entries.find(
      (candidate) => candidate.binding === binding.binding,
    );

    if (entry === undefined) {
      diagnostics.push({
        code: "lightShaderBinding.missingBinding",
        bindingId: binding.id,
        binding: binding.binding,
        message: `Light bind group layout is missing '${binding.id}' at binding ${binding.binding}.`,
      });
      continue;
    }

    const resource = layoutEntryResource(entry);

    if (resource !== binding.resource) {
      diagnostics.push({
        code: "lightShaderBinding.resourceMismatch",
        bindingId: binding.id,
        binding: binding.binding,
        message: `Light bind group layout binding ${binding.binding} uses '${resource}' but metadata requires '${binding.resource}'.`,
      });
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function createLightShaderResourceReadinessReport(
  input: LightShaderResourceReadinessInput,
): LightShaderResourceReadinessReport {
  const diagnostics: LightShaderResourceReadinessDiagnostic[] = [];

  if (input.lightGpuBufferResourceKey === null) {
    diagnostics.push({
      code: "lightShaderReadiness.missingLightGpuBuffers",
      message: "Light shader readiness requires light GPU buffers.",
    });
  }

  if (input.layoutKey === null) {
    diagnostics.push({
      code: "lightShaderReadiness.missingLayout",
      message: "Light shader readiness requires a light bind group layout.",
    });
  }

  if (input.bindGroupResourceKey === null) {
    diagnostics.push({
      code: "lightShaderReadiness.missingBindGroup",
      message: "Light shader readiness requires a light bind group resource.",
    });
  }

  if (!input.metadata.valid) {
    diagnostics.push({
      code: "lightShaderReadiness.metadataInvalid",
      message: "Light shader binding metadata validation failed.",
    });
  }

  return {
    ready: diagnostics.length === 0,
    sections: {
      lightGpuBuffers: input.lightGpuBufferResourceKey !== null,
      layout: input.layoutKey !== null,
      bindGroup: input.bindGroupResourceKey !== null,
      metadata: input.metadata.valid,
    },
    diagnostics,
  };
}

export function lightShaderResourceReadinessReportToJsonValue(
  report: LightShaderResourceReadinessReport,
): LightShaderResourceReadinessReportJsonValue {
  return {
    ready: report.ready,
    sections: { ...report.sections },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function lightShaderResourceReadinessReportToJson(
  report: LightShaderResourceReadinessReport,
): string {
  return JSON.stringify(lightShaderResourceReadinessReportToJsonValue(report));
}

export function lightShaderReadinessToResourceSummaryDiagnostics(
  report: LightShaderResourceReadinessReport,
): readonly RenderResourceSummaryDiagnostic[] {
  return report.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: "warning",
    ...(diagnostic.resourceKey === undefined
      ? {}
      : { resourceKey: diagnostic.resourceKey }),
  }));
}

function layoutEntryResource(
  entry: WebGpuBindGroupLayoutDescriptor["entries"][number],
): BuiltInShaderBindingResource | "unsupported" {
  const record = entry as Readonly<Record<string, unknown>>;
  const buffer = record.buffer as Readonly<Record<string, unknown>> | undefined;

  if (buffer?.type === "read-only-storage") {
    return "read-only-storage-buffer";
  }

  if (buffer?.type === "uniform") {
    return "uniform-buffer";
  }

  if ("texture" in record) {
    return "texture";
  }

  if ("sampler" in record) {
    return "sampler";
  }

  return "unsupported";
}
