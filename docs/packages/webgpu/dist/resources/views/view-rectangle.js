export function resolveNormalizedViewRectangle(options) {
    const diagnostics = [];
    const label = options.label;
    const targetWidth = Math.round(options.target.width);
    const targetHeight = Math.round(options.target.height);
    if (!Number.isFinite(options.target.width) ||
        !Number.isFinite(options.target.height) ||
        targetWidth <= 0 ||
        targetHeight <= 0) {
        diagnostics.push({
            code: "viewRectangle.invalidTargetSize",
            message: messageWithLabel(label, `View rectangle target size must be positive and finite; received ${options.target.width}x${options.target.height}.`),
            ...labelProperty(label),
        });
    }
    if (options.rect.length < 4 ||
        !Number.isFinite(options.rect[0]) ||
        !Number.isFinite(options.rect[1]) ||
        !Number.isFinite(options.rect[2]) ||
        !Number.isFinite(options.rect[3]) ||
        (options.rect[2] ?? 0) <= 0 ||
        (options.rect[3] ?? 0) <= 0) {
        diagnostics.push({
            code: "viewRectangle.invalidRect",
            message: messageWithLabel(label, "View rectangle must provide finite x, y, width, and height values with positive width and height."),
            ...labelProperty(label),
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, rect: null, diagnostics };
    }
    const normalizedX = options.rect[0] ?? 0;
    const normalizedY = options.rect[1] ?? 0;
    const normalizedWidth = options.rect[2] ?? 0;
    const normalizedHeight = options.rect[3] ?? 0;
    const left = clampInteger(Math.round(normalizedX * targetWidth), 0, targetWidth);
    const top = clampInteger(Math.round(normalizedY * targetHeight), 0, targetHeight);
    const right = clampInteger(Math.round((normalizedX + normalizedWidth) * targetWidth), 0, targetWidth);
    const bottom = clampInteger(Math.round((normalizedY + normalizedHeight) * targetHeight), 0, targetHeight);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) {
        return {
            valid: false,
            rect: null,
            diagnostics: [
                {
                    code: "viewRectangle.emptyRect",
                    message: messageWithLabel(label, "View rectangle resolved to an empty target-space rectangle."),
                    ...labelProperty(label),
                },
            ],
        };
    }
    return {
        valid: true,
        rect: { x: left, y: top, width, height },
        diagnostics: [],
    };
}
function clampInteger(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function messageWithLabel(label, message) {
    return label === undefined ? message : `${label}: ${message}`;
}
function labelProperty(label) {
    return label === undefined ? {} : { label };
}
//# sourceMappingURL=view-rectangle.js.map