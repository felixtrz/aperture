import type { RenderWorldDrawReadinessReport } from "./render-world.js";
import type { RenderWorldDrawPackage, RenderWorldDrawPackagePlan, RenderWorldDrawPackageScratch } from "./draw-package-types.js";
import type { PackedSnapshotTransforms } from "./transform-pack.js";
export { createRenderWorldDrawPackageScratch } from "./draw-package-scratch.js";
export type { RenderWorldDrawPackage, RenderWorldDrawPackageDiagnosticSummary, RenderWorldDrawPackagePlan, RenderWorldDrawPackageScratch, RenderWorldDrawPackageScratchSummary, } from "./draw-package-types.js";
export declare function planRenderWorldDrawPackages(readiness: RenderWorldDrawReadinessReport, transforms: PackedSnapshotTransforms): RenderWorldDrawPackagePlan;
export declare function writeRenderWorldDrawPackages(readiness: RenderWorldDrawReadinessReport, transforms: PackedSnapshotTransforms, scratch: RenderWorldDrawPackageScratch): RenderWorldDrawPackagePlan;
export declare function compareRenderWorldDrawPackages(a: RenderWorldDrawPackage, b: RenderWorldDrawPackage): number;
//# sourceMappingURL=draw-package.d.ts.map