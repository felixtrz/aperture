/**
 * Resolve whether the generated browser app should use the single-encoder
 * FrameGraph forward route.
 *
 * Sources, in order of precedence (either enables it; default off):
 * - the `render.frameGraph` config option (reproducible, no query string), and
 * - the `?graph=1` URL flag (per-load override, kept for existing harness/e2e).
 */
export function resolveUseFrameGraph(
  render: { readonly frameGraph?: boolean } | undefined,
  search: URLSearchParams | null,
): boolean {
  return render?.frameGraph === true || search?.get("graph") === "1";
}
