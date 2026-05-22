export type HdrRgbeDiagnosticCode =
  | "hdrRgbe.invalidHeader"
  | "hdrRgbe.unsupportedFormat"
  | "hdrRgbe.invalidResolution"
  | "hdrRgbe.truncatedPixels"
  | "hdrRgbe.invalidScanline";

export interface HdrRgbeDiagnostic {
  readonly code: HdrRgbeDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
}

export interface HdrRgbeImage {
  readonly kind: "hdr-rgbe";
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
  readonly rgbe: Uint8Array;
  readonly header: string;
  readonly gamma: number;
  readonly exposure: number;
  readonly colorSpace: "linear";
  readonly format: "rgba32float";
}

export type ParseHdrRgbeReport = ParseHdrRgbeSuccess | ParseHdrRgbeFailure;

export interface ParseHdrRgbeSuccess {
  readonly ok: true;
  readonly image: HdrRgbeImage;
  readonly diagnostics: readonly [];
}

export interface ParseHdrRgbeFailure {
  readonly ok: false;
  readonly image: null;
  readonly diagnostics: readonly HdrRgbeDiagnostic[];
}

export type LoadHdrFromUriDiagnosticCode =
  | "loadHdrFromUri.invalidUrl"
  | "loadHdrFromUri.fetchUnavailable"
  | "loadHdrFromUri.fetchFailed"
  | "loadHdrFromUri.httpError"
  | "loadHdrFromUri.readFailed"
  | "loadHdrFromUri.parseDiagnostic";

export interface LoadHdrFromUriDiagnostic {
  readonly code: LoadHdrFromUriDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
  readonly parserCode?: HdrRgbeDiagnosticCode;
}

export interface LoadHdrFromUriFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export type LoadHdrFromUriFetch = (
  url: string,
) => Promise<LoadHdrFromUriFetchResponse>;

export interface LoadHdrFromUriOptions {
  readonly fetch?: LoadHdrFromUriFetch;
}

export interface LoadHdrFromUriReport {
  readonly ok: boolean;
  readonly url: string;
  readonly byteLength: number | null;
  readonly image: HdrRgbeImage | null;
  readonly diagnostics: readonly LoadHdrFromUriDiagnostic[];
}

interface HdrHeader {
  readonly text: string;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly gamma: number;
  readonly exposure: number;
  readonly dataOffset: number;
}

class ByteLineReader {
  #offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get offset(): number {
    return this.#offset;
  }

  readLine(): string | null {
    if (this.#offset >= this.bytes.length) {
      return null;
    }

    const start = this.#offset;
    let end = start;

    while (end < this.bytes.length && this.bytes[end] !== 0x0a) {
      end += 1;
    }

    this.#offset = end < this.bytes.length ? end + 1 : end;

    if (end > start && this.bytes[end - 1] === 0x0d) {
      end -= 1;
    }

    return new TextDecoder("ascii").decode(this.bytes.subarray(start, end));
  }
}

export function parseHdrRgbe(
  source: ArrayBuffer | Uint8Array,
): ParseHdrRgbeReport {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const header = readHdrHeader(bytes);

  if (!header.ok) {
    return header;
  }

  const rgbe = readHdrPixels(bytes.subarray(header.header.dataOffset), {
    width: header.header.width,
    height: header.header.height,
  });

  if (!rgbe.ok) {
    return rgbe;
  }

  return {
    ok: true,
    image: {
      kind: "hdr-rgbe",
      width: header.header.width,
      height: header.header.height,
      data: rgbeToFloatRgba(rgbe.pixels),
      rgbe: rgbe.pixels,
      header: header.header.text,
      gamma: header.header.gamma,
      exposure: header.header.exposure,
      colorSpace: "linear",
      format: "rgba32float",
    },
    diagnostics: [],
  };
}

export async function loadHdrFromUri(
  url: string,
  options: LoadHdrFromUriOptions = {},
): Promise<LoadHdrFromUriReport> {
  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl === null) {
    return loadFailure(url, {
      code: "loadHdrFromUri.invalidUrl",
      severity: "error",
      message: `HDR URI '${url}' is not a valid absolute URL.`,
    });
  }

  const fetcher =
    options.fetch ??
    (globalThis.fetch === undefined
      ? undefined
      : (requestUrl: string) => globalThis.fetch(requestUrl));

  if (fetcher === undefined) {
    return loadFailure(normalizedUrl, {
      code: "loadHdrFromUri.fetchUnavailable",
      severity: "error",
      message:
        "HDR URI loading requires globalThis.fetch or an explicit fetch option.",
    });
  }

  let response: LoadHdrFromUriFetchResponse;

  try {
    response = await fetcher(normalizedUrl);
  } catch (error) {
    return loadFailure(normalizedUrl, {
      code: "loadHdrFromUri.fetchFailed",
      severity: "error",
      message: errorMessage(
        error,
        `Fetching HDR URI '${normalizedUrl}' failed.`,
      ),
    });
  }

  if (!response.ok) {
    return loadFailure(normalizedUrl, {
      code: "loadHdrFromUri.httpError",
      severity: "error",
      status: response.status,
      statusText: response.statusText,
      message: `Fetching HDR URI '${normalizedUrl}' failed with HTTP ${response.status}.`,
    });
  }

  let bytes: ArrayBuffer;

  try {
    bytes = await response.arrayBuffer();
  } catch (error) {
    return loadFailure(normalizedUrl, {
      code: "loadHdrFromUri.readFailed",
      severity: "error",
      message: errorMessage(
        error,
        `Reading HDR URI '${normalizedUrl}' response bytes failed.`,
      ),
    });
  }

  const parsed = parseHdrRgbe(bytes);

  return {
    ok: parsed.ok,
    url: normalizedUrl,
    byteLength: bytes.byteLength,
    image: parsed.image,
    diagnostics: parsed.diagnostics.map((diagnostic) => ({
      code: "loadHdrFromUri.parseDiagnostic",
      severity: "error",
      parserCode: diagnostic.code,
      message: diagnostic.message,
    })),
  };
}

function readHdrHeader(
  bytes: Uint8Array,
): { readonly ok: true; readonly header: HdrHeader } | ParseHdrRgbeFailure {
  const reader = new ByteLineReader(bytes);
  const firstLine = reader.readLine();

  if (firstLine === null || !firstLine.startsWith("#?")) {
    return parseFailure(
      "hdrRgbe.invalidHeader",
      "Radiance HDR data must start with a '#?' magic header.",
    );
  }

  const headerLines = [firstLine];
  let format = "";
  let gamma = 1;
  let exposure = 1;
  let resolutionLine: string | null | undefined;

  for (;;) {
    const line = reader.readLine();

    if (line === null) {
      return parseFailure(
        "hdrRgbe.invalidResolution",
        "Radiance HDR header ended before a resolution line.",
      );
    }

    headerLines.push(line);

    if (line.length === 0) {
      resolutionLine = reader.readLine();

      if (resolutionLine !== null) {
        headerLines.push(resolutionLine);
      }

      break;
    }

    const equals = line.indexOf("=");

    if (equals === -1) {
      continue;
    }

    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();

    if (key === "FORMAT") {
      format = value;
    } else if (key === "GAMMA") {
      gamma = finitePositiveNumber(value, 1);
    } else if (key === "EXPOSURE") {
      exposure = finitePositiveNumber(value, 1);
    }
  }

  if (format !== "32-bit_rle_rgbe") {
    return parseFailure(
      "hdrRgbe.unsupportedFormat",
      `Radiance HDR FORMAT must be '32-bit_rle_rgbe', not '${format || "missing"}'.`,
    );
  }

  if (resolutionLine === undefined || resolutionLine === null) {
    return parseFailure(
      "hdrRgbe.invalidResolution",
      "Radiance HDR header is missing a resolution line.",
    );
  }

  const resolution = /^([+-]Y)\s+(\d+)\s+([+-]X)\s+(\d+)$/u.exec(
    resolutionLine,
  );

  if (resolution === null) {
    return parseFailure(
      "hdrRgbe.invalidResolution",
      `Radiance HDR resolution '${resolutionLine}' is not supported.`,
    );
  }

  const height = Number(resolution[2]!);
  const width = Number(resolution[4]!);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return parseFailure(
      "hdrRgbe.invalidResolution",
      `Radiance HDR resolution '${resolutionLine}' must contain positive dimensions.`,
    );
  }

  return {
    ok: true,
    header: {
      text: `${headerLines.join("\n")}\n`,
      format,
      width,
      height,
      gamma,
      exposure,
      dataOffset: reader.offset,
    },
  };
}

function readHdrPixels(
  bytes: Uint8Array,
  dimensions: { readonly width: number; readonly height: number },
): { readonly ok: true; readonly pixels: Uint8Array } | ParseHdrRgbeFailure {
  const { width, height } = dimensions;

  if (width < 8 || width > 0x7fff || bytes.length < 4) {
    return readFlatPixels(bytes, dimensions);
  }

  if (bytes[0] !== 2 || bytes[1] !== 2 || (bytes[2]! & 0x80) !== 0) {
    return readFlatPixels(bytes, dimensions);
  }

  const pixels = new Uint8Array(width * height * 4);
  const scanline = new Uint8Array(width * 4);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    if (sourceOffset + 4 > bytes.length) {
      return parseFailure(
        "hdrRgbe.truncatedPixels",
        "Radiance HDR data ended before a scanline header.",
      );
    }

    if (
      bytes[sourceOffset] !== 2 ||
      bytes[sourceOffset + 1] !== 2 ||
      ((bytes[sourceOffset + 2]! << 8) | bytes[sourceOffset + 3]!) !== width
    ) {
      return parseFailure(
        "hdrRgbe.invalidScanline",
        "Radiance HDR RLE scanline header does not match image width.",
      );
    }

    sourceOffset += 4;

    for (let channel = 0; channel < 4; channel += 1) {
      let x = 0;

      while (x < width) {
        if (sourceOffset >= bytes.length) {
          return parseFailure(
            "hdrRgbe.truncatedPixels",
            "Radiance HDR data ended during RLE scanline decoding.",
          );
        }

        let count = bytes[sourceOffset]!;
        sourceOffset += 1;

        if (count > 128) {
          count -= 128;

          if (
            count === 0 ||
            x + count > width ||
            sourceOffset >= bytes.length
          ) {
            return parseFailure(
              "hdrRgbe.invalidScanline",
              "Radiance HDR RLE run length is invalid.",
            );
          }

          const value = bytes[sourceOffset]!;
          sourceOffset += 1;
          scanline.fill(
            value,
            channel * width + x,
            channel * width + x + count,
          );
          x += count;
        } else {
          if (
            count === 0 ||
            x + count > width ||
            sourceOffset + count > bytes.length
          ) {
            return parseFailure(
              "hdrRgbe.invalidScanline",
              "Radiance HDR RLE literal length is invalid.",
            );
          }

          scanline.set(
            bytes.subarray(sourceOffset, sourceOffset + count),
            channel * width + x,
          );
          sourceOffset += count;
          x += count;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      const destination = (y * width + x) * 4;

      pixels[destination] = scanline[x]!;
      pixels[destination + 1] = scanline[width + x]!;
      pixels[destination + 2] = scanline[width * 2 + x]!;
      pixels[destination + 3] = scanline[width * 3 + x]!;
    }
  }

  return { ok: true, pixels };
}

function readFlatPixels(
  bytes: Uint8Array,
  dimensions: { readonly width: number; readonly height: number },
): { readonly ok: true; readonly pixels: Uint8Array } | ParseHdrRgbeFailure {
  const byteLength = dimensions.width * dimensions.height * 4;

  if (bytes.length < byteLength) {
    return parseFailure(
      "hdrRgbe.truncatedPixels",
      `Radiance HDR data ended before ${byteLength} flat RGBE pixel byte(s).`,
    );
  }

  return { ok: true, pixels: bytes.slice(0, byteLength) };
}

function rgbeToFloatRgba(rgbe: Uint8Array): Float32Array {
  const floats = new Float32Array(rgbe.length);

  for (let source = 0; source < rgbe.length; source += 4) {
    const destination = source;
    const exponent = rgbe[source + 3]!;

    if (exponent === 0) {
      floats[destination] = 0;
      floats[destination + 1] = 0;
      floats[destination + 2] = 0;
      floats[destination + 3] = 1;
      continue;
    }

    const scale = Math.pow(2, exponent - 128) / 255;

    floats[destination] = rgbe[source]! * scale;
    floats[destination + 1] = rgbe[source + 1]! * scale;
    floats[destination + 2] = rgbe[source + 2]! * scale;
    floats[destination + 3] = 1;
  }

  return floats;
}

function finitePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFailure(
  code: HdrRgbeDiagnosticCode,
  message: string,
): ParseHdrRgbeFailure {
  return {
    ok: false,
    image: null,
    diagnostics: [{ code, severity: "error", message }],
  };
}

function normalizeUrl(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

function loadFailure(
  url: string,
  diagnostic: LoadHdrFromUriDiagnostic,
): LoadHdrFromUriReport {
  return {
    ok: false,
    url,
    byteLength: null,
    image: null,
    diagnostics: [diagnostic],
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
