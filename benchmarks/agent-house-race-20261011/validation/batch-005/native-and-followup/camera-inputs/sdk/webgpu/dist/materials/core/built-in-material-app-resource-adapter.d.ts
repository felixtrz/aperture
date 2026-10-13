import { type BuiltInMaterialQueueFamily } from "./built-in-material-queue-family.js";
import { type BuiltInMaterialQueueRouteAdapter } from "./built-in-material-queue-adapter.js";
import type { PreparedAppTextureSamplerResources } from "../../app/app-texture-sampler-resources.js";
import type { DebugNormalFrameGpuResources } from "../debug-normal/debug-normal-frame-resources.js";
import type { MatcapFrameGpuResources } from "../matcap/matcap-frame-resources.js";
import type { StandardFrameGpuResources } from "../standard/standard-frame-resources.js";
import type { UnlitFrameGpuResources } from "../unlit/unlit-frame-resources.js";
import type { CreateDebugNormalAppFrameResourcesResult } from "../debug-normal/debug-normal-app-frame-resources.js";
import type { CreateMatcapAppFrameResourcesResult } from "../matcap/matcap-app-frame-resources.js";
import type { CreateStandardAppFrameResourcesResult } from "../standard/standard-app-frame-resources.js";
import type { CreateUnlitAppFrameResourcesResult } from "../unlit/unlit-app-frame-resources.js";
import { type QueuedMaterialAdapterRegistry, type QueuedMaterialAdapterRegistryDiagnostic, type QueuedMaterialAdapterRegistration } from "../../render/queues/queued-material-adapter.js";
export declare const BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES: readonly ["unlit", "matcap", "standard", "debug-normal"];
export type QueuedBuiltInFrameResource = UnlitFrameGpuResources | MatcapFrameGpuResources | StandardFrameGpuResources | DebugNormalFrameGpuResources;
export interface QueuedMaterialFrameResourceAdapterResult<TResources = unknown, TDiagnostic = unknown> {
    readonly valid: boolean;
    readonly resources: TResources | null;
    readonly diagnostics: readonly TDiagnostic[];
}
export interface QueuedMaterialFrameResourceAdapterContext<TItem, TOptions> {
    readonly item: TItem;
    readonly options: TOptions;
}
export type CreateQueuedBuiltInFamilyFrameResourcesResult = CreateUnlitAppFrameResourcesResult | CreateMatcapAppFrameResourcesResult | CreateStandardAppFrameResourcesResult | CreateDebugNormalAppFrameResourcesResult;
export interface QueuedBuiltInFrameResourceBuckets {
    readonly unlit: UnlitFrameGpuResources[];
    readonly matcap: MatcapFrameGpuResources[];
    readonly standard: StandardFrameGpuResources[];
    readonly debugNormal: DebugNormalFrameGpuResources[];
}
export type QueuedBuiltInFrameResourceAdapterStatus = "appended" | "skipped" | "failed";
export interface QueuedBuiltInFrameResourceAdapterReport<TDiagnostic = unknown> {
    readonly valid: boolean;
    readonly status: QueuedBuiltInFrameResourceAdapterStatus;
    readonly family: BuiltInMaterialQueueFamily;
    readonly diagnostics: readonly TDiagnostic[];
}
export interface QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions> extends BuiltInMaterialQueueRouteAdapter, QueuedMaterialAdapterRegistration<BuiltInMaterialQueueFamily> {
    readonly kind: BuiltInMaterialQueueFamily;
    prepareTextureSamplerResources(options: TextureOptions): PreparedAppTextureSamplerResources;
    createFrameResources(options: FrameOptions): CreateQueuedBuiltInFamilyFrameResourcesResult;
    appendFrameResource(resource: QueuedBuiltInFrameResource, buckets: QueuedBuiltInFrameResourceBuckets): void;
}
export interface QueuedBuiltInAppResourceFamilyAdapter<TextureOptions, FrameOptions> {
    prepareTextureSamplerResources(options: TextureOptions): PreparedAppTextureSamplerResources;
    createFrameResources(options: FrameOptions): CreateQueuedBuiltInFamilyFrameResourcesResult;
    appendFrameResource(resource: QueuedBuiltInFrameResource, buckets: QueuedBuiltInFrameResourceBuckets): void;
}
export type QueuedBuiltInAppResourceFamilyAdapterTable<TextureOptions, FrameOptions> = {
    readonly [Family in BuiltInMaterialQueueFamily]: QueuedBuiltInAppResourceFamilyAdapter<TextureOptions, FrameOptions>;
};
export interface QueuedBuiltInAppResourceAdapterCallbacks<TextureOptions, FrameOptions> {
    prepareUnlitTextureSamplerResources(options: TextureOptions): PreparedAppTextureSamplerResources;
    prepareMatcapTextureSamplerResources(options: TextureOptions): PreparedAppTextureSamplerResources;
    prepareStandardTextureSamplerResources(options: TextureOptions): PreparedAppTextureSamplerResources;
    prepareDebugNormalTextureSamplerResources(options: TextureOptions): PreparedAppTextureSamplerResources;
    createUnlitFrameResources(options: FrameOptions): CreateUnlitAppFrameResourcesResult;
    createMatcapFrameResources(options: FrameOptions): CreateMatcapAppFrameResourcesResult;
    createStandardFrameResources(options: FrameOptions): CreateStandardAppFrameResourcesResult;
    createDebugNormalFrameResources(options: FrameOptions): CreateDebugNormalAppFrameResourcesResult;
}
export interface QueuedBuiltInAppResourceAdapterTableOptions<TextureOptions, FrameOptions> {
    readonly families: QueuedBuiltInAppResourceFamilyAdapterTable<TextureOptions, FrameOptions>;
}
export type QueuedBuiltInAppResourceAdapterFactoryOptions<TextureOptions, FrameOptions> = QueuedBuiltInAppResourceAdapterCallbacks<TextureOptions, FrameOptions> | QueuedBuiltInAppResourceAdapterTableOptions<TextureOptions, FrameOptions>;
export type QueuedBuiltInAppResourceAdapterRegistryDiagnostic = QueuedMaterialAdapterRegistryDiagnostic | {
    readonly code: "queuedBuiltInAppResourceAdapter.missingFamily";
    readonly severity: "error";
    readonly family: BuiltInMaterialQueueFamily;
    readonly message: string;
};
export interface QueuedBuiltInAppResourceAdapterRegistryValidationReport {
    readonly valid: boolean;
    readonly expectedFamilies: readonly BuiltInMaterialQueueFamily[];
    readonly registeredFamilies: readonly string[];
    readonly diagnostics: readonly QueuedBuiltInAppResourceAdapterRegistryDiagnostic[];
}
export interface QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue {
    readonly valid: boolean;
    readonly expectedFamilies: readonly BuiltInMaterialQueueFamily[];
    readonly registeredFamilies: readonly string[];
    readonly diagnostics: readonly QueuedBuiltInAppResourceAdapterRegistryDiagnostic[];
}
export declare function createQueuedBuiltInAppResourceFamilyAdapterTable<TextureOptions, FrameOptions>(options: QueuedBuiltInAppResourceAdapterCallbacks<TextureOptions, FrameOptions>): QueuedBuiltInAppResourceFamilyAdapterTable<TextureOptions, FrameOptions>;
export declare function createQueuedBuiltInFrameResourceViaAdapter<FrameOptions>(input: {
    readonly adapter: Pick<QueuedBuiltInAppResourceAdapter<unknown, FrameOptions>, "kind" | "createFrameResources" | "appendFrameResource">;
    readonly frameOptions: FrameOptions;
    readonly buckets: QueuedBuiltInFrameResourceBuckets;
}): QueuedBuiltInFrameResourceAdapterReport;
export declare function appendQueuedBuiltInFrameResourceViaAdapter(input: {
    readonly adapter: Pick<QueuedBuiltInAppResourceAdapter<unknown, unknown>, "kind" | "appendFrameResource">;
    readonly result: CreateQueuedBuiltInFamilyFrameResourcesResult;
    readonly buckets: QueuedBuiltInFrameResourceBuckets;
}): QueuedBuiltInFrameResourceAdapterReport;
export declare function createQueuedBuiltInAppResourceAdapterRegistry<TextureOptions, FrameOptions>(options: QueuedBuiltInAppResourceAdapterFactoryOptions<TextureOptions, FrameOptions>): QueuedMaterialAdapterRegistry<QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>>;
export declare function validateQueuedBuiltInAppResourceAdapterRegistry(registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration<string>>): QueuedBuiltInAppResourceAdapterRegistryValidationReport;
export declare function queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(report: QueuedBuiltInAppResourceAdapterRegistryValidationReport): QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue;
export declare function createQueuedBuiltInAppResourceAdapterRegistrations<TextureOptions, FrameOptions>(options: QueuedBuiltInAppResourceAdapterFactoryOptions<TextureOptions, FrameOptions>): readonly QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>[];
//# sourceMappingURL=built-in-material-app-resource-adapter.d.ts.map