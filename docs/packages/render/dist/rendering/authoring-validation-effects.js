import { FogMode, ParticleSimulationSpace, ProceduralSkyModel, SpriteBillboardMode, SpriteBlendMode, SpriteCoordinateMode, SpriteDepthMode, SpriteSizeMode, } from "./authoring-types.js";
import { createFog, createParticleEmitter, createProceduralSky, createRuntimeUniform, createSkybox, createSprite, } from "./authoring-create.js";
import { tuple4 } from "./authoring-utils.js";
export function validateSpriteInput(input) {
    const sprite = createSprite(input);
    const textureId = sprite.textureId ?? "";
    const width = sprite.width ?? 1;
    const height = sprite.height ?? 1;
    const uvRect = sprite.uvRect ?? [0, 0, 1, 1];
    const pivot = sprite.pivot ?? [0.5, 0.5];
    const rotation = sprite.rotation ?? 0;
    const atlasFrame = sprite.atlasFrame ?? 0;
    const coordinateMode = sprite.coordinateMode ?? SpriteCoordinateMode.World;
    const billboardMode = sprite.billboardMode ?? SpriteBillboardMode.Spherical;
    const sizeMode = sprite.sizeMode ?? SpriteSizeMode.WorldUnits;
    const blendMode = sprite.blendMode ?? SpriteBlendMode.Alpha;
    const depthMode = sprite.depthMode ?? SpriteDepthMode.Test;
    const diagnostics = [];
    if (textureId.trim().length === 0) {
        diagnostics.push({
            code: "sprite.invalidTexture",
            field: "texture",
            message: "Sprites require a texture handle.",
        });
    }
    if (!Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0) {
        diagnostics.push({
            code: "sprite.invalidSize",
            field: "size",
            message: "Sprites require finite positive width and height.",
        });
    }
    if (Array.from(uvRect).some((value) => !Number.isFinite(value)) ||
        (uvRect[2] ?? 0) < 0 ||
        (uvRect[3] ?? 0) < 0) {
        diagnostics.push({
            code: "sprite.invalidUvRect",
            field: "uvRect",
            message: "Sprite uvRect values must be finite with non-negative width and height.",
        });
    }
    if (Array.from(pivot).some((value) => !Number.isFinite(value))) {
        diagnostics.push({
            code: "sprite.invalidPivot",
            field: "pivot",
            message: "Sprite pivot values must be finite numbers.",
        });
    }
    if (!Number.isFinite(rotation)) {
        diagnostics.push({
            code: "sprite.invalidRotation",
            field: "rotation",
            message: "Sprite rotation must be a finite number.",
        });
    }
    if (!Number.isInteger(atlasFrame) || atlasFrame < 0) {
        diagnostics.push({
            code: "sprite.invalidAtlasFrame",
            field: "atlasFrame",
            message: "Sprite atlasFrame must be a non-negative integer.",
        });
    }
    if (!Object.values(SpriteCoordinateMode).includes(coordinateMode)) {
        diagnostics.push({
            code: "sprite.invalidCoordinateMode",
            field: "coordinateMode",
            message: "Sprite coordinateMode must be 'world' or 'screen'.",
        });
    }
    if (!Object.values(SpriteBillboardMode).includes(billboardMode)) {
        diagnostics.push({
            code: "sprite.invalidBillboardMode",
            field: "billboardMode",
            message: "Sprite billboardMode must be 'none', 'spherical', 'cylindrical', or 'axis-locked'.",
        });
    }
    if (!Object.values(SpriteSizeMode).includes(sizeMode)) {
        diagnostics.push({
            code: "sprite.invalidSizeMode",
            field: "sizeMode",
            message: "Sprite sizeMode must be 'world-units' or 'screen-pixels'.",
        });
    }
    if (!Object.values(SpriteBlendMode).includes(blendMode)) {
        diagnostics.push({
            code: "sprite.invalidBlendMode",
            field: "blendMode",
            message: "Sprite blendMode must be 'opaque', 'alpha', 'additive', or 'multiply'.",
        });
    }
    if (!Object.values(SpriteDepthMode).includes(depthMode)) {
        diagnostics.push({
            code: "sprite.invalidDepthMode",
            field: "depthMode",
            message: "Sprite depthMode must be 'test' or 'disabled'.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function validateParticleEmitterInput(input) {
    const emitter = createParticleEmitter(input);
    const diagnostics = [];
    const boundsCenter = emitter.boundsCenter ?? [0, 0, 0];
    const capacity = emitter.capacity ?? 0;
    const seed = emitter.seed ?? 1;
    const resetEpoch = emitter.resetEpoch ?? 0;
    const timeScale = emitter.timeScale ?? 1;
    const boundsRadius = emitter.boundsRadius ?? 0;
    if ((emitter.effectId ?? "").trim().length === 0) {
        diagnostics.push({
            code: "particle.invalidEffect",
            field: "effect",
            message: "Particle emitters require a particle-effect handle.",
        });
    }
    if (capacity !== 0 && (!Number.isInteger(capacity) || capacity < 0)) {
        diagnostics.push({
            code: "particle.invalidCapacity",
            field: "capacity",
            message: "Particle emitter capacity must be zero or a positive integer.",
        });
    }
    if (!Number.isInteger(seed)) {
        diagnostics.push({
            code: "particle.invalidSeed",
            field: "seed",
            message: "Particle emitter seed must be an integer.",
        });
    }
    if (!Number.isInteger(resetEpoch) || resetEpoch < 0) {
        diagnostics.push({
            code: "particle.invalidResetEpoch",
            field: "resetEpoch",
            message: "Particle emitter resetEpoch must be a non-negative integer.",
        });
    }
    if (!Number.isFinite(timeScale) || timeScale < 0) {
        diagnostics.push({
            code: "particle.invalidTimeScale",
            field: "timeScale",
            message: "Particle emitter timeScale must be a non-negative number.",
        });
    }
    if (!Object.values(ParticleSimulationSpace).includes(emitter.simulationSpace)) {
        diagnostics.push({
            code: "particle.invalidSimulationSpace",
            field: "simulationSpace",
            message: "Particle emitter simulationSpace must be 'world' or 'local'.",
        });
    }
    if (!Array.from(boundsCenter).every(Number.isFinite) ||
        !Number.isFinite(boundsRadius) ||
        boundsRadius < 0) {
        diagnostics.push({
            code: "particle.invalidBounds",
            field: "bounds",
            message: "Particle emitter bounds require a finite center and a non-negative radius; radius 0 enables automatic bounds.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function validateSkyboxInput(input) {
    const skybox = createSkybox(input);
    const textureId = skybox.textureId ?? "";
    const intensity = skybox.intensity ?? 1;
    const diagnostics = [];
    if (textureId.trim().length === 0) {
        diagnostics.push({
            code: "skybox.invalidTexture",
            field: "texture",
            message: "Skyboxes require a cube texture handle.",
        });
    }
    if (!Number.isFinite(intensity) || intensity < 0) {
        diagnostics.push({
            code: "skybox.invalidIntensity",
            field: "intensity",
            message: "Skybox intensity must be a finite non-negative number.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function validateProceduralSkyInput(input) {
    const sky = createProceduralSky(input);
    const diagnostics = [];
    const model = sky.model ?? ProceduralSkyModel.Gradient;
    const priority = sky.priority ?? 0;
    const horizonPosition = sky.horizonPosition ?? 0.4;
    const horizonSoftness = sky.horizonSoftness ?? 0.24;
    const intensity = sky.intensity ?? 1;
    const sunDirection = sky.sunDirection ?? [0, 1, 0];
    const sunRadius = sky.sunRadius ?? 0;
    const sunGlow = sky.sunGlow ?? 0;
    const ditherStrength = sky.ditherStrength ?? 0;
    if (!Object.values(ProceduralSkyModel).includes(model)) {
        diagnostics.push({
            code: "proceduralSky.invalidModel",
            field: "model",
            message: "Procedural sky model must be 'gradient'.",
        });
    }
    if (!Number.isInteger(priority)) {
        diagnostics.push({
            code: "proceduralSky.invalidPriority",
            field: "priority",
            message: "Procedural sky priority must be an integer.",
        });
    }
    validateSkyColor(sky.topColor ?? [0, 0, 0], "topColor", diagnostics);
    validateSkyColor(sky.horizonColor ?? [0, 0, 0], "horizonColor", diagnostics);
    validateSkyColor(sky.bottomColor ?? [0, 0, 0], "bottomColor", diagnostics);
    validateSkyColor(sky.sunColor ?? [0, 0, 0], "sunColor", diagnostics);
    if (!Number.isFinite(horizonPosition) ||
        horizonPosition < 0 ||
        horizonPosition > 1 ||
        !Number.isFinite(horizonSoftness) ||
        horizonSoftness < 0) {
        diagnostics.push({
            code: "proceduralSky.invalidHorizon",
            field: "horizon",
            message: "Procedural sky horizonPosition must be in [0,1] and horizonSoftness must be finite and non-negative.",
        });
    }
    if (!Number.isFinite(intensity) || intensity < 0) {
        diagnostics.push({
            code: "proceduralSky.invalidIntensity",
            field: "intensity",
            message: "Procedural sky intensity must be finite and non-negative.",
        });
    }
    if (!Array.from(sunDirection).every(Number.isFinite) ||
        vectorLengthSq(sunDirection) <= 1e-8) {
        diagnostics.push({
            code: "proceduralSky.invalidSunDirection",
            field: "sunDirection",
            message: "Procedural sky sunDirection must be a finite non-zero vec3 direction.",
        });
    }
    if (!Number.isFinite(sunRadius) ||
        sunRadius < 0 ||
        !Number.isFinite(sunGlow) ||
        sunGlow < 0) {
        diagnostics.push({
            code: "proceduralSky.invalidSun",
            field: "sun",
            message: "Procedural sky sunRadius and sunGlow must be finite and non-negative.",
        });
    }
    if (!Number.isFinite(ditherStrength) || ditherStrength < 0) {
        diagnostics.push({
            code: "proceduralSky.invalidDither",
            field: "ditherStrength",
            message: "Procedural sky ditherStrength must be finite and non-negative.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function validateRuntimeUniformInput(input) {
    const uniform = createRuntimeUniform(input);
    const version = uniform.version ?? 0;
    const diagnostics = [];
    if (typeof uniform.key !== "string" || uniform.key.trim().length === 0) {
        diagnostics.push({
            code: "runtimeUniform.invalidKey",
            field: "key",
            message: "Runtime uniform key must be a non-empty string.",
        });
    }
    if (!runtimeUniformValuesValid(uniform.values)) {
        diagnostics.push({
            code: "runtimeUniform.invalidValues",
            field: "values",
            message: "Runtime uniform values must be a plain object of finite numbers, booleans, nulls, strings, or finite numeric arrays.",
        });
    }
    if (!Number.isInteger(version) ||
        version < 0 ||
        !Number.isSafeInteger(version)) {
        diagnostics.push({
            code: "runtimeUniform.invalidVersion",
            field: "version",
            message: "Runtime uniform version must be a non-negative safe integer.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
export function validateFogInput(input) {
    const fog = createFog(input);
    const mode = fog.mode ?? FogMode.Linear;
    const color = fog.color ?? tuple4(0, 0, 0, 1);
    const density = fog.density ?? 0;
    const start = fog.start ?? 1;
    const end = fog.end ?? 1000;
    const diagnostics = [];
    if (!Object.values(FogMode).includes(mode)) {
        diagnostics.push({
            code: "fog.invalidMode",
            field: "mode",
            message: "Fog mode must be 'linear', 'exp', or 'exp2'.",
        });
    }
    if (color.some((value) => !Number.isFinite(value))) {
        diagnostics.push({
            code: "fog.invalidColor",
            field: "color",
            message: "Fog color components must be finite numbers.",
        });
    }
    if ((mode === FogMode.Exp || mode === FogMode.Exp2) &&
        (!Number.isFinite(density) || density < 0)) {
        diagnostics.push({
            code: "fog.invalidDensity",
            field: "density",
            message: "Exponential fog density must be a finite non-negative number.",
        });
    }
    if (mode === FogMode.Linear &&
        (!Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start < 0 ||
            end <= start)) {
        diagnostics.push({
            code: "fog.invalidRange",
            field: "start/end",
            message: "Linear fog requires finite start >= 0 and end greater than start.",
        });
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
function validateSkyColor(color, field, diagnostics) {
    if (Array.from(color)
        .slice(0, 3)
        .every((value) => Number.isFinite(value) && value >= 0)) {
        return;
    }
    diagnostics.push({
        code: "proceduralSky.invalidColor",
        field,
        message: "Procedural sky colors must be finite non-negative RGB values.",
    });
}
function runtimeUniformValuesValid(value) {
    if (!isPlainObject(value)) {
        return false;
    }
    return Object.values(value).every((entry) => {
        if (entry === null) {
            return true;
        }
        if (typeof entry === "boolean" || typeof entry === "string") {
            return true;
        }
        if (typeof entry === "number") {
            return Number.isFinite(entry);
        }
        if (Array.isArray(entry)) {
            return entry.every((item) => typeof item === "number" && Number.isFinite(item));
        }
        return false;
    });
}
function isPlainObject(value) {
    return (typeof value === "object" &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype);
}
function vectorLengthSq(vector) {
    const x = vector[0] ?? 0;
    const y = vector[1] ?? 0;
    const z = vector[2] ?? 0;
    return x * x + y * y + z * z;
}
//# sourceMappingURL=authoring-validation-effects.js.map