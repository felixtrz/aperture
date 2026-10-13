import type { LoadGlbFromUriDiagnostic, LoadGlbFromUriFetchResponse } from "./glb-uri-loader.js";
import type { FetchBytesInput } from "./glb-uri-fetch-byte-types.js";
export declare function fetchFailedDiagnostic(input: FetchBytesInput, error: unknown): LoadGlbFromUriDiagnostic;
export declare function httpErrorDiagnostic(input: FetchBytesInput, response: Pick<LoadGlbFromUriFetchResponse, "status" | "statusText">): LoadGlbFromUriDiagnostic;
export declare function readFailedDiagnostic(input: FetchBytesInput, error: unknown): LoadGlbFromUriDiagnostic;
export declare function diagnosticForFetchInput(diagnostic: LoadGlbFromUriDiagnostic, input: FetchBytesInput): LoadGlbFromUriDiagnostic;
export declare function fetchIndexFields(input: Pick<FetchBytesInput, "bufferIndex" | "imageIndex">): Pick<LoadGlbFromUriDiagnostic, "bufferIndex" | "imageIndex">;
//# sourceMappingURL=glb-uri-fetch-byte-diagnostics.d.ts.map