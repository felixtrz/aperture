/**
 * Runs a disposal stack in reverse registration order, collecting failures so
 * every disposer still runs. Throws an AggregateError with `failureMessage`
 * when any disposer failed; `onError` observes each failure (by stack index)
 * before the aggregate throw, e.g. to report a diagnostic per failure.
 */
export async function runDisposersInReverse(options) {
    const errors = [];
    for (let index = options.disposers.length - 1; index >= 0; index -= 1) {
        const dispose = options.disposers[index];
        if (dispose === undefined) {
            continue;
        }
        try {
            await dispose();
        }
        catch (error) {
            errors.push(error);
            options.onError?.(error, index);
        }
    }
    if (errors.length > 0) {
        throw new AggregateError(errors, options.failureMessage);
    }
}
//# sourceMappingURL=disposal.js.map