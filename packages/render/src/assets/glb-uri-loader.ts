import {
  createNoFetchGlbSourceLoaderReport,
  type CreateNoFetchGlbSourceLoaderReportOptions,
  type NoFetchGlbSourceLoaderReport,
} from "./glb-source-loader-facade.js";

export type LoadGlbFromUriDiagnosticCode =
  | "loadGlbFromUri.invalidUrl"
  | "loadGlbFromUri.fetchUnavailable"
  | "loadGlbFromUri.fetchFailed"
  | "loadGlbFromUri.httpError"
  | "loadGlbFromUri.readFailed"
  | "loadGlbFromUri.loaderDiagnostic";

export interface LoadGlbFromUriDiagnostic {
  readonly code: LoadGlbFromUriDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly loaderCode?: string;
}

export interface LoadGlbFromUriFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export type LoadGlbFromUriFetch = (
  url: string,
) => Promise<LoadGlbFromUriFetchResponse>;

export interface LoadGlbFromUriOptions extends Omit<
  CreateNoFetchGlbSourceLoaderReportOptions,
  "source"
> {
  readonly fetch?: LoadGlbFromUriFetch;
}

export interface LoadGlbFromUriReport {
  readonly ok: boolean;
  readonly url: string;
  readonly byteLength: number | null;
  readonly loader: NoFetchGlbSourceLoaderReport | null;
  readonly diagnostics: readonly LoadGlbFromUriDiagnostic[];
}

export async function loadGlbFromUri(
  url: string,
  options: LoadGlbFromUriOptions = {},
): Promise<LoadGlbFromUriReport> {
  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl === null) {
    return failure(url, {
      code: "loadGlbFromUri.invalidUrl",
      severity: "error",
      message: `GLB URI '${url}' is not a valid absolute URL.`,
    });
  }

  const fetcher =
    options.fetch ??
    (globalThis.fetch === undefined
      ? undefined
      : (requestUrl: string) => globalThis.fetch(requestUrl));

  if (fetcher === undefined) {
    return failure(normalizedUrl, {
      code: "loadGlbFromUri.fetchUnavailable",
      severity: "error",
      message:
        "GLB URI loading requires globalThis.fetch or an explicit fetch option.",
    });
  }

  let response: LoadGlbFromUriFetchResponse;

  try {
    response = await fetcher(normalizedUrl);
  } catch (error) {
    return failure(normalizedUrl, {
      code: "loadGlbFromUri.fetchFailed",
      severity: "error",
      message: errorMessage(
        error,
        `Fetching GLB URI '${normalizedUrl}' failed.`,
      ),
    });
  }

  if (!response.ok) {
    return failure(normalizedUrl, {
      code: "loadGlbFromUri.httpError",
      severity: "error",
      status: response.status,
      statusText: response.statusText,
      message: `Fetching GLB URI '${normalizedUrl}' failed with HTTP ${response.status}.`,
    });
  }

  let bytes: ArrayBuffer;

  try {
    bytes = await response.arrayBuffer();
  } catch (error) {
    return failure(normalizedUrl, {
      code: "loadGlbFromUri.readFailed",
      severity: "error",
      message: errorMessage(
        error,
        `Reading GLB URI '${normalizedUrl}' response bytes failed.`,
      ),
    });
  }

  const { fetch: _fetch, ...loaderOptions } = options;
  const loader = createNoFetchGlbSourceLoaderReport({
    ...loaderOptions,
    source: bytes,
  });
  const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
    code: "loadGlbFromUri.loaderDiagnostic" as const,
    severity: "error" as const,
    loaderCode: diagnostic.code,
    message: diagnostic.message,
  }));

  return {
    ok: loader.status.status === "loaded" && loaderDiagnostics.length === 0,
    url: normalizedUrl,
    byteLength: bytes.byteLength,
    loader,
    diagnostics: loaderDiagnostics,
  };
}

function normalizeUrl(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

function failure(
  url: string,
  diagnostic: LoadGlbFromUriDiagnostic,
): LoadGlbFromUriReport {
  return {
    ok: false,
    url,
    byteLength: null,
    loader: null,
    diagnostics: [diagnostic],
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
