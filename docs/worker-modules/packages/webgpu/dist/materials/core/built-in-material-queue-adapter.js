import { BUILT_IN_MATERIAL_QUEUE_FAMILIES, } from "./built-in-material-queue-family.js";
import { createUnsupportedBuiltInMaterialQueuePhaseDiagnostic, } from "./built-in-material-queue-phase.js";
import { createQueuedMaterialAdapterRegistry, } from "../../render/queues/queued-material-adapter.js";
import { createQueuedMaterialPrepareRouteResult, } from "../../render/queues/queued-material-prepare-route.js";
export function createBuiltInMaterialQueueRouteAdapterRegistry(adapters = createBuiltInMaterialQueueRouteAdapters()) {
    return createQueuedMaterialAdapterRegistry(adapters);
}
export function createBuiltInMaterialQueueRouteAdapters() {
    return BUILT_IN_MATERIAL_QUEUE_FAMILIES.map((family) => ({
        kind: family,
        isMaterialAsset: (material) => material.kind === family,
        acceptsMaterial: (material) => isBuiltInMaterialCandidate(material) && material.kind === family,
        validateQueueItem: createUnsupportedBuiltInMaterialQueuePhaseDiagnostic,
        prepareRoute: (context) => createQueuedMaterialPrepareRouteResult(context),
    }));
}
function isBuiltInMaterialCandidate(material) {
    return (typeof material === "object" &&
        material !== null &&
        "kind" in material &&
        typeof material.kind === "string");
}
//# sourceMappingURL=built-in-material-queue-adapter.js.map