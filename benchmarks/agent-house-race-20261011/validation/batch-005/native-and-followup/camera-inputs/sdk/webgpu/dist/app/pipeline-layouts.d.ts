import type { LightBindGroupLayoutResource } from "../lighting/light-bind-group-layout.js";
import type { BuiltInMaterialQueueFamily } from "../materials/core/built-in-material-queue-family.js";
import type { DebugNormalMaterialBindGroupLayoutResource } from "../materials/debug-normal/debug-normal-bind-group.js";
import type { MatcapMaterialBindGroupLayoutResource } from "../materials/matcap/matcap-bind-group.js";
import type { StandardMaterialBindGroupLayoutResource } from "../materials/standard/standard-bind-group.js";
import { type StandardLightShadowBindGroupLayoutResource } from "../materials/standard/standard-light-shadow-bind-group.js";
import { type UnlitBindGroupLayoutResource } from "../materials/unlit/unlit-bind-group.js";
import type { WebGpuAppPipelineResourceResult } from "./app.js";
export type WebGpuAppMaterialKind = BuiltInMaterialQueueFamily;
export interface WebGpuAppPipelineLayouts {
    readonly kind: WebGpuAppMaterialKind;
    readonly pipelineResourceKey: string;
    readonly sharedLayouts: readonly UnlitBindGroupLayoutResource[];
    readonly materialLayout: MatcapMaterialBindGroupLayoutResource | StandardMaterialBindGroupLayoutResource | DebugNormalMaterialBindGroupLayoutResource | null;
    readonly lightLayout: LightBindGroupLayoutResource | StandardLightShadowBindGroupLayoutResource | null;
}
export declare function getWebGpuAppPipelineLayouts(options: {
    readonly cache: {
        readonly layouts: Map<string, WebGpuAppPipelineLayouts>;
    };
    readonly kind: WebGpuAppMaterialKind;
    readonly pipeline: WebGpuAppPipelineResourceResult;
    readonly getBindGroupLayout: (group: number) => unknown;
}): WebGpuAppPipelineLayouts;
//# sourceMappingURL=pipeline-layouts.d.ts.map