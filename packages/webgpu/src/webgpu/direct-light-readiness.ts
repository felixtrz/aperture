import type { LightKind, RenderSnapshot } from "@aperture-engine/render";
import {
  createLightShaderResourceReadinessReport,
  lightShaderResourceReadinessReportToJsonValue,
  type LightShaderBindingValidationReport,
  type LightShaderResourceReadinessDiagnostic,
  type LightShaderResourceReadinessReport,
} from "./light-shader-metadata.js";
import type { StandardFrameGpuResources } from "./standard-frame-resources.js";

export interface DirectLightKindCounts {
  readonly total: number;
  readonly direct: number;
  readonly ambient: number;
  readonly directional: number;
  readonly point: number;
  readonly spot: number;
  readonly environment: number;
}

export interface DirectLightReadinessResourceState {
  readonly lightGpuBufferResourceKey: string | null;
  readonly lightBindGroupLayoutKey: string | null;
  readonly lightBindGroupResourceKey: string | null;
}

export interface DirectLightReadinessInput {
  readonly snapshot: Pick<RenderSnapshot, "lights">;
  readonly resources?: DirectLightReadinessResourceState | null;
  readonly metadata?: LightShaderBindingValidationReport;
}

export interface DirectLightShaderMetadataReadiness {
  readonly valid: boolean;
  readonly diagnostics: LightShaderBindingValidationReport["diagnostics"];
}

export interface DirectLightReadinessReport {
  readonly ready: boolean;
  readonly lightCounts: DirectLightKindCounts;
  readonly sections: {
    readonly lightGpuBuffers: boolean;
    readonly lightBindGroupLayout: boolean;
    readonly lightBindGroup: boolean;
    readonly shaderMetadata: boolean;
  };
  readonly resources: {
    readonly lightGpuBufferResourceKey: string | null;
    readonly lightBindGroupLayoutKey: string | null;
    readonly lightBindGroupResourceKey: string | null;
  };
  readonly shaderMetadata: DirectLightShaderMetadataReadiness;
  readonly diagnostics: readonly LightShaderResourceReadinessDiagnostic[];
}

export type DirectLightReadinessReportJsonValue = DirectLightReadinessReport;

export function createDirectLightReadinessReport(
  input: DirectLightReadinessInput,
): DirectLightReadinessReport {
  const resources = input.resources ?? null;
  const metadata = input.metadata ?? { valid: true, diagnostics: [] };
  const shaderReadiness = createLightShaderResourceReadinessReport({
    lightGpuBufferResourceKey: resources?.lightGpuBufferResourceKey ?? null,
    layoutKey: resources?.lightBindGroupLayoutKey ?? null,
    bindGroupResourceKey: resources?.lightBindGroupResourceKey ?? null,
    metadata,
  });

  return directLightReadinessReportFromShaderReadiness({
    lightCounts: countDirectLightKinds(input.snapshot.lights),
    resources,
    metadata,
    shaderReadiness,
  });
}

export function directLightReadinessResourceStateFromStandardFrameResources(
  resources: Pick<
    StandardFrameGpuResources,
    "lightGpuBuffers" | "lightBindGroup"
  > | null,
): DirectLightReadinessResourceState {
  return {
    lightGpuBufferResourceKey:
      resources?.lightGpuBuffers.resource?.resourceKey ?? null,
    lightBindGroupLayoutKey: resources?.lightBindGroup.layoutKey ?? null,
    lightBindGroupResourceKey: resources?.lightBindGroup.resourceKey ?? null,
  };
}

export function directLightReadinessReportToJsonValue(
  report: DirectLightReadinessReport,
): DirectLightReadinessReportJsonValue {
  return {
    ready: report.ready,
    lightCounts: { ...report.lightCounts },
    sections: { ...report.sections },
    resources: { ...report.resources },
    shaderMetadata: {
      valid: report.shaderMetadata.valid,
      diagnostics: report.shaderMetadata.diagnostics.map((diagnostic) => ({
        ...diagnostic,
      })),
    },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function directLightReadinessReportToJson(
  report: DirectLightReadinessReport,
): string {
  return JSON.stringify(directLightReadinessReportToJsonValue(report));
}

function directLightReadinessReportFromShaderReadiness(input: {
  readonly lightCounts: DirectLightKindCounts;
  readonly resources: DirectLightReadinessResourceState | null;
  readonly metadata: LightShaderBindingValidationReport;
  readonly shaderReadiness: LightShaderResourceReadinessReport;
}): DirectLightReadinessReport {
  const shaderReadiness = lightShaderResourceReadinessReportToJsonValue(
    input.shaderReadiness,
  );

  return {
    ready: shaderReadiness.ready,
    lightCounts: input.lightCounts,
    sections: {
      lightGpuBuffers: shaderReadiness.sections.lightGpuBuffers,
      lightBindGroupLayout: shaderReadiness.sections.layout,
      lightBindGroup: shaderReadiness.sections.bindGroup,
      shaderMetadata: shaderReadiness.sections.metadata,
    },
    resources: {
      lightGpuBufferResourceKey:
        input.resources?.lightGpuBufferResourceKey ?? null,
      lightBindGroupLayoutKey: input.resources?.lightBindGroupLayoutKey ?? null,
      lightBindGroupResourceKey:
        input.resources?.lightBindGroupResourceKey ?? null,
    },
    shaderMetadata: {
      valid: input.metadata.valid,
      diagnostics: input.metadata.diagnostics.map((diagnostic) => ({
        ...diagnostic,
      })),
    },
    diagnostics: shaderReadiness.diagnostics,
  };
}

function countDirectLightKinds(
  lights: readonly { readonly kind: LightKind }[],
): DirectLightKindCounts {
  const counts: MutableDirectLightKindCounts = {
    total: lights.length,
    direct: 0,
    ambient: 0,
    directional: 0,
    point: 0,
    spot: 0,
    environment: 0,
  };

  for (const light of lights) {
    counts[light.kind] += 1;

    if (isDirectLightKind(light.kind)) {
      counts.direct += 1;
    }
  }

  return counts;
}

function isDirectLightKind(kind: LightKind): boolean {
  return kind === "directional" || kind === "point" || kind === "spot";
}

type MutableDirectLightKindCounts = {
  -readonly [Key in keyof DirectLightKindCounts]: DirectLightKindCounts[Key];
};
