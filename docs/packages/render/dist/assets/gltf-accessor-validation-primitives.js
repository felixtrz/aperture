import { validateGltfAccessorReference } from "./gltf-accessor-validation-accessors.js";
export function validateGltfPrimitiveAccessorPlan(context, primitive) {
    if (primitive.compression !== null) {
        return null;
    }
    const diagnosticsBefore = context.diagnostics.length;
    const attributes = [];
    appendAttribute(context, primitive, primitive.attributes.position, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.normal, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.texcoord0, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.joints0, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.weights0, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.morphPosition0, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.morphNormal0, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.morphPosition1, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.morphNormal1, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.tangent, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.texcoord1, attributes);
    appendOptionalAttribute(context, primitive, primitive.attributes.color0, attributes);
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
function appendAttribute(context, primitive, attribute, output) {
    const validated = validateGltfAccessorReference(context, primitive, {
        semantic: attribute.semantic,
        accessorIndex: attribute.accessorIndex,
    });
    if (validated !== null) {
        output.push(validated);
    }
}
function appendOptionalAttribute(context, primitive, attribute, output) {
    if (attribute === undefined) {
        return;
    }
    appendAttribute(context, primitive, attribute, output);
}
function validateIndexReference(context, primitive, indices) {
    if (indices === null) {
        return null;
    }
    return validateGltfAccessorReference(context, primitive, {
        semantic: "INDICES",
        accessorIndex: indices.accessorIndex,
    });
}
//# sourceMappingURL=gltf-accessor-validation-primitives.js.map