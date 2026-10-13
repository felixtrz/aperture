import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { typedGeometry } from "./scene.mjs";
import { createThreeGeometry } from "./three-geometry.mjs";

const bytes = (data) =>
  Buffer.from(data.buffer, data.byteOffset, data.byteLength);
const sha256 = (data) => createHash("sha256").update(bytes(data)).digest("hex");

/** Production CPU assets only. This never initializes a renderer or browser. */
export async function verifyGeometryBufferParity({
  workload,
  apertureRoot,
  threeRoot,
}) {
  const { createTriangleListMeshAsset } = await import(
    pathToFileURL(resolve(apertureRoot, "packages/render/dist/index.js"))
  );
  const THREE = await import(
    pathToFileURL(resolve(threeRoot, "build/three.webgpu.js"))
  );
  const geometries = [];
  for (const source of workload.geometries) {
    const canonical = typedGeometry(source),
      aperture = createTriangleListMeshAsset(canonical),
      three = createThreeGeometry(THREE, source),
      fields = {};
    try {
      for (const [semantic, attributeName, field, width] of [
        ["POSITION", "position", "positions", 3],
        ["NORMAL", "normal", "normals", 3],
        ["TEXCOORD_0", "uv", "uvs", 2],
      ]) {
        const stream = aperture.vertexStreams.find((entry) =>
          entry.attributes.some((attribute) => attribute.semantic === semantic),
        );
        const attribute = stream.attributes.find(
          (entry) => entry.semantic === semantic,
        );
        const packed = new Float32Array(canonical[field].length);
        const view = new DataView(
          stream.data.buffer,
          stream.data.byteOffset,
          stream.data.byteLength,
        );
        for (let i = 0; i < packed.length; i++)
          packed[i] = view.getFloat32(
            Math.floor(i / width) * stream.arrayStride +
              attribute.offset +
              (i % width) * 4,
            true,
          );
        const threeData = three.getAttribute(attributeName).array;
        if (
          !bytes(packed).equals(bytes(threeData)) ||
          !bytes(packed).equals(bytes(canonical[field]))
        )
          throw new Error(
            `Production geometry buffer mismatch: ${source.id}/${field}`,
          );
        fields[field] = {
          bytes: packed.byteLength,
          sha256: sha256(packed),
          status: "byte-identical-production-assets",
        };
      }
      if (
        !bytes(aperture.indexBuffer.data).equals(bytes(three.index.array)) ||
        !bytes(three.index.array).equals(bytes(canonical.indices))
      )
        throw new Error(`Production index buffer mismatch: ${source.id}`);
      fields.indices = {
        bytes: three.index.array.byteLength,
        sha256: sha256(three.index.array),
        type: three.index.array.constructor.name,
        status: "byte-identical-production-assets",
      };
      geometries.push({ id: source.id, fields });
    } finally {
      three.dispose();
    }
  }
  return {
    schema: "aperture.controlled-workload.production-buffer-parity.v1",
    status: "passed",
    geometries,
    limitation:
      "Checks actual production CPU asset arrays used by both adapters. Native upload, index use, transforms and submitted draw coverage still require run-v2 inspection.",
  };
}
