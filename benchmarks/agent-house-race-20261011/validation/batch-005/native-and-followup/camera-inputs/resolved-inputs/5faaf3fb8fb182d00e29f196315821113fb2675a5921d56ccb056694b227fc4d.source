/** Hard work/copy bounds for the static source-mesh bake operation. */
export const MESH_BAKE_TRANSFORM_LIMITS = Object.freeze({
    vertices: 2_000_000,
    indices: 6_000_000,
    triangleCorners: 6_000_000,
    bytes: 128 * 1024 * 1024,
    streams: 16,
    attributesPerStream: 16,
    submeshes: 4_096,
    materialSlots: 4_096,
});
export class MeshBakeFailure extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.message);
        this.diagnostic = diagnostic;
    }
}
export function bakeFailure(diagnostic) {
    throw new MeshBakeFailure({ ...diagnostic, severity: "error" });
}
//# sourceMappingURL=bake-transform-types.js.map