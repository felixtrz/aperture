export interface ReusableRouteCollectorResourceSet<TItem> {
    readonly items: readonly TItem[];
}
export interface ReusableRouteCollector<TItem, TDiagnostic = unknown> {
    readonly items: TItem[];
    readonly diagnostics: TDiagnostic[];
    readonly resourceSet: ReusableRouteCollectorResourceSet<TItem>;
}
export declare function createReusableRouteCollector<TItem, TDiagnostic = unknown>(): ReusableRouteCollector<TItem, TDiagnostic>;
export declare function resetReusableRouteCollector<TItem, TDiagnostic>(collector: ReusableRouteCollector<TItem, TDiagnostic>): ReusableRouteCollector<TItem, TDiagnostic>;
//# sourceMappingURL=reusable-route-collector.d.ts.map