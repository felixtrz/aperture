import type { MeshAsset } from "./types.js";
import type { LatheMeshOptions } from "./lathe-types.js";
import type {
  TriangleListPosition,
  TriangleListUv,
} from "./triangle-list-types.js";
import { LatheMeshError, readLatheProfile } from "./lathe-validation.js";
import {
  createTriangleListMeshAsset,
  TriangleListMeshError,
} from "./primitives-triangle-list.js";

export { LatheMeshError } from "./lathe-validation.js";

/**
 * Revolve [radius, y] around Y: [r*cos(theta), y, r*sin(theta)], starting at +X
 * and turning toward +Z. For a=(i,j), b=(i+1,j), c=(i+1,j+1), d=(i,j+1),
 * emit [a,b,d], [d,b,c]. Ascending outer walls face out; descending inner
 * walls face in. Endpoint poles omit only their analytically collapsed face.
 * No automatic caps, implicit profile closure, or self-intersection repair.
 * Flat normals and owned buffers use the standard triangle-list layout.
 */
export function createLatheMeshAsset(options: LatheMeshOptions): MeshAsset {
  const { label, profile, radialSegments } = readLatheProfile(options);
  const positions: TriangleListPosition[] = [];
  const uvs: TriangleListUv[] = [];
  const indices: number[] = [];
  const facePaths: string[] = [];
  const stride = radialSegments + 1;
  for (let i = 0; i < profile.length; i += 1) {
    const [radius, y] = profile[i]!;
    const first: TriangleListPosition = [radius, y, 0];
    for (let j = 0; j <= radialSegments; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2;
      // Copy the seam exactly, rather than evaluating sin(2*pi). Axis points
      // also use exact zero; their distinct U coordinates still survive.
      positions.push(
        j === 0 || j === radialSegments || radius === 0
          ? [...first]
          : [radius * Math.cos(theta), y, radius * Math.sin(theta)],
      );
      uvs.push([j / radialSegments, i / (profile.length - 1)]);
    }
  }
  for (let i = 0; i < profile.length - 1; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * stride + j;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      const path = `profile[${i}..${i + 1}].segments[${j}]`;
      if (profile[i]![0] !== 0) {
        indices.push(a, b, d);
        facePaths.push(path);
      }
      if (profile[i + 1]![0] !== 0) {
        indices.push(d, b, c);
        facePaths.push(path);
      }
    }
  }
  try {
    return createTriangleListMeshAsset({ label, positions, indices, uvs });
  } catch (error) {
    if (!(error instanceof TriangleListMeshError)) throw error;
    if (error.path === "positions") {
      throw new LatheMeshError(
        "profile",
        "spans a bounding sphere too large for finite float32 storage; use smaller local coordinates and a transform.",
      );
    }
    const corner = /^indices\[(\d+)\.\./.exec(error.path)?.[1];
    if (corner === undefined) throw error;
    throw new LatheMeshError(
      facePaths[Number(corner) / 3]!,
      "forms a zero-area triangle after float32 conversion; increase the radius or point separation, or reduce radialSegments.",
    );
  }
}
