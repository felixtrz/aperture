import { mergeBounds } from "./mesh-merge-bounds.js";
import { mergeIndexBuffer, mergeSubmeshes, mergeVertexStreams, } from "./mesh-merge-assembly.js";
import { cloneMaterialSlots, required } from "./mesh-merge-utils.js";
import { collectSourceLayouts, validateCompatibility, } from "./mesh-merge-validation.js";
export function mergeMeshAssetsForBatch(options) {
    const diagnostics = [];
    if (options.sources.length === 0) {
        diagnostics.push({
            code: "meshMerge.emptyInput",
            severity: "error",
            message: "Cannot merge mesh assets for batching without sources.",
        });
        return { valid: false, mesh: null, ranges: [], diagnostics };
    }
    const firstSource = required(options.sources[0]);
    const firstMesh = firstSource.mesh;
    const indexed = firstMesh.indexBuffer !== undefined;
    const topology = firstMesh.submeshes[0]?.topology ?? "triangle-list";
    const sourceLayouts = collectSourceLayouts(options.sources, diagnostics);
    validateCompatibility({
        sources: options.sources,
        firstMesh,
        indexed,
        topology,
        diagnostics,
    });
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        return { valid: false, mesh: null, ranges: [], diagnostics };
    }
    const mergedVertexStreams = mergeVertexStreams(firstMesh, sourceLayouts);
    const indexBuffer = indexed
        ? mergeIndexBuffer(sourceLayouts, diagnostics)
        : undefined;
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        return { valid: false, mesh: null, ranges: [], diagnostics };
    }
    const ranges = [];
    const submeshes = mergeSubmeshes(sourceLayouts, indexed, ranges);
    const mesh = {
        kind: "mesh",
        label: options.label ?? `Merged ${options.sources.length} meshes`,
        vertexStreams: mergedVertexStreams,
        ...(indexBuffer === undefined ? {} : { indexBuffer }),
        submeshes,
        materialSlots: cloneMaterialSlots(firstMesh.materialSlots),
        ...mergeBounds(sourceLayouts.map((source) => source.mesh)),
    };
    return { valid: true, mesh, ranges, diagnostics };
}
//# sourceMappingURL=mesh-merge.js.map