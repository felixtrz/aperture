import type {
  HdrRgbeDiagnosticCode,
  ParseHdrRgbeFailure,
} from "./hdr-rgbe-types.js";

export function parseFailure(
  code: HdrRgbeDiagnosticCode,
  message: string,
): ParseHdrRgbeFailure {
  return {
    ok: false,
    image: null,
    diagnostics: [{ code, severity: "error", message }],
  };
}
