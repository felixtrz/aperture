import type { LoadGltfFromUriDiagnostic } from "./gltf-uri-loader.js";
export type ParseGltfJsonResult = {
    readonly ok: true;
    readonly root: Record<string, unknown>;
} | {
    readonly ok: false;
    readonly diagnostic: LoadGltfFromUriDiagnostic;
};
export declare function parseGltfJson(url: string, bytes: ArrayBuffer): ParseGltfJsonResult;
//# sourceMappingURL=gltf-uri-json.d.ts.map