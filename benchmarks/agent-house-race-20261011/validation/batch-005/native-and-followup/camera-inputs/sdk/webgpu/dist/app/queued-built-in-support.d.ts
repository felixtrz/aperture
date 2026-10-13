import { type RenderSnapshot } from "@aperture-engine/render";
import type { QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue } from "../materials/core/built-in-material-app-resource-adapter.js";
import { type StandardAreaLightLtcResources } from "../materials/standard/standard-area-light-ltc-resource.js";
import type { PlanRenderFrameFromSnapshotResult } from "../render/frame/render-frame-plan.js";
import { type QueuedBuiltInAppResourceSet } from "../render/queues/queued-built-in-app-resource-set.js";
import type { QueuedBuiltInFrameResources } from "../render/queues/queued-built-in-frame-resource-set.js";
import { type WebGpuAppDiagnosticsSummary } from "./app-diagnostics-summary.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
interface QueuedBuiltInSupportAppContext {
    readonly initialization: {
        readonly device: unknown;
    };
}
export declare function snapshotUsesTransmission(snapshot: RenderSnapshot): boolean;
export declare function queuedBuiltInResourceSetHasStandardMaterial(resourceSet: QueuedBuiltInAppResourceSet): boolean;
export declare function createQueuedBuiltInAppDiagnosticsSummary(input: {
    readonly snapshot: RenderSnapshot;
    readonly resourceSet: QueuedBuiltInAppResourceSet;
    readonly resources: QueuedBuiltInFrameResources | null;
    readonly adapterValidation: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
    readonly framePlan?: Pick<PlanRenderFrameFromSnapshotResult, "readiness" | "packages" | "summary">;
}): WebGpuAppDiagnosticsSummary;
export declare function collectInstanceTintResources(resources: QueuedBuiltInFrameResources): NonNullable<QueuedBuiltInFrameResources["standard"][number]["instanceTints"]>[];
export declare function createQueuedBuiltInRouteFailureDiagnosticsSummary(diagnostics: readonly unknown[], adapterValidation: QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue): WebGpuAppDiagnosticsSummary | undefined;
export declare function resolveStandardAreaLightLtcResources(options: {
    readonly app: QueuedBuiltInSupportAppContext;
    readonly cache: WebGpuAppResourceCache;
    readonly required: boolean;
}): {
    readonly valid: boolean;
    readonly resources: StandardAreaLightLtcResources | null;
    readonly diagnostics: readonly unknown[];
};
export {};
//# sourceMappingURL=queued-built-in-support.d.ts.map