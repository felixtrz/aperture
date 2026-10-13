export function planRenderWorldDrawReadiness(objects) {
    const ready = [];
    const blocked = [];
    const diagnostics = [];
    if (objects.length === 0) {
        diagnostics.push({
            code: "renderWorld.empty",
            message: "Render world has no active draw objects.",
            severity: "info",
        });
    }
    for (const object of objects) {
        const meshResourceKey = object.gpu.meshResourceKey;
        const materialResourceKey = object.gpu.materialResourceKey;
        const missing = [];
        if (meshResourceKey === null) {
            missing.push("missing-mesh-resource");
            diagnostics.push({
                code: "renderWorld.missingMeshResource",
                message: `Render object ${object.renderId} is missing a mesh resource binding.`,
                severity: "warning",
                entity: object.packet.entity,
            });
        }
        if (materialResourceKey === null) {
            missing.push("missing-material-resource");
            diagnostics.push({
                code: "renderWorld.missingMaterialResource",
                message: `Render object ${object.renderId} is missing a material resource binding.`,
                severity: "warning",
                entity: object.packet.entity,
            });
        }
        if (meshResourceKey === null || materialResourceKey === null) {
            blocked.push({
                renderId: object.renderId,
                packet: object.packet,
                missing,
            });
            continue;
        }
        ready.push({
            renderId: object.renderId,
            packet: object.packet,
            meshResourceKey,
            materialResourceKey,
            batchKey: object.packet.batchKey,
        });
    }
    return { ready, blocked, diagnostics };
}
//# sourceMappingURL=render-world-readiness.js.map