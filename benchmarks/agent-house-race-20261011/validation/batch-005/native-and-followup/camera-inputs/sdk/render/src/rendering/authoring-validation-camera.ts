import {
  CameraProjection,
  type CameraInput,
  type RenderAuthoringDiagnostic,
  type RenderAuthoringValidationReport,
} from "./authoring-types.js";
import { createCamera } from "./authoring-create.js";
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

  if (!Number.isFinite(aspect) || aspect <= 0) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "aspect",
      message: "Cameras require a finite aspect > 0.",
    });
  }

  if (
    projection === CameraProjection.Perspective &&
    (!Number.isFinite(fovYRadians) ||
      fovYRadians <= 0 ||
      fovYRadians >= Math.PI)
  ) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "fovYRadians",
      message: "Perspective cameras require finite 0 < fovYRadians < PI.",
    });
  }

  if (
    projection === CameraProjection.Orthographic &&
    (!Number.isFinite(orthographicHeight) || orthographicHeight <= 0)
  ) {
    diagnostics.push({
      code: "camera.invalidProjection",
      field: "orthographicHeight",
      message: "Orthographic cameras require a finite orthographicHeight > 0.",
    });
  }

  if (!Number.isFinite(near) || near <= 0) {
    diagnostics.push({
      code: "camera.invalidClipRange",
      field: "near",
      message: "Cameras require a finite near > 0.",
    });
  }
  if (!Number.isFinite(far) || far <= near) {
    diagnostics.push({
      code: "camera.invalidClipRange",
      field: "far",
      message: "Cameras require a finite far > near.",
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
