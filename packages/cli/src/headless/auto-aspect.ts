import { Camera } from "@aperture-engine/render";
import type { EcsWorld } from "@aperture-engine/simulation";

/**
 * Mirror the browser resize path (`applyViewportResizeCommand` in
 * `@aperture-engine/app`'s worker viewport module) for headless sessions:
 * cameras with `autoAspect` follow the session render target, so recorded
 * projections match the pixels the bundle will be rendered at. Without this,
 * headless cameras keep their spawn-default aspect (1) and every non-square
 * render is horizontally stretched relative to the browser (battletest
 * finding F4).
 *
 * Returns the number of cameras whose aspect changed.
 */
export function syncAutoAspectCameras(
  world: EcsWorld,
  width: number,
  height: number,
): number {
  const targetAspect = width / Math.max(1, height);
  let updated = 0;

  for (const entity of world.queryManager.registerQuery({
    required: [Camera],
  }).entities) {
    if (!entity.active) {
      continue;
    }
    if (entity.getValue(Camera, "autoAspect") === false) {
      continue;
    }

    // Cameras rendering to an offscreen target own their aspect, exactly as
    // in the browser resize path.
    const renderTargetId = entity.getValue(Camera, "renderTargetId") ?? "";
    if (renderTargetId.length > 0) {
      continue;
    }

    const viewport = entity.getVectorView(Camera, "viewport");
    const viewportWidth = finitePositiveNumber(viewport[2]) ?? 1;
    const viewportHeight = finitePositiveNumber(viewport[3]) ?? 1;
    const aspect = targetAspect * (viewportWidth / viewportHeight);

    if (entity.getValue(Camera, "aspect") === aspect) {
      continue;
    }

    entity.setValue(Camera, "aspect", aspect);
    updated += 1;
  }

  return updated;
}

function finitePositiveNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
