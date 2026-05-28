import type {
  GltfDecodedAccessor,
  GltfDecodedPrimitiveAccessors,
} from "./gltf-accessor-decoding.js";
import type {
  GltfMeshAssetConstructionDiagnostic,
  GltfMeshAssetTangentGenerationRequest,
} from "./gltf-mesh-asset-construction-types.js";
import { createGltfMeshAssetDiagnostic } from "./gltf-mesh-asset-construction-diagnostics.js";
import { generateMissingTangents } from "./gltf-mesh-tangents.js";
import {
  decodedAttributeByteSize,
  isSupportedMeshAttributeArray,
  type GltfMeshAttributeSource,
} from "./gltf-mesh-asset-vertex-streams.js";

export function collectGltfMeshAttributeSources(
  primitive: GltfDecodedPrimitiveAccessors,
  position: GltfDecodedAccessor,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
  tangentRequest: GltfMeshAssetTangentGenerationRequest | undefined,
): readonly GltfMeshAttributeSource[] | null {
  const sources: GltfMeshAttributeSource[] = [{ decoded: position, offset: 0 }];
  let offset = decodedAttributeByteSize(position);
  const decodedBySemantic = new Map(
    primitive.attributes.map((attribute) => [attribute.semantic, attribute]),
  );

  if (tangentRequest !== undefined && !decodedBySemantic.has("TANGENT")) {
    const generated = generateMissingTangents(
      primitive,
      position,
      decodedBySemantic.get("NORMAL"),
      decodedBySemantic.get("TEXCOORD_0"),
      diagnostics,
      tangentRequest,
    );

    if (generated !== null) {
      decodedBySemantic.set("TANGENT", generated);
    }
  }

  for (const semantic of [
    "NORMAL",
    "TEXCOORD_0",
    "JOINTS_0",
    "WEIGHTS_0",
    "MORPH_POSITION_0",
    "MORPH_NORMAL_0",
    "MORPH_POSITION_1",
    "MORPH_NORMAL_1",
    "TANGENT",
    "TEXCOORD_1",
    "COLOR_0",
  ] as const) {
    const decoded =
      decodedBySemantic.get(semantic) ??
      createZeroMorphAccessor(semantic, primitive, decodedBySemantic);
    if (decoded === undefined) {
      continue;
    }

    const count = decoded.array.length / decoded.itemSize;
    if (
      count !== primitive.vertexCount ||
      !isSupportedMeshAttributeArray(decoded)
    ) {
      diagnostics.push(
        createGltfMeshAssetDiagnostic(
          primitive,
          "gltfMeshAsset.mismatchedAttributeCount",
          {
            semantic,
            vertexCount: primitive.vertexCount,
            message: `Primitive '${primitive.meshHandleKey}' ${semantic} attribute count does not match POSITION vertex count.`,
          },
        ),
      );
      return null;
    }

    sources.push({ decoded, offset });
    offset += decodedAttributeByteSize(decoded);
  }

  return sources;
}

function createZeroMorphAccessor(
  semantic: string,
  primitive: GltfDecodedPrimitiveAccessors,
  decodedBySemantic: ReadonlyMap<string, GltfDecodedAccessor>,
): GltfDecodedAccessor | undefined {
  const requiredByPosition =
    semantic === "MORPH_NORMAL_0"
      ? decodedBySemantic.has("MORPH_POSITION_0")
      : semantic === "MORPH_POSITION_1" || semantic === "MORPH_NORMAL_1"
        ? decodedBySemantic.has("MORPH_POSITION_0")
        : false;

  if (!requiredByPosition) {
    return undefined;
  }

  return {
    semantic: semantic as GltfDecodedAccessor["semantic"],
    accessorIndex: -1,
    bufferIndex: -1,
    sourceByteOffset: 0,
    sourceByteLength: 0,
    expectedFormat: "float32x3",
    itemSize: 3,
    array: new Float32Array(primitive.vertexCount * 3),
  };
}
