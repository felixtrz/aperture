import { quat as wgpuQuat, type Vec3Arg as WgpuVec3Arg } from "wgpu-matrix";

import { EPSILON } from "./constants.js";
import { quat } from "./constructors.js";
import { v3 } from "./scalars.js";
import type { Quat, Vec3Like } from "./types.js";

export function quatFromAxisAngle(
  axis: Vec3Like,
  radians: number,
  out: Quat = quat(),
): Quat {
  const axisLength = Math.hypot(v3(axis, 0), v3(axis, 1), v3(axis, 2));

  if (axisLength <= EPSILON) {
    return quatIdentityTo(out);
  }

  return wgpuQuat.fromAxisAngle(
    [
      v3(axis, 0) / axisLength,
      v3(axis, 1) / axisLength,
      v3(axis, 2) / axisLength,
    ] as WgpuVec3Arg,
    radians,
    out,
  );
}

function quatIdentityTo(out: Quat): Quat {
  return wgpuQuat.identity(out);
}
