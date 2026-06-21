import { BUILT_IN_MATERIAL_QUEUE_FAMILIES, } from "./built-in-material-queue-family.js";
import { createBuiltInMaterialQueueRouteAdapterRegistry, } from "./built-in-material-queue-adapter.js";
import { createQueuedMaterialAdapterRegistry, } from "../../render/queues/queued-material-adapter.js";
export const BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES = BUILT_IN_MATERIAL_QUEUE_FAMILIES;
export function createQueuedBuiltInAppResourceFamilyAdapterTable(options) {
    return {
        unlit: {
            prepareTextureSamplerResources: options.prepareUnlitTextureSamplerResources,
            createFrameResources: options.createUnlitFrameResources,
            appendFrameResource: (resource, buckets) => {
                buckets.unlit.push(resource);
            },
        },
        matcap: {
            prepareTextureSamplerResources: options.prepareMatcapTextureSamplerResources,
            createFrameResources: options.createMatcapFrameResources,
            appendFrameResource: (resource, buckets) => {
                buckets.matcap.push(resource);
            },
        },
        standard: {
            prepareTextureSamplerResources: options.prepareStandardTextureSamplerResources,
            createFrameResources: options.createStandardFrameResources,
            appendFrameResource: (resource, buckets) => {
                buckets.standard.push(resource);
            },
        },
        "debug-normal": {
            prepareTextureSamplerResources: options.prepareDebugNormalTextureSamplerResources,
            createFrameResources: options.createDebugNormalFrameResources,
            appendFrameResource: (resource, buckets) => {
                buckets.debugNormal.push(resource);
            },
        },
    };
}
export function createQueuedBuiltInFrameResourceViaAdapter(input) {
    const result = input.adapter.createFrameResources(input.frameOptions);
    return appendQueuedBuiltInFrameResourceViaAdapter({
        adapter: input.adapter,
        result,
        buckets: input.buckets,
    });
}
export function appendQueuedBuiltInFrameResourceViaAdapter(input) {
    const result = input.result;
    if (!result.valid) {
        return {
            valid: false,
            status: "failed",
            family: input.adapter.kind,
            diagnostics: result.diagnostics,
        };
    }
    if (result.resources === null) {
        return {
            valid: true,
            status: "skipped",
            family: input.adapter.kind,
            diagnostics: result.diagnostics,
        };
    }
    input.adapter.appendFrameResource(result.resources, input.buckets);
    return {
        valid: true,
        status: "appended",
        family: input.adapter.kind,
        diagnostics: result.diagnostics,
    };
}
export function createQueuedBuiltInAppResourceAdapterRegistry(options) {
    return createQueuedMaterialAdapterRegistry(createQueuedBuiltInAppResourceAdapterRegistrations(options));
}
export function validateQueuedBuiltInAppResourceAdapterRegistry(registry) {
    const registeredFamilies = registry.adapters.map((adapter) => adapter.kind);
    const registeredFamilySet = new Set(registeredFamilies);
    const diagnostics = [
        ...registry.diagnostics,
    ];
    for (const family of BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES) {
        if (registeredFamilySet.has(family)) {
            continue;
        }
        diagnostics.push({
            code: "queuedBuiltInAppResourceAdapter.missingFamily",
            severity: "error",
            family,
            message: `Built-in app resource adapter family '${family}' is not registered.`,
        });
    }
    return {
        valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
        registeredFamilies,
        diagnostics,
    };
}
export function queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(report) {
    return {
        valid: report.valid,
        expectedFamilies: [...report.expectedFamilies],
        registeredFamilies: [...report.registeredFamilies],
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function createQueuedBuiltInAppResourceAdapterRegistrations(options) {
    const familyAdapters = resolveQueuedBuiltInAppResourceFamilyAdapterTable(options);
    const routeRegistry = createBuiltInMaterialQueueRouteAdapterRegistry();
    return BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES.map((family) => createQueuedBuiltInAppResourceAdapter(requireBuiltInMaterialRouteAdapter(routeRegistry, family), familyAdapters));
}
function resolveQueuedBuiltInAppResourceFamilyAdapterTable(options) {
    return "families" in options
        ? options.families
        : createQueuedBuiltInAppResourceFamilyAdapterTable(options);
}
function createQueuedBuiltInAppResourceAdapter(routeAdapter, familyAdapters) {
    return {
        ...routeAdapter,
        ...familyAdapters[routeAdapter.kind],
    };
}
function requireBuiltInMaterialRouteAdapter(registry, family) {
    const adapter = registry.get(family);
    if (adapter === null) {
        throw new Error(`Missing built-in material queue route adapter for '${family}'.`);
    }
    return adapter;
}
//# sourceMappingURL=built-in-material-app-resource-adapter.js.map