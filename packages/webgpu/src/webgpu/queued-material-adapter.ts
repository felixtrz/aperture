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
