import type {
  EnvironmentPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { planEnvironmentResources } from "./environment-resource-planning.js";

export type EnvironmentMapReadinessDiagnosticCode =
  "environmentMapReadiness.missingResource";

export interface EnvironmentMapReadinessDiagnostic {
  readonly code: EnvironmentMapReadinessDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly resourceKey: string;
  readonly environmentIds: readonly number[];
}

export interface EnvironmentMapReadinessRequirement {
  readonly resourceKey: string;
  readonly environmentIds: readonly number[];
  readonly ready: boolean | null;
}

export interface EnvironmentMapReadinessResourceState {
  readonly environmentMapResourceKeys: readonly string[];
}

export interface EnvironmentMapReadinessInput {
  readonly snapshot:
    | Pick<RenderSnapshot, "environments">
    | readonly EnvironmentPacket[];
  readonly resources?: EnvironmentMapReadinessResourceState | null;
}

export interface EnvironmentMapReadinessReport {
  readonly ready: boolean;
  readonly environmentCount: number;
  readonly nullHandleCount: number;
  readonly requiredEnvironmentMapCount: number;
  readonly sections: {
    readonly environmentResourcePlanning: boolean;
    readonly environmentMapResources: boolean | null;
  };
  readonly requirements: readonly EnvironmentMapReadinessRequirement[];
  readonly diagnostics: readonly EnvironmentMapReadinessDiagnostic[];
}

export type EnvironmentMapReadinessReportJsonValue =
  EnvironmentMapReadinessReport;

export function createEnvironmentMapReadinessReport(
  input: EnvironmentMapReadinessInput,
): EnvironmentMapReadinessReport {
  const plan = planEnvironmentResources(input.snapshot);
  const resourceKeys = input.resources?.environmentMapResourceKeys;
  const availableResources =
    resourceKeys === undefined ? null : new Set(resourceKeys);
  const diagnostics: EnvironmentMapReadinessDiagnostic[] = [];
  const requirements = plan.requirements.map((requirement) => {
    const ready =
      availableResources === null
        ? null
        : availableResources.has(requirement.resourceKey);

    if (ready === false) {
      diagnostics.push({
        code: "environmentMapReadiness.missingResource",
        severity: "warning",
        resourceKey: requirement.resourceKey,
        environmentIds: [...requirement.environmentIds],
        message: `Environment map resource '${requirement.resourceKey}' is required by extracted environment packets but is not present in renderer resource state.`,
      });
    }

    return {
      resourceKey: requirement.resourceKey,
      environmentIds: [...requirement.environmentIds],
      ready,
    };
  });
  const resourcesReady =
    availableResources === null
      ? null
      : diagnostics.length === 0 && requirements.every((item) => item.ready);

  return {
    ready: resourcesReady ?? true,
    environmentCount: plan.environmentCount,
    nullHandleCount: plan.nullHandleCount,
    requiredEnvironmentMapCount: plan.requirements.length,
    sections: {
      environmentResourcePlanning: true,
      environmentMapResources: resourcesReady,
    },
    requirements,
    diagnostics,
  };
}

export function environmentMapReadinessReportToJsonValue(
  report: EnvironmentMapReadinessReport,
): EnvironmentMapReadinessReportJsonValue {
  return {
    ready: report.ready,
    environmentCount: report.environmentCount,
    nullHandleCount: report.nullHandleCount,
    requiredEnvironmentMapCount: report.requiredEnvironmentMapCount,
    sections: { ...report.sections },
    requirements: report.requirements.map((requirement) => ({
      resourceKey: requirement.resourceKey,
      environmentIds: [...requirement.environmentIds],
      ready: requirement.ready,
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      environmentIds: [...diagnostic.environmentIds],
    })),
  };
}

export function environmentMapReadinessReportToJson(
  report: EnvironmentMapReadinessReport,
): string {
  return JSON.stringify(environmentMapReadinessReportToJsonValue(report));
}
