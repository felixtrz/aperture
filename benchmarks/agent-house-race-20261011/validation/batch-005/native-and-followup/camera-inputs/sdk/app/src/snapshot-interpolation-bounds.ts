import type { BoundsPacket, RenderSnapshot } from "@aperture-engine/render";
import {
  maxScaleOnAxis,
  transformAabb,
  transformPoint,
  type Mat4Like,
} from "@aperture-engine/simulation";

export function rewriteInterpolatedPacketBounds(options: {
  readonly snapshot: RenderSnapshot;
  readonly boundsIndex: number;
  readonly worldMatrix: Mat4Like;
  readonly writtenBounds: Set<number>;
}): number {
  if (
    options.writtenBounds.has(options.boundsIndex) ||
    options.boundsIndex < 0 ||
    options.boundsIndex >= options.snapshot.bounds.length
  ) {
    return 0;
  }

  const bounds = options.snapshot.bounds[options.boundsIndex];

  if (bounds === undefined) {
    return 0;
  }

  const rewritten: BoundsPacket = {
    ...bounds,
    worldAabb: transformAabb(bounds.localAabb, options.worldMatrix),
    worldSphere: {
      center: transformPoint(options.worldMatrix, bounds.localSphere.center),
      radius: bounds.localSphere.radius * maxScaleOnAxis(options.worldMatrix),
    },
  };

  (options.snapshot.bounds as BoundsPacket[])[options.boundsIndex] = rewritten;
  options.writtenBounds.add(options.boundsIndex);
  return 1;
}
