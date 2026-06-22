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
