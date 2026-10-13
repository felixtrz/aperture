export interface ReusableRouteCollectorResourceSet<TItem> {
  readonly items: readonly TItem[];
}

export interface ReusableRouteCollector<TItem, TDiagnostic = unknown> {
  readonly items: TItem[];
  readonly diagnostics: TDiagnostic[];
  readonly resourceSet: ReusableRouteCollectorResourceSet<TItem>;
}

export function createReusableRouteCollector<
  TItem,
  TDiagnostic = unknown,
>(): ReusableRouteCollector<TItem, TDiagnostic> {
  const items: TItem[] = [];

  return {
    items,
    diagnostics: [],
    resourceSet: { items },
  };
}

export function resetReusableRouteCollector<TItem, TDiagnostic>(
  collector: ReusableRouteCollector<TItem, TDiagnostic>,
): ReusableRouteCollector<TItem, TDiagnostic> {
  collector.items.length = 0;
  collector.diagnostics.length = 0;
  return collector;
}
