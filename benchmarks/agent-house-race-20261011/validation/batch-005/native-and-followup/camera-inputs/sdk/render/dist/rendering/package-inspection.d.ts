import type { RenderDiagnostic } from "./snapshot.js";
import type { RenderWorldDrawPackage } from "./draw-package.js";
export interface RenderPackageInspectionReport {
    readonly packageCount: number;
    readonly renderIds: readonly number[];
    readonly meshResourceKeys: readonly string[];
    readonly materialResourceKeys: readonly string[];
    readonly batchKeys: readonly string[];
    readonly transformPackedOffsets: readonly number[];
    readonly diagnostics: readonly RenderDiagnostic[];
}
export declare function inspectRenderPackages(packages: readonly RenderWorldDrawPackage[]): RenderPackageInspectionReport;
//# sourceMappingURL=package-inspection.d.ts.map