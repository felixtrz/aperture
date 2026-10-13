export interface QueuedMaterialAdapterRegistration<Kind extends string = string> {
    readonly kind: Kind;
}
export type QueuedMaterialAdapterRegistryDiagnosticCode = "queuedMaterialAdapter.duplicateFamily";
export interface QueuedMaterialAdapterRegistryDiagnostic {
    readonly code: QueuedMaterialAdapterRegistryDiagnosticCode;
    readonly severity: "warning";
    readonly family: string;
    readonly firstIndex: number;
    readonly duplicateIndex: number;
    readonly message: string;
}
export interface QueuedMaterialAdapterRegistry<TAdapter extends QueuedMaterialAdapterRegistration> {
    readonly adapters: readonly TAdapter[];
    readonly diagnostics: readonly QueuedMaterialAdapterRegistryDiagnostic[];
    get(materialKind: string): TAdapter | null;
}
export interface QueuedMaterialAdapterMissingExpectedFamilyDiagnostic {
    readonly code: "queuedMaterialAdapter.missingExpectedFamily";
    readonly severity: "error";
    readonly family: string;
    readonly message: string;
}
export type QueuedMaterialAdapterRegistryValidationDiagnostic = QueuedMaterialAdapterRegistryDiagnostic | QueuedMaterialAdapterMissingExpectedFamilyDiagnostic;
export interface ValidateQueuedMaterialAdapterRegistryOptions {
    readonly expectedFamilies?: readonly string[];
}
export interface QueuedMaterialAdapterRegistryValidationReport {
    readonly valid: boolean;
    readonly expectedFamilies: readonly string[];
    readonly registeredFamilies: readonly string[];
    readonly diagnostics: readonly QueuedMaterialAdapterRegistryValidationDiagnostic[];
}
export interface QueuedMaterialAdapterRegistryValidationJsonValue {
    readonly valid: boolean;
    readonly expectedFamilies: readonly string[];
    readonly registeredFamilies: readonly string[];
    readonly diagnostics: readonly QueuedMaterialAdapterRegistryValidationDiagnostic[];
}
export interface QueuedMaterialAdapterRegistryJsonValue {
    readonly adapterCount: number;
    readonly families: readonly string[];
    readonly diagnostics: readonly QueuedMaterialAdapterRegistryDiagnostic[];
}
export declare function createQueuedMaterialAdapterRegistry<TAdapter extends QueuedMaterialAdapterRegistration>(adapters: readonly TAdapter[]): QueuedMaterialAdapterRegistry<TAdapter>;
export declare function validateQueuedMaterialAdapterRegistry(registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration>, options?: ValidateQueuedMaterialAdapterRegistryOptions): QueuedMaterialAdapterRegistryValidationReport;
export declare function queuedMaterialAdapterRegistryValidationReportToJsonValue(report: QueuedMaterialAdapterRegistryValidationReport): QueuedMaterialAdapterRegistryValidationJsonValue;
export declare function queuedMaterialAdapterRegistryValidationReportToJson(report: QueuedMaterialAdapterRegistryValidationReport): string;
export declare function queuedMaterialAdapterRegistryToJsonValue(registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration>): QueuedMaterialAdapterRegistryJsonValue;
export declare function queuedMaterialAdapterRegistryToJson(registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration>): string;
//# sourceMappingURL=queued-material-adapter.d.ts.map