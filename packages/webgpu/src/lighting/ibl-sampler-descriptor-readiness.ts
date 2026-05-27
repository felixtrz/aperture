import type {
  IblTexturePreparationReport,
  IblTexturePreparationSlot,
  IblTexturePreparationStatus,
} from "./ibl-texture-preparation.js";

export type IblSamplerDescriptorStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "unsupported"
  | "not-required";

export type IblSamplerAllocationMode = "ready" | "deferred" | "unsupported";

export type IblSamplerDescriptorDiagnosticCode =
  | "iblSamplerDescriptor.missingTexturePreparation"
  | "iblSamplerDescriptor.unsupportedTextureSlots"
  | "iblSamplerDescriptor.allocationDeferred"
  | "iblSamplerDescriptor.allocationUnsupported";

export interface IblSamplerDescriptorSlot {
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly kind: "diffuse" | "specular";
  readonly sourceResourceKey: string;
  readonly samplerKey: string;
  readonly addressModeU: "clamp-to-edge";
  readonly addressModeV: "clamp-to-edge";
  readonly addressModeW: "clamp-to-edge";
  readonly magFilter: "linear";
  readonly minFilter: "linear";
  readonly mipmapFilter: "linear";
  readonly maxAnisotropy: 1;
  readonly allocation: IblSamplerAllocationMode;
}

export interface IblSamplerDescriptorDiagnostic {
  readonly code: IblSamplerDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface IblSamplerDescriptorReadinessReport {
  readonly ready: boolean;
  readonly status: IblSamplerDescriptorStatus;
  readonly textureSlotCount: number;
  readonly samplerCount: number;
  readonly allocatedSamplerCount: number;
  readonly sections: {
    readonly texturePreparation: boolean;
    readonly samplerDescriptors: boolean;
    readonly gpuAllocation: boolean;
    readonly bindGroupLayout: false;
    readonly shaderSampling: false;
  };
  readonly samplers: readonly IblSamplerDescriptorSlot[];
  readonly diagnostics: readonly IblSamplerDescriptorDiagnostic[];
}

export type IblSamplerDescriptorReadinessReportJsonValue =
  IblSamplerDescriptorReadinessReport;

export interface IblSamplerDescriptorReadinessInput {
  readonly textures: IblTexturePreparationReport;
  readonly allocation?: IblSamplerAllocationMode;
}

export function createIblSamplerDescriptorReadinessReport(
  input: IblSamplerDescriptorReadinessInput,
): IblSamplerDescriptorReadinessReport {
  const allocation = input.allocation ?? "deferred";

  if (input.textures.status === "not-required") {
    return {
      ready: true,
      status: "not-required",
      textureSlotCount: input.textures.slotCount,
      samplerCount: 0,
      allocatedSamplerCount: 0,
      sections: {
        texturePreparation: true,
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: false,
        shaderSampling: false,
      },
      samplers: [],
      diagnostics: [],
    };
  }

  const samplers = input.textures.slots
    .filter(isSamplerReadyTextureSlot)
    .map((slot) => createSamplerDescriptor(slot, allocation));
  const status = determineStatus(input.textures.status, allocation);
  const diagnostics = createDiagnostics(input.textures.status, allocation);

  return {
    ready: status === "ready",
    status,
    textureSlotCount: input.textures.slotCount,
    samplerCount: samplers.length,
    allocatedSamplerCount: status === "ready" ? samplers.length : 0,
    sections: {
      texturePreparation:
        input.textures.status === "ready" ||
        input.textures.status === "deferred",
      samplerDescriptors: status === "ready" || status === "deferred",
      gpuAllocation: status === "ready",
      bindGroupLayout: false,
      shaderSampling: false,
    },
    samplers,
    diagnostics,
  };
}

export function iblSamplerDescriptorReadinessReportToJsonValue(
  report: IblSamplerDescriptorReadinessReport,
): IblSamplerDescriptorReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    textureSlotCount: report.textureSlotCount,
    samplerCount: report.samplerCount,
    allocatedSamplerCount: report.allocatedSamplerCount,
    sections: { ...report.sections },
    samplers: report.samplers.map((sampler) => ({
      ...sampler,
      environmentIds: [...sampler.environmentIds],
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function iblSamplerDescriptorReadinessReportToJson(
  report: IblSamplerDescriptorReadinessReport,
): string {
  return JSON.stringify(iblSamplerDescriptorReadinessReportToJsonValue(report));
}

function isSamplerReadyTextureSlot(
  slot: IblTexturePreparationSlot,
): slot is IblTexturePreparationSlot & {
  readonly sourceResourceKey: string;
  readonly samplerKey: string;
} {
  return slot.sourceResourceKey !== null && slot.samplerKey !== null;
}

function createSamplerDescriptor(
  slot: IblTexturePreparationSlot & {
    readonly sourceResourceKey: string;
    readonly samplerKey: string;
  },
  allocation: IblSamplerAllocationMode,
): IblSamplerDescriptorSlot {
  return {
    environmentMapResourceKey: slot.environmentMapResourceKey,
    environmentIds: [...slot.environmentIds],
    kind: slot.kind,
    sourceResourceKey: slot.sourceResourceKey,
    samplerKey: slot.samplerKey,
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    maxAnisotropy: 1,
    allocation,
  };
}

function determineStatus(
  textureStatus: IblTexturePreparationStatus,
  allocation: IblSamplerAllocationMode,
): IblSamplerDescriptorStatus {
  if (textureStatus === "missing") {
    return "missing";
  }

  if (textureStatus === "unsupported" || allocation === "unsupported") {
    return "unsupported";
  }

  if (allocation === "deferred") {
    return "deferred";
  }

  return "ready";
}

function createDiagnostics(
  textureStatus: IblTexturePreparationStatus,
  allocation: IblSamplerAllocationMode,
): IblSamplerDescriptorDiagnostic[] {
  if (textureStatus === "missing") {
    return [
      {
        code: "iblSamplerDescriptor.missingTexturePreparation",
        severity: "warning",
        message:
          "IBL sampler descriptor readiness requires valid IBL texture preparation descriptors.",
      },
    ];
  }

  if (textureStatus === "unsupported") {
    return [
      {
        code: "iblSamplerDescriptor.unsupportedTextureSlots",
        severity: "warning",
        message:
          "IBL sampler descriptor readiness cannot proceed while texture slots are unsupported.",
      },
    ];
  }

  if (allocation === "unsupported") {
    return [
      {
        code: "iblSamplerDescriptor.allocationUnsupported",
        severity: "warning",
        message:
          "IBL sampler allocation is unsupported for the planned sampler descriptors.",
      },
    ];
  }

  if (allocation === "deferred") {
    return [
      {
        code: "iblSamplerDescriptor.allocationDeferred",
        severity: "warning",
        message:
          "IBL sampler descriptors are planned, but GPU sampler allocation is deferred.",
      },
    ];
  }

  return [];
}
