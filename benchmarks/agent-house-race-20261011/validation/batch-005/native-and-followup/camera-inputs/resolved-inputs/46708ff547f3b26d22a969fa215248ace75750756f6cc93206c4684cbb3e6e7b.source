import { assetHandleKey, toVec4Tuple, } from "@aperture-engine/simulation";
import { AreaLightShape, CameraProjection, LightKind, } from "./authoring-types.js";
export function createCamera(input = {}) {
    return {
        projection: input.projection ?? CameraProjection.Perspective,
        fovYRadians: input.fovYRadians ?? Math.PI / 3,
        aspect: input.aspect ?? 1,
        autoAspect: input.autoAspect ?? input.aspect === undefined,
        near: input.near ?? 0.1,
        far: input.far ?? 1000,
        orthographicHeight: input.orthographicHeight ?? 10,
        viewport: toVec4Tuple(input.viewport ?? [0, 0, 1, 1]),
        scissor: toVec4Tuple(input.scissor ?? [0, 0, 1, 1]),
        clearColor: toVec4Tuple(input.clearColor ?? [0, 0, 0, 1]),
        clearDepth: input.clearDepth ?? 1,
        clearStencil: input.clearStencil ?? 0,
        clearFlags: input.clearFlags ?? 3,
        layerMask: input.layerMask ?? 1,
        priority: input.priority ?? 0,
        renderTargetId: input.renderTargetId ?? "",
        frustumCulling: input.frustumCulling ?? true,
        temporalJitterX: input.temporalJitter?.[0] ?? 0,
        temporalJitterY: input.temporalJitter?.[1] ?? 0,
    };
}
export function createLight(input = {}) {
    return {
        kind: input.kind ?? LightKind.Directional,
        shape: input.shape ?? AreaLightShape.Rect,
        color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
        intensity: input.intensity ?? 1,
        range: input.range ?? 10,
        innerConeAngle: input.innerConeAngle ?? Math.PI / 8,
        outerConeAngle: input.outerConeAngle ?? Math.PI / 6,
        width: input.width ?? 2,
        height: input.height ?? 2,
        layerMask: input.layerMask ?? 1,
        environmentMapId: input.environmentMap === undefined || input.environmentMap === null
            ? ""
            : assetHandleKey(input.environmentMap),
    };
}
export function createLightCookie(input) {
    return {
        textureId: assetHandleKey(input.texture),
        samplerId: input.sampler === undefined || input.sampler === null
            ? ""
            : assetHandleKey(input.sampler),
        intensity: input.intensity ?? 1,
    };
}
export function createLightShadowSettings(input = {}) {
    const center = input.center ?? [0, 0, 0];
    return {
        enabled: input.enabled ?? false,
        mapSize: input.mapSize ?? 1024,
        bias: input.bias ?? 0,
        normalBias: input.normalBias ?? 0,
        cascadeCount: input.cascadeCount ?? 1,
        casterLayerMask: input.casterLayerMask ?? -1,
        receiverLayerMask: input.receiverLayerMask ?? -1,
        shadowType: input.shadowType ?? 1,
        strength: input.strength ?? 1,
        filterRadius: input.filterRadius ?? 1,
        slopeBias: input.slopeBias ?? 0,
        centerX: center[0] ?? 0,
        centerY: center[1] ?? 0,
        centerZ: center[2] ?? 0,
        orthographicSize: input.orthographicSize ?? 0,
        near: input.near ?? 0,
        far: input.far ?? 0,
        lightDistance: input.lightDistance ?? 0,
    };
}
//# sourceMappingURL=authoring-create-camera-light.js.map