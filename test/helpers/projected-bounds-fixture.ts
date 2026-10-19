import {
  makeOrthographic,
  makePerspective,
  multiplyMat4,
} from "@aperture-engine/simulation";
import type { MeshAsset, ProjectedBoundsInput } from "@aperture-engine/render";
import {
  coplanarFixture,
  identityMatrix,
  inspectionMesh,
  type Position,
} from "./coplanar-overlap-fixture.js";

export const probePoints: Position[] = [
  [-1, 0, 0],
  [1, 0, 0.5],
  [0, 2, -0.5],
];

/** Generic asymmetric card. Parent rotation has sin=.6/cos=.8 and reflection. */
export function projectedBoundsFixture(
  perspective = false,
  indexed = false,
  degenerate = false,
) {
  const sourcePoints: Position[] = indexed
    ? [[80, 90, 70], ...probePoints, [0, 5, 0]]
    : probePoints;
  let mesh: MeshAsset = inspectionMesh(
    sourcePoints,
    indexed ? [0, 0, 0, 1, 2, 3, 4, 4, 4] : undefined,
  );
  if (indexed) {
    // Nonzero backing byte offset AND attribute offset/stride. The leading
    // index range and vertex 0 are inactive outliers, not projected geometry.
    const backing = new Float32Array(4 + sourcePoints.length * 5);
    sourcePoints.forEach((p, i) => backing.set([123, ...p, -456], 4 + i * 5));
    mesh = {
      ...mesh,
      vertexStreams: [
        {
          id: "interleaved",
          arrayStride: 20,
          vertexCount: sourcePoints.length,
          data: new Float32Array(backing.buffer, 16),
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 4 },
          ],
        },
      ],
    };
  }
  const parent = new Float32Array([
    -1.6, -1.2, 0, 0, -1.8, 2.4, 0, 0, 0, 0, 0.5, 0, 1, -1, -2, 1,
  ]);
  const child = new Float32Array([
    1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 2, 0, 0.5, 1, 2, 1,
  ]);
  const resolved = multiplyMat4(parent, child);
  const fixture = coplanarFixture([mesh], [Array.from(resolved)]);
  const view = new Float32Array(identityMatrix);
  view[14] = -10;
  const projection = perspective
    ? makePerspective(Math.PI / 2, 4 / 3, 0.1, 100)
    : makeOrthographic(-8, 8, -6, 6, 0.1, 100);
  const vp = multiplyMat4(projection, view);
  const input: ProjectedBoundsInput = {
    ...fixture.input,
    scope: { meshIds: ["mesh.0"] },
    viewId: 7,
    target: { width: 800, height: 600 },
    snapshot: {
      ...fixture.input.snapshot,
      meshDraws: fixture.input.snapshot.meshDraws.map((d) =>
        indexed ? { ...d, indexStart: 3, indexCount: degenerate ? 6 : 3 } : d,
      ),
      views: [
        {
          viewId: 7,
          camera: { index: 99, generation: 2 },
          priority: 0,
          layerMask: 1,
          viewMatrixOffset: 0,
          projectionMatrixOffset: 16,
          viewProjectionMatrixOffset: 32,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
          clearColor: [0, 0, 0, 1],
          clearDepth: 1,
          clearStencil: 0,
          renderTarget: null,
        },
      ],
      viewMatrices: new Float32Array([...view, ...projection, ...vp]),
      report: { ...fixture.input.snapshot.report, views: 1 },
    },
  };
  // Independent analytic construction, no production matrix/project helper.
  const oracle = (p: Position) => {
    const childX = p[0] + 0.5,
      childY = p[1] * 0.5 + 1,
      childZ = p[2] * 2 + 2;
    const world: Position = [
      1 - 1.6 * childX - 1.8 * childY,
      -1 - 1.2 * childX + 2.4 * childY,
      -2 + 0.5 * childZ,
    ];
    const scale = perspective ? 300 / (10 - world[2]) : 50;
    return {
      world,
      pixel: [400 + world[0] * scale, 300 - world[1] * scale] as const,
    };
  };
  return { input, registry: fixture.registry, mesh, oracle };
}
