import { readGeneratedCanvasSamples } from "./canvas-readback.js";
import { pickGeneratedBrowserEntity } from "./picking.js";
export async function callGeneratedBrowserDevtoolsTool(input) {
    if (input.tool === "browser_pick_pixel") {
        const readback = await readGeneratedCanvasSamples(input.payload);
        return {
            ok: readback.ok,
            result: {
                sample: readback.samples[0] ?? null,
                readback,
            },
            diagnostics: readback.diagnostics,
        };
    }
    if (input.tool === "render_readback_samples") {
        const readback = await readGeneratedCanvasSamples(input.payload);
        return {
            ok: readback.ok,
            result: readback,
            diagnostics: readback.diagnostics,
        };
    }
    if (input.tool === "render_pick_entity") {
        return pickGeneratedBrowserEntity(input.getWebGpuResult(), input.payload);
    }
    if (input.tool === "render_set_post_effect_enabled") {
        return setGeneratedBrowserPostEffectEnabled(input.getWebGpuResult(), input.payload);
    }
    return null;
}
function setGeneratedBrowserPostEffectEnabled(webgpu, payload) {
    if (webgpu === null) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.devtools.webgpuUnavailable",
                    severity: "error",
                    message: "The generated WebGPU app is not available yet; wait for browser_status.webgpuOk before changing post effects.",
                },
            ],
        };
    }
    if (!webgpu.ok) {
        return {
            ok: false,
            result: webgpu,
            diagnostics: [
                {
                    code: "aperture.devtools.webgpuFailed",
                    severity: "error",
                    message: "The generated WebGPU app failed to initialize; post effects cannot be changed.",
                },
            ],
        };
    }
    const request = parsePostEffectEnabledPayload(payload);
    if (request === null) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.devtools.invalidPostEffectToggle",
                    severity: "error",
                    message: "render_set_post_effect_enabled expects { effectId: string, enabled: boolean }.",
                },
            ],
        };
    }
    const effect = webgpu.app.postEffects.find((candidate) => candidate.id === request.effectId);
    if (effect === undefined) {
        return {
            ok: false,
            result: {
                postEffects: summarizePostEffects(webgpu.app.postEffects),
            },
            diagnostics: [
                {
                    code: "aperture.devtools.postEffectNotFound",
                    severity: "warning",
                    effectId: request.effectId,
                    message: `No generated WebGPU post effect with id '${request.effectId}' is registered.`,
                },
            ],
        };
    }
    webgpu.app.setPostEffectEnabled(request.effectId, request.enabled);
    return {
        ok: true,
        result: {
            effectId: effect.id,
            enabled: request.enabled,
            postEffects: summarizePostEffects(webgpu.app.postEffects),
        },
    };
}
function parsePostEffectEnabledPayload(payload) {
    if (typeof payload !== "object" || payload === null)
        return null;
    const record = payload;
    const effectId = typeof record["effectId"] === "string"
        ? record["effectId"]
        : typeof record["id"] === "string"
            ? record["id"]
            : null;
    const enabled = record["enabled"];
    if (effectId === null ||
        effectId.length === 0 ||
        typeof enabled !== "boolean") {
        return null;
    }
    return { effectId, enabled };
}
function summarizePostEffects(effects) {
    return effects.map((effect) => ({
        id: effect.id,
        ...(effect.label === undefined ? {} : { label: effect.label }),
        enabled: effect.enabled !== false,
    }));
}
//# sourceMappingURL=dispatch.js.map