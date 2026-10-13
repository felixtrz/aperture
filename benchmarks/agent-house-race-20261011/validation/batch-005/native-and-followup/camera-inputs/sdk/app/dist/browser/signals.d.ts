export type GeneratedSignalSummary = Readonly<Record<string, unknown>>;
export type GeneratedSignalsListener = (signals: GeneratedSignalSummary) => void;
export interface GeneratedSignalsSubscriptionOptions {
    readonly scope?: object;
    readonly immediate?: boolean;
    readonly intervalMilliseconds?: number;
}
export declare const DEFAULT_GENERATED_SIGNAL_SUBSCRIPTION_INTERVAL_MS = 16;
export declare function readGeneratedSignals(scope?: object): GeneratedSignalSummary | null;
export declare function readGeneratedSignal<T = unknown>(name: string, fallback: T, scope?: object): T;
export declare function subscribeGeneratedSignals(listener: GeneratedSignalsListener, options?: GeneratedSignalsSubscriptionOptions): () => void;
//# sourceMappingURL=signals.d.ts.map