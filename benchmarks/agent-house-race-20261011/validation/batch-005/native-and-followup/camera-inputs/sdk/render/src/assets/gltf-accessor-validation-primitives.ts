import type {
  GltfMeshPrimitiveAttributeReference,
  GltfMeshPrimitiveIndexReference,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive.js";
import { validateGltfAccessorReference } from "./gltf-accessor-validation-accessors.js";
import type {
  GltfAccessorValidationContext,
  GltfPrimitiveAccessorPlan,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation-types.js";

export function validateGltfPrimitiveAccessorPlan(
  context: GltfAccessorValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
): GltfPrimitiveAccessorPlan | null {
  if (primitive.compression !== null) {
    return null;
  }

  const diagnosticsBefore = context.diagnostics.length;
  const attributes: GltfValidatedAccessorReference[] = [];

  appendAttribute(
    context,
    primitive,
    primitive.attributes.position,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.normal,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.texcoord0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.joints0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.weights0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphPosition0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphNormal0,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphPosition1,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.morphNormal1,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.tangent,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.texcoord1,
    attributes,
  );
  appendOptionalAttribute(
    context,
    primitive,
    primitive.attributes.color0,
    attributes,
  );
  const indices = validateIndexReference(context, primitive, primitive.indices);

  const hasNewError = context.diagnostics
    .slice(diagnosticsBefore)
    .some((diagnostic) => diagnostic.severity === "error");
  if (hasNewError) {
    return null;
  }

  if (!attributes.some((attribute) => attribute.semantic === "POSITION")) {
    return null;
  }

  return {
    meshHandleKey: primitive.registeredHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    vertexCount: attributes[0]?.count ?? null,
    attributes,
    indices,
  };
}

function appendAttribute(
  context: GltfAccessorValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  attribute: GltfMeshPrimitiveAttributeReference,
  output: GltfValidatedAccessorReference[],
): void {
  const validated = validateGltfAccessorReference(context, primitive, {
    semantic: attribute.semantic,
    accessorIndex: attribute.accessorIndex,
  });
  if (validated !== null) {
    output.push(validated);
  }
}

function appendOptionalAttribute(
  context: GltfAccessorValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  attribute: GltfMeshPrimitiveAttributeReference | undefined,
  output: GltfValidatedAccessorReference[],
): void {
  if (attribute === undefined) {
    return;
  }

  appendAttribute(context, primitive, attribute, output);
}

function validateIndexReference(
  context: GltfAccessorValidationContext,
  primitive: GltfPlannedMeshPrimitiveAsset,
  indices: GltfMeshPrimitiveIndexReference | null,
): GltfValidatedAccessorReference | null {
  if (indices === null) {
    return null;
  }

  return validateGltfAccessorReference(context, primitive, {
    semantic: "INDICES",
    accessorIndex: indices.accessorIndex,
  });
}
