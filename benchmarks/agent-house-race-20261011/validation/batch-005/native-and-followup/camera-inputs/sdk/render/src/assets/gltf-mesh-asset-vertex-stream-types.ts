import type { GltfDecodedAccessor } from "./gltf-accessor-decoding.js";

export interface GltfMeshAttributeSource {
  readonly decoded: GltfDecodedAccessor;
  readonly offset: number;
}
