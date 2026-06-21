import { assetHandleKey, } from "@aperture-engine/simulation";
export function planEnvironmentResources(input) {
    const environments = isEnvironmentPacketArray(input)
        ? input
        : input.environments;
    const requirementsByKey = new Map();
    let nullHandleCount = 0;
    for (const environment of environments) {
        if (environment.handle === null) {
            nullHandleCount += 1;
            continue;
        }
        const resourceKey = assetHandleKey(environment.handle);
        const current = requirementsByKey.get(resourceKey);
        if (current === undefined) {
            requirementsByKey.set(resourceKey, {
                handle: environment.handle,
                environmentIds: [environment.environmentId],
            });
        }
        else {
            current.environmentIds.push(environment.environmentId);
        }
    }
    return {
        environmentCount: environments.length,
        nullHandleCount,
        requirements: [...requirementsByKey.entries()]
            .map(([resourceKey, requirement]) => ({
            resourceKey,
            handle: requirement.handle,
            environmentIds: [...requirement.environmentIds].sort((a, b) => a - b),
        }))
            .sort((a, b) => a.resourceKey < b.resourceKey
            ? -1
            : a.resourceKey > b.resourceKey
                ? 1
                : 0),
    };
}
function isEnvironmentPacketArray(input) {
    return Array.isArray(input);
}
//# sourceMappingURL=environment-resource-planning.js.map