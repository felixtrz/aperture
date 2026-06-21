import { identityMat4, WorldTransform, } from "@aperture-engine/simulation";
export function readWorldMatrix(entity) {
    const matrix = identityMat4();
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return matrix;
}
export function pushMatrix(values, matrix) {
    const offset = values.length;
    values.push(...matrix);
    return offset;
}
export function pushTranslationMatrix(values, position) {
    const offset = values.length;
    values.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, position[0], position[1], position[2], 1);
    return offset;
}
//# sourceMappingURL=extraction-matrices.js.map