import { type RenderResourceInspectionRecord, type RenderResourceInspectionReport } from "../../resources/core/resource-lifecycle.js";
import type { StandardMaterialGpuBufferResource } from "./standard-material-buffer-resource.js";
export interface StandardMaterialResourceInspectionInput {
    readonly assetKey: string;
    readonly expectedResourceKey: string;
    readonly resource: StandardMaterialGpuBufferResource | null;
    readonly version?: number | string;
    readonly expectedVersion?: number | string;
    readonly pendingDestroy?: boolean;
}
export declare function createStandardMaterialResourceInspectionRecords(inputs: readonly StandardMaterialResourceInspectionInput[]): readonly RenderResourceInspectionRecord[];
export declare function createStandardMaterialResourceInspectionReport(inputs: readonly StandardMaterialResourceInspectionInput[]): RenderResourceInspectionReport;
//# sourceMappingURL=standard-material-resource-inspection.d.ts.map