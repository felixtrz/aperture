/**
 * Resolve whether the generated browser app should collect WebGPU timestamp
 * timings for rendered frames.
 *
 * GPU timing readback drains the queue, so this stays URL-only and opt-in for
 * profiling harnesses. Normal generated apps leave it disabled.
 */
export function resolveGpuTimings(
  search: URLSearchParams | null,
): boolean | undefined {
  const flag = search?.get("gpuTimings") ?? null;
  if (flag === "1" || flag === "true") {
    return true;
  }
  if (flag === "0" || flag === "false") {
    return false;
  }
  return undefined;
}
