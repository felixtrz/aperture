export type MeshoptDecodeMode = "ATTRIBUTES" | "TRIANGLES" | "INDICES";

export type MeshoptDecodeFilter =
  | "NONE"
  | "OCTAHEDRAL"
  | "QUATERNION"
  | "EXPONENTIAL"
  | "COLOR";

export interface MeshoptDecoderSource {
  readonly jsSource?: string;
  readonly jsUrl?: string;
  readonly fetchText?: (url: string) => PromiseLike<string>;
}

export interface MeshoptGltfBufferDecodeOptions {
  readonly count: number;
  readonly byteStride: number;
  readonly mode: MeshoptDecodeMode;
  readonly filter?: MeshoptDecodeFilter;
}

export interface MeshoptBufferDecoder {
  readonly decodeGltfBuffer: (
    source: ArrayBuffer | ArrayBufferView,
    options: MeshoptGltfBufferDecodeOptions,
  ) => Uint8Array;
}

interface MeshoptModule {
  readonly ready: PromiseLike<unknown>;
  readonly supported: boolean;
  readonly decodeGltfBuffer: (
    target: Uint8Array,
    count: number,
    byteStride: number,
    source: Uint8Array,
    mode: MeshoptDecodeMode,
    filter: MeshoptDecodeFilter,
  ) => void;
}

type MeshoptModuleFactory = () => MeshoptModule;

export async function createMeshoptDecoder(
  source: MeshoptDecoderSource,
): Promise<MeshoptBufferDecoder> {
  const jsSource = await resolveMeshoptJsSource(source);
  const module = compileMeshoptFactory(jsSource)();

  if (!module.supported) {
    throw new Error("Meshopt decoder requires WebAssembly support.");
  }
  if (typeof module.decodeGltfBuffer !== "function") {
    throw new Error("Meshopt decoder did not expose decodeGltfBuffer().");
  }

  await module.ready;

  return {
    decodeGltfBuffer(sourceBytes, options) {
      const count = positiveInteger(options.count, "count");
      const byteStride = positiveInteger(options.byteStride, "byteStride");
      const bytes = bytesView(sourceBytes);
      const target = new Uint8Array(count * byteStride);

      module.decodeGltfBuffer(
        target,
        count,
        byteStride,
        bytes,
        options.mode,
        options.filter ?? "NONE",
      );

      return target;
    },
  };
}

async function resolveMeshoptJsSource(
  source: MeshoptDecoderSource,
): Promise<string> {
  if (source.jsSource !== undefined) {
    return source.jsSource;
  }

  if (source.jsUrl === undefined) {
    throw new Error("Meshopt decoder requires jsSource or jsUrl.");
  }

  const fetcher = source.fetchText ?? defaultFetchText;
  return fetcher(source.jsUrl).then((text) => String(text));
}

function compileMeshoptFactory(jsSource: string): MeshoptModuleFactory {
  const factoryBody = `${stripMeshoptExport(jsSource)}\nreturn MeshoptDecoder;`;
  const factory = Function(factoryBody)();

  if (!isMeshoptModule(factory)) {
    throw new Error("Meshopt JS source did not expose MeshoptDecoder.");
  }

  return () => factory;
}

function stripMeshoptExport(jsSource: string): string {
  return jsSource.replace(/export\s*\{\s*MeshoptDecoder\s*\};?\s*$/u, "");
}

async function defaultFetchText(url: string): Promise<string> {
  if (globalThis.fetch === undefined) {
    throw new Error("No fetch implementation is available for Meshopt JS.");
  }

  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Fetching Meshopt JS failed with HTTP ${response.status}.`);
  }

  return response.text();
}

function bytesView(source: ArrayBuffer | ArrayBufferView): Uint8Array {
  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Meshopt decode ${field} must be a positive integer.`);
  }

  return value;
}

function isMeshoptModule(value: unknown): value is MeshoptModule {
  return (
    isRecord(value) &&
    typeof value.supported === "boolean" &&
    typeof value.ready === "object" &&
    typeof value.decodeGltfBuffer === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
