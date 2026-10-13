import { emptyOpaqueRenderStateSortPressureReport } from "./render-state-sort.js";
export function createRenderWorldDrawPackageScratch(capacity = 0) {
    const packagePool = [];
    const packages = [];
    const stableOrderScratch = [];
    const diagnostics = [];
    const summary = createEmptySummary();
    for (let i = 0; i < capacity; i += 1) {
        packagePool.push(createEmptyPackage());
    }
    return {
        packages,
        diagnostics,
        packagePool,
        stableOrderScratch,
        summary,
        plan: { packages, diagnostics, summary },
    };
}
export function drawPackageAt(scratch, index) {
    const existing = scratch.packagePool[index];
    if (existing !== undefined) {
        return existing;
    }
    const drawPackage = createEmptyPackage();
    scratch.packagePool.push(drawPackage);
    return drawPackage;
}
function createEmptyPackage() {
    return {
        renderId: 0,
        packet: null,
        meshResourceKey: "",
        materialResourceKey: "",
        batchKey: null,
        sortKey: null,
        transformPackedOffset: 0,
    };
}
function createEmptySummary() {
    return {
        readyDrawCount: 0,
        blockedDrawCount: 0,
        packageCount: 0,
        packagePoolSize: 0,
        packagePoolSizeBeforeWrite: 0,
        packageSlotsReused: 0,
        packageSlotsCreated: 0,
        missingPackedTransformCount: 0,
        diagnostics: {
            total: 0,
            byCode: {},
        },
        stateSort: emptyOpaqueRenderStateSortPressureReport(),
    };
}
//# sourceMappingURL=draw-package-scratch.js.map