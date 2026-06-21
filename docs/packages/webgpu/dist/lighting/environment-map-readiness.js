import { planEnvironmentResources } from "./environment-resource-planning.js";
export function createEnvironmentMapReadinessReport(input) {
    const plan = planEnvironmentResources(input.snapshot);
    const resourceKeys = input.resources?.environmentMapResourceKeys;
    const availableResources = resourceKeys === undefined ? null : new Set(resourceKeys);
    const diagnostics = [];
    const requirements = plan.requirements.map((requirement) => {
        const ready = availableResources === null
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
    const resourcesReady = availableResources === null
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
export function environmentMapReadinessReportToJsonValue(report) {
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
export function environmentMapReadinessReportToJson(report) {
    return JSON.stringify(environmentMapReadinessReportToJsonValue(report));
}
//# sourceMappingURL=environment-map-readiness.js.map