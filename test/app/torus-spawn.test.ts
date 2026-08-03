import { describe, expect, it } from "vitest";

import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createMeshHandle, type Entity } from "@aperture-engine/simulation";
import type { MeshAsset } from "@aperture-engine/render";

// `mesh.torus` is the authoring surface for the ring/tube primitive the render
// package has always been able to build. Without it an app that wants a flat
// band on the ground — a selection ring, a charge arc, a decal outline — has to
// fake it with concentric line loops, which read as separate hairline strokes
// with gaps between them instead of one solid band.

describe("app torus spawning", () => {
  it("spawns a solid ring laid out flat in XZ, sized by radius and drawn thickness", async () => {
    const refs: { ring: Entity | null } = { ring: null };

    class RingSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        refs.ring = this.spawn.mesh({
          key: "board.ring",
          mesh: mesh.torus({
            radius: 0.183,
            thickness: 0.008,
            segments: 64,
            tubeSegments: 8,
          }),
          material: material.unlit({ baseColor: [0, 1, 1, 1] }),
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: RingSetupSystem }],
    });
    const snapshot = app.extract(1);
    const draw = snapshot.meshDraws.find(
      (candidate) => candidate.entity.index === refs.ring?.index,
    );
    const meshEntry = app.lowLevel.assets.get<"mesh", MeshAsset>(
      createMeshHandle("board.ring.mesh"),
    );

    expect(snapshot.diagnostics).toEqual([]);
    // Triangles, not lines: one solid band.
    expect(draw?.batchKey.topology).toBe("triangle-list");
    // (segments + 1) x (tubeSegments + 1) vertices, 2 triangles per quad.
    expect(meshEntry?.asset.submeshes[0]?.indexCount).toBe(64 * 8 * 6);

    const positions = positionsOf(meshEntry?.asset);
    const radii = positions.map((position) =>
      Math.hypot(position[0], position[2]),
    );
    const heights = positions.map((position) => position[1]);

    // Authored thickness is the band's DRAWN WIDTH (tube diameter), so the
    // surface spans radius +/- thickness/2 and rises thickness/2 above the
    // plane — the number an author measures off a reference frame.
    expect(Math.min(...radii)).toBeCloseTo(0.183 - 0.004, 6);
    expect(Math.max(...radii)).toBeCloseTo(0.183 + 0.004, 6);
    expect(Math.max(...heights)).toBeCloseTo(0.004, 6);
    expect(Math.min(...heights)).toBeCloseTo(-0.004, 6);

    await app.dispose?.();
  });

  it("defaults every dimension so mesh.torus() alone spawns", async () => {
    class DefaultRingSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.spawn.mesh({
          key: "board.default-ring",
          mesh: mesh.torus(),
          material: material.unlit(),
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: DefaultRingSystem }],
    });

    expect(app.extract(1).diagnostics).toEqual([]);

    const meshEntry = app.lowLevel.assets.get<"mesh", MeshAsset>(
      createMeshHandle("board.default-ring.mesh"),
    );
    const radii = positionsOf(meshEntry?.asset).map((position) =>
      Math.hypot(position[0], position[2]),
    );

    expect(Math.min(...radii)).toBeCloseTo(0.5, 6);
    expect(Math.max(...radii)).toBeCloseTo(1, 6);

    await app.dispose?.();
  });
});

function positionsOf(
  asset: MeshAsset | undefined,
): readonly (readonly [number, number, number])[] {
  const stream = asset?.vertexStreams[0];
  const data = stream?.data;

  if (stream === undefined || !(data instanceof Float32Array)) {
    throw new Error("Torus mesh asset has no float vertex stream.");
  }

  // Primitive meshes interleave position/normal/uv into one stream; position
  // is the first attribute of each vertex.
  const floatsPerVertex = stream.arrayStride / Float32Array.BYTES_PER_ELEMENT;
  const positions: (readonly [number, number, number])[] = [];

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const offset = vertex * floatsPerVertex;
    positions.push([
      data[offset] ?? 0,
      data[offset + 1] ?? 0,
      data[offset + 2] ?? 0,
    ]);
  }

  return positions;
}
