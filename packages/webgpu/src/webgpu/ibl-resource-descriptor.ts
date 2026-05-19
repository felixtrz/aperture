import type {
  EnvironmentPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { planEnvironmentResources } from "./environment-resource-planning.js";

export type IblResourceDescriptorSlotStatus = "ready" | "unsupported";

export type IblResourceDescriptorDiagnosticCode =
  | "iblResourceDescriptor.missingDescriptor"
  | "iblResourceDescriptor.diffuseUnsupported"
  | "iblResourceDescriptor.specularUnsupported";

export interface IblResourceDescriptorSlot {
  readonly status: IblResourceDescriptorSlotStatus;
  readonly resourceKey: string | null;
  readonly placeholder: string | null;
}

export interface IblResourceDescriptorSource {
  readonly environmentMapResourceKey: string;
  readonly diffuseResourceKey?: string;
  readonly specularResourceKey?: string;
}

export interface IblResourceDescriptor {
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly ready: boolean;
  readonly diffuse: IblResourceDescriptorSlot;
  readonly specular: IblResourceDescriptorSlot;
}

export interface IblResourceDescriptorDiagnostic {
  readonly code: IblResourceDescriptorDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly message: string;
}

export interface IblResourceDescriptorReport {
  readonly ready: boolean;
  readonly environmentCount: number;
  readonly requiredEnvironmentMapCount: number;
  readonly descriptorCount: number;
  readonly sections: {
    readonly environmentResourcePlanning: boolean;
    readonly iblDescriptors: boolean;
    readonly shaderSampling: false;
  };
  readonly descriptors: readonly IblResourceDescriptor[];
  readonly diagnostics: readonly IblResourceDescriptorDiagnostic[];
}

export type IblResourceDescriptorReportJsonValue = IblResourceDescriptorReport;

export interface IblResourceDescriptorInput {
  readonly snapshot:
    | Pick<RenderSnapshot, "environments">
    | readonly EnvironmentPacket[];
  readonly descriptors?: readonly IblResourceDescriptorSource[];
}

export function createIblResourceDescriptorReport(
  input: IblResourceDescriptorInput,
): IblResourceDescriptorReport {
  const plan = planEnvironmentResources(input.snapshot);
  const descriptorsByKey = new Map(
    (input.descriptors ?? []).map((descriptor) => [
      descriptor.environmentMapResourceKey,
      descriptor,
    ]),
  );
  const diagnostics: IblResourceDescriptorDiagnostic[] = [];
  const descriptors = plan.requirements.map((requirement) => {
    const source = descriptorsByKey.get(requirement.resourceKey);

    if (source === undefined) {
      diagnostics.push({
        code: "iblResourceDescriptor.missingDescriptor",
        severity: "warning",
        environmentMapResourceKey: requirement.resourceKey,
        environmentIds: [...requirement.environmentIds],
        message: `IBL resource descriptor '${requirement.resourceKey}' is required by extracted environment packets but was not provided by renderer resource state.`,
      });
    }

    const diffuse = createSlot({
      kind: "diffuse",
      resourceKey: source?.diffuseResourceKey,
      environmentMapResourceKey: requirement.resourceKey,
      environmentIds: requirement.environmentIds,
      diagnostics,
    });
    const specular = createSlot({
      kind: "specular",
      resourceKey: source?.specularResourceKey,
      environmentMapResourceKey: requirement.resourceKey,
      environmentIds: requirement.environmentIds,
      diagnostics,
    });

    return {
      environmentMapResourceKey: requirement.resourceKey,
      environmentIds: [...requirement.environmentIds],
      ready: source !== undefined,
      diffuse,
      specular,
    };
  });

  return {
    ready: diagnostics.every(
      (diagnostic) =>
        diagnostic.code !== "iblResourceDescriptor.missingDescriptor",
    ),
    environmentCount: plan.environmentCount,
    requiredEnvironmentMapCount: plan.requirements.length,
    descriptorCount: descriptors.filter((descriptor) => descriptor.ready)
      .length,
    sections: {
      environmentResourcePlanning: true,
      iblDescriptors: diagnostics.every(
        (diagnostic) =>
          diagnostic.code !== "iblResourceDescriptor.missingDescriptor",
      ),
      shaderSampling: false,
    },
    descriptors,
    diagnostics,
  };
}

export function iblResourceDescriptorReportToJsonValue(
  report: IblResourceDescriptorReport,
): IblResourceDescriptorReportJsonValue {
  return {
    ready: report.ready,
    environmentCount: report.environmentCount,
    requiredEnvironmentMapCount: report.requiredEnvironmentMapCount,
    descriptorCount: report.descriptorCount,
    sections: { ...report.sections },
    descriptors: report.descriptors.map((descriptor) => ({
      environmentMapResourceKey: descriptor.environmentMapResourceKey,
      environmentIds: [...descriptor.environmentIds],
      ready: descriptor.ready,
      diffuse: { ...descriptor.diffuse },
      specular: { ...descriptor.specular },
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      environmentIds: [...diagnostic.environmentIds],
    })),
  };
}

export function iblResourceDescriptorReportToJson(
  report: IblResourceDescriptorReport,
): string {
  return JSON.stringify(iblResourceDescriptorReportToJsonValue(report));
}

function createSlot(input: {
  readonly kind: "diffuse" | "specular";
  readonly resourceKey: string | undefined;
  readonly environmentMapResourceKey: string;
  readonly environmentIds: readonly number[];
  readonly diagnostics: IblResourceDescriptorDiagnostic[];
}): IblResourceDescriptorSlot {
  if (input.resourceKey !== undefined) {
    return {
      status: "ready",
      resourceKey: input.resourceKey,
      placeholder: null,
    };
  }

  const placeholder = `${input.environmentMapResourceKey}:ibl:${input.kind}:unsupported`;

  input.diagnostics.push({
    code:
      input.kind === "diffuse"
        ? "iblResourceDescriptor.diffuseUnsupported"
        : "iblResourceDescriptor.specularUnsupported",
    severity: "warning",
    environmentMapResourceKey: input.environmentMapResourceKey,
    environmentIds: [...input.environmentIds],
    message: `IBL ${input.kind} resource for '${input.environmentMapResourceKey}' is not prepared yet; reporting an unsupported placeholder without enabling shader sampling.`,
  });

  return {
    status: "unsupported",
    resourceKey: null,
    placeholder,
  };
}
