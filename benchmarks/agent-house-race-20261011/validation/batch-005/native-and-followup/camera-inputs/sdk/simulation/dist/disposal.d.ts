export type MaybePromise<T> = T | Promise<T>;
/**
 * Runs a disposal stack in reverse registration order, collecting failures so
 * every disposer still runs. Throws an AggregateError with `failureMessage`
 * when any disposer failed; `onError` observes each failure (by stack index)
 * before the aggregate throw, e.g. to report a diagnostic per failure.
 */
export declare function runDisposersInReverse(options: {
    readonly disposers: readonly (() => MaybePromise<void>)[];
    readonly failureMessage: string;
    readonly onError?: (error: unknown, index: number) => void;
}): Promise<void>;
//# sourceMappingURL=disposal.d.ts.map