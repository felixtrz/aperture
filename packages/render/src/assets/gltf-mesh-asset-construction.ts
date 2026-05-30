import type { GltfDecodedPrimitiveAccessors } from "./gltf-accessor-decoding.js";
import type { MeshAsset, MeshMorphTargetData } from "../mesh/index.js";
import type {
  GltfMeshAssetConstructionDiagnostic,
  GltfMeshAssetConstructionOptions,
  GltfMeshAssetConstructionReport,
  GltfMeshAssetTangentGenerationRequest,
  GltfPlannedMeshSourceAsset,
} from "./gltf-mesh-asset-construction-types.js";
import { collectGltfMeshAttributeSources } from "./gltf-mesh-asset-construction-attributes.js";
import {
  createGltfMeshAssetDiagnostic,
  gltfMeshAssetIdFromRegisteredHandleKey,
  gltfMeshPrimitiveRequestKey,
} from "./gltf-mesh-asset-construction-diagnostics.js";
import {
  createGltfMeshMorphTargetDescriptors,
  createGltfMeshSkinningSchema,
} from "./gltf-mesh-asset-construction-schema.js";
import {
  computeGltfMeshBounds,
  createGltfMeshIndexBuffer,
} from "./gltf-mesh-asset-construction-validation.js";
import { createVertexStreams } from "./gltf-mesh-asset-vertex-streams.js";

export type {
  GltfMeshAssetConstructionArrayJsonSummary,
  GltfMeshAssetConstructionDiagnostic,
  GltfMeshAssetConstructionIndexBufferJsonSummary,
  GltfMeshAssetConstructionMeshJsonSummary,
  GltfMeshAssetConstructionOptions,
  GltfMeshAssetConstructionReport,
  GltfMeshAssetConstructionReportJsonValue,
  GltfMeshAssetConstructionVertexStreamJsonSummary,
  GltfMeshAssetTangentGenerationReason,
  GltfMeshAssetTangentGenerationRequest,
  GltfPlannedMeshSourceAsset,
  GltfPlannedMeshSourceAssetJsonValue,
} from "./gltf-mesh-asset-construction-types.js";
export {
  gltfMeshAssetConstructionReportToJson,
  gltfMeshAssetConstructionReportToJsonValue,
} from "./gltf-mesh-asset-construction-report.js";

export function createMeshAssetsFromGltfDecodedAccessors(
  options: GltfMeshAssetConstructionOptions,
): GltfMeshAssetConstructionReport {
  const diagnostics: GltfMeshAssetConstructionDiagnostic[] = [];
  const meshes: GltfPlannedMeshSourceAsset[] = [];
  const tangentRequests = new Map(
    (options.generateMissingTangentsFor ?? []).map((request) => [
      gltfMeshPrimitiveRequestKey(request.meshIndex, request.primitiveIndex),
      request,
    ]),
  );

  for (const primitive of options.decodedReport.primitives) {
    const mesh = createMeshAssetFromPrimitive(
      primitive,
      diagnostics,
      tangentRequests.get(
        gltfMeshPrimitiveRequestKey(
          primitive.meshIndex,
          primitive.primitiveIndex,
        ),
      ),
      options.morphTargetDataFor?.get(
        gltfMeshPrimitiveRequestKey(
          primitive.meshIndex,
          primitive.primitiveIndex,
        ),
      ),
    );
    meshes.push({
      handleKey: gltfMeshAssetIdFromRegisteredHandleKey(
        primitive.meshHandleKey,
      ),
      registeredHandleKey: primitive.meshHandleKey,
      meshIndex: primitive.meshIndex,
      primitiveIndex: primitive.primitiveIndex,
      mesh,
    });
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    meshes,
    diagnostics,
  };
}

function createMeshAssetFromPrimitive(
  primitive: GltfDecodedPrimitiveAccessors,
  diagnostics: GltfMeshAssetConstructionDiagnostic[],
  tangentRequest: GltfMeshAssetTangentGenerationRequest | undefined,
  morphTargetData: MeshMorphTargetData | undefined,
): MeshAsset | null {
  const position = primitive.attributes.find(
    (attribute) => attribute.semantic === "POSITION",
  );
  if (position === undefined || !(position.array instanceof Float32Array)) {
    diagnostics.push(
      createGltfMeshAssetDiagnostic(
        primitive,
        "gltfMeshAsset.missingPosition",
        {
          semantic: "POSITION",
          message: `Primitive '${primitive.meshHandleKey}' cannot construct a MeshAsset without decoded POSITION data.`,
        },
      ),
    );
    return null;
  }

  const attributes = collectGltfMeshAttributeSources(
    primitive,
    position,
    diagnostics,
    tangentRequest,
  );
  if (attributes === null) {
    return null;
  }

  const vertexStreams = createVertexStreams(primitive.vertexCount, attributes);
  const indices = createGltfMeshIndexBuffer(primitive, diagnostics);
  if (indices === null && primitive.indices !== null) {
    return null;
  }

  const bounds = computeGltfMeshBounds(position, primitive, diagnostics);
  if (bounds === null) {
    return null;
  }
  const descriptors = vertexStreams.flatMap((stream) => stream.attributes);
  const skinning = createGltfMeshSkinningSchema(descriptors);
  const morphTargets = createGltfMeshMorphTargetDescriptors(descriptors);

  return {
    kind: "mesh",
    label: primitive.meshHandleKey,
    vertexStreams,
    ...(indices === null ? {} : { indexBuffer: indices }),
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: primitive.vertexCount,
        indexStart: 0,
        indexCount: indices?.indexCount ?? indices?.data.length ?? 0,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
    ...(skinning === null ? {} : { skinning }),
    ...(morphTargets.length === 0 ? {} : { morphTargets }),
    ...(morphTargetData === undefined ? {} : { morphTargetData }),
  };
}
