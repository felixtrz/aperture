export interface QueuedMaterialAdapterRegistration<
  Kind extends string = string,
> {
  readonly kind: Kind;
}

export interface QueuedMaterialAdapterRegistry<
  TAdapter extends QueuedMaterialAdapterRegistration,
> {
  readonly adapters: readonly TAdapter[];
  get(materialKind: string): TAdapter | null;
}

export function createQueuedMaterialAdapterRegistry<
  TAdapter extends QueuedMaterialAdapterRegistration,
>(adapters: readonly TAdapter[]): QueuedMaterialAdapterRegistry<TAdapter> {
  return {
    adapters,
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
