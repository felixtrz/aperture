import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type { LoadGlbFromUriExternalImageSourceKind } from "./glb-uri-loader.js";
export type ImageSourceRefResult = {
    readonly ok: true;
    readonly source: GltfImageSourceRef;
} | {
    readonly ok: false;
    readonly message: string;
};
export declare function imageSourceRefFromImage(image: Record<string, unknown>): ImageSourceRefResult;
export declare function externalImageSourceKind(source: GltfImageSourceRef): LoadGlbFromUriExternalImageSourceKind;
export declare function imageStatusUri(source: GltfImageSourceRef): string;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
//# sourceMappingURL=glb-uri-image-sources.d.ts.map