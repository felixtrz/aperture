import { canvasDimensions, numberFromValue, pixelFromSample, pixelSampleRequestsFromPayload, } from "./payloads.js";
export async function readGeneratedCanvasSamples(payload) {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
        return canvasReadbackFailure("aperture.render.canvasMissing", {
            message: "No HTML canvas was found for managed-browser pixel readback.",
        });
    }
    if (typeof createImageBitmap !== "function") {
        return canvasReadbackFailure("aperture.render.createImageBitmapMissing", {
            message: "This browser does not expose createImageBitmap for canvas readback.",
        });
    }
    const requestedSamples = pixelSampleRequestsFromPayload(payload);
    const dimensions = canvasDimensions(canvas);
    const diagnostics = [];
    const pixels = requestedSamples
        .map((sample) => {
        const pixel = pixelFromSample(dimensions, sample);
        if (pixel === null) {
            diagnostics.push({
                code: "aperture.render.readbackSampleOutOfBounds",
                severity: "error",
                message: `Readback sample '${sample.id}' is outside the ${dimensions.width}x${dimensions.height} canvas.`,
                data: sample,
            });
        }
        return pixel === null ? null : { sample, pixel };
    })
        .filter((entry) => entry !== null);
    if (pixels.length === 0) {
        return {
            ok: false,
            width: dimensions.width,
            height: dimensions.height,
            samples: [],
            diagnostics,
        };
    }
    try {
        const bitmap = await createImageBitmap(canvas);
        try {
            const readbackCanvas = typeof OffscreenCanvas === "function"
                ? new OffscreenCanvas(bitmap.width, bitmap.height)
                : document.createElement("canvas");
            readbackCanvas.width = bitmap.width;
            readbackCanvas.height = bitmap.height;
            const context = readbackCanvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (context === null) {
                return canvasReadbackFailure("aperture.render.readbackContextMissing", {
                    width: dimensions.width,
                    height: dimensions.height,
                    message: "Could not create a 2D canvas context for pixel readback.",
                });
            }
            context.drawImage(bitmap, 0, 0);
            return {
                ok: diagnostics.length === 0,
                width: dimensions.width,
                height: dimensions.height,
                samples: pixels.map(({ sample, pixel }) => {
                    const rgba = context.getImageData(pixel.x, pixel.y, 1, 1).data;
                    return {
                        id: sample.id,
                        x: pixel.x,
                        y: pixel.y,
                        pixel: {
                            r: rgba[0] ?? 0,
                            g: rgba[1] ?? 0,
                            b: rgba[2] ?? 0,
                            a: rgba[3] ?? 0,
                        },
                    };
                }),
                diagnostics,
            };
        }
        finally {
            bitmap.close();
        }
    }
    catch (error) {
        return canvasReadbackFailure("aperture.render.readbackFailed", {
            width: dimensions.width,
            height: dimensions.height,
            message: error instanceof Error ? error.message : String(error),
        });
    }
}
function canvasReadbackFailure(code, data) {
    return {
        ok: false,
        width: numberFromValue(data["width"]) ?? 0,
        height: numberFromValue(data["height"]) ?? 0,
        samples: [],
        diagnostics: [
            {
                code,
                severity: "error",
                message: String(data["message"] ?? code),
                data,
            },
        ],
    };
}
//# sourceMappingURL=canvas-readback.js.map