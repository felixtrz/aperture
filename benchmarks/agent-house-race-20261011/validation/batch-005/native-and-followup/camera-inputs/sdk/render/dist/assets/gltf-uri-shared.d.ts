export declare function mimeTypeFromImage(image: Record<string, unknown>, uri: string): string | null;
export declare function isSupportedImageMimeType(mimeType: string): boolean;
/**
 * Decode a base64 `data:` URI (e.g. `data:application/octet-stream;base64,…`)
 * into its raw bytes. Returns null when the URI is not a data URI, is not
 * base64-encoded, or carries an invalid payload.
 */
export declare function decodeDataUriBytes(uri: string): ArrayBuffer | null;
/** A data URI trimmed for diagnostics (payloads can be megabytes long). */
export declare function truncateUriForDiagnostic(uri: string): string;
export declare function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array;
export declare function normalizeUrl(url: string): string | null;
export declare function errorMessage(error: unknown, fallback: string): string;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
//# sourceMappingURL=gltf-uri-shared.d.ts.map