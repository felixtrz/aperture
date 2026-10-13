import type { LoadGltfFromUriCache, LoadGltfFromUriOptions, LoadGltfFromUriReport } from "./gltf-uri-loader-types.js";
export type * from "./gltf-uri-loader-types.js";
export declare function createGltfUriLoadCache(): LoadGltfFromUriCache;
export declare function loadGltfFromUri(url: string, options?: LoadGltfFromUriOptions): Promise<LoadGltfFromUriReport>;
//# sourceMappingURL=gltf-uri-loader.d.ts.map