import type { LoadGlbFromUriCache, LoadGlbFromUriOptions, LoadGlbFromUriReport } from "./glb-uri-loader-types.js";
export type * from "./glb-uri-loader-types.js";
export declare function createGlbUriLoadCache(): LoadGlbFromUriCache;
export declare function loadGlbFromUri(url: string, options?: LoadGlbFromUriOptions): Promise<LoadGlbFromUriReport>;
//# sourceMappingURL=glb-uri-loader.d.ts.map