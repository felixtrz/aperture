import type {
  IblResourceDescriptorDiagnostic,
  IblResourceDescriptorReport,
  IblResourceDescriptorSlot,
} from "./ibl-resource-descriptor.js";

export type IblTexturePreparationStatus =
  | "ready"
  | "deferred"
  | "unsupported"
  | "missing"
  | "not-required";

export type IblTexturePreparationMode = "ready" | "deferred" | "unsupported";

export type IblTexturePreparationDiagnosticCode =
  | "iblTexturePreparation.missingDescriptors"
  | "iblTexturePreparation.unsupportedSlots"
  | "iblTexturePreparation.preparationDeferred"
  | "iblTexturePreparation.preparationUnsupported";

export interface IblTexturePreparationSlot {
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly kind: "diffuse" | "specular";
  readonly sourceResourceKey: string | null;
  readonly placeholder: string | null;
  readonly textureKey: string | null;
  readonly viewKey: string | null;
  readonly samplerKey: string | null;
  readonly dimension: "cube";
  readonly format: "rgba16float";
  readonly usageIntent: "texture-binding";
  readonly preparation: Exclude<IblTexturePreparationMode, "ready"> | "ready";
}

export interface IblTexturePreparationDiagnostic {
  readonly code: IblTexturePreparationDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly descriptorDiagnostics: readonly IblResourceDescriptorDiagnostic[];
}

export interface IblTexturePreparationReport {
  readonly ready: boolean;
  readonly status: IblTexturePreparationStatus;
  readonly descriptorCount: number;
  readonly slotCount: number;
  readonly preparedSlotCount: number;
  readonly sections: {
    readonly iblDescriptors: boolean;
    readonly texturePreparation: boolean;
    readonly textureUpload: boolean;
    readonly prefiltering: boolean;
    readonly shaderSampling: false;
  };
  readonly slots: readonly IblTexturePreparationSlot[];
  readonly diagnostics: readonly IblTexturePreparationDiagnostic[];
}

export type IblTexturePreparationReportJsonValue = IblTexturePreparationReport;

export interface IblTexturePreparationInput {
  readonly descriptors: IblResourceDescriptorReport;
  readonly preparation?: IblTexturePreparationMode;
}

export function createIblTexturePreparationReport(
  input: IblTexturePreparationInput,
): IblTexturePreparationReport {
  const preparation = input.preparation ?? "deferred";

  if (input.descriptors.requiredEnvironmentMapCount === 0) {
    return {
      ready: true,
      status: "not-required",
      descriptorCount: input.descriptors.descriptorCount,
      slotCount: 0,
      preparedSlotCount: 0,
      sections: {
        iblDescriptors: true,
        texturePreparation: true,
        textureUpload: true,
        prefiltering: true,
        shaderSampling: false,
      },
      slots: [],
      diagnostics: [],
    };
  }

  const diagnostics: IblTexturePreparationDiagnostic[] = [];
  const missingDescriptorDiagnostics = input.descriptors.diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "iblResourceDescriptor.missingDescriptor",
  );
  const unsupportedSlotDiagnostics = input.descriptors.diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "iblResourceDescriptor.diffuseSourceNotPrepared" ||
      diagnostic.code === "iblResourceDescriptor.specularSourceNotPrepared",
  );

  if (missingDescriptorDiagnostics.length > 0) {
    diagnostics.push({
      code: "iblTexturePreparation.missingDescriptors",
      severity: "warning",
      descriptorDiagnostics: missingDescriptorDiagnostics,
      message:
        "IBL texture preparation requires renderer-owned IBL resource descriptors.",
    });
  }

  if (unsupportedSlotDiagnostics.length > 0) {
    diagnostics.push({
      code: "iblTexturePreparation.unsupportedSlots",
      severity: "warning",
      descriptorDiagnostics: unsupportedSlotDiagnostics,
      message:
        "IBL texture preparation cannot proceed while diffuse or specular descriptor slots are unsupported placeholders.",
    });
  }

  const slots = input.descriptors.descriptors.flatMap((descriptor) => [
    createPreparationSlot({
      environmentMapResourceKey: descriptor.environmentMapResourceKey,
      environmentIds: descriptor.environmentIds,
      kind: "diffuse",
      slot: descriptor.diffuse,
      preparation,
    }),
    createPreparationSlot({
      environmentMapResourceKey: descriptor.environmentMapResourceKey,
      environmentIds: descriptor.environmentIds,
      kind: "specular",
      slot: descriptor.specular,
      preparation,
    }),
  ]);
  const supportedSlotCount = slots.filter(
    (slot) => slot.sourceResourceKey !== null,
  ).length;

  if (preparation === "unsupported" && supportedSlotCount > 0) {
    diagnostics.push({
      code: "iblTexturePreparation.preparationUnsupported",
      severity: "warning",
      descriptorDiagnostics: [],
      message:
        "IBL texture upload and prefiltering are unsupported for the planned texture resources.",
    });
  } else if (preparation === "deferred" && supportedSlotCount > 0) {
    diagnostics.push({
      code: "iblTexturePreparation.preparationDeferred",
      severity: "warning",
      descriptorDiagnostics: [],
      message:
        "IBL texture descriptors are planned, but texture upload and prefiltering are not implemented yet.",
    });
  }

  const status = determineStatus({
    preparation,
    missingDescriptorDiagnostics,
    unsupportedSlotDiagnostics,
  });

  return {
    ready: status === "ready",
    status,
    descriptorCount: input.descriptors.descriptorCount,
    slotCount: slots.length,
    preparedSlotCount: status === "ready" ? supportedSlotCount : 0,
    sections: {
      iblDescriptors: missingDescriptorDiagnostics.length === 0,
      texturePreparation: status === "ready" || status === "deferred",
      textureUpload: status === "ready",
      prefiltering: status === "ready",
      shaderSampling: false,
    },
    slots,
    diagnostics,
  };
}

export function iblTexturePreparationReportToJsonValue(
  report: IblTexturePreparationReport,
): IblTexturePreparationReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    descriptorCount: report.descriptorCount,
    slotCount: report.slotCount,
    preparedSlotCount: report.preparedSlotCount,
    sections: { ...report.sections },
    slots: report.slots.map((slot) => ({
      ...slot,
      environmentIds: [...slot.environmentIds],
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
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

export function iblTexturePreparationReportToJson(
  report: IblTexturePreparationReport,
): string {
  return JSON.stringify(iblTexturePreparationReportToJsonValue(report));
}

function createPreparationSlot(input: {
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly kind: "diffuse" | "specular";
  readonly slot: IblResourceDescriptorSlot;
  readonly preparation: IblTexturePreparationMode;
}): IblTexturePreparationSlot {
  const sourceResourceKey = input.slot.resourceKey;

  return {
    environmentMapResourceKey: input.environmentMapResourceKey,
    environmentIds: [...input.environmentIds],
    kind: input.kind,
    sourceResourceKey,
    placeholder: input.slot.placeholder,
    textureKey:
      sourceResourceKey === null ? null : `${sourceResourceKey}:texture`,
    viewKey: sourceResourceKey === null ? null : `${sourceResourceKey}:view`,
    samplerKey:
      sourceResourceKey === null ? null : `${sourceResourceKey}:sampler`,
    dimension: "cube",
    format: "rgba16float",
    usageIntent: "texture-binding",
    preparation: sourceResourceKey === null ? "unsupported" : input.preparation,
  };
}

function determineStatus(input: {
  readonly preparation: IblTexturePreparationMode;
  readonly missingDescriptorDiagnostics: readonly IblResourceDescriptorDiagnostic[];
  readonly unsupportedSlotDiagnostics: readonly IblResourceDescriptorDiagnostic[];
}): IblTexturePreparationStatus {
  if (input.missingDescriptorDiagnostics.length > 0) {
    return "missing";
  }

  if (
    input.unsupportedSlotDiagnostics.length > 0 ||
    input.preparation === "unsupported"
  ) {
    return "unsupported";
  }

  return input.preparation;
}
