import { canvasDimensions, pixelFromSample, pixelSampleRequestsFromPayload, } from "./payloads.js";
import { webgpuDiagnosticsArray, webgpuDiagnosticValue, } from "./webgpu-diagnostics.js";
export async function pickGeneratedBrowserEntity(webgpuResult, payload) {
    if (webgpuResult === null) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.render.webgpuNotReady",
                    severity: "error",
                    message: "WebGPU has not finished initializing in this managed tab.",
                },
            ],
        };
    }
    if (!webgpuResult.ok) {
        return {
            ok: false,
            result: webgpuResult,
            diagnostics: [
                {
                    code: "aperture.render.webgpuUnavailable",
                    severity: "error",
                    message: "WebGPU initialization failed, so entity picking is unavailable.",
                },
            ],
        };
    }
    const request = pixelSampleRequestsFromPayload(payload)[0] ?? {
        id: "pick",
        x: 0.5,
        y: 0.5,
        coordinateSpace: "normalized",
    };
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.render.canvasMissing",
                    severity: "error",
                    message: "No HTML canvas was found for managed-browser entity pick.",
                },
            ],
        };
    }
    const dimensions = canvasDimensions(canvas);
    const pixel = pixelFromSample(dimensions, request);
    if (pixel === null) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.render.pickOutOfBounds",
                    severity: "error",
                    message: `Pick point is outside the ${dimensions.width}x${dimensions.height} canvas.`,
                    data: request,
                },
            ],
        };
    }
    const entity = await webgpuResult.app.pick(pixel.x, pixel.y);
    const diagnostics = webgpuDiagnosticsArray(webgpuResult.app.getDiagnostics(), "lastPick");
    return {
        ok: entity !== null && diagnostics.length === 0,
        result: {
            entity,
            x: pixel.x,
            y: pixel.y,
            pick: webgpuDiagnosticValue(webgpuResult.app.getDiagnostics(), "lastPick"),
        },
        diagnostics,
    };
}
//# sourceMappingURL=picking.js.map