import { type StandardAreaLightLtcResources } from "./standard-area-light-ltc-resource.js";
import { type LocalLightClusterGpuResource } from "../../lighting/local-light-clusters.js";
import type { LocalLightClusterCookieResources } from "../../lighting/local-light-cookie-resources.js";
import type { StandardLightIblShadowReceiverResources, StandardLightShadowBindGroupDescriptorEntry, StandardLightShadowBindGroupDiagnostic } from "./standard-light-shadow-bind-group.js";
export declare function appendAreaLightLtcEntries(entries: StandardLightShadowBindGroupDescriptorEntry[], resources: StandardAreaLightLtcResources | null): void;
export declare function appendLocalLightClusterEntries(entries: StandardLightShadowBindGroupDescriptorEntry[], resources: LocalLightClusterGpuResource | null): void;
export declare function appendLocalLightCookieEntries(entries: StandardLightShadowBindGroupDescriptorEntry[], resources: LocalLightClusterCookieResources | null, matrixEntryEnabled?: boolean): void;
export declare function appendShadowEntries(shadowResources: StandardLightIblShadowReceiverResources, entries: StandardLightShadowBindGroupDescriptorEntry[], diagnostics: StandardLightShadowBindGroupDiagnostic[], bindings?: {
    readonly matrix: number;
    readonly depth: number;
    readonly sampler: number;
}): void;
//# sourceMappingURL=standard-light-shadow-bind-group-entries.d.ts.map