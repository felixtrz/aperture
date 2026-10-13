/**
 * Resolve whether the generated browser app should collect WebGPU timestamp
 * timings for rendered frames.
 *
 * GPU timing readback drains the queue, so this stays URL-only and opt-in for
 * profiling harnesses. Normal generated apps leave it disabled.
 */
export declare function resolveGpuTimings(search: URLSearchParams | null): boolean | undefined;
//# sourceMappingURL=gpu-timings-route.d.ts.map