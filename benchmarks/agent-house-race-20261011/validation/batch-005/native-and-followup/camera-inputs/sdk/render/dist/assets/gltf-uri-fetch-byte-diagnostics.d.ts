import type { LoadGltfFromUriDiagnostic, LoadGltfFromUriFetchResponse } from "./gltf-uri-loader.js";
import type { FetchBytesInput } from "./gltf-uri-fetch-byte-types.js";
export declare function fetchFailedDiagnostic(input: FetchBytesInput, error: unknown): LoadGltfFromUriDiagnostic;
export declare function httpErrorDiagnostic(input: FetchBytesInput, response: Pick<LoadGltfFromUriFetchResponse, "status" | "statusText">): LoadGltfFromUriDiagnostic;
export declare function readFailedDiagnostic(input: FetchBytesInput, error: unknown): LoadGltfFromUriDiagnostic;
export declare function diagnosticForFetchInput(diagnostic: LoadGltfFromUriDiagnostic, input: FetchBytesInput): LoadGltfFromUriDiagnostic;
//# sourceMappingURL=gltf-uri-fetch-byte-diagnostics.d.ts.map