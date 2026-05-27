import type { IblSamplerResourceReport } from "./ibl-sampler-resource.js";
import type { IblTexturePreparationReport } from "./ibl-texture-preparation.js";
import type { DiffuseIblTextureResourceReport } from "./ibl-texture-resource.js";

export type DiffuseIblResourceSummaryStatus =
  | "deferred"
  | "missing"
  | "unsupported"
  | "not-required";

export interface DiffuseIblResourceSummaryDiagnostic {
  readonly code:
    | "diffuseIblResourceSummary.textureResourceMissing"
    | "diffuseIblResourceSummary.samplerResourceMissing"
    | "diffuseIblResourceSummary.resourceUnsupported"
    | "diffuseIblResourceSummary.specularPrefilteringDeferred"
    | "diffuseIblResourceSummary.bindGroupLayoutDeferred"
    | "diffuseIblResourceSummary.shaderSamplingDeferred";
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface CreateDiffuseIblResourceSummaryOptions {
  readonly textures: IblTexturePreparationReport;
  readonly diffuseTextureResource: DiffuseIblTextureResourceReport;
  readonly samplers: IblSamplerResourceReport;
}

export interface DiffuseIblResourceSummaryReport {
  readonly ready: false;
  readonly status: DiffuseIblResourceSummaryStatus;
  readonly counts: {
    readonly textureSlots: number;
    readonly diffuseTextureResources: number;
    readonly samplerResources: number;
    readonly deferredSpecularSlots: number;
  };
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly diffuseTextureResource: boolean;
    readonly samplerResources: boolean;
    readonly specularPrefiltering: false;
    readonly bindGroupLayout: false;
    readonly shaderSampling: false;
  };
  readonly resourceKeys: {
    readonly diffuseTextures: readonly string[];
    readonly samplers: readonly string[];
    readonly deferredSpecularTextures: readonly string[];
  };
  readonly diagnostics: readonly DiffuseIblResourceSummaryDiagnostic[];
}

export type DiffuseIblResourceSummaryReportJsonValue =
  DiffuseIblResourceSummaryReport;

export function createDiffuseIblResourceSummaryReport(
  options: CreateDiffuseIblResourceSummaryOptions,
): DiffuseIblResourceSummaryReport {
  const status = determineStatus(options);
  const diagnostics = createDiagnostics(status, options);
  const diffuseTextures = options.diffuseTextureResource.resources.flatMap(
    (resource) =>
      resource.resource === null ? [] : [resource.resource.resourceKey],
  );
  const samplers = options.samplers.resources.flatMap((resource) =>
    resource.resource === null ? [] : [resource.resource.resourceKey],
  );
  const deferredSpecularTextures = options.textures.slots.flatMap((slot) =>
    slot.kind === "specular" && slot.textureKey !== null
      ? [slot.textureKey]
      : [],
  );

  return {
    ready: false,
    status,
    counts: {
      textureSlots: options.textures.slotCount,
      diffuseTextureResources: diffuseTextures.length,
      samplerResources: samplers.length,
      deferredSpecularSlots: deferredSpecularTextures.length,
    },
    sections: {
      texturePreparation:
        options.textures.status === "ready" ||
        options.textures.status === "deferred",
      diffuseTextureResource:
        options.diffuseTextureResource.status === "available",
      samplerResources: options.samplers.status === "available",
      specularPrefiltering: false,
      bindGroupLayout: false,
      shaderSampling: false,
    },
    resourceKeys: {
      diffuseTextures,
      samplers,
      deferredSpecularTextures,
    },
    diagnostics,
  };
}

export function diffuseIblResourceSummaryReportToJsonValue(
  report: DiffuseIblResourceSummaryReport,
): DiffuseIblResourceSummaryReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    counts: { ...report.counts },
    sections: { ...report.sections },
    resourceKeys: {
      diffuseTextures: [...report.resourceKeys.diffuseTextures],
      samplers: [...report.resourceKeys.samplers],
      deferredSpecularTextures: [
        ...report.resourceKeys.deferredSpecularTextures,
      ],
    },
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function diffuseIblResourceSummaryReportToJson(
  report: DiffuseIblResourceSummaryReport,
): string {
  return JSON.stringify(diffuseIblResourceSummaryReportToJsonValue(report));
}

function determineStatus(
  options: CreateDiffuseIblResourceSummaryOptions,
): DiffuseIblResourceSummaryStatus {
  if (
    options.textures.status === "not-required" ||
    options.diffuseTextureResource.status === "not-required" ||
    options.samplers.status === "not-required"
  ) {
    return "not-required";
  }

  if (
    options.textures.status === "unsupported" ||
    options.diffuseTextureResource.status === "unsupported" ||
    options.samplers.status === "unsupported"
  ) {
    return "unsupported";
  }

  if (
    options.diffuseTextureResource.status !== "available" ||
    options.samplers.status !== "available"
  ) {
    return "missing";
  }

  return "deferred";
}

function createDiagnostics(
  status: DiffuseIblResourceSummaryStatus,
  options: CreateDiffuseIblResourceSummaryOptions,
): DiffuseIblResourceSummaryDiagnostic[] {
  if (status === "not-required") {
    return [];
  }

  if (status === "unsupported") {
    return [
      {
        code: "diffuseIblResourceSummary.resourceUnsupported",
        severity: "warning",
        message:
          "Diffuse IBL resource summary cannot proceed while an IBL resource input is unsupported.",
      },
    ];
  }

  const diagnostics: DiffuseIblResourceSummaryDiagnostic[] = [];

  if (options.diffuseTextureResource.status !== "available") {
    diagnostics.push({
      code: "diffuseIblResourceSummary.textureResourceMissing",
      severity: "warning",
      message:
        "Diffuse IBL resource summary requires an available diffuse texture resource.",
    });
  }

  if (options.samplers.status !== "available") {
    diagnostics.push({
      code: "diffuseIblResourceSummary.samplerResourceMissing",
      severity: "warning",
      message:
        "Diffuse IBL resource summary requires available IBL sampler resources.",
    });
  }

  if (status === "deferred") {
    diagnostics.push(
      {
        code: "diffuseIblResourceSummary.specularPrefilteringDeferred",
        severity: "warning",
        message:
          "Diffuse IBL resources are available, but specular prefiltering remains deferred.",
      },
      {
        code: "diffuseIblResourceSummary.bindGroupLayoutDeferred",
        severity: "warning",
        message:
          "Diffuse IBL resources are available, but StandardMaterial bind-group layout changes remain deferred.",
      },
      {
        code: "diffuseIblResourceSummary.shaderSamplingDeferred",
        severity: "warning",
        message:
          "Diffuse IBL resources are available, but StandardMaterial shader sampling remains deferred.",
      },
    );
  }

  return diagnostics;
}
