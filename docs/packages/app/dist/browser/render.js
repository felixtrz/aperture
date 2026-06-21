export const DEFAULT_GENERATED_MSAA_SAMPLE_COUNT = 4;
export const DEFAULT_GENERATED_MAX_PIXEL_RATIO = 2;
export function resolveGeneratedRenderSettings(render, devicePixelRatio = readDevicePixelRatio(), profile = null) {
    const diagnostics = [];
    const rawSampleCount = render?.sampleCount;
    let requestedSampleCount = DEFAULT_GENERATED_MSAA_SAMPLE_COUNT;
    let sampleCountSource = "default";
    if (rawSampleCount !== undefined) {
        const normalized = normalizePositiveInteger(rawSampleCount);
        if (normalized === null) {
            sampleCountSource = "sanitized";
            diagnostics.push({
                code: "aperture.render.sampleCount.invalid",
                severity: "warn",
                message: "Generated app render.sampleCount must be a finite positive number; using the default 4x MSAA.",
                suggestedFix: "Use render.sampleCount: 4 for default anti-aliasing or render.sampleCount: 1 to opt out.",
                requestedSampleCount: rawSampleCount,
                resolvedSampleCount: DEFAULT_GENERATED_MSAA_SAMPLE_COUNT,
            });
        }
        else {
            requestedSampleCount = normalized;
            sampleCountSource = "config";
            if (normalized !== 1 && normalized !== 4) {
                diagnostics.push({
                    code: "aperture.render.sampleCount.clamped",
                    severity: "info",
                    message: "WebGPU generated apps currently support MSAA sample counts 1 and 4; this value will be clamped by the WebGPU backend.",
                    suggestedFix: "Use render.sampleCount: 1 to disable MSAA or render.sampleCount: 4 for the default quality setting.",
                    requestedSampleCount: normalized,
                    supportedSampleCounts: [1, 4],
                    resolvedSampleCount: normalized > 1 ? 4 : 1,
                });
            }
        }
    }
    const maxPixelRatio = normalizePositiveNumber(render?.maxPixelRatio) ??
        DEFAULT_GENERATED_MAX_PIXEL_RATIO;
    const configuredPixelRatio = normalizePositiveNumber(render?.pixelRatio);
    const resolvedDevicePixelRatio = normalizePositiveNumber(devicePixelRatio) ?? 1;
    let pixelRatio = resolvedDevicePixelRatio;
    let pixelRatioSource = "device";
    if (configuredPixelRatio !== null) {
        pixelRatio = configuredPixelRatio;
        pixelRatioSource = "configured";
    }
    else if (resolvedDevicePixelRatio > maxPixelRatio) {
        pixelRatio = maxPixelRatio;
        pixelRatioSource = "capped";
    }
    return {
        requestedSampleCount,
        sampleCountSource,
        pixelRatio,
        devicePixelRatio: resolvedDevicePixelRatio,
        maxPixelRatio,
        pixelRatioSource,
        profile,
        diagnostics,
    };
}
export function resolveGeneratedEffectiveRenderDefaults(render, environment = {}) {
    const profile = render?.deviceProfiles?.find((candidate) => renderDeviceProfileMatches(candidate, environment));
    if (profile === undefined) {
        return { render, profile: null };
    }
    return {
        render: {
            ...render,
            ...(profile.sampleCount === undefined
                ? {}
                : { sampleCount: profile.sampleCount }),
            ...(profile.pixelRatio === undefined
                ? {}
                : { pixelRatio: profile.pixelRatio }),
            ...(profile.maxPixelRatio === undefined
                ? {}
                : { maxPixelRatio: profile.maxPixelRatio }),
            ...(profile.exposure === undefined ? {} : { exposure: profile.exposure }),
            ...(profile.bloom === undefined ? {} : { bloom: profile.bloom }),
        },
        profile: profile.label ?? null,
    };
}
export function readGeneratedRenderProfileEnvironment(canvas) {
    const rect = canvas.getBoundingClientRect();
    const viewportWidth = normalizePositiveNumber(rect.width) ?? canvas.clientWidth;
    const viewportHeight = normalizePositiveNumber(rect.height) ?? canvas.clientHeight;
    return {
        ...(viewportWidth === 0 ? {} : { viewportWidth }),
        ...(viewportHeight === 0 ? {} : { viewportHeight }),
        devicePixelRatio: readDevicePixelRatio(),
    };
}
export function measureGeneratedCanvasResize(canvas, options = {}) {
    const render = resolveGeneratedRenderSettings(options.render, options.devicePixelRatio ?? readDevicePixelRatio());
    const rect = canvas.getBoundingClientRect();
    const devicePixelBox = devicePixelContentBoxSize(options.resizeEntry);
    const canUseDevicePixelBox = devicePixelBox !== null &&
        render.pixelRatioSource === "device" &&
        render.pixelRatio > 0;
    const displayWidth = Math.max(1, canUseDevicePixelBox
        ? devicePixelBox.width / render.pixelRatio
        : rect.width > 0
            ? rect.width
            : canvas.clientWidth);
    const displayHeight = Math.max(1, canUseDevicePixelBox
        ? devicePixelBox.height / render.pixelRatio
        : rect.height > 0
            ? rect.height
            : canvas.clientHeight);
    const width = Math.max(1, canUseDevicePixelBox
        ? Math.floor(devicePixelBox.width)
        : Math.floor(displayWidth * render.pixelRatio));
    const height = Math.max(1, canUseDevicePixelBox
        ? Math.floor(devicePixelBox.height)
        : Math.floor(displayHeight * render.pixelRatio));
    return {
        width,
        height,
        displayWidth,
        displayHeight,
        pixelRatio: render.pixelRatio,
        aspect: displayWidth / displayHeight,
        devicePixelRatio: render.devicePixelRatio,
        maxPixelRatio: render.maxPixelRatio,
        pixelRatioSource: render.pixelRatioSource,
        resizeSource: options.resizeSource ?? "initial",
        measurementSource: canUseDevicePixelBox
            ? "device-pixel-content-box"
            : "css-box",
    };
}
function readDevicePixelRatio() {
    return typeof window === "object" ? window.devicePixelRatio : 1;
}
function renderDeviceProfileMatches(profile, environment) {
    return (finiteRangeMatches(environment.viewportWidth, profile.minViewportWidth, profile.maxViewportWidth) &&
        finiteRangeMatches(environment.viewportHeight, profile.minViewportHeight, profile.maxViewportHeight) &&
        finiteRangeMatches(environment.devicePixelRatio, profile.minDevicePixelRatio, profile.maxDevicePixelRatio));
}
function finiteRangeMatches(value, min, max) {
    if (min === undefined && max === undefined) {
        return true;
    }
    const normalized = normalizePositiveNumber(value);
    if (normalized === null) {
        return false;
    }
    if (min !== undefined && normalized < min) {
        return false;
    }
    if (max !== undefined && normalized > max) {
        return false;
    }
    return true;
}
function normalizePositiveNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
}
function normalizePositiveInteger(value) {
    const normalized = normalizePositiveNumber(value);
    if (normalized === null) {
        return null;
    }
    const integer = Math.floor(normalized);
    return integer < 1 ? null : integer;
}
function devicePixelContentBoxSize(entry) {
    if (entry === undefined) {
        return null;
    }
    const box = entry.devicePixelContentBoxSize;
    const first = Array.isArray(box) ? box[0] : box;
    const width = normalizePositiveNumber(first?.inlineSize);
    const height = normalizePositiveNumber(first?.blockSize);
    return width === null || height === null ? null : { width, height };
}
//# sourceMappingURL=render.js.map