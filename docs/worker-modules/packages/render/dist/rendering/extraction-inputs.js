import { createAudioClipHandle, createEnvironmentMapHandle, createMaterialHandle, createMeshHandle, createParticleEffectHandle, createRenderTargetHandle, createSamplerHandle, createTextureHandle, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { Camera, Fog, FogMode, Light, ProceduralSky, Sprite, Skybox, } from "./index.js";
import { diagnostic } from "./extraction-diagnostics.js";
export function readCameraNumber(entity, key) {
    const value = entity.getValue(Camera, key);
    return typeof value === "number" ? value : 0;
}
export function readRenderTarget(entity, diagnostics) {
    const value = entity.getValue(Camera, "renderTargetId") ?? "";
    if (value === "") {
        return null;
    }
    const id = parseAssetId(value, "render-target");
    if (id === null) {
        diagnostics.push(diagnostic("render.camera.invalidRenderTargetHandle", entity));
        return null;
    }
    return createRenderTargetHandle(id);
}
export function readEnvironmentMapHandle(entity, diagnostics) {
    const value = entity.getValue(Light, "environmentMapId") ?? "";
    if (value === "") {
        return null;
    }
    const id = parseAssetId(value, "environment-map");
    if (id === null) {
        diagnostics.push(diagnostic("render.environment.invalidHandle", entity));
        return undefined;
    }
    return createEnvironmentMapHandle(id);
}
export function cameraInput(entity) {
    return {
        projection: (entity.getValue(Camera, "projection") ?? "perspective"),
        fovYRadians: entity.getValue(Camera, "fovYRadians") ?? Math.PI / 3,
        aspect: entity.getValue(Camera, "aspect") ?? 1,
        near: entity.getValue(Camera, "near") ?? 0.1,
        far: entity.getValue(Camera, "far") ?? 1000,
        orthographicHeight: entity.getValue(Camera, "orthographicHeight") ?? 10,
        viewport: Array.from(entity.getVectorView(Camera, "viewport")),
        scissor: Array.from(entity.getVectorView(Camera, "scissor")),
        layerMask: entity.getValue(Camera, "layerMask") ?? 1,
        frustumCulling: entity.getValue(Camera, "frustumCulling") !== false,
        temporalJitter: [
            readCameraNumber(entity, "temporalJitterX"),
            readCameraNumber(entity, "temporalJitterY"),
        ],
    };
}
export function applyTemporalJitter(projectionMatrix, entity) {
    const jitterX = readCameraNumber(entity, "temporalJitterX");
    const jitterY = readCameraNumber(entity, "temporalJitterY");
    if (jitterX === 0 && jitterY === 0) {
        return;
    }
    projectionMatrix[8] = (projectionMatrix[8] ?? 0) + jitterX;
    projectionMatrix[9] = (projectionMatrix[9] ?? 0) + jitterY;
}
export function lightInput(entity) {
    return {
        kind: (entity.getValue(Light, "kind") ?? "directional"),
        shape: (entity.getValue(Light, "shape") ?? "rect"),
        intensity: entity.getValue(Light, "intensity") ?? 1,
        range: entity.getValue(Light, "range") ?? 10,
        innerConeAngle: entity.getValue(Light, "innerConeAngle") ?? Math.PI / 8,
        outerConeAngle: entity.getValue(Light, "outerConeAngle") ?? Math.PI / 6,
        width: entity.getValue(Light, "width") ?? 2,
        height: entity.getValue(Light, "height") ?? 2,
        layerMask: entity.getValue(Light, "layerMask") ?? 1,
    };
}
export function spriteInput(entity) {
    const texture = parseTextureHandle(entity.getValue(Sprite, "textureId") ?? "");
    const samplerId = entity.getValue(Sprite, "samplerId") ?? "";
    const sampler = samplerId === "" ? null : parseSamplerHandle(samplerId);
    return {
        texture: texture ?? createTextureHandle("__invalid_sprite_texture__"),
        ...(samplerId === ""
            ? {}
            : {
                sampler: sampler ?? createSamplerHandle("__invalid_sprite_sampler__"),
            }),
        size: [
            entity.getValue(Sprite, "width") ?? 1,
            entity.getValue(Sprite, "height") ?? 1,
        ],
        color: Array.from(entity.getVectorView(Sprite, "color")),
        uvRect: Array.from(entity.getVectorView(Sprite, "uvRect")),
        pivot: Array.from(entity.getVectorView(Sprite, "pivot")),
        rotation: entity.getValue(Sprite, "rotation") ?? 0,
        atlasFrame: entity.getValue(Sprite, "atlasFrame") ?? 0,
        coordinateMode: (entity.getValue(Sprite, "coordinateMode") ?? "world"),
        billboardMode: (entity.getValue(Sprite, "billboardMode") ?? "spherical"),
        sizeMode: (entity.getValue(Sprite, "sizeMode") ?? "world-units"),
        blendMode: (entity.getValue(Sprite, "blendMode") ?? "alpha"),
        depthMode: (entity.getValue(Sprite, "depthMode") ?? "test"),
    };
}
export function skyboxInput(entity) {
    const texture = parseTextureHandle(entity.getValue(Skybox, "textureId") ?? "");
    const samplerId = entity.getValue(Skybox, "samplerId") ?? "";
    const sampler = samplerId === "" ? null : parseSamplerHandle(samplerId);
    return {
        texture: texture ?? createTextureHandle("__invalid_skybox_texture__"),
        ...(samplerId === ""
            ? {}
            : {
                sampler: sampler ?? createSamplerHandle("__invalid_skybox_sampler__"),
            }),
        intensity: entity.getValue(Skybox, "intensity") ?? 1,
    };
}
export function proceduralSkyInput(entity) {
    return {
        model: (entity.getValue(ProceduralSky, "model") ??
            "gradient"),
        priority: entity.getValue(ProceduralSky, "priority") ?? 0,
        topColor: Array.from(entity.getVectorView(ProceduralSky, "topColor")),
        horizonColor: Array.from(entity.getVectorView(ProceduralSky, "horizonColor")),
        bottomColor: Array.from(entity.getVectorView(ProceduralSky, "bottomColor")),
        horizonPosition: entity.getValue(ProceduralSky, "horizonPosition") ?? 0.4,
        horizonSoftness: entity.getValue(ProceduralSky, "horizonSoftness") ?? 0.24,
        intensity: entity.getValue(ProceduralSky, "intensity") ?? 1,
        sunDirection: Array.from(entity.getVectorView(ProceduralSky, "sunDirection")),
        sunColor: Array.from(entity.getVectorView(ProceduralSky, "sunColor")),
        sunRadius: entity.getValue(ProceduralSky, "sunRadius") ?? 0.02,
        sunGlow: entity.getValue(ProceduralSky, "sunGlow") ?? 0.35,
        ditherStrength: entity.getValue(ProceduralSky, "ditherStrength") ?? 0.003,
    };
}
export function fogInput(entity) {
    return {
        mode: (entity.getValue(Fog, "mode") ?? FogMode.Linear),
        color: Array.from(entity.getVectorView(Fog, "color")),
        density: entity.getValue(Fog, "density") ?? 0,
        start: entity.getValue(Fog, "start") ?? 1,
        end: entity.getValue(Fog, "end") ?? 1000,
    };
}
export function parseMeshHandle(value) {
    const id = parseAssetId(value, "mesh");
    return id === null ? null : createMeshHandle(id);
}
export function parseMaterialHandle(value) {
    const id = parseAssetId(value, "material");
    return id === null ? null : createMaterialHandle(id);
}
export function parseTextureHandle(value) {
    const id = parseAssetId(value, "texture");
    return id === null ? null : createTextureHandle(id);
}
export function parseSamplerHandle(value) {
    const id = parseAssetId(value, "sampler");
    return id === null ? null : createSamplerHandle(id);
}
export function parseParticleEffectHandle(value) {
    const id = parseAssetId(value, "particle-effect");
    return id === null ? null : createParticleEffectHandle(id);
}
export function parseAudioClipHandle(value) {
    const id = parseAssetId(value, "audio-clip");
    return id === null ? null : createAudioClipHandle(id);
}
function parseAssetId(value, kind) {
    const prefix = `${kind}:`;
    return value.startsWith(prefix) && value.length > prefix.length
        ? value.slice(prefix.length)
        : null;
}
//# sourceMappingURL=extraction-inputs.js.map