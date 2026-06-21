export function pushAccessorValidationDiagnostic(context, primitive, input, diagnostic) {
    context.diagnostics.push({
        severity: diagnostic.severity ?? "error",
        meshHandleKey: primitive.registeredHandleKey,
        meshIndex: primitive.meshIndex,
        primitiveIndex: primitive.primitiveIndex,
        semantic: input.semantic,
        accessorIndex: input.accessorIndex,
        ...diagnostic,
    });
}
//# sourceMappingURL=gltf-accessor-validation-diagnostics.js.map