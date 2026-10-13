import { type LocalLightClusterGpuResource } from "../../lighting/local-light-clusters.js";
import type { CreateStandardFrameGpuResourcesDiagnostic, CreateStandardFrameGpuResourcesOptions } from "./standard-frame-resources.js";
export declare function requiresClusteredLocalLightBuffer(pipelineKey: string): boolean;
export declare function requiresClusteredLocalLightCookies(pipelineKey: string): boolean;
export declare function reusesShadowMatricesForClusteredLocalLightCookies(pipelineKey: string): boolean;
export declare function createLocalLightClusterResource(options: Pick<CreateStandardFrameGpuResourcesOptions, "device" | "snapshot" | "pipelineKey" | "localLightClusterDescriptor" | "localLightClusterResources" | "localLightCookieResources" | "shadowReceiverResources">, diagnostics: CreateStandardFrameGpuResourcesDiagnostic[]): LocalLightClusterGpuResource | null;
//# sourceMappingURL=standard-frame-local-light-resources.d.ts.map