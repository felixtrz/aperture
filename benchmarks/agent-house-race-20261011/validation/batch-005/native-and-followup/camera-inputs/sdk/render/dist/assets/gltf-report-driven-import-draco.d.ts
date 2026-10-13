import type { GltfAccessorDecodingReport } from "./gltf-accessor-decoding.js";
import { type DracoMeshDecoder } from "./draco-decoder.js";
import type { GltfMeshPrimitiveMappingReport } from "./gltf-mesh-primitive.js";
export declare function decodeGltfDracoPrimitiveAccessors(input: {
    readonly root: unknown;
    readonly primitiveReport: GltfMeshPrimitiveMappingReport;
    readonly decoder: DracoMeshDecoder | undefined;
    readonly resolveBufferBytes: (bufferIndex: number) => ArrayBuffer | ArrayBufferView | null | undefined;
}): GltfAccessorDecodingReport;
//# sourceMappingURL=gltf-report-driven-import-draco.d.ts.map