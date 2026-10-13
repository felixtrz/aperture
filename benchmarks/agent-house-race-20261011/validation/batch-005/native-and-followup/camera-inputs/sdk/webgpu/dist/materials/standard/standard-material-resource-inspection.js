import { createRenderResourceInspectionReport, } from "../../resources/core/resource-lifecycle.js";
export function createStandardMaterialResourceInspectionRecords(inputs) {
    return inputs.map((input) => {
        const status = standardMaterialResourceStatus(input);
        return {
            kind: "material",
            assetKey: input.assetKey,
            resourceKey: input.resource?.resourceKey ?? input.expectedResourceKey,
            ...(input.version === undefined ? {} : { version: input.version }),
            ...(input.expectedVersion === undefined
                ? {}
                : { expectedVersion: input.expectedVersion }),
            status,
            pendingDestroy: input.pendingDestroy ?? status === "pending-destroy",
        };
    });
}
export function createStandardMaterialResourceInspectionReport(inputs) {
    return createRenderResourceInspectionReport(createStandardMaterialResourceInspectionRecords(inputs));
}
function standardMaterialResourceStatus(input) {
    if (input.pendingDestroy === true) {
        return "pending-destroy";
    }
    if (input.resource === null) {
        return "missing";
    }
    if (input.version !== undefined &&
        input.expectedVersion !== undefined &&
        input.version !== input.expectedVersion) {
        return "stale";
    }
    return "live";
}
//# sourceMappingURL=standard-material-resource-inspection.js.map