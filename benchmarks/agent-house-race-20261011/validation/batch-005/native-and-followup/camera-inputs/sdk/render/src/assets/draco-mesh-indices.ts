import type {
  DracoDecodedIndexArray,
  DracoDecoderApi,
  DracoMesh,
  DracoModule,
} from "./draco-types.js";

export function decodeIndices(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
): DracoDecodedIndexArray {
  const indexCount = mesh.num_faces() * 3;
  const useUint16 = mesh.num_points() <= 0xffff;
  const byteLength = indexCount * (useUint16 ? 2 : 4);
  const pointer = draco._malloc(byteLength);

  try {
    const ok = useUint16
      ? decoder.GetTrianglesUInt16Array(mesh, byteLength, pointer)
      : decoder.GetTrianglesUInt32Array(mesh, byteLength, pointer);
    if (!ok) {
      throw new Error("Draco index decode failed.");
    }

    return useUint16
      ? new Uint16Array(draco.HEAPU16.buffer, pointer, indexCount).slice()
      : new Uint32Array(draco.HEAPU32.buffer, pointer, indexCount).slice();
  } finally {
    draco._free(pointer);
  }
}
