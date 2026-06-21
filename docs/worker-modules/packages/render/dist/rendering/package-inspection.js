export function inspectRenderPackages(packages) {
    const diagnostics = [];
    const seen = new Set();
    for (const drawPackage of packages) {
        if (seen.has(drawPackage.renderId)) {
            diagnostics.push({
                code: "renderPackage.duplicateRenderId",
                message: `Duplicate render package id ${drawPackage.renderId}.`,
                severity: "warning",
            });
            continue;
        }
        seen.add(drawPackage.renderId);
    }
    if (packages.length === 0) {
        diagnostics.push({
            code: "renderPackage.empty",
            message: "No render packages were provided for inspection.",
            severity: "info",
        });
    }
    return {
        packageCount: packages.length,
        renderIds: uniqueSortedNumbers(packages.map((drawPackage) => drawPackage.renderId)),
        meshResourceKeys: uniqueSortedStrings(packages.map((drawPackage) => drawPackage.meshResourceKey)),
        materialResourceKeys: uniqueSortedStrings(packages.map((drawPackage) => drawPackage.materialResourceKey)),
        batchKeys: uniqueSortedStrings(packages.map((drawPackage) => batchKeyString(drawPackage))),
        transformPackedOffsets: uniqueSortedNumbers(packages.map((drawPackage) => drawPackage.transformPackedOffset)),
        diagnostics,
    };
}
function batchKeyString(drawPackage) {
    const key = drawPackage.batchKey;
    return [
        key.pipelineKey,
        key.materialKey,
        key.meshLayoutKey,
        key.topology,
        key.instanced ? "instanced" : "single",
        key.skinned ? "skinned" : "rigid",
        key.morphed ? "morphed" : "static",
    ].join("|");
}
function uniqueSortedNumbers(values) {
    return [...new Set(values)].sort((a, b) => a - b);
}
function uniqueSortedStrings(values) {
    return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
//# sourceMappingURL=package-inspection.js.map