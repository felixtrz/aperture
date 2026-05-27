import type { LightPacket } from "@aperture-engine/render";

export function normalizeLayerMask(
  layerMask: number | undefined,
): number | null {
  if (layerMask === undefined || !Number.isFinite(layerMask)) {
    return null;
  }

  const normalized = Math.trunc(layerMask);

  return normalized === 0 ? null : normalized;
}

export function lightMatchesLayer(
  light: Pick<LightPacket, "layerMask">,
  layerMask: number | null,
): boolean {
  return layerMask === null || (light.layerMask & layerMask) !== 0;
}
