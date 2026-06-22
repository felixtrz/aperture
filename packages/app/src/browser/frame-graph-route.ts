/**
 * Resolve whether the generated browser app should use the single-encoder
 * FrameGraph route.
 *
 * AI-25: the FrameGraph route is the DEFAULT (on at parity, matching
 * createWebGpuApp's default). Sources, in order of precedence:
 * - the `?graph=1` / `?graph=0` URL flag — a per-load override kept alongside
 *   the config option for the existing harness/e2e matrix (it lets one built
 *   example exercise BOTH routes without rebuilding config), and
 * - the `render.frameGraph` config option (reproducible, no query string):
 *   `true` enables the graph route, `false` forces the legacy multi-submit
 *   route.
 *
 * The returned boolean is passed to createWebGpuApp explicitly, so `false`
 * really forces legacy rather than falling through to the renderer default.
 */
export function resolveUseFrameGraph(
  render: { readonly frameGraph?: boolean } | undefined,
  search: URLSearchParams | null,
): boolean {
  const urlFlag = search?.get("graph") ?? null;
  if (urlFlag === "1") {
    return true;
  }
  if (urlFlag === "0") {
    return false;
  }
  if (render?.frameGraph !== undefined) {
    return render.frameGraph;
  }
  return true;
}
