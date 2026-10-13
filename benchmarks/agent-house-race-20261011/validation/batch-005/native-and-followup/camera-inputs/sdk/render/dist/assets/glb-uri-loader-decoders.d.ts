import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
export declare function resolveDracoDecoder(input: {
    readonly root: Record<string, unknown> | null;
    readonly provided: DracoMeshDecoder | undefined;
    readonly create: (() => PromiseLike<DracoMeshDecoder>) | undefined;
}): Promise<DracoMeshDecoder | undefined>;
export declare function resolveMeshoptDecoder(input: {
    readonly root: Record<string, unknown> | null;
    readonly provided: MeshoptBufferDecoder | undefined;
    readonly create: (() => PromiseLike<MeshoptBufferDecoder>) | undefined;
}): Promise<MeshoptBufferDecoder | undefined>;
//# sourceMappingURL=glb-uri-loader-decoders.d.ts.map