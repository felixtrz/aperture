import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { createSystem } from "@aperture-engine/app/systems";
import {
  createApertureSnapshotBundle,
  createNodeApertureAssetLoader,
  preflightApertureSnapshotBundle,
} from "@aperture-engine/cli";
import {
  createGltfReportDrivenImportReportFromGlb,
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
  type MeshAsset,
} from "@aperture-engine/render";
import { gameTemplateFiles } from "../../packages/cli/src/create/templates/game.js";
import { glbViewerTemplateFiles } from "../../packages/cli/src/create/templates/glb-viewer.js";
import { SAMPLE_CUBE_GLB_BASE64 } from "../../packages/cli/src/create/templates/sample-cube.js";

const source = Buffer.from(SAMPLE_CUBE_GLB_BASE64, "base64");
const fixturePaths = [
  "examples/assets/cube.glb",
  "examples/developer-api/public/assets/cube.glb",
];

// Decode the fixture independently of Aperture's importer. Winding is a
// mesh-local property; a reflected world matrix must not determine this test.
function rawCube(bytes: Buffer) {
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
  const binaryOffset = 28 + bytes.readUInt32LE(12);
  expect(bytes.readUInt32LE(binaryOffset - 4)).toBe(0x004e4942);
  const root = JSON.parse(bytes.toString("utf8", 20, binaryOffset - 8)) as {
    accessors: {
      bufferView: number;
      byteOffset: number;
      count: number;
      componentType: number;
      type: string;
    }[];
    bufferViews: { byteOffset: number; byteLength: number }[];
    meshes: {
      primitives: { attributes: { POSITION: number }; indices: number }[];
    }[];
  };
  const primitive = required(required(root.meshes[0]).primitives[0]);
  const position = required(root.accessors[primitive.attributes.POSITION]);
  const index = required(root.accessors[primitive.indices]);
  expect(position).toMatchObject({
    componentType: 5126,
    type: "VEC3",
    count: 8,
  });
  expect(index).toMatchObject({
    componentType: 5123,
    type: "SCALAR",
    count: 36,
  });
  const positionOffset =
    binaryOffset +
    required(root.bufferViews[position.bufferView]).byteOffset +
    position.byteOffset;
  const indexOffset =
    binaryOffset +
    required(root.bufferViews[index.bufferView]).byteOffset +
    index.byteOffset;
  return {
    positions: Array.from({ length: position.count * 3 }, (_, i) =>
      bytes.readFloatLE(positionOffset + i * 4),
    ),
    indices: Array.from({ length: index.count }, (_, i) =>
      bytes.readUInt16LE(indexOffset + i * 2),
    ),
    indexOffset,
  };
}

type Vec3 = readonly [number, number, number];
const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const subtract = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

function cubeGeometry(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
) {
  const vertex = (i: number): Vec3 => [
    required(positions[i * 3]),
    required(positions[i * 3 + 1]),
    required(positions[i * 3 + 2]),
  ];
  const edges = new Map<string, number[]>();
  const outward: number[] = [];
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [
      required(indices[i]),
      required(indices[i + 1]),
      required(indices[i + 2]),
    ] as const;
    const [a, b, c] = ids.map(vertex) as [Vec3, Vec3, Vec3];
    // This fixture is centered on the origin, so the face centroid points out.
    const center: Vec3 = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ];
    outward.push(dot(cross(subtract(b, a), subtract(c, a)), center));
    volume += dot(a, cross(b, c)) / 6;
    for (const [u, v] of [
      [ids[0], ids[1]],
      [ids[1], ids[2]],
      [ids[2], ids[0]],
    ] as const) {
      expect(u).not.toBe(v);
      const key = `${Math.min(u, v)}:${Math.max(u, v)}`;
      const directions = edges.get(key) ?? [];
      directions.push(u < v ? 1 : -1);
      edges.set(key, directions);
    }
  }
  return { outward, volume, edges };
}

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing sample cube fixture data");
  return value;
}

function meshData(mesh: MeshAsset) {
  const stream = required(
    mesh.vertexStreams.find((candidate) =>
      candidate.attributes.some(
        (attribute) => attribute.semantic === "POSITION",
      ),
    ),
  );
  expect(stream.arrayStride).toBe(12);
  expect(stream.attributes).toEqual([
    { semantic: "POSITION", format: "float32x3", offset: 0 },
  ]);
  expect(mesh.indexBuffer?.format).toBe("uint16");
  const positionBytes = new DataView(
    stream.data.buffer,
    stream.data.byteOffset,
    stream.data.byteLength,
  );
  return {
    positions: Array.from({ length: stream.vertexCount * 3 }, (_, i) =>
      positionBytes.getFloat32(i * 4, true),
    ),
    indices: Array.from(required(mesh.indexBuffer).data),
  };
}

describe("sample cube GLB fixture winding", () => {
  it("keeps both example fixtures and generated scaffold copies byte-identical", () => {
    for (const path of fixturePaths) expect(readFileSync(path)).toEqual(source);
    for (const files of [gameTemplateFiles(), glbViewerTemplateFiles()]) {
      const cube = required(
        files.find((file) => file.path.endsWith("-cube.glb")),
      );
      expect(cube.contents).toEqual(source);
    }
  });

  it("changes only the second and third indices of each original triangle", () => {
    const { indexOffset, indices } = rawCube(source);
    const reversed = Buffer.from(source);
    for (let i = 0; i < indices.length; i += 3) {
      reversed.writeUInt16LE(
        required(indices[i + 2]),
        indexOffset + (i + 1) * 2,
      );
      reversed.writeUInt16LE(
        required(indices[i + 1]),
        indexOffset + (i + 2) * 2,
      );
    }
    // Reversing the repair reconstructs the exact original file, proving that
    // JSON, materials, transform, positions, GLB layout and padding did not move.
    expect(createHash("sha256").update(reversed).digest("hex")).toBe(
      "8695ee54cfdb56020c754dff6ba93fab97c3ae14bef3d46d36c1474ab2e789d9",
    );
  });

  it("has twelve outward-facing triangles and positive mesh-local volume", () => {
    const { positions, indices } = rawCube(source);
    const geometry = cubeGeometry(positions, indices);
    expect(geometry.outward).toHaveLength(12);
    for (const orientation of geometry.outward)
      expect(orientation).toBeGreaterThan(0);
    expect(geometry.volume).toBeCloseTo(1.4 ** 3, 6);
  });

  it("is watertight with opposing directions on every shared edge", () => {
    const { positions, indices } = rawCube(source);
    const { edges } = cubeGeometry(positions, indices);
    expect(edges.size).toBe(18);
    for (const directions of edges.values()) {
      expect(directions).toHaveLength(2);
      expect(directions[0]).toBe(-required(directions[1]));
    }
  });

  it.each([false, true])(
    "preserves source winding on import (reversed: %s)",
    (reverse) => {
      const bytes = Buffer.from(source);
      const raw = rawCube(bytes);
      if (reverse) {
        for (let i = 0; i < raw.indices.length; i += 3) {
          bytes.writeUInt16LE(
            required(raw.indices[i + 2]),
            raw.indexOffset + (i + 1) * 2,
          );
          bytes.writeUInt16LE(
            required(raw.indices[i + 1]),
            raw.indexOffset + (i + 2) * 2,
          );
        }
      }
      const expected = rawCube(bytes);
      const report = createGltfReportDrivenImportReportFromGlb({
        source: bytes,
        createMeshAssets: true,
        createAssetMapping: true,
      });
      expect(report.valid).toBe(true);
      const imported = meshData(
        required(report.importReport?.meshConstruction?.meshes[0]?.mesh),
      );
      expect(imported).toEqual({
        positions: expected.positions,
        indices: expected.indices,
      });
      expect(
        Math.sign(cubeGeometry(imported.positions, imported.indices).volume),
      ).toBe(reverse ? -1 : 1);
      expect(
        report.importReport?.sceneTraversal.nodes[0]?.localTransform,
      ).toEqual({
        kind: "trs",
        translation: [0, 0, 0],
        rotation: [0, 0.258819, 0, 0.965926],
        scale: [1, 1, 1],
      });
    },
  );

  it("preserves corrected geometry through headless import and a JSON render bundle", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          cube: asset.gltf(
            `data:model/gltf-binary;base64,${source.toString("base64")}`,
            { preload: "blocking" },
          ),
        },
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
      }),
      systems: [
        {
          default: class extends createSystem({ priority: 0 }) {
            override init(): void {
              this.spawn.camera({
                key: "camera",
                transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
              });
              this.spawn.gltf(this.assets.gltf("cube"), { key: "cube" });
            }
          },
        },
      ],
      assetLoader: createNodeApertureAssetLoader({ mode: "strict" }),
    });
    try {
      const { snapshot } = runner.step(1 / 60, 0);
      expect(snapshot.meshDraws).toHaveLength(1);
      const draw = required(snapshot.meshDraws[0]);
      const column = (i: number): Vec3 => {
        const offset = draw.worldTransformOffset + i * 4;
        return [
          required(snapshot.transforms[offset]),
          required(snapshot.transforms[offset + 1]),
          required(snapshot.transforms[offset + 2]),
        ];
      };
      expect(dot(column(0), cross(column(1), column(2)))).toBeCloseTo(1, 6);
      const bundle = createApertureSnapshotBundle({
        snapshot,
        assets: runner.app.lowLevel.assets,
      });
      const roundTrip = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
      expect(preflightApertureSnapshotBundle(roundTrip).ok).toBe(true);
      const serializedMesh = required(
        roundTrip.assets.entries.find(
          (entry) =>
            entry.handle.kind === "mesh" && entry.handle.id === draw.mesh.id,
        ),
      );
      const decoded = meshData(
        decodeTypedArrayTree(serializedMesh.asset) as MeshAsset,
      );
      const raw = rawCube(source);
      expect(decoded).toEqual({
        positions: raw.positions,
        indices: raw.indices,
      });
      expect(
        cubeGeometry(decoded.positions, decoded.indices).volume,
      ).toBeGreaterThan(0);
      expect(
        renderSnapshotFromJsonValue(roundTrip.snapshot.value).transforms,
      ).toEqual(snapshot.transforms);
      const material = required(
        roundTrip.assets.entries.find(
          (entry) =>
            entry.handle.kind === "material" &&
            entry.handle.id === draw.material.id,
        ),
      );
      expect(decodeTypedArrayTree(material.asset)).toMatchObject({
        renderState: { frontFace: "ccw", cullMode: "back" },
      });
    } finally {
      await runner.app.dispose();
    }
  });
});
