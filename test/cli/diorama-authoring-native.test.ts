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
import type { CameraLocalInspectionReport } from "@aperture-engine/app/systems";
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

it("inspects generated bounds requests after the entire starter system is replaced", async () => {
  await withDiorama(async (source) => {
    const project = path.resolve(path.dirname(source), "../..");
    const request = path.join(project, "bounds-request.json");
    const scene = (x: number) => `
import { createSystem, mesh, material } from "@aperture-engine/app/systems";
export default class Scene extends createSystem() {
  override init(): void {
    this.spawn.camera({ key: "camera",
      transform: { translation: [0, 0, 10], lookAt: [0, 0, 0] },
      camera: { projection: "orthographic", orthographicHeight: 6, autoAspect: true } });
    const root = this.spawn.group({ key: "assembly.primary",
      transform: { translation: [${x}, 0, 0], scale: [1, 2, 1] } });
    this.spawn.mesh({ key: "primary.shape", mesh: mesh.box({ size: [4, 2, 2] }),
      material: material.standard(), transform: { parent: root } });
    this.spawn.mesh({ key: "assembly.secondary", mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(), transform: { translation: [-2, 0, 0] } });
  }
}
`;
    const inspect = async (x: number) => {
      await writeFile(source, scene(x));
      const { stdout } = await exec(process.execPath, [
        cli,
        "camera",
        "inspect-local",
        path.join(project, "aperture.headless.config.ts"),
        "--request",
        request,
        "--seed",
        "9",
      ]);
      const report = JSON.parse(stdout) as {
        ok: boolean;
        result: CameraLocalInspectionReport;
      };
      expect(report.ok).toBe(true);
      expect(report.result.viewport).toEqual({ width: 1200, height: 900 });
      expect(report.result.subjects.map((subject) => subject.name)).toEqual([
        "assembly.primary",
        "assembly.secondary",
      ]);
      const bounds = report.result.subjects[0]!.bounds!;
      expect(bounds.status).toBe("complete");
      expect(bounds.includeDescendants).toBe(true);
      expect(bounds.meshes).toHaveLength(1);
      expect(bounds.screenBounds!.min[1]).toBeCloseTo(150, 3);
      expect(bounds.screenBounds!.max[1]).toBeCloseTo(750, 3);
      return bounds.screenBounds!;
    };
    const outside = await inspect(3);
    expect(outside.min[0]).toBeCloseTo(750, 3);
    expect(outside.max[0]).toBeCloseTo(1350, 3);
    const inside = await inspect(1);
    expect(inside.min[0]).toBeCloseTo(450, 3);
    expect(inside.max[0]).toBeCloseTo(1050, 3);
  });
}, 120_000);

interface Extraction {
  readonly status: ApertureHeadlessStatus;
  readonly bundle: ApertureRenderBundle;
  readonly snapshot: RenderSnapshot;
}

async function withDiorama(
  run: (
    source: string,
    extract: (args?: readonly string[]) => Promise<Extraction>,
  ) => Promise<void>,
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
      async (extraArgs = []) => {
        const { stdout } = await exec(
          process.execPath,
          [...args, ...extraArgs],
          {
            cwd: root,
            timeout: 60000,
          },
        );
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

it("rebuilds the starter probe from edited mesh dimensions and parent transforms", async () => {
  await withDiorama(async (source, extract) => {
    const project = path.resolve(path.dirname(source), "../..");
    const probe = async (name: string) => {
      const out = path.join(project, name);
      const { stdout } = await exec(
        process.execPath,
        [
          cli,
          "camera",
          "inspect-local",
          path.join(project, "aperture.headless.config.ts"),
          "--request-resource",
          "authoring.cameraProbe",
          "--seed",
          "7",
          "--out",
          out,
        ],
        { cwd: root, timeout: 60000 },
      );
      const saved = await readFile(out, "utf8");
      expect(JSON.parse(saved)).toEqual(JSON.parse(stdout));
      const envelope = JSON.parse(saved) as {
        readonly ok: boolean;
        readonly result: CameraLocalInspectionReport;
      };
      expect(envelope.ok).toBe(true);
      expect(envelope.result.diagnostics).toEqual([]);
      expect(envelope.result.cameraJobDiagnostics).toEqual([]);
      // An explicit distance gauge exports source geometry without inventing targets.
      expect(envelope.result.cameraJob).not.toBeNull();
      expect(envelope.result.cameraJob!.landmarks).toHaveLength(9);
      expect(
        envelope.result.cameraJob!.landmarks.every(
          (point) => point.target === undefined,
        ),
      ).toBe(true);
      return { report: envelope.result, saved, out };
    };
    const initial = await probe("initial-probe.json");
    const initialSubject = initial.report.subjects[0]!;
    expect(initialSubject.name).toBe("main-mass");
    initialSubject.points[0]!.world.forEach((value, axis) =>
      expect(value).toBeCloseTo([-1.8, 2.95, -1.4][axis]!, 5),
    );
    expect(initialSubject.points[0]!.residual).toBeNull();
    expect(initialSubject.faces[0]!.normal).toEqual([0, 0, 1]);
    expect(initialSubject.bounds?.status).toBe("complete");

    const original = await readFile(source, "utf8");
    expect(original).toContain('"main-mass", [2.2, 2.6, 1.8]');
    await writeFile(
      source,
      original
        .replace('"main-mass", [2.2, 2.6, 1.8]', '"main-mass", [2.2, 3.6, 1.8]')
        .replace(
          "translation: [-1.5, 0, -1]",
          "translation: [3, 2, -4], rotationEulerDegrees: [0, 90, 0], scale: [2, 3, 0.5]",
        ),
    );
    const revised = await probe("revised-probe.json");
    const subject = revised.report.subjects[0]!;
    // Independent affine oracle: rotate Y by 90 degrees after nonuniform scale.
    // Root [3,2,-4] + R*S*([-0.3,1.65,-0.4] + [0,3.6/2,0]).
    subject.points[0]!.world.forEach((value, axis) =>
      expect(value).toBeCloseTo([2.8, 12.35, -3.4][axis]!, 5),
    );
    for (const point of subject.points.filter((p) => p.name !== "top")) {
      const x = point.name.endsWith("left") ? -1.01 : 1.01;
      const z = point.name.startsWith("back") ? -0.81 : 0.81;
      const expected = [
        3 + 0.5 * (z - 0.4),
        2 + 3 * (1.8 + 1.65),
        -4 - 2 * (x - 0.3),
      ];
      point.world.forEach((value, axis) =>
        expect(value).toBeCloseTo(expected[axis]!, 5),
      );
    }
    expect(subject.faces[0]!.status).toBe("ok");
    subject.faces[0]!.normal!.forEach((value, axis) =>
      expect(value).toBeCloseTo([1, 0, 0][axis]!, 5),
    );
    expect(subject.bounds?.status).toBe("complete");
    expect(subject.bounds?.meshes).toHaveLength(1);
    expect(
      Math.max(
        ...subject.bounds!.meshes[0]!.corners.map((corner) => corner.world[1]),
      ),
    ).toBeCloseTo(12.35, 5);
    expect(revised.report.camera).toEqual(initial.report.camera);
    expect(await readFile(initial.out, "utf8")).toBe(initial.saved);
    const extracted = await extract();
    expect(extracted.snapshot.meshDraws).toHaveLength(6);
    expect(subject.entity).toEqual(entity(extracted, "main-mass").entity);
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

it("uses the generated reference files for explicit camera calibration, fresh targets and independent shape checks", async () => {
  await withDiorama(async (source, extract) => {
    const project = path.resolve(path.dirname(source), "../..");
    const observationFile = path.join(project, "camera-observations.json");
    const planFile = path.join(project, "camera-fit-plan.json");
    const original = await readFile(source, "utf8");
    const blank = JSON.parse(await readFile(observationFile, "utf8")) as {
      points: Record<
        string,
        Record<string, { pixel: number[] | null; role: string }>
      >;
    };
    const inspect = async (
      name: string,
    ): Promise<CameraLocalInspectionReport> => {
      const { stdout } = await exec(
        process.execPath,
        [
          cli,
          "camera",
          "inspect-local",
          path.join(project, "aperture.headless.config.ts"),
          "--request-resource",
          "authoring.cameraProbe",
          "--seed",
          "7",
          "--out",
          path.join(project, name),
        ],
        { cwd: root, timeout: 60000 },
      );
      const envelope = JSON.parse(stdout) as {
        ok: boolean;
        result: CameraLocalInspectionReport;
      };
      expect(envelope.ok).toBe(true);
      return envelope.result;
    };
    const fit = (name: string) =>
      exec(
        process.execPath,
        [
          cli,
          "camera",
          "fit-local",
          path.join(project, "aperture.headless.config.ts"),
          "--request-resource",
          "authoring.cameraProbe",
          "--fit-plan",
          planFile,
          "--seed",
          "7",
          "--out",
          path.join(project, name),
        ],
        { cwd: root, timeout: 60000 },
      );
    const unmeasured = await inspect("empty-inspection.json");
    expect(unmeasured.subjects).toHaveLength(2);
    expect(
      unmeasured.subjects
        .flatMap((s) => s.points)
        .every((p) => p.target === undefined && p.residual === null),
    ).toBe(true);
    await writeFile(
      path.join(project, "empty-fit.json"),
      "old report must not become a current result\n",
    );
    await expect(fit("empty-fit.json")).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("aperture.camera.invalidJob"),
    });
    expect(await readFile(path.join(project, "empty-fit.json"), "utf8")).toBe(
      "old report must not become a current result\n",
    );

    const initialExtraction = await extract();
    // Actual encoded vertices, not an AABB or a duplicate point formula.
    const verifySurfaceVertices = (
      report: CameraLocalInspectionReport,
      extraction: Extraction,
    ) => {
      for (const subject of report.subjects) {
        const meshId =
          subject.name === "ground" ? "land.mesh" : "main-mass.mesh";
        const encoded = extraction.bundle.assets.entries.find(
          (e) => e.handle.id === meshId,
        )!.asset as unknown as {
          vertexStreams: {
            arrayStride: number;
            vertexCount: number;
            data: { base64: string };
          }[];
        };
        const stream = encoded.vertexStreams[0]!;
        const bytes = Buffer.from(stream.data.base64, "base64");
        const data = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        );
        const positions = Array.from({ length: stream.vertexCount }, (_, i) =>
          [0, 4, 8].map((offset) =>
            data.getFloat32(i * stream.arrayStride + offset, true),
          ),
        );
        for (const point of subject.points.filter((p) => p.name !== "top")) {
          expect(
            positions.some((vertex) =>
              vertex.every(
                (value, axis) => Math.abs(value - point.local[axis]!) < 1e-6,
              ),
            ),
            `${subject.name}/${point.name}`,
          ).toBe(true);
        }
      }
    };
    verifySurfaceVertices(unmeasured, initialExtraction);

    // Independent scalar projection of known mesh dimensions and world transforms.
    const eye = [10, 10, 13],
      look = [0, 0.6, 0];
    const back = eye.map((value, axis) => value - look[axis]!);
    const length = Math.hypot(...back);
    back.forEach((v, i) => (back[i] = v / length));
    const right = [back[2]!, 0, -back[0]!];
    const rightLength = Math.hypot(...right);
    right.forEach((v, i) => (right[i] = v / rightLength));
    const up = [
      back[1]! * right[2]!,
      back[2]! * right[0]! - back[0]! * right[2]!,
      -back[1]! * right[0]!,
    ];
    const projected = (world: readonly number[]) => {
      const relative = world.map((value, axis) => value - look[axis]!);
      const dot = (basis: number[]) =>
        relative.reduce((sum, value, axis) => sum + value * basis[axis]!, 0);
      return [600 + (900 / 10.5) * dot(right), 450 - (900 / 10.5) * dot(up)];
    };
    const signs: Record<string, number[]> = {
      "back-left": [-1, -1],
      "back-right": [1, -1],
      "front-right": [1, 1],
      "front-left": [-1, 1],
    };
    const measured = structuredClone(blank);
    for (const [subject, points] of Object.entries(measured.points)) {
      const center =
        subject === "ground" ? [-1.5, 0.15, -1.2] : [-1.8, 1.65, -1.4];
      const size = subject === "ground" ? [4.5, 0.45, 3.8] : [2.2, 2.6, 1.8];
      const bevel = Math.min(...size) * 0.05;
      for (const [name, observation] of Object.entries(points)) {
        const sign = signs[name]!;
        observation.pixel = projected([
          center[0]! + sign[0]! * (size[0]! / 2 - bevel),
          center[1]! + size[1]! / 2,
          center[2]! + sign[1]! * (size[2]! / 2 - bevel),
        ]);
      }
    }
    await writeFile(observationFile, JSON.stringify(measured));
    const wrongShape = original
      .replace('"main-mass", [2.2, 2.6, 1.8]', '"main-mass", [2.2, 3.4, 1.8]')
      .replace("translation: [10, 10, 13]", "translation: [12, 8, 11]")
      .replace("orthographicHeight: 10.5", "orthographicHeight: 12");
    await writeFile(source, wrongShape);
    const { stdout } = await fit("accepted-fit.json");
    const accepted = JSON.parse(stdout) as {
      cameraApplied: boolean;
      result: {
        fit: { accepted: boolean };
        spawnCamera: { transform: object; camera: object };
      };
    };
    expect(accepted.cameraApplied).toBe(false);
    expect(accepted.result.fit.accepted).toBe(true);
    expect(await readFile(source, "utf8")).toBe(wrongShape);
    const proposal = accepted.result.spawnCamera;
    const applied = wrongShape.replace(
      /const view = \{[\s\S]*?\} satisfies SpawnCameraOptions;/,
      `const view = { transform: ${JSON.stringify(proposal.transform)}, camera: {
        frustumCulling: false, clearColor: color(0xf5efe3), ...${JSON.stringify(proposal.camera)}
      } } satisfies SpawnCameraOptions;`,
    );
    expect(applied).not.toBe(wrongShape);
    await writeFile(source, applied);
    const calibrated = await inspect("calibrated.json");
    const ground = calibrated.subjects.find((s) => s.name === "ground")!;
    const main = calibrated.subjects.find((s) => s.name === "main-mass")!;
    expect(Math.max(...ground.points.map((p) => p.errorPixels!))).toBeLessThan(
      0.002,
    );
    expect(
      Math.min(
        ...main.points.filter((p) => p.target).map((p) => p.errorPixels!),
      ),
    ).toBeGreaterThan(20);
    const appliedExtraction = await extract();
    expect(appliedExtraction.bundle.renderTarget).toEqual(
      initialExtraction.bundle.renderTarget,
    );
    expect(appliedExtraction.snapshot.views[0]!.clearColor).toEqual(
      initialExtraction.snapshot.views[0]!.clearColor,
    );
    expect(entity(appliedExtraction, "camera").entity).toEqual(
      entity(initialExtraction, "camera").entity,
    );
    expect(appliedExtraction.snapshot.meshDraws).toHaveLength(6);
    const saved = await readFile(path.join(project, "calibrated.json"), "utf8");
    await writeFile(
      source,
      applied.replace(
        '"main-mass", [2.2, 3.4, 1.8]',
        '"main-mass", [2.2, 2.6, 1.8]',
      ),
    );
    const corrected = await inspect("corrected.json");
    expect(
      Math.max(
        ...corrected.subjects
          .flatMap((s) => s.points)
          .filter((p) => p.target)
          .map((p) => p.errorPixels!),
      ),
    ).toBeLessThan(0.002);
    const beforeObservationEdit = await extract();
    measured.points.ground!["back-left"]!.pixel![0]! += 3;
    measured.points.ground!["back-left"]!.role = "reviewed-observation";
    await writeFile(observationFile, JSON.stringify(measured));
    const changed = await inspect("changed-observations.json");
    const oldPoint = corrected.subjects.find((s) => s.name === "ground")!
      .points[0]!;
    const newPoint = changed.subjects.find((s) => s.name === "ground")!
      .points[0]!;
    expect(newPoint.world).toEqual(oldPoint.world);
    expect(newPoint.target![0] - oldPoint.target![0]).toBe(3);
    expect(newPoint.residual![0] - oldPoint.residual![0]).toBeCloseTo(-3, 8);
    const afterObservationEdit = await extract();
    expect(afterObservationEdit.bundle.snapshot).toEqual(
      beforeObservationEdit.bundle.snapshot,
    );
    expect(afterObservationEdit.bundle.assets).toEqual(
      beforeObservationEdit.bundle.assets,
    );
    expect(await readFile(path.join(project, "calibrated.json"), "utf8")).toBe(
      saved,
    );

    for (const pixel of [["3", 4], [1], [1, 2, 3], [1e13, 2]]) {
      const invalid = structuredClone(blank) as unknown as {
        points: Record<string, Record<string, { pixel: unknown }>>;
      };
      invalid.points.ground!["back-left"]!.pixel = pixel;
      await writeFile(observationFile, JSON.stringify(invalid));
      await expect(inspect("invalid.json")).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringMatching(
          /ground[\s\S]*back-left[\s\S]*pixel must/,
        ),
      });
    }
    for (const points of [
      { typo: {} },
      { ground: { typo: { pixel: null } } },
    ]) {
      await writeFile(observationFile, JSON.stringify({ points }));
      await expect(inspect("unknown.json")).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("unknown construction"),
      });
    }
    await writeFile(observationFile, JSON.stringify({ points: {} }));
    expect(
      (await inspect("missing.json")).subjects
        .flatMap((s) => s.points)
        .every((p) => p.target === undefined),
    ).toBe(true);

    // The same construction helper must also follow an actual unbeveled surface.
    await writeFile(
      source,
      original.replace(
        'key === "water-volume";',
        'key === "water-volume" || key === "land";',
      ),
    );
    const plain = await inspect("plain-land.json");
    const plainGround = plain.subjects.find((s) => s.name === "ground")!;
    expect(plainGround.points[0]!.local).toEqual([-2.25, 0.225, -1.9]);
    verifySurfaceVertices(plain, await extract());
  });
}, 120000);

it("applies the literal local pan example to axis-aligned and oblique cameras with both image signs", async () => {
  await withDiorama(async (source, extract) => {
    const original = await readFile(source, "utf8");
    const guide = await readFile(
      path.resolve(path.dirname(source), "../../DIORAMA.md"),
      "utf8",
    );
    const pan = [...guide.matchAll(/```ts\n([\s\S]*?)\n```/g)][0]![1]!;
    const dimensions = ["--render-width", "1200", "--render-height", "900"];
    const projectPixel = (result: Extraction, point: readonly number[]) => {
      const offset = result.snapshot.views[0]!.viewProjectionMatrixOffset;
      const m = result.snapshot.viewMatrices.subarray(offset, offset + 16);
      const clip = [0, 1, 2, 3].map(
        (row) =>
          m[row]! * point[0]! +
          m[4 + row]! * point[1]! +
          m[8 + row]! * point[2]! +
          m[12 + row]!,
      );
      return [600 * (1 + clip[0]! / clip[3]!), 450 * (1 - clip[1]! / clip[3]!)];
    };
    for (const axisAligned of [true, false]) {
      const baselineSource = axisAligned
        ? original.replace(
            "translation: [10, 10, 13], lookAt: [0, 0.6, 0]",
            "translation: [0, 0, 10], lookAt: [0, 0, 0]",
          )
        : original;
      await writeFile(source, baselineSource);
      const baseline = await extract(dimensions);
      for (const [dx, dy] of [
        [30, 20],
        [-30, -20],
      ]) {
        const literal = pan.replace(
          "const dx = 30, dy = 20",
          `const dx = ${dx}, dy = ${dy}`,
        );
        // Stale quaternion and Euler settings would override lookAt if spread forward.
        const withStaleOrientation = baselineSource
          .replace(
            "translation: [",
            "rotation: [0, 0, 0, 1], rotationEulerDegrees: [40, 20, 10], translation: [",
          )
          .replace(
            "} satisfies SpawnCameraOptions;",
            "} satisfies SpawnCameraOptions as SpawnCameraOptions & { transform: { translation: Vec3Tuple; lookAt: Vec3Tuple }; camera: { orthographicHeight: number } };",
          );
        await writeFile(
          source,
          (dx! > 0 ? baselineSource : withStaleOrientation).replace(
            '    this.spawn.camera({ key: "camera", ...view });',
            `${literal}\n    this.spawn.camera({ key: "camera", ...view });`,
          ),
        );
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
        const shifted = await extract(dimensions);
        for (const point of [
          [0, 0, 0],
          [2, 3, -1],
          [-4, 1, 2],
        ]) {
          const a = projectPixel(baseline, point),
            b = projectPixel(shifted, point);
          expect(b[0]! - a[0]!).toBeCloseTo(dx!, 2);
          expect(b[1]! - a[1]!).toBeCloseTo(dy!, 2);
        }
        // Actual ECS-resolved camera basis and projection scale remain unchanged.
        const before = entity(baseline, "camera").worldTransform!.matrix;
        const after = entity(shifted, "camera").worldTransform!.matrix;
        before
          .slice(0, 12)
          .forEach((v, i) => expect(after[i]).toBeCloseTo(v, 5));
        const p = baseline.snapshot.views[0]!.projectionMatrixOffset;
        expect(shifted.snapshot.viewMatrices.subarray(p, p + 16)).toEqual(
          baseline.snapshot.viewMatrices.subarray(p, p + 16),
        );
        if (axisAligned) {
          expect(after[12]! - before[12]!).toBeCloseTo((-dx! * 10.5) / 900, 5);
          expect(after[13]! - before[13]!).toBeCloseTo((dy! * 10.5) / 900, 5);
          expect(after[14]).toBe(before[14]);
        }
        for (const summary of baseline.status.entities.summaries.filter(
          (e) => e.key !== "camera",
        ))
          expect(entity(shifted, summary.key!).worldTransform).toEqual(
            summary.worldTransform,
          );
        expect(shifted.bundle.assets).toEqual(baseline.bundle.assets);
        expect(shifted.bundle.renderTarget).toEqual(
          baseline.bundle.renderTarget,
        );
        expect(shifted.snapshot.lights).toEqual(baseline.snapshot.lights);
      }
    }
  });
}, 90000);

it("applies the literal sun-aim example without changing geometry, camera, fill or shadow settings", async () => {
  await withDiorama(async (source, extract) => {
    const original = await readFile(source, "utf8");
    const guide = await readFile(
      path.resolve(path.dirname(source), "../../DIORAMA.md"),
      "utf8",
    );
    const sun = [...guide.matchAll(/```ts\n([\s\S]*?)\n```/g)][1]![1]!;
    const baseline = await extract();
    const oldSun = / {4}this\.spawn\.light\(\{[\s\S]*?\n {4}\}\);/;
    expect(original.match(oldSun)).not.toBeNull();
    await writeFile(source, original.replace(oldSun, sun));
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
    const aimed = await extract();
    const matrix = entity(aimed, "sun").worldTransform!.matrix;
    const direction = [-4, 8, 4].map((v) => v / Math.sqrt(96));
    direction.forEach((v, i) => expect(matrix[8 + i]).toBeCloseTo(v, 5));
    expect(-matrix[8]! / matrix[9]!).toBeCloseTo(0.5, 5);
    expect(-matrix[10]! / matrix[9]!).toBeCloseTo(-0.5, 5);
    expect(aimed.snapshot.lights).toEqual(baseline.snapshot.lights);
    expect(aimed.snapshot.shadowRequests).toEqual(
      baseline.snapshot.shadowRequests,
    );
    expect(aimed.snapshot.environments).toEqual(baseline.snapshot.environments);
    expect(aimed.snapshot.viewMatrices).toEqual(baseline.snapshot.viewMatrices);
    expect(aimed.bundle.assets).toEqual(baseline.bundle.assets);
    expect(aimed.bundle.renderTarget).toEqual(baseline.bundle.renderTarget);
    for (const summary of baseline.status.entities.summaries.filter(
      (e) => e.key !== "sun",
    ))
      expect(entity(aimed, summary.key!).worldTransform).toEqual(
        summary.worldTransform,
      );
  });
}, 90000);
