export function mimeTypeFromImage(
  image: Record<string, unknown>,
  uri: string,
): string | null {
  const mimeType =
    typeof image.mimeType === "string" ? image.mimeType : mimeTypeFromUri(uri);

  return mimeType !== null && isSupportedImageMimeType(mimeType)
    ? mimeType
    : null;
}

function mimeTypeFromUri(uri: string): string | null {
  const dataPrefix = uri.match(/^data:([^;,]+)[;,]/u);
  if (dataPrefix?.[1] !== undefined) {
    return dataPrefix[1];
  }

  let pathname: string;

  try {
    pathname = new URL(uri, "https://example.invalid/").pathname;
  } catch {
    pathname = uri;
  }

  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".ktx2")) {
    return "image/ktx2";
  }
  return null;
}

export function isSupportedImageMimeType(mimeType: string): boolean {
  return (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/ktx2"
  );
}

// Dependency-free base64 decode: the glTF loader runs in pure Node (headless
// asset loading) and in the browser, so it cannot rely on `Buffer` or `atob`.
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP: Readonly<Record<string, number>> = Object.fromEntries(
  [...BASE64_ALPHABET].map((char, index) => [char, index]),
);

/**
 * Decode a base64 `data:` URI (e.g. `data:application/octet-stream;base64,…`)
 * into its raw bytes. Returns null when the URI is not a data URI, is not
 * base64-encoded, or carries an invalid payload.
 */
export function decodeDataUriBytes(uri: string): ArrayBuffer | null {
  const match = uri.match(/^data:([^,]*),/u);
  if (match === null) {
    return null;
  }

  const metadata = match[1] ?? "";
  if (!metadata.split(";").includes("base64")) {
    return null;
  }

  const payload = uri.slice(match[0].length).replace(/=+$/u, "");
  const bytes = new Uint8Array(Math.floor((payload.length * 6) / 8));
  let bitBuffer = 0;
  let bitCount = 0;
  let writeIndex = 0;

  for (const char of payload) {
    const sextet = BASE64_LOOKUP[char];
    if (sextet === undefined) {
      return null;
    }

    bitBuffer = (bitBuffer << 6) | sextet;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[writeIndex] = (bitBuffer >> bitCount) & 0xff;
      writeIndex += 1;
    }
  }

  return bytes.buffer;
}

/** A data URI trimmed for diagnostics (payloads can be megabytes long). */
export function truncateUriForDiagnostic(uri: string): string {
  return uri.length > 64 ? `${uri.slice(0, 64)}…` : uri;
}

export function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  return bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function normalizeUrl(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
