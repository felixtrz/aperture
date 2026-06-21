import { LightCookie, LightShadowSettings, validateLightCookieInput, validateLightShadowSettingsInput, } from "./index.js";
import { createStableRenderId, } from "./snapshot.js";
import { validateSamplerAssetState, validateTextureAssetState, } from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { parseSamplerHandle, parseTextureHandle } from "./extraction-inputs.js";
export function requiresLightTransform(kind) {
    return kind !== "ambient" && kind !== "environment";
}
export function readShadowSettings(entity, diagnostics) {
    if (!entity.hasComponent(LightShadowSettings)) {
        return null;
    }
    const settings = {
        enabled: entity.getValue(LightShadowSettings, "enabled") ?? false,
        mapSize: entity.getValue(LightShadowSettings, "mapSize") ?? 1024,
        bias: entity.getValue(LightShadowSettings, "bias") ?? 0,
        normalBias: entity.getValue(LightShadowSettings, "normalBias") ?? 0,
        cascadeCount: entity.getValue(LightShadowSettings, "cascadeCount") ?? 1,
        casterLayerMask: entity.getValue(LightShadowSettings, "casterLayerMask") ?? -1,
        receiverLayerMask: entity.getValue(LightShadowSettings, "receiverLayerMask") ?? -1,
        shadowType: entity.getValue(LightShadowSettings, "shadowType") ?? 1,
        strength: entity.getValue(LightShadowSettings, "strength") ?? 1,
        filterRadius: entity.getValue(LightShadowSettings, "filterRadius") ?? 1,
        slopeBias: entity.getValue(LightShadowSettings, "slopeBias") ?? 0,
        center: [
            entity.getValue(LightShadowSettings, "centerX") ?? 0,
            entity.getValue(LightShadowSettings, "centerY") ?? 0,
            entity.getValue(LightShadowSettings, "centerZ") ?? 0,
        ],
        orthographicSize: entity.getValue(LightShadowSettings, "orthographicSize") ?? 0,
        near: entity.getValue(LightShadowSettings, "near") ?? 0,
        far: entity.getValue(LightShadowSettings, "far") ?? 0,
        lightDistance: entity.getValue(LightShadowSettings, "lightDistance") ?? 0,
    };
    const validation = validateLightShadowSettingsInput(settings);
    if (!validation.valid) {
        for (const shadowDiagnostic of validation.diagnostics) {
            diagnostics.push(diagnostic(`render.${shadowDiagnostic.code}`, entity));
        }
        return null;
    }
    return settings;
}
export function readLightCookie(entity, assets, kind, diagnostics) {
    if (!entity.hasComponent(LightCookie)) {
        return null;
    }
    if (kind !== "point" && kind !== "spot") {
        diagnostics.push(diagnostic(`render.lightCookieUnsupportedKind.${kind}`, entity));
        return null;
    }
    const texture = parseTextureHandle(entity.getValue(LightCookie, "textureId") ?? "");
    const samplerId = entity.getValue(LightCookie, "samplerId") ?? "";
    const sampler = samplerId.length === 0 ? null : parseSamplerHandle(samplerId);
    const intensity = entity.getValue(LightCookie, "intensity") ?? 1;
    if (texture === null) {
        diagnostics.push(diagnostic("render.lightCookie.missingTexture", entity));
        return null;
    }
    const input = {
        texture,
        sampler,
        intensity,
    };
    const validation = validateLightCookieInput(input);
    if (!validation.valid) {
        for (const cookieDiagnostic of validation.diagnostics) {
            diagnostics.push(diagnostic(`render.${cookieDiagnostic.code}`, entity));
        }
        return null;
    }
    if (!validateTextureAssetState(texture, assets, entity, diagnostics)) {
        return null;
    }
    if (sampler !== null &&
        !validateSamplerAssetState(sampler, assets, entity, diagnostics)) {
        return null;
    }
    return input;
}
export function appendShadowRequest(entity, kind, settings, shadowRequests, diagnostics) {
    if (settings?.enabled !== true) {
        return;
    }
    if (kind !== "directional" && kind !== "point" && kind !== "spot") {
        diagnoseUnsupportedShadowRequest(entity, kind, settings, diagnostics);
        return;
    }
    const lightId = createStableRenderId(entityRef(entity));
    // Only attach authored shadow params when they differ from the renderer
    // defaults, so default-authored lights keep the prior minimal packet shape
    // (and round-trip identically through the packed worker codec).
    const shadowType = settings.shadowType ?? 1;
    const strength = settings.strength ?? 1;
    const filterRadius = settings.filterRadius ?? 1;
    const slopeBias = settings.slopeBias ?? 0;
    const depthBias = settings.bias ?? 0;
    const normalBias = settings.normalBias ?? 0;
    const mapSize = settings.mapSize ?? 1024;
    const orthographicSize = settings.orthographicSize ?? 0;
    const near = settings.near ?? 0;
    const far = settings.far ?? 0;
    const lightDistance = settings.lightDistance ?? 0;
    const center = settings.center ?? [0, 0, 0];
    shadowRequests.push({
        shadowId: lightId,
        lightId,
        lightKind: kind,
        ...(kind === "directional"
            ? { cascadeCount: settings.cascadeCount ?? 1 }
            : {}),
        casterLayerMask: settings.casterLayerMask ?? -1,
        receiverLayerMask: settings.receiverLayerMask ?? -1,
        ...(shadowType === 1 ? {} : { shadowType }),
        ...(strength === 1 ? {} : { strength }),
        ...(filterRadius === 1 ? {} : { filterRadius }),
        ...(slopeBias === 0 ? {} : { slopeBias }),
        ...(depthBias === 0 ? {} : { depthBias }),
        ...(normalBias === 0 ? {} : { normalBias }),
        // Authored shadow-map resolution; both three.js (LightShadow.mapSize) and
        // PlayCanvas (light._shadowResolution) honor it. Only attached when it
        // differs from the renderer default so default lights round-trip minimally.
        ...(mapSize === 1024 ? {} : { mapSize }),
        ...(orthographicSize <= 0
            ? {}
            : {
                center,
                orthographicSize,
                ...(near === 0 ? {} : { near }),
                ...(far === 0 ? {} : { far }),
                ...(lightDistance === 0 ? {} : { lightDistance }),
            }),
    });
}
export function diagnoseUnsupportedShadowRequest(entity, kind, settings, diagnostics) {
    if (settings?.enabled === true) {
        diagnostics.push(diagnostic(`render.shadowUnsupportedLightKind.${kind}`, entity));
    }
}
//# sourceMappingURL=extraction-light-settings.js.map