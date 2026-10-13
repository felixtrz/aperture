export function createStandardMaterialNormalMapTangentReadinessReport(options) {
    const meshSemantics = uniqueMeshSemantics(options.mesh);
    const hasTangents = meshSemantics.includes("TANGENT");
    if (options.material.kind !== "standard") {
        return {
            ready: false,
            materialKind: options.material.kind,
            normalMapAuthored: false,
            requiresTangents: false,
            hasTangents,
            meshSemantics,
            diagnostics: [
                {
                    code: "standardNormalMap.unsupportedMaterialKind",
                    severity: "error",
                    ...(options.meshKey === undefined
                        ? {}
                        : { meshKey: options.meshKey }),
                    ...(options.materialKey === undefined
                        ? {}
                        : { materialKey: options.materialKey }),
                    message: `Standard normal-map tangent readiness requires a StandardMaterial, not '${options.material.kind}'.`,
                },
            ],
        };
    }
    return createStandardReadinessReport({
        meshSemantics,
        hasTangents,
        material: options.material,
        ...(options.meshKey === undefined ? {} : { meshKey: options.meshKey }),
        ...(options.materialKey === undefined
            ? {}
            : { materialKey: options.materialKey }),
    });
}
export function standardMaterialNormalMapTangentReadinessReportToJsonValue(report) {
    return {
        ...report,
        meshSemantics: [...report.meshSemantics],
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialNormalMapTangentReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialNormalMapTangentReadinessReportToJsonValue(report));
}
function createStandardReadinessReport(input) {
    const normalMapAuthored = input.material.normalTexture !== null;
    const requiresTangents = normalMapAuthored;
    const diagnostics = [];
    if (requiresTangents && !input.hasTangents) {
        diagnostics.push({
            code: "standardNormalMap.missingTangents",
            severity: "warning",
            ...(input.meshKey === undefined ? {} : { meshKey: input.meshKey }),
            ...(input.materialKey === undefined
                ? {}
                : { materialKey: input.materialKey }),
            message: "StandardMaterial normalTexture requires mesh TANGENT vertex attributes before tangent-space normal mapping can render.",
        });
    }
    return {
        ready: diagnostics.length === 0,
        materialKind: input.material.kind,
        normalMapAuthored,
        requiresTangents,
        hasTangents: input.hasTangents,
        meshSemantics: input.meshSemantics,
        diagnostics,
    };
}
function uniqueMeshSemantics(mesh) {
    return [
        ...new Set(mesh.vertexStreams.flatMap((stream) => stream.attributes.map((attribute) => attribute.semantic))),
    ].sort();
}
//# sourceMappingURL=standard-normal-map-readiness.js.map