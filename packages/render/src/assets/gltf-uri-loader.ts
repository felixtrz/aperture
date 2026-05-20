import {
  createNoFetchGltfSourceLoaderReport,
  type CreateNoFetchGltfSourceLoaderReportOptions,
  type NoFetchGltfSourceLoaderReport,
} from "./gltf-source-loader-facade.js";

export type LoadGltfFromUriDiagnosticCode =
  | "loadGltfFromUri.invalidUrl"
  | "loadGltfFromUri.fetchUnavailable"
  | "loadGltfFromUri.fetchFailed"
  | "loadGltfFromUri.httpError"
  | "loadGltfFromUri.readFailed"
  | "loadGltfFromUri.invalidJson"
  | "loadGltfFromUri.unsupportedBufferUri"
  | "loadGltfFromUri.bufferFetchFailed"
  | "loadGltfFromUri.bufferHttpError"
  | "loadGltfFromUri.bufferReadFailed"
  | "loadGltfFromUri.loaderDiagnostic";

export interface LoadGltfFromUriDiagnostic {
  readonly code: LoadGltfFromUriDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly uri?: string;
  readonly bufferIndex?: number;
  readonly loaderCode?: string;
}

export interface LoadGltfFromUriFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export type LoadGltfFromUriFetch = (
  url: string,
) => Promise<LoadGltfFromUriFetchResponse>;

export interface LoadGltfFromUriOptions extends Omit<
  CreateNoFetchGltfSourceLoaderReportOptions,
  "root"
> {
  readonly fetch?: LoadGltfFromUriFetch;
}

export interface LoadGltfFromUriReport {
  readonly ok: boolean;
  readonly url: string;
  readonly byteLength: number | null;
  readonly loader: NoFetchGltfSourceLoaderReport | null;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

export async function loadGltfFromUri(
  url: string,
  options: LoadGltfFromUriOptions = {},
): Promise<LoadGltfFromUriReport> {
  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl === null) {
    return failure(url, {
      code: "loadGltfFromUri.invalidUrl",
      severity: "error",
      message: `glTF URI '${url}' is not a valid absolute URL.`,
    });
  }

  const fetcher =
    options.fetch ??
    (globalThis.fetch === undefined
      ? undefined
      : (requestUrl: string) => globalThis.fetch(requestUrl));

  if (fetcher === undefined) {
    return failure(normalizedUrl, {
      code: "loadGltfFromUri.fetchUnavailable",
      severity: "error",
      message:
        "glTF URI loading requires globalThis.fetch or an explicit fetch option.",
    });
  }

  const source = await fetchBytes({
    url: normalizedUrl,
    fetcher,
    context: "source",
  });

  if (!source.ok) {
    return failure(normalizedUrl, source.diagnostic);
  }

  const parsed = parseGltfJson(normalizedUrl, source.bytes);

  if (!parsed.ok) {
    return failure(normalizedUrl, parsed.diagnostic, source.bytes.byteLength);
  }

  const externalBuffers = await fetchExternalBuffers({
    root: parsed.root,
    sourceUrl: normalizedUrl,
    fetcher,
  });
  const {
    fetch: _fetch,
    externalBufferBytes: providedBuffers,
    ...loaderOptions
  } = options;
  const mergedExternalBuffers = mergeExternalBufferBytes(
    providedBuffers,
    externalBuffers.bytes,
  );
  const loader = createNoFetchGltfSourceLoaderReport({
    ...loaderOptions,
    root: parsed.root,
    sourceByteLength: source.bytes.byteLength,
    externalBufferBytes: mergedExternalBuffers,
  });
  const loaderDiagnostics = loader.status.diagnostics.map((diagnostic) => ({
    code: "loadGltfFromUri.loaderDiagnostic" as const,
    severity: "error" as const,
    loaderCode: diagnostic.code,
    message: diagnostic.message,
  }));
  const diagnostics = [...externalBuffers.diagnostics, ...loaderDiagnostics];

  return {
    ok: loader.status.status === "loaded" && diagnostics.length === 0,
    url: normalizedUrl,
    byteLength: source.bytes.byteLength,
    loader,
    diagnostics,
  };
}

interface FetchBytesInput {
  readonly url: string;
  readonly fetcher: LoadGltfFromUriFetch;
  readonly context: "source" | "buffer";
  readonly bufferIndex?: number;
}

type FetchBytesResult =
  | { readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

async function fetchBytes(input: FetchBytesInput): Promise<FetchBytesResult> {
  let response: LoadGltfFromUriFetchResponse;

  try {
    response = await input.fetcher(input.url);
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code:
          input.context === "source"
            ? "loadGltfFromUri.fetchFailed"
            : "loadGltfFromUri.bufferFetchFailed",
        severity: "error",
        message: errorMessage(
          error,
          `Fetching glTF URI '${input.url}' failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: {
        code:
          input.context === "source"
            ? "loadGltfFromUri.httpError"
            : "loadGltfFromUri.bufferHttpError",
        severity: "error",
        status: response.status,
        statusText: response.statusText,
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
        message: `Fetching glTF URI '${input.url}' failed with HTTP ${response.status}.`,
      },
    };
  }

  try {
    return { ok: true, bytes: await response.arrayBuffer() };
  } catch (error) {
    return {
      ok: false,
      diagnostic: {
        code:
          input.context === "source"
            ? "loadGltfFromUri.readFailed"
            : "loadGltfFromUri.bufferReadFailed",
        severity: "error",
        message: errorMessage(
          error,
          `Reading glTF URI '${input.url}' response bytes failed.`,
        ),
        uri: input.url,
        ...(input.bufferIndex === undefined
          ? {}
          : { bufferIndex: input.bufferIndex }),
      },
    };
  }
}

type ParseGltfJsonResult =
  | { readonly ok: true; readonly root: Record<string, unknown> }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function parseGltfJson(url: string, bytes: ArrayBuffer): ParseGltfJsonResult {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return invalidJson(url, error);
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (!isRecord(parsed)) {
      return invalidJson(url, null);
    }

    return { ok: true, root: parsed };
  } catch (error) {
    return invalidJson(url, error);
  }
}

function invalidJson(
  url: string,
  error: unknown,
): { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic } {
  return {
    ok: false,
    diagnostic: {
      code: "loadGltfFromUri.invalidJson",
      severity: "error",
      uri: url,
      message: errorMessage(error, `glTF URI '${url}' did not contain JSON.`),
    },
  };
}

interface FetchExternalBuffersResult {
  readonly bytes: ReadonlyMap<number, ArrayBuffer>;
  readonly diagnostics: readonly LoadGltfFromUriDiagnostic[];
}

async function fetchExternalBuffers(input: {
  readonly root: Record<string, unknown>;
  readonly sourceUrl: string;
  readonly fetcher: LoadGltfFromUriFetch;
}): Promise<FetchExternalBuffersResult> {
  const buffers = Array.isArray(input.root.buffers) ? input.root.buffers : [];
  const sourceUrl = new URL(input.sourceUrl);
  const bytes = new Map<number, ArrayBuffer>();
  const diagnostics: LoadGltfFromUriDiagnostic[] = [];

  for (const [bufferIndex, buffer] of buffers.entries()) {
    if (!isRecord(buffer) || typeof buffer.uri !== "string") {
      continue;
    }

    const bufferUrl = resolveSameOriginBufferUrl({
      sourceUrl,
      uri: buffer.uri,
      bufferIndex,
    });

    if (!bufferUrl.ok) {
      diagnostics.push(bufferUrl.diagnostic);
      continue;
    }

    const fetched = await fetchBytes({
      url: bufferUrl.url,
      fetcher: input.fetcher,
      context: "buffer",
      bufferIndex,
    });

    if (!fetched.ok) {
      diagnostics.push(fetched.diagnostic);
      continue;
    }

    bytes.set(bufferIndex, fetched.bytes);
  }

  return { bytes, diagnostics };
}

type ResolveBufferUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

function resolveSameOriginBufferUrl(input: {
  readonly sourceUrl: URL;
  readonly uri: string;
  readonly bufferIndex: number;
}): ResolveBufferUrlResult {
  if (input.uri.startsWith("data:")) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} uses a data URI; this loader currently expects same-origin external buffer files.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(input.uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' is not same-origin with the glTF source.`,
      },
    };
  }

  return { ok: true, url: url.href };
}

function mergeExternalBufferBytes(
  provided: ReadonlyMap<number, ArrayBuffer | ArrayBufferView> | undefined,
  fetched: ReadonlyMap<number, ArrayBuffer>,
): ReadonlyMap<number, ArrayBuffer | ArrayBufferView> {
  if (provided === undefined || provided.size === 0) {
    return fetched;
  }

  const merged = new Map<number, ArrayBuffer | ArrayBufferView>(provided);

  for (const [bufferIndex, bytes] of fetched.entries()) {
    if (!merged.has(bufferIndex)) {
      merged.set(bufferIndex, bytes);
    }
  }

  return merged;
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
  diagnostic: LoadGltfFromUriDiagnostic,
  byteLength: number | null = null,
): LoadGltfFromUriReport {
  return {
    ok: false,
    url,
    byteLength,
    loader: null,
    diagnostics: [diagnostic],
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
