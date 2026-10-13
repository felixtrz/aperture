import type {
  DracoAttribute,
  DracoAttributeDecodeRequest,
  DracoDecodedMeshAttribute,
  DracoDecoderApi,
  DracoMesh,
  DracoModule,
} from "./draco-types.js";
import {
  arrayConstructorForDataType,
  dataTypeName,
  dracoAttributeKindValue,
  dracoDataTypeValue,
  typedArrayFromHeap,
} from "./draco-mesh-attribute-types.js";

export function decodeAttributes(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
  requests: readonly DracoAttributeDecodeRequest[],
): DracoDecodedMeshAttribute[] {
  const attributes: DracoDecodedMeshAttribute[] = [];

  for (const request of requests) {
    const attribute = resolveAttribute(draco, decoder, mesh, request);
    if (attribute === null || attribute.ptr === 0) {
      continue;
    }

    attributes.push(
      decodeAttribute(
        draco,
        decoder,
        mesh,
        attribute,
        request.semantic,
        request,
      ),
    );
  }

  if (attributes.length === 0) {
    throw new Error("Draco mesh did not contain any requested attributes.");
  }

  return attributes;
}

function resolveAttribute(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
  request: DracoAttributeDecodeRequest,
): DracoAttribute | null {
  if (request.uniqueId !== undefined) {
    return decoder.GetAttributeByUniqueId(mesh, request.uniqueId);
  }

  if (request.attribute === undefined) {
    throw new Error(
      `Draco attribute request '${request.semantic}' must include uniqueId or attribute.`,
    );
  }

  const attributeId = decoder.GetAttributeId(
    mesh,
    dracoAttributeKindValue(draco, request.attribute),
  );
  return attributeId < 0 ? null : decoder.GetAttribute(mesh, attributeId);
}

function decodeAttribute(
  draco: DracoModule,
  decoder: DracoDecoderApi,
  mesh: DracoMesh,
  attribute: DracoAttribute,
  semantic: string,
  request: DracoAttributeDecodeRequest,
): DracoDecodedMeshAttribute {
  const itemSize = attribute.num_components();
  const dataType = request.output ?? dataTypeName(draco, attribute.data_type());
  const typedArray = arrayConstructorForDataType(dataType);
  const byteLength =
    mesh.num_points() * itemSize * typedArray.BYTES_PER_ELEMENT;
  const pointer = draco._malloc(byteLength);

  try {
    const ok = decoder.GetAttributeDataArrayForAllPoints(
      mesh,
      attribute,
      dracoDataTypeValue(draco, dataType),
      byteLength,
      pointer,
    );
    if (!ok) {
      throw new Error(`Draco attribute '${semantic}' decode failed.`);
    }

    return {
      semantic,
      uniqueId: attribute.unique_id(),
      itemSize,
      dataType,
      array: typedArrayFromHeap(draco, dataType, pointer, byteLength),
    };
  } finally {
    draco._free(pointer);
  }
}
