import { assetHandleKey } from "@aperture-engine/simulation";
import {
  LightKind,
  type LightCookieInput,
  type LightInput,
  type LightShadowSettingsInput,
  type RenderAuthoringDiagnostic,
  type RenderAuthoringValidationReport,
} from "./authoring-types.js";
import { createLight, createLightShadowSettings } from "./authoring-create.js";

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
