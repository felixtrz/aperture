import { assetHandleKey } from "@aperture-engine/simulation";
import {
  CameraProjection,
  FogMode,
  LightKind,
  type CameraInput,
  type FogInput,
  type LightCookieInput,
  type LightInput,
  type LightShadowSettingsInput,
  type RenderAuthoringDiagnostic,
  type RenderAuthoringValidationReport,
  type SkyboxInput,
  type SpriteInput,
} from "./authoring-types.js";
import {
  createCamera,
  createFog,
  createLight,
  createLightShadowSettings,
  createSkybox,
  createSprite,
} from "./authoring-create.js";
import { tuple4, validateRect } from "./authoring-utils.js";

export function validateCameraInput(
  input: CameraInput,
): RenderAuthoringValidationReport {
  const camera = createCamera(input);
  const projection = camera.projection ?? CameraProjection.Perspective;
  const fovYRadians = camera.fovYRadians ?? Math.PI / 3;
  const aspect = camera.aspect ?? 1;
  const near = camera.near ?? 0.1;
  const far = camera.far ?? 1000;
  const orthographicHeight = camera.orthographicHeight ?? 10;
  const viewport = camera.viewport ?? tuple4(0, 0, 1, 1);
  const scissor = camera.scissor ?? tuple4(0, 0, 1, 1);
  const layerMask = camera.layerMask ?? 1;
  const temporalJitterX = camera.temporalJitterX ?? 0;
  const temporalJitterY = camera.temporalJitterY ?? 0;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (
    projection === CameraProjection.Perspective &&
    (fovYRadians <= 0 || fovYRadians >= Math.PI || aspect <= 0)
  ) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "projection",
      message:
        "Perspective cameras require 0 < fovYRadians < PI and aspect > 0.",
    });
  }

  if (projection === CameraProjection.Orthographic && orthographicHeight <= 0) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "orthographicHeight",
      message: "Orthographic cameras require orthographicHeight > 0.",
    });
  }

  if (near <= 0 || far <= near) {
    diagnostics.push({
      code: "camera.invalidClipRange",
      field: "near/far",
      message: "Cameras require near > 0 and far > near.",
    });
  }

  validateRect(viewport, "viewport", diagnostics);
  validateRect(scissor, "scissor", diagnostics);

  if (layerMask === 0) {
    diagnostics.push({
      code: "camera.zeroLayerMask",
      field: "layerMask",
      message: "Camera layerMask must not be zero.",
    });
  }

  if (!Number.isFinite(temporalJitterX) || !Number.isFinite(temporalJitterY)) {
    diagnostics.push({
      code: "camera.invalidTemporalJitter",
      field: "temporalJitter",
      message: "Camera temporalJitter values must be finite numbers.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateLightInput(
  input: LightInput,
): RenderAuthoringValidationReport {
  const light = createLight(input);
  const kind = light.kind ?? LightKind.Directional;
  const intensity = light.intensity ?? 1;
  const range = light.range ?? 10;
  const innerConeAngle = light.innerConeAngle ?? Math.PI / 8;
  const outerConeAngle = light.outerConeAngle ?? Math.PI / 6;
  const width = light.width ?? 2;
  const height = light.height ?? 2;
  const layerMask = light.layerMask ?? 1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (intensity < 0) {
    diagnostics.push({
      code: "light.invalidIntensity",
      field: "intensity",
      message: "Light intensity must be non-negative.",
    });
  }

  if ((kind === LightKind.Point || kind === LightKind.Spot) && range <= 0) {
    diagnostics.push({
      code: "light.invalidRange",
      field: "range",
      message: "Point and spot lights require range > 0.",
    });
  }

  if (
    kind === LightKind.Spot &&
    (outerConeAngle <= 0 ||
      innerConeAngle < 0 ||
      innerConeAngle > outerConeAngle)
  ) {
    diagnostics.push({
      code: "light.invalidSpotCone",
      field: "innerConeAngle/outerConeAngle",
      message: "Spot lights require 0 <= innerConeAngle <= outerConeAngle.",
    });
  }

  if (
    kind === LightKind.RectArea &&
    (!Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0)
  ) {
    diagnostics.push({
      code: "light.invalidAreaSize",
      field: "width/height",
      message: "Area lights require finite width > 0 and height > 0.",
    });
  }

  if (layerMask === 0) {
    diagnostics.push({
      code: "light.zeroLayerMask",
      field: "layerMask",
      message: "Light layerMask must not be zero.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateLightCookieInput(
  input: LightCookieInput,
): RenderAuthoringValidationReport {
  const diagnostics: RenderAuthoringDiagnostic[] = [];
  const textureKey = assetHandleKey(input.texture);
  const intensity = input.intensity ?? 1;

  if (!textureKey.startsWith("texture:")) {
    diagnostics.push({
      code: "lightCookie.invalidTexture",
      field: "texture",
      message: "Light cookie texture must be a texture asset handle.",
    });
  }

  if (!Number.isFinite(intensity) || intensity < 0) {
    diagnostics.push({
      code: "lightCookie.invalidIntensity",
      field: "intensity",
      message: "Light cookie intensity must be a finite non-negative number.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateLightShadowSettingsInput(
  input: LightShadowSettingsInput,
): RenderAuthoringValidationReport {
  const settings = createLightShadowSettings(input);
  const mapSize = settings.mapSize ?? 1024;
  const bias = settings.bias ?? 0;
  const normalBias = settings.normalBias ?? 0;
  const cascadeCount = settings.cascadeCount ?? 1;
  const casterLayerMask = settings.casterLayerMask ?? -1;
  const receiverLayerMask = settings.receiverLayerMask ?? -1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (!Number.isInteger(mapSize) || mapSize <= 0) {
    diagnostics.push({
      code: "shadow.invalidMapSize",
      field: "mapSize",
      message: "Light shadow mapSize must be a positive integer.",
    });
  }

  if (bias < 0 || normalBias < 0) {
    diagnostics.push({
      code: "shadow.invalidBias",
      field: "bias/normalBias",
      message: "Light shadow bias and normalBias must be non-negative.",
    });
  }

  if (!Number.isInteger(cascadeCount) || cascadeCount < 1 || cascadeCount > 4) {
    diagnostics.push({
      code: "shadow.invalidCascadeCount",
      field: "cascadeCount",
      message:
        "Directional shadow cascadeCount must be an integer from 1 to 4.",
    });
  }

  if (casterLayerMask === 0 || receiverLayerMask === 0) {
    diagnostics.push({
      code: "shadow.zeroLayerMask",
      field: "casterLayerMask/receiverLayerMask",
      message: "Light shadow caster and receiver layer masks must not be zero.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateSpriteInput(
  input: SpriteInput,
): RenderAuthoringValidationReport {
  const sprite = createSprite(input);
  const textureId = sprite.textureId ?? "";
  const width = sprite.width ?? 1;
  const height = sprite.height ?? 1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (textureId.trim().length === 0) {
    diagnostics.push({
      code: "sprite.invalidTexture",
      field: "texture",
      message: "Sprites require a texture handle.",
    });
  }

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    diagnostics.push({
      code: "sprite.invalidSize",
      field: "size",
      message: "Sprites require finite positive width and height.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export function validateSkyboxInput(
  input: SkyboxInput,
): RenderAuthoringValidationReport {
  const skybox = createSkybox(input);
  const textureId = skybox.textureId ?? "";
  const intensity = skybox.intensity ?? 1;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

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

export function validateFogInput(
  input: FogInput,
): RenderAuthoringValidationReport {
  const fog = createFog(input);
  const mode = fog.mode ?? FogMode.Linear;
  const color = fog.color ?? tuple4(0, 0, 0, 1);
  const density = fog.density ?? 0;
  const start = fog.start ?? 1;
  const end = fog.end ?? 1000;
  const diagnostics: RenderAuthoringDiagnostic[] = [];

  if (!Object.values(FogMode).includes(mode as FogMode)) {
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

  if (
    (mode === FogMode.Exp || mode === FogMode.Exp2) &&
    (!Number.isFinite(density) || density < 0)
  ) {
    diagnostics.push({
      code: "fog.invalidDensity",
      field: "density",
      message: "Exponential fog density must be a finite non-negative number.",
    });
  }

  if (
    mode === FogMode.Linear &&
    (!Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start)
  ) {
    diagnostics.push({
      code: "fog.invalidRange",
      field: "start/end",
      message:
        "Linear fog requires finite start >= 0 and end greater than start.",
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}
