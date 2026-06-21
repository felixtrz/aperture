export function webGpuAppCanvasDimensions(canvas) {
    const dimensions = canvas;
    const width = typeof dimensions.width === "number" ? dimensions.width : 1;
    const height = typeof dimensions.height === "number" ? dimensions.height : 1;
    return {
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
    };
}
//# sourceMappingURL=canvas.js.map