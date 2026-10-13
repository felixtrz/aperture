import type { AssetRegistry } from "@aperture-engine/simulation";
import { materialDependencyReadinessReportToJsonValue, type RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuAppMaterialDependencyDiagnostic } from "./app.js";
export declare function diagnoseSnapshotMaterialDependencies(assets: AssetRegistry, snapshot: RenderSnapshot): WebGpuAppMaterialDependencyDiagnostic[];
export declare function createWebGpuAppMaterialDependencyDiagnostic(materialDependencyReadiness: Parameters<typeof materialDependencyReadinessReportToJsonValue>[0]): WebGpuAppMaterialDependencyDiagnostic;
//# sourceMappingURL=material-dependencies.d.ts.map