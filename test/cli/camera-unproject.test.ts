import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  composeTrsMatrix,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
} from "@aperture-engine/math";
import { runApertureCli } from "@aperture-engine/cli";
import {
  unprojectCameraPixels,
  type CameraUnprojectJob,
} from "../../packages/cli/src/camera/unproject.js";

type Vec3 = readonly [number, number, number];
function job(
  projection: "perspective" | "orthographic" = "perspective",
): CameraUnprojectJob {
  return {
    viewport: { width: 800, height: 600 },
    camera: {
      translation: [0, 0, 10],
      lookAt: [0, 0, 0],
      near: 1,
      far: 20,
      ...(projection === "perspective"
        ? { projection, fovYDegrees: 90 }
        : { projection, orthographicHeight: 6 }),
    },
    plane: { normal: [0, 0, 1], constant: 0 },
    pixels: [
      { name: "center", pixel: [400, 300] },
      { name: "corner", pixel: [200, 200] },
    ],
  };
}
function close(
  actual: readonly number[] | null,
  expected: readonly number[],
  digits = 5,
) {
  expect(actual).not.toBeNull();
  expected.forEach((value, i) => expect(actual![i]).toBeCloseTo(value, digits));
}

// Forward-only oracle: independently recreate the emitted camera through engine
// ECS Float32 fields and matrix APIs, without the inverse helper or its report math.
function forward(
  result: ReturnType<typeof unprojectCameraPixels>,
  world: Vec3,
) {
  const emitted = result.spawnCamera;
  const camera = emitted.camera;
  const view = invertMat4(
    composeTrsMatrix(
      emitted.transform.translation.map(Math.fround),
      emitted.transform.rotation,
      [1, 1, 1],
    ),
  )!;
  const aspect = Math.fround(camera.aspect),
    near = Math.fround(camera.near),
    far = Math.fround(camera.far);
  const height = Math.fround(
    camera.projection === "orthographic" ? camera.orthographicHeight : 1,
  );
  const projection =
    camera.projection === "perspective"
      ? makePerspective(Math.fround(camera.fovYRadians!), aspect, near, far)
      : makeOrthographic(
          (-height * aspect) / 2,
          (height * aspect) / 2,
          -height / 2,
          height / 2,
          near,
          far,
        );
  const matrix = multiplyMat4(projection, view);
  const clip = [0, 1, 2, 3].map(
    (r) =>
      matrix[r]! * world[0] +
      matrix[r + 4]! * world[1] +
      matrix[r + 8]! * world[2] +
      matrix[r + 12]!,
  );
  return [
    ((clip[0]! / clip[3]! + 1) * result.input.viewport.width) / 2,
    ((1 - clip[1]! / clip[3]!) * result.input.viewport.height) / 2,
    clip[2]! / clip[3]!,
  ];
}

describe("CPU pixel-to-plane placement", () => {
  it.each(["perspective", "orthographic"] as const)(
    "solves analytic non-square %s geometry and ray units",
    (projection) => {
      const result = unprojectCameraPixels(job(projection));
      expect(result.accepted).toBe(true);
      close(result.points[0]!.world, [0, 0, 0]);
      close(
        result.points[1]!.world,
        projection === "perspective" ? [-20 / 3, 10 / 3, 0] : [-2, 1, 0],
      );
      for (const point of result.points) {
        close(
          point.ray!.origin,
          projection === "perspective"
            ? [0, 0, 10]
            : [point.world![0], point.world![1], 10],
        );
        expect(Math.hypot(...point.ray!.direction)).toBeCloseTo(1, 14);
        close(
          point.ray!.origin.map(
            (v, i) => v + point.distance! * point.ray!.direction[i]!,
          ),
          point.world!,
        );
        const projected = forward(result, point.world!);
        close(projected.slice(0, 2), point.pixel, 5);
        close(
          point.ndc,
          [
            (2 * projected[0]!) / 800 - 1,
            1 - (2 * projected[1]!) / 600,
            projected[2]!,
          ],
          12,
        );
        expect(point.inFrustum).toBe(true);
        expect(point.clipXYInRange).toBe(
          Math.abs(point.ndc![0]) <= 1 && Math.abs(point.ndc![1]) <= 1,
        );
        expect(point.failure).toBeNull();
      }
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "solves an analytic oblique %s plane and keeps scaled equations equivalent",
    (projection) => {
      const input = job(projection);
      const baseline = unprojectCameraPixels({
        ...input,
        plane: { normal: [1, 2, 3], constant: -2 },
      });
      close(
        baseline.points[1]!.world,
        projection === "perspective"
          ? [-56 / 9, 28 / 9, 2 / 3]
          : [-2, 1, 2 / 3],
      );
      for (const scale of [
        Number.MIN_VALUE,
        1e-320,
        1e-200,
        1e-20,
        1e20,
        1e300,
        -1e-300,
      ]) {
        const result = unprojectCameraPixels({
          ...input,
          plane: {
            normal: [scale, 2 * scale, 3 * scale],
            constant: -2 * scale,
          },
        });
        expect(result.accepted).toBe(true);
        close(result.points[1]!.world, baseline.points[1]!.world!, 8);
        expect(Math.hypot(...result.plane.normal)).toBeCloseTo(1, 14);
        expect(result.points[1]!.planeResidualWorldUnits).toBeCloseTo(0, 12);
      }
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "independently reprojects an off-axis %s camera and permits offscreen extrapolation",
    (projection) => {
      const input = job(projection);
      const result = unprojectCameraPixels({
        ...input,
        camera: {
          ...input.camera,
          translation: [6, 4, 8],
          lookAt: [0, 1, 0],
          far: 100,
        },
        plane: { normal: [1, 0.2, 1], constant: 0 },
        pixels: [
          { name: "on", pixel: [450, 225] },
          { name: "off", pixel: [-100, 200] },
        ],
      });
      expect(result.accepted).toBe(true);
      for (const point of result.points) {
        close(forward(result, point.world!).slice(0, 2), point.pixel, 3);
        expect(point.residualDistance).toBeLessThan(0.001);
        expect(
          point.world![0] + 0.2 * point.world![1] + point.world![2],
        ).toBeCloseTo(0, 12);
      }
      expect(result.points[0]!.inFrustum).toBe(true);
      expect(result.points[1]!.insideViewport).toBe(false);
      expect(result.points[1]!.inFrustum).toBe(false);
      expect(result.points[1]!.accepted).toBe(true);
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "reports exact %s clip boundaries and rejected depths",
    (projection) => {
      const input = job(projection);
      for (const [depth, accepted, failure] of [
        [1, true, null],
        [2, true, null],
        [0.5, false, "outside-clip-range"],
        [2.5, false, "outside-clip-range"],
        [-1, false, "behind-camera"],
        [0, false, "behind-camera"],
      ] as const) {
        const result = unprojectCameraPixels({
          ...input,
          camera: {
            ...input.camera,
            translation: [0, 0, 0],
            lookAt: [0, 0, -1],
            near: 1,
            far: 2,
          },
          plane: { normal: [0, 0, 1], constant: depth },
        });
        expect(result.accepted).toBe(accepted);
        for (const point of result.points) {
          expect(point.failure).toBe(failure);
          expect(point.depth).toBeCloseTo(depth, 12);
          expect(point.inFront).toBe(depth > 0);
          expect(point.depthInRange).toBe(depth >= 1 && depth <= 2);
        }
        if (accepted) expect(result.points[0]!.ndc![2]).toBe(depth - 1);
        if (depth === 0 && projection === "perspective")
          expect(result.points[0]!.reprojectedPixel).toBeNull();
        expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
      }
    },
  );

  it("reports actual Float32 clipping at a nominal boundary without hiding it", () => {
    const result = unprojectCameraPixels({
      ...job(),
      plane: { normal: [0, 0, 1], constant: -9 },
    });
    const point = result.points[0]!;
    expect(point.depthInRange).toBe(true);
    expect(point.clipDepthInRange).toBe(
      point.ndc![2] >= 0 && point.ndc![2] <= 1,
    );
    expect(point.accepted).toBe(point.clipDepthInRange);
  });

  it.each(["perspective", "orthographic"] as const)(
    "rejects inaccurate %s engine reprojection at large coordinates",
    (projection) => {
      const input = job(projection);
      const result = unprojectCameraPixels({
        ...input,
        camera: {
          ...input.camera,
          translation: [1e6 + 6, 4, 8],
          lookAt: [1e6, 1, 0],
        },
      });
      expect(result.accepted).toBe(false);
      for (const point of result.points) {
        expect(point.failure).toBe("reprojection-error");
        expect(point.residualDistance).toBeGreaterThan(0.05);
        close(
          forward(result, point.world!).slice(0, 2),
          point.reprojectedPixel!,
          8,
        );
        expect(point.depthInRange).toBe(true);
      }
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "distinguishes parallel, coplanar and ill-conditioned %s rays from usable ones",
    (projection) => {
      const input = {
        ...job(projection),
        pixels: [{ name: "center", pixel: [400, 300] }],
      };
      for (const constant of [0, 1]) {
        const point = unprojectCameraPixels({
          ...input,
          plane: { normal: [1, 0, 0], constant },
        }).points[0]!;
        expect(point.failure).toBe("parallel");
        expect(point.world).toBeNull();
        expect(point.ray).not.toBeNull();
      }
      const result = unprojectCameraPixels({
        ...input,
        plane: { normal: [1, 0, 1e-9], constant: -5e-9 },
      });
      expect(result.points[0]!.failure).toBe("ill-conditioned");
      expect(result.points[0]!.incidenceCosine).toBeCloseTo(-1e-9, 18);
      expect(result.points[0]!.world).toBeNull();
    },
  );

  it("avoids far-endpoint collapse and reports unsupported Float32 ranges", () => {
    const input = job();
    expect(
      unprojectCameraPixels({
        ...input,
        camera: { ...input.camera, far: 1e12 },
      }).accepted,
    ).toBe(true);
    for (const camera of [
      { ...input.camera, near: 1, far: 1 + 1e-10 },
      { ...input.camera, near: 1e-50 },
      { ...job("orthographic").camera, orthographicHeight: 1e-50 },
      { ...job("orthographic").camera, orthographicHeight: 1e-40 },
    ]) {
      const result = unprojectCameraPixels({ ...input, camera });
      expect(result.accepted).toBe(false);
      expect(result.cameraFailure).toMatch(/Float32/);
      expect(result.points[0]!.failure).toBe("invalid-engine-camera");
      expect(result.points[0]!.ray).toBeNull();
    }
  });

  it("reports nonfinite intersections as failures, retaining finite rays", () => {
    const result = unprojectCameraPixels({
      ...job(),
      plane: { normal: [1, 0, 1e-7], constant: Number.MAX_VALUE },
    });
    expect(result.accepted).toBe(false);
    expect(result.points[0]!.failure).toBe("nonfinite-intersection");
    expect(result.points[0]!.world).toBeNull();
    expect(result.points[0]!.ray).not.toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it("rejects invalid camera, plane, pixel and unknown inputs", () => {
    const input = job();
    for (const patch of [
      { plane: { normal: [0, 0, 0], constant: 0 } },
      { plane: { normal: [NaN, 0, 1], constant: 0 } },
      { plane: { normal: [0, 0, 1], constant: Infinity } },
      { plane: { normal: [0, 0, Number.MIN_VALUE], constant: 1 } },
      { plane: { normal: [0, 1], constant: 0 } },
      { plane: { normal: [0, 0, 1], offset: 0 } },
      { camera: { ...input.camera, roll: 1 } },
      { viewport: { width: 800.5, height: 600 } },
      { pixels: [] },
      { pixels: [{ name: "missing" }] },
      { pixels: [{ name: "bad", pixel: [0, Infinity] }] },
      { pixels: [{ name: "bad", pixel: [0, 0], world: [0, 0, 0] }] },
      { pixels: [input.pixels[0], input.pixels[0]] },
      { fit: {} },
    ])
      expect(() => unprojectCameraPixels({ ...input, ...patch })).toThrow();
  });
});

const roots: string[] = [];
async function fixture(input: unknown = job("orthographic")) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "aperture-unproject-"));
  roots.push(cwd);
  await writeFile(path.join(cwd, "job.json"), JSON.stringify(input));
  return cwd;
}
async function cli(cwd: string, ...argv: string[]) {
  let stdout = "",
    stderr = "";
  const exitCode = await runApertureCli({
    argv,
    cwd,
    stdout: (s) => {
      stdout += s;
    },
    stderr: (s) => {
      stderr += s;
    },
  });
  return { stdout, stderr, exitCode };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("aperture camera unproject CLI", () => {
  it.each(["project", "fit", "unproject"] as const)(
    "rejects %s input and directory aliases without changing any files",
    async (command) => {
      const input = job("orthographic");
      const cwd = await fixture(
        command === "unproject"
          ? input
          : {
              viewport: input.viewport,
              camera: input.camera,
              landmarks: [
                { name: "corner", world: [-1, 1, 0], target: [200, 200] },
              ],
              ...(command === "fit"
                ? {
                    fit: {
                      parameters: {
                        azimuthDegrees: "fixed",
                        elevationDegrees: "fixed",
                        distance: "fixed",
                        panX: { min: -2, max: 2 },
                        panY: "fixed",
                        orthographicHeight: "fixed",
                      },
                    },
                  }
                : {}),
            },
      );
      await symlink("job.json", path.join(cwd, "input-alias.json"));
      await symlink(".", path.join(cwd, "parent-alias"), "dir");
      const source = await readFile(path.join(cwd, "job.json"), "utf8");
      for (const [inputPath, outputPath] of [
        ["input-alias.json", "job.json"],
        ["job.json", "parent-alias/job.json"],
        ["parent-alias/job.json", "job.json"],
        ["parent-alias/input-alias.json", "input-alias.json"],
      ]) {
        const result = await cli(
          cwd,
          "camera",
          command,
          inputPath!,
          "--out",
          outputPath!,
        );
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("aperture.camera.usage");
        expect(result.stdout).toBe("");
        expect(await readFile(path.join(cwd, "job.json"), "utf8")).toBe(source);
        expect(await readFile(path.join(cwd, inputPath!), "utf8")).toBe(source);
        expect(await readFile(path.join(cwd, outputPath!), "utf8")).toBe(
          source,
        );
        expect(await readlink(path.join(cwd, "input-alias.json"))).toBe(
          "job.json",
        );
        expect(await readlink(path.join(cwd, "parent-alias"))).toBe(".");
        expect((await readdir(cwd)).sort()).toEqual([
          "input-alias.json",
          "job.json",
          "parent-alias",
        ]);
      }
    },
  );

  it("safely replaces an output symlink without rewriting its input target", async () => {
    const cwd = await fixture();
    const source = await readFile(path.join(cwd, "job.json"), "utf8");
    await symlink("job.json", path.join(cwd, "report.json"));
    const result = await cli(
      cwd,
      "camera",
      "unproject",
      "job.json",
      "--out",
      "report.json",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(await readFile(path.join(cwd, "job.json"), "utf8")).toBe(source);
    expect(await readFile(path.join(cwd, "report.json"), "utf8")).toBe(
      result.stdout,
    );
    expect((await lstat(path.join(cwd, "report.json"))).isSymbolicLink()).toBe(
      false,
    );
    expect((await readdir(cwd)).sort()).toEqual(["job.json", "report.json"]);
  });

  it("prints JSON, atomically replaces reports and preserves its input", async () => {
    const cwd = await fixture();
    const original = await readFile(path.join(cwd, "job.json"), "utf8");
    await writeFile(path.join(cwd, "report.json"), "old");
    const result = await cli(
      cwd,
      "camera",
      "unproject",
      "job.json",
      "--out",
      "report.json",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const report = JSON.parse(result.stdout);
    expect(report.command).toBe("unproject");
    expect(report.accepted).toBe(true);
    close(report.points[1].world, [-2, 1, 0]);
    expect(await readFile(path.join(cwd, "report.json"), "utf8")).toBe(
      result.stdout,
    );
    expect(await readFile(path.join(cwd, "job.json"), "utf8")).toBe(original);
    expect((await readdir(cwd)).sort()).toEqual(["job.json", "report.json"]);
  });

  it("writes complete exit-2 reports for mixed accepted/rejected intersections", async () => {
    const cwd = await fixture({
      ...job(),
      plane: { normal: [-1, 0, 1], constant: 2 },
    });
    const result = await cli(
      cwd,
      "camera",
      "unproject",
      "job.json",
      "--out",
      "candidate.json",
    );
    expect(result.exitCode).toBe(2);
    const report = JSON.parse(result.stdout);
    expect(report.accepted).toBe(false);
    expect(
      report.points.some((point: { accepted: boolean }) => point.accepted),
    ).toBe(true);
    expect(
      report.points.some((point: { accepted: boolean }) => !point.accepted),
    ).toBe(true);
    expect(await readFile(path.join(cwd, "candidate.json"), "utf8")).toBe(
      result.stdout,
    );
  });

  it("exposes runnable help and reports invalid jobs/I/O with exit 1", async () => {
    const cwd = await fixture();
    const help = await cli(cwd, "camera", "unproject", "--help");
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("dot(normal, world) + c = 0");
    expect(help.stdout).toContain("plane-job.json");
    expect((await cli(cwd, "--help")).stdout).toContain("unproject");
    for (const [args, code] of [
      [["unproject"], "usage"],
      [["unproject", "job.json", "--bad"], "usage"],
      [["unproject", "job.json", "--out", "job.json"], "usage"],
      [["unproject", "missing.json"], "readFailed"],
      [
        ["unproject", "job.json", "--out", "missing/report.json"],
        "writeFailed",
      ],
    ] as const) {
      const result = await cli(cwd, "camera", ...args);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`aperture.camera.${code}`);
    }
    for (const [source, code] of [
      ["{", "invalidJson"],
      ["{}", "invalidJob"],
    ]) {
      await writeFile(path.join(cwd, "job.json"), source!);
      const result = await cli(cwd, "camera", "unproject", "job.json");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`aperture.camera.${code}`);
    }
    expect((await readdir(cwd)).sort()).toEqual(["job.json"]);
  });
});
