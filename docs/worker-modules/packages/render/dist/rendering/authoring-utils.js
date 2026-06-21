export function validateRect(rect, field, diagnostics) {
    if (rect.some((value) => !Number.isFinite(value)) ||
        rect[2] < 0 ||
        rect[3] < 0) {
        diagnostics.push({
            code: "camera.invalidViewport",
            field,
            message: `${field} values must be finite with non-negative width and height.`,
        });
    }
}
export function tuple4(x, y, z, w) {
    return [x, y, z, w];
}
export function tuple3(x, y, z) {
    return [x, y, z];
}
export function tuple2(x, y) {
    return [x, y];
}
export function spriteSize(size) {
    if (size === undefined) {
        return [1, 1];
    }
    return typeof size === "number" ? [size, size] : [size[0] ?? 1, size[1] ?? 1];
}
//# sourceMappingURL=authoring-utils.js.map