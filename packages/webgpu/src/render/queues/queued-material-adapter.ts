export interface QueuedMaterialAdapterRegistration<
  Kind extends string = string,
> {
  readonly kind: Kind;
}

export type QueuedMaterialAdapterRegistryDiagnosticCode =
  "queuedMaterialAdapter.duplicateFamily";

export interface QueuedMaterialAdapterRegistryDiagnostic {
  readonly code: QueuedMaterialAdapterRegistryDiagnosticCode;
  readonly severity: "warning";
  readonly family: string;
  readonly firstIndex: number;
  readonly duplicateIndex: number;
  readonly message: string;
}

export interface QueuedMaterialAdapterRegistry<
  TAdapter extends QueuedMaterialAdapterRegistration,
> {
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

export type QueuedMaterialAdapterRegistryValidationDiagnostic =
  | QueuedMaterialAdapterRegistryDiagnostic
  | QueuedMaterialAdapterMissingExpectedFamilyDiagnostic;

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

export function createQueuedMaterialAdapterRegistry<
  TAdapter extends QueuedMaterialAdapterRegistration,
>(adapters: readonly TAdapter[]): QueuedMaterialAdapterRegistry<TAdapter> {
  return {
    adapters,
    diagnostics: collectRegistryDiagnostics(adapters),
    get: (materialKind) => {
      for (const adapter of adapters) {
        if (adapter.kind === materialKind) {
          return adapter;
        }
      }

      return null;
    },
  };
}

export function validateQueuedMaterialAdapterRegistry(
  registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration>,
  options: ValidateQueuedMaterialAdapterRegistryOptions = {},
): QueuedMaterialAdapterRegistryValidationReport {
  const expectedFamilies = [...(options.expectedFamilies ?? [])];
  const registeredFamilies = registry.adapters.map((adapter) => adapter.kind);
  const registeredFamilySet = new Set(registeredFamilies);
  const diagnostics: QueuedMaterialAdapterRegistryValidationDiagnostic[] = [
    ...registry.diagnostics,
  ];

  for (const family of expectedFamilies) {
    if (registeredFamilySet.has(family)) {
      continue;
    }

    diagnostics.push({
      code: "queuedMaterialAdapter.missingExpectedFamily",
      severity: "error",
      family,
      message: `Expected material adapter family '${family}' is not registered.`,
    });
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    expectedFamilies,
    registeredFamilies,
    diagnostics,
  };
}

export function queuedMaterialAdapterRegistryValidationReportToJsonValue(
  report: QueuedMaterialAdapterRegistryValidationReport,
): QueuedMaterialAdapterRegistryValidationJsonValue {
  return {
    valid: report.valid,
    expectedFamilies: [...report.expectedFamilies],
    registeredFamilies: [...report.registeredFamilies],
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function queuedMaterialAdapterRegistryValidationReportToJson(
  report: QueuedMaterialAdapterRegistryValidationReport,
): string {
  return JSON.stringify(
    queuedMaterialAdapterRegistryValidationReportToJsonValue(report),
  );
}

export function queuedMaterialAdapterRegistryToJsonValue(
  registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration>,
): QueuedMaterialAdapterRegistryJsonValue {
  return {
    adapterCount: registry.adapters.length,
    families: registry.adapters.map((adapter) => adapter.kind),
    diagnostics: registry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function queuedMaterialAdapterRegistryToJson(
  registry: QueuedMaterialAdapterRegistry<QueuedMaterialAdapterRegistration>,
): string {
  return JSON.stringify(queuedMaterialAdapterRegistryToJsonValue(registry));
}

function collectRegistryDiagnostics(
  adapters: readonly QueuedMaterialAdapterRegistration[],
): QueuedMaterialAdapterRegistryDiagnostic[] {
  const firstIndexByFamily = new Map<string, number>();
  const diagnostics: QueuedMaterialAdapterRegistryDiagnostic[] = [];

  adapters.forEach((adapter, index) => {
    const firstIndex = firstIndexByFamily.get(adapter.kind);

    if (firstIndex === undefined) {
      firstIndexByFamily.set(adapter.kind, index);
      return;
    }

    diagnostics.push({
      code: "queuedMaterialAdapter.duplicateFamily",
      severity: "warning",
      family: adapter.kind,
      firstIndex,
      duplicateIndex: index,
      message: `Material adapter family '${adapter.kind}' is registered more than once; the first adapter at index ${firstIndex} will be used.`,
    });
  });

  return diagnostics;
}
