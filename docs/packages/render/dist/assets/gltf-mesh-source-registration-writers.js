import { assetHandleKey, createMeshHandle, } from "@aperture-engine/simulation";
export function registerGltfPlannedMeshSourceAsset(input) {
    const handle = createHandle(input.mesh, input.diagnostics, input.skipped);
    if (handle === null) {
        return;
    }
    const registeredHandleKey = assetHandleKey(handle);
    if (input.mesh.mesh === null) {
        skip({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            mesh: input.mesh,
            registeredHandleKey,
            code: "gltfMeshRegistration.invalidPlannedAsset",
            message: `Mesh '${registeredHandleKey}' was not registered because its planned source asset is invalid.`,
        });
        return;
    }
    if (input.registry.has(handle)) {
        skip({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            mesh: input.mesh,
            registeredHandleKey,
            code: "gltfMeshRegistration.duplicateAssetKey",
            message: `Mesh '${registeredHandleKey}' already exists and was not overwritten.`,
        });
        return;
    }
    const registryDiagnostics = assetDiagnosticsForMesh(input.report.diagnostics, input.mesh);
    input.registry.register(handle, {
        label: input.mesh.mesh.label,
        diagnostics: registryDiagnostics,
    });
    input.registry.markReady(handle, input.mesh.mesh, registryDiagnostics);
    input.written.push({
        kind: "mesh",
        plannedHandleKey: input.mesh.handleKey,
        registeredHandleKey,
        meshIndex: input.mesh.meshIndex,
        primitiveIndex: input.mesh.primitiveIndex,
        diagnostics: registryDiagnostics,
    });
}
function createHandle(mesh, diagnostics, skipped) {
    try {
        return createMeshHandle(meshIdFromPlannedHandleKey(mesh.handleKey));
    }
    catch {
        skip({
            diagnostics,
            skipped,
            mesh,
            registeredHandleKey: mesh.registeredHandleKey,
            code: "gltfMeshRegistration.invalidHandleKey",
            message: `Mesh '${mesh.registeredHandleKey}' was not registered because its planned handle key is invalid.`,
        });
        return null;
    }
}
function skip(input) {
    const diagnostic = {
        code: input.code,
        severity: "error",
        message: input.message,
        kind: "mesh",
        plannedHandleKey: input.mesh.handleKey,
        registeredHandleKey: input.registeredHandleKey,
        meshIndex: input.mesh.meshIndex,
        primitiveIndex: input.mesh.primitiveIndex,
    };
    input.diagnostics.push(diagnostic);
    input.skipped.push({
        kind: "mesh",
        plannedHandleKey: input.mesh.handleKey,
        registeredHandleKey: input.registeredHandleKey,
        meshIndex: input.mesh.meshIndex,
        primitiveIndex: input.mesh.primitiveIndex,
        reason: input.code,
        diagnostics: [diagnostic],
    });
}
function assetDiagnosticsForMesh(diagnostics, mesh) {
    return diagnostics
        .filter((diagnostic) => diagnosticMatchesMesh(diagnostic, mesh))
        .map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        severity: diagnostic.severity,
    }));
}
function diagnosticMatchesMesh(diagnostic, mesh) {
    if (diagnostic.meshIndex !== undefined &&
        diagnostic.meshIndex !== mesh.meshIndex) {
        return false;
    }
    if (diagnostic.primitiveIndex !== undefined &&
        diagnostic.primitiveIndex !== mesh.primitiveIndex) {
        return false;
    }
    if (diagnostic.meshHandleKey !== undefined &&
        diagnostic.meshHandleKey !== mesh.handleKey &&
        diagnostic.meshHandleKey !== mesh.registeredHandleKey) {
        return false;
    }
    return (diagnostic.meshIndex !== undefined ||
        diagnostic.primitiveIndex !== undefined ||
        diagnostic.meshHandleKey !== undefined);
}
function meshIdFromPlannedHandleKey(handleKey) {
    const prefix = "mesh:";
    return handleKey.startsWith(prefix)
        ? handleKey.slice(prefix.length)
        : handleKey;
}
//# sourceMappingURL=gltf-mesh-source-registration-writers.js.map