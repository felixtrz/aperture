import { compareStableRenderRecords, compareStateAwareRenderRecords, countOpaqueRenderStateRecords, countOpaqueRenderStateSwitches, createOpaqueRenderStateSortPressureReport, } from "./render-state-sort.js";
import { createRenderWorldDrawPackageScratch, drawPackageAt, } from "./draw-package-scratch.js";
export { createRenderWorldDrawPackageScratch } from "./draw-package-scratch.js";
export function planRenderWorldDrawPackages(readiness, transforms) {
    const scratch = createRenderWorldDrawPackageScratch();
    writeRenderWorldDrawPackages(readiness, transforms, scratch);
    return scratch.plan;
}
export function writeRenderWorldDrawPackages(readiness, transforms, scratch) {
    const packagePoolSizeBeforeWrite = scratch.packagePool.length;
    scratch.packages.length = 0;
    scratch.diagnostics.length = 0;
    for (const diagnostic of transforms.diagnostics) {
        scratch.diagnostics.push(diagnostic);
    }
    for (const blocked of readiness.blocked) {
        scratch.diagnostics.push({
            code: "renderDrawPackage.blockedDraw",
            message: `Render object ${blocked.renderId} is blocked by missing resources: ${blocked.missing.join(", ")}.`,
            severity: "warning",
            entity: blocked.packet.entity,
        });
    }
    for (const draw of readiness.ready) {
        const transformPackedOffset = findPackedTransformOffset(transforms, draw.renderId);
        if (transformPackedOffset === undefined) {
            scratch.diagnostics.push({
                code: "renderDrawPackage.missingPackedTransform",
                message: `Render object ${draw.renderId} is ready but has no packed transform offset.`,
                severity: "warning",
                entity: draw.packet.entity,
            });
            continue;
        }
        const drawPackage = drawPackageAt(scratch, scratch.packages.length);
        drawPackage.renderId = draw.renderId;
        drawPackage.packet = draw.packet;
        drawPackage.meshResourceKey = draw.meshResourceKey;
        drawPackage.materialResourceKey = draw.materialResourceKey;
        drawPackage.batchKey = draw.batchKey;
        drawPackage.sortKey = draw.packet.sortKey;
        drawPackage.transformPackedOffset = transformPackedOffset;
        scratch.packages.push(drawPackage);
    }
    const stableOrderStateSwitches = countStableOrderStateSwitches(scratch.packages, scratch.stableOrderScratch);
    scratch.packages.sort(compareRenderWorldDrawPackages);
    writeScratchSummary(readiness, scratch, packagePoolSizeBeforeWrite, stableOrderStateSwitches);
    return scratch.plan;
}
export function compareRenderWorldDrawPackages(a, b) {
    return compareStateAwareRenderRecords(a, b);
}
function findPackedTransformOffset(transforms, renderId) {
    for (const offset of transforms.offsets) {
        if (offset.renderId === renderId) {
            return offset.packedOffset;
        }
    }
    return undefined;
}
function writeScratchSummary(readiness, scratch, packagePoolSizeBeforeWrite, stableOrderStateSwitches) {
    const summary = scratch.summary;
    const diagnostics = summary.diagnostics;
    summary.readyDrawCount = readiness.ready.length;
    summary.blockedDrawCount = readiness.blocked.length;
    summary.packageCount = scratch.packages.length;
    summary.packagePoolSize = scratch.packagePool.length;
    summary.packagePoolSizeBeforeWrite = packagePoolSizeBeforeWrite;
    summary.packageSlotsReused = Math.min(scratch.packages.length, packagePoolSizeBeforeWrite);
    summary.packageSlotsCreated = Math.max(0, scratch.packagePool.length - packagePoolSizeBeforeWrite);
    summary.missingPackedTransformCount = 0;
    summary.stateSort = createOpaqueRenderStateSortPressureReport({
        stableOrder: stableOrderStateSwitches,
        stateAwareOrder: countOpaqueRenderStateSwitches(scratch.packages),
        recordCount: countOpaqueRenderStateRecords(scratch.packages),
    });
    diagnostics.total = scratch.diagnostics.length;
    for (const code in diagnostics.byCode) {
        delete diagnostics.byCode[code];
    }
    for (const diagnostic of scratch.diagnostics) {
        diagnostics.byCode[diagnostic.code] =
            (diagnostics.byCode[diagnostic.code] ?? 0) + 1;
        if (diagnostic.code === "renderDrawPackage.missingPackedTransform") {
            summary.missingPackedTransformCount += 1;
        }
    }
}
function countStableOrderStateSwitches(packages, scratch) {
    scratch.length = 0;
    for (const drawPackage of packages) {
        scratch.push(drawPackage);
    }
    scratch.sort(compareStableRenderRecords);
    return countOpaqueRenderStateSwitches(scratch);
}
//# sourceMappingURL=draw-package.js.map