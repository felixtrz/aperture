import {
  FogMode,
  type FogInput,
  type RenderAuthoringDiagnostic,
  type RenderAuthoringValidationReport,
  type SkyboxInput,
  type SpriteInput,
} from "./authoring-types.js";
import { createFog, createSkybox, createSprite } from "./authoring-create.js";
import { tuple4 } from "./authoring-utils.js";

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
