import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { createApertureProject } from "@aperture-engine/cli";
import type { ApertureHeadlessStatus } from "@aperture-engine/app/headless";
import type { ApertureEntitySummary } from "@aperture-engine/app/entity-lookup";
import {
  renderSnapshotFromJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  preflightApertureSnapshotBundle,
  type ApertureRenderBundle,
} from "../../packages/cli/src/headless/bundle.js";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "packages/cli/dist/bin/aperture.js");
const exec = promisify(execFile);

interface Extraction {
  readonly status: ApertureHeadlessStatus;
  readonly bundle: ApertureRenderBundle;
  readonly snapshot: RenderSnapshot;
}

async function withDiorama(
  run: (source: string, extract: () => Promise<Extraction>) => Promise<void>,
): Promise<void> {
  const temp = await mkdtemp(path.join(os.tmpdir(), "aperture-diorama-"));
  try {
    const project = await createApertureProject({
      cwd: temp,
      name: "scene",
      template: "diorama",
    });
    const scope = path.join(project.targetDir, "node_modules/@aperture-engine");
    await mkdir(scope, { recursive: true });
    await symlink(
      path.join(root, "packages/app"),
      path.join(scope, "app"),
      "dir",
    );
    const out = path.join(temp, "scene.json");
    const args = [
      cli,
      "headless",
      path.join(project.targetDir, "aperture.headless.config.ts"),
      "--out",
      out,
      "--asset-mode",
      "strict",
      "--json",
    ];
    await run(
      path.join(project.targetDir, "src/systems/scene.system.ts"),
      async () => {
        const { stdout } = await exec(process.execPath, args, {
          cwd: root,
          timeout: 60000,
        });
        const bundle = JSON.parse(
          await readFile(out, "utf8"),
        ) as ApertureRenderBundle;
        expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
        expect(bundle).toMatchObject({
          assets: { completeness: "complete", allowPlaceholders: false },
          closure: { missing: [], unready: [], placeholders: [] },
          assetProvenance: { placeholderCount: 0, placeholderIds: [] },
        });
        return {
          status: JSON.parse(stdout) as ApertureHeadlessStatus,
          bundle,
          snapshot: renderSnapshotFromJsonValue(bundle.snapshot.value),
        };
      },
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

function entity(extraction: Extraction, key: string): ApertureEntitySummary {
  const summary = extraction.status.entities.summaries.find(
    (candidate) => candidate.key === key,
  );
  expect(summary, key).toBeDefined();
  return summary!;
}

function expectMatrix(actual: ArrayLike<number>, expected: readonly number[]) {
  expect(actual.length).toBe(16);
  expected.forEach((value, index) => {
    expect(actual[index], `matrix[${index}]`).toBeCloseTo(value, 5);
  });
}

// Independent affine oracle: parent basis columns and a local translation.
function translated(matrix: readonly number[], position: readonly number[]) {
  const result = [...matrix];
  for (let row = 0; row < 3; row++) {
    result[12 + row] = matrix[12 + row]!;
    for (let column = 0; column < 3; column++) {
      result[12 + row]! += matrix[column * 4 + row]! * position[column]!;
    }
  }
  return result;
}

it("extracts the unchanged six starter meshes through Node exports and attributes malformed authored geometry", async () => {
  await withDiorama(async (source, extract) => {
    // Native Node strips types; separately check the generated helper's public types.
    await exec(
      process.execPath,
      [
        path.join(root, "node_modules/typescript/bin/tsc"),
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--module",
        "NodeNext",
        "--target",
        "ES2022",
        "--allowImportingTsExtensions",
        "--resolveJsonModule",
        source,
      ],
      { cwd: root, timeout: 60000 },
    );
    const initial = await extract();
    expect(initial.bundle.renderTarget.planarReflection?.height).toBe(0);
    expect(initial.bundle.closure.roots).toContain("material:water.material");
    expect(initial.snapshot.meshDraws).toHaveLength(6);
    const positions = {
      backdrop: [0, -0.65, 0],
      "water-volume": [0, -0.3, 0],
      water: [0, 0, 0],
      land: [-1.5, 0.15, -1.2],
      "main-mass": [-1.8, 1.65, -1.4],
      "secondary-mass": [1.7, 0.45, 1.2],
    };
    expect(
      initial.snapshot.meshDraws.map((draw) => draw.mesh.id).sort(),
    ).toEqual(
      Object.keys(positions)
        .map((key) => `${key}.mesh`)
        .sort(),
    );
    for (const [key, position] of Object.entries(positions)) {
      const matrix = entity(initial, key).worldTransform!.matrix;
      // Match the old world-coordinate starter exactly, including Float32 rounding.
      expect(matrix.slice(12, 15)).toEqual(position.map(Math.fround));
    }
    for (const key of ["assembly.primary", "assembly.secondary"]) {
      expect(entity(initial, key).componentIds).not.toContain(
        "aperture.render.mesh",
      );
    }
    expect(entity(initial, "land").parent).toEqual(
      entity(initial, "assembly.primary").entity,
    );
    expect(entity(initial, "main-mass").parent).toEqual(
      entity(initial, "assembly.primary").entity,
    );
    expect(entity(initial, "secondary-mass").parent).toEqual(
      entity(initial, "assembly.secondary").entity,
    );

    await writeFile(
      source,
      `
import { createSystem, mesh, material } from "@aperture-engine/app/systems";
export default class InvalidFloor extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.mesh({ key: "bad-floor", mesh: mesh.polygons({ faces: [{
      outline: [[0,0,0],[1,0,0],[1,1,1],[0,0,1]],
    }] }), material: material.standard() });
  }
}
`,
    );
    await expect(extract()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/not coplanar[\s\S]*scene\.system\.ts:\d+/),
    });
  });
}, 90000);

it.each([
  {
    name: "translation",
    pose: "translation: [3, 2, -4]",
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 2, -4, 1],
  },
  {
    name: "rotation",
    pose: "translation: [-1.5, 0, -1], rotationEulerDegrees: [0, 90, 0]",
    matrix: [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, -1.5, 0, -1, 1],
  },
  {
    name: "nonuniform scale",
    pose: "translation: [-1.5, 0, -1], scale: [2, 3, 0.5]",
    matrix: [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0.5, 0, -1.5, 0, -1, 1],
  },
  {
    name: "combined pose",
    pose: "translation: [3, 2, -4], rotationEulerDegrees: [0, 90, 0], scale: [2, 3, 0.5]",
    matrix: [0, 0, -2, 0, 0, 3, 0, 0, 0.5, 0, 0, 0, 3, 2, -4, 1],
  },
])(
  "composes a root's $name through existing and newly authored local children",
  async ({ pose, matrix }) => {
    await withDiorama(async (source, extract) => {
      const generated = await readFile(source, "utf8");
      // A new nested assembly uses the same public group and typed box helper.
      const insertion = "    const secondary = this.spawn.group(";
      expect(generated).toContain(insertion);
      const withChild = generated.replace(
        insertion,
        `    const detail = this.spawn.group({ key: "assembly.detail",
      transform: { parent: primary, translation: [1, 2, 3] } });
    box("detail", [0.3, 0.2, 0.4], [0.5, 0.25, -1], 0xd5a454, detail);
${insertion}`,
      );
      await writeFile(source, withChild);
      const initial = await extract();
      const originalPose = "translation: [-1.5, 0, -1]";
      expect(withChild).toContain(originalPose);
      await writeFile(source, withChild.replace(originalPose, pose));
      const revised = await extract();
      expect(revised.snapshot.meshDraws).toHaveLength(7);
      expect(revised.bundle.assets).toEqual(initial.bundle.assets);
      expect(revised.bundle.renderTarget).toEqual(initial.bundle.renderTarget);

      const primary = entity(revised, "assembly.primary");
      expectMatrix(primary.worldTransform!.matrix, matrix);
      for (const [key, localPosition, parentKey, rootPosition] of [
        ["land", [0, 0.15, -0.2], "assembly.primary", [0, 0.15, -0.2]],
        [
          "main-mass",
          [-0.3, 1.65, -0.4],
          "assembly.primary",
          [-0.3, 1.65, -0.4],
        ],
        ["assembly.detail", [1, 2, 3], "assembly.primary", [1, 2, 3]],
        ["detail", [0.5, 0.25, -1], "assembly.detail", [1.5, 2.25, 2]],
      ] as const) {
        const child = entity(revised, key);
        expect(child.localTransform).toEqual(
          entity(initial, key).localTransform,
        );
        child.localTransform!.translation.forEach((value, axis) =>
          expect(value).toBeCloseTo(localPosition[axis]!, 6),
        );
        expect(child.parent).toEqual(entity(revised, parentKey).entity);
        const expected = translated(matrix, rootPosition);
        expectMatrix(child.worldTransform!.matrix, expected);
        const draw = revised.snapshot.meshDraws.find(
          (candidate) => candidate.mesh.id === `${key}.mesh`,
        );
        if (key === "assembly.detail") {
          expect(draw).toBeUndefined();
        } else {
          expect(draw).toBeDefined();
          expectMatrix(
            revised.snapshot.transforms.slice(
              draw!.worldTransformOffset,
              draw!.worldTransformOffset + 16,
            ),
            expected,
          );
        }
      }
      for (const key of [
        "camera",
        "sun",
        "backdrop",
        "water-volume",
        "water",
        "assembly.secondary",
        "secondary-mass",
      ]) {
        expect(entity(revised, key)).toEqual(entity(initial, key));
      }
      expect(revised.snapshot.views).toEqual(initial.snapshot.views);
      expect(revised.snapshot.lights).toEqual(initial.snapshot.lights);
    });
  },
  120000,
);
