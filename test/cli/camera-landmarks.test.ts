import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { quatLookAt } from "../../packages/app/src/systems/spawn/transforms.js";
import {
  fitCameraLandmarks,
  projectCameraLandmarks,
  type CameraLandmarkJob,
} from "../../packages/cli/src/camera/landmarks.js";

type Vec3 = readonly [number, number, number];
const points: Vec3[] = [
  [-2, 0, 1],
  [2, 0, -1],
  [0, 3, 0],
  [-1, 2, -2],
  [1.5, 1, 2],
  [0.4, -1, -3],
  [2, 4, 1],
];

function job(
  projection: "perspective" | "orthographic" = "perspective",
): CameraLandmarkJob {
  return {
    viewport: { width: 800, height: 600 },
    camera: {
      projection,
      translation: [6, 4, 8],
      lookAt: [0, 1, 0],
      near: 0.1,
      far: 100,
      ...(projection === "perspective"
        ? { fovYDegrees: 52 }
        : { orthographicHeight: 8 }),
    } as CameraLandmarkJob["camera"],
    landmarks: points.map((world, i) => ({ name: `point-${i}`, world })),
  };
}

// Independent oracle: actual spawn look-at orientation, engine view/projection
// matrices and homogeneous clip divide. Never uses the fitting implementation.
function enginePixels(
  input: CameraLandmarkJob,
  rotation?: readonly [number, number, number, number],
): [number, number, number][] {
  const c = input.camera,
    aspect = input.viewport.width / input.viewport.height;
  const view = invertMat4(
    composeTrsMatrix(
      c.translation,
      rotation ?? quatLookAt(c.translation, c.lookAt),
      [1, 1, 1],
    ),
  )!;
  const projection =
    c.projection === "perspective"
      ? makePerspective((c.fovYDegrees * Math.PI) / 180, aspect, c.near, c.far)
      : makeOrthographic(
          (-c.orthographicHeight * aspect) / 2,
          (c.orthographicHeight * aspect) / 2,
          -c.orthographicHeight / 2,
          c.orthographicHeight / 2,
          c.near,
          c.far,
        );
  const matrix = multiplyMat4(projection, view);
  return input.landmarks.map(({ world }) => {
    const clip = [0, 1, 2, 3].map(
      (row) =>
        matrix[row]! * world[0] +
        matrix[row + 4]! * world[1] +
        matrix[row + 8]! * world[2] +
        matrix[row + 12]!,
    );
    return [
      ((clip[0]! / clip[3]! + 1) * input.viewport.width) / 2,
      ((1 - clip[1]! / clip[3]!) * input.viewport.height) / 2,
      clip[2]! / clip[3]!,
    ];
  });
}

function fitJob(
  projection: "perspective" | "orthographic" = "perspective",
): CameraLandmarkJob {
  const truth = job(projection),
    pixels = enginePixels(truth);
  return {
    ...truth,
    camera: {
      ...truth.camera,
      translation: [6.8, 4.5, 8.3],
      lookAt: [0.15, 0.8, -0.1],
      ...(projection === "perspective"
        ? { fovYDegrees: 56 }
        : { orthographicHeight: 8.7 }),
    } as CameraLandmarkJob["camera"],
    landmarks: truth.landmarks.map((point, i) => ({
      ...point,
      target: [pixels[i]![0], pixels[i]![1]],
    })),
    fit: {
      parameters: {
        azimuthDegrees: { min: 20, max: 60 },
        elevationDegrees: { min: 5, max: 40 },
        distance: projection === "perspective" ? { min: 7, max: 18 } : "fixed",
        panX: { min: -2, max: 2 },
        panY: { min: -2, max: 2 },
        ...(projection === "perspective"
          ? { fovYDegrees: { min: 35, max: 75 } }
          : { orthographicHeight: { min: 5, max: 12 } }),
      },
      tolerancePixels: 0.01,
    },
  };
}

function panJob(weight = 1): CameraLandmarkJob {
  return {
    viewport: { width: 800, height: 600 },
    camera: {
      projection: "orthographic",
      translation: [0, 0, 10],
      lookAt: [0, 0, 0],
      near: 0.1,
      far: 100,
      orthographicHeight: 6,
    },
    landmarks: [
      { name: "corner", world: [-1, 1, 0], target: [200, 200], weight },
    ],
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
  };
}

describe("CPU camera landmark projection", () => {
  it.each([
    [-6, 4, -8],
    [6, -4, -8],
    [-6, -4, 8],
    [0.1, 15, 0.2],
  ] as Vec3[])(
    "preserves spawn camera orientation for eye %j",
    (...translation) => {
      for (const projection of ["perspective", "orthographic"] as const) {
        const input = job(projection);
        const varied = {
          ...input,
          camera: {
            ...input.camera,
            translation: translation as unknown as Vec3,
          },
        };
        const expected = enginePixels(varied),
          result = projectCameraLandmarks(varied);
        result.landmarks.forEach((point, i) => {
          expect(point.pixel![0]).toBeCloseTo(expected[i]![0], 3);
          expect(point.pixel![1]).toBeCloseTo(expected[i]![1], 3);
        });
      }
    },
  );
  it.each(["perspective", "orthographic"] as const)(
    "matches independent engine %s matrices off axis with depth",
    (projection) => {
      const input = job(projection),
        expected = enginePixels(input);
      const result = projectCameraLandmarks(input);
      for (const [i, point] of result.landmarks.entries()) {
        expect(point.pixel![0]).toBeCloseTo(expected[i]![0], 3);
        expect(point.pixel![1]).toBeCloseTo(expected[i]![1], 3);
        expect(point.ndcDepth).toBeCloseTo(expected[i]![2], 6);
        expect(point.ndc).toHaveLength(3);
      }
      expect(result.enginePrecision.withinTolerance).toBe(true);
      expect(result.spawnCamera.camera.autoAspect).toBe(false);
      expect(result.metrics.scalarCoordinateRmsPixels).toBeNull();
    },
  );

  it.each(["perspective", "orthographic"] as const)(
    "reports %s frustum, near/far boundaries and behind-camera points",
    (projection) => {
      const input = job(projection);
      const result = projectCameraLandmarks({
        ...input,
        camera: {
          ...input.camera,
          translation: [0, 0, 10],
          lookAt: [0, 0, 0],
          near: 1,
          far: 20,
        },
        landmarks: [
          [0, 0, 9],
          [0, 0, -10],
          [0, 0, 11],
          [100, 0, 0],
          [0, 0, 10],
        ].map((world, i) => ({ name: `p${i}`, world })),
      });
      expect(result.landmarks[0]!.ndcDepth).toBeCloseTo(0);
      expect(result.landmarks[1]!.ndcDepth).toBeCloseTo(1);
      expect(result.landmarks[0]!.inFrustum).toBe(true);
      expect(result.landmarks[2]!.inFront).toBe(false);
      expect(result.landmarks[3]!.insideViewport).toBe(false);
      expect(result.landmarks[4]!.inFrustum).toBe(false);
      if (projection === "perspective")
        expect(result.landmarks[4]!.pixel).toBeNull();
      expect(JSON.stringify(result)).not.toContain("Infinity");
    },
  );

  it("reports signed residuals and distinct weighted/unweighted RMS definitions", () => {
    const input = panJob();
    const result = projectCameraLandmarks({
      ...input,
      landmarks: [
        { name: "a", world: [0, 0, 0], target: [397, 296], weight: 2 },
        { name: "b", world: [0, 0, 0], target: [400, 300], weight: 1 },
      ],
    });
    expect(result.landmarks[0]!.residual).toEqual([3, 4]);
    expect(result.metrics.scalarCoordinateRmsPixels).toBe(2.5);
    expect(result.metrics.pointRmsPixels).toBeCloseTo(Math.sqrt(12.5));
    expect(result.metrics.weightedScalarCoordinateRmsPixels).toBeCloseTo(
      Math.sqrt(50 / 6),
    );
    expect(result.metrics.weightedPointRmsPixels).toBeCloseTo(
      Math.sqrt(50 / 3),
    );
  });

  it("exposes Float32 engine precision loss and collapsed clip planes", () => {
    const input = panJob();
    const result = projectCameraLandmarks({
      ...input,
      camera: {
        ...input.camera,
        translation: [1e6 + 3, 2, 6],
        lookAt: [1e6, 0, 0],
      },
      landmarks: [{ name: "large", world: [1e6 + 1, 1, 0] }],
      fit: undefined,
    });
    expect(result.enginePrecision.withinTolerance).toBe(false);
    expect(result.enginePrecision.maxPixelDelta).toBeGreaterThan(1);
    const collapsed = projectCameraLandmarks({
      ...job(),
      camera: { ...job().camera, near: 1, far: 1 + 1e-10 },
    });
    expect(collapsed.enginePrecision.withinTolerance).toBe(false);
    expect(collapsed.enginePrecision.reason).toContain("collapse");
  });
});

describe("bounded camera landmark fitting", () => {
  it("requires the emitted engine camera to meet a strict target tolerance", () => {
    const input = panJob();
    const result = fitCameraLandmarks({
      ...input,
      fit: { ...input.fit, tolerancePixels: 1e-6 },
    });
    expect(result.fit.converged).toBe(true);
    expect(result.fit.withinTolerance).toBe(true);
    expect(result.fit.engineWithinTolerance).toBe(false);
    expect(result.fit.accepted).toBe(false);
    expect(result.enginePrecision.maxTargetPointErrorPixels).toBeGreaterThan(
      1e-6,
    );
    const emitted = result.spawnCamera;
    const actual = enginePixels(
      { ...input, camera: { ...input.camera, ...emitted.transform } },
      emitted.transform.rotation,
    );
    expect(actual[0]![0]).toBeCloseTo(
      result.enginePrecision.landmarks[0]!.pixel![0]!,
      8,
    );
    expect(actual[0]![1]).toBeCloseTo(
      result.enginePrecision.landmarks[0]!.pixel![1]!,
      8,
    );
  });
  it.each(["perspective", "orthographic"] as const)(
    "recovers a constrained %s camera from independent synthetic projections",
    (projection) => {
      const input = fitJob(projection),
        result = fitCameraLandmarks(input);
      expect(result.fit.accepted, JSON.stringify(result.fit)).toBe(true);
      expect(result.fit.converged).toBe(true);
      expect(result.fit.conditioning.rank).toBe(
        projection === "perspective" ? 6 : 5,
      );
      expect(result.metrics.maxPointErrorPixels).toBeLessThan(0.001);
      expect(result.fit.freeParameterCount).toBe(
        projection === "perspective" ? 6 : 5,
      );
      expect(result.spawnCamera.camera.projection).toBe(projection);
      expect(result.parameters.azimuthDegrees).toBeCloseTo(
        (Math.atan2(6, 8) * 180) / Math.PI,
        3,
      );
      if (projection === "perspective")
        expect(result.parameters.fovYDegrees).toBeCloseTo(52, 3);
      else expect(result.parameters.orthographicHeight).toBeCloseTo(8, 4);
    },
  );

  it("keeps convergence and conditioning invariant under global confidence scaling", () => {
    const a = fitCameraLandmarks(panJob()),
      b = fitCameraLandmarks(panJob(1e-32));
    expect(a.parameters.panX).toBeCloseTo(1, 5);
    expect(b.parameters.panX).toBe(a.parameters.panX);
    expect(b.fit.iterations).toBe(a.fit.iterations);
    expect(b.fit.accepted).toBe(true);
    expect(b.fit.conditioning).toEqual(a.fit.conditioning);
  });

  it("exposes inconsistent observations even when the optimizer converges", () => {
    const input = panJob();
    const result = fitCameraLandmarks({
      ...input,
      landmarks: [
        { name: "a", world: [-1, 1, 0], target: [200, 200] },
        { name: "b", world: [-1, 1, 0], target: [250, 180], weight: 2 },
      ],
    });
    expect(result.fit.converged).toBe(true);
    expect(result.fit.accepted).toBe(false);
    expect(result.fit.withinTolerance).toBe(false);
    expect(result.metrics.maxPointErrorPixels).toBeGreaterThan(30);
    expect(result.landmarks[1]!.residual![1]).toBeCloseTo(20);
    expect(result.parameters.panX).toBeCloseTo(2 / 3, 6);
  });

  it("reports active bounds and residual mismatch separately from bounded stationarity", () => {
    const input = panJob();
    const result = fitCameraLandmarks({
      ...input,
      fit: {
        ...input.fit,
        parameters: { ...input.fit!.parameters, panX: { min: -0.2, max: 0.2 } },
      },
    });
    expect(result.fit.converged).toBe(true);
    expect(result.fit.accepted).toBe(false);
    expect(result.fit.boundHits).toEqual([{ parameter: "panX", side: "max" }]);
  });

  it("does not call a one-step incomplete solve converged", () => {
    const input = fitJob();
    const result = fitCameraLandmarks({
      ...input,
      fit: { ...input.fit, maxIterations: 1 },
    });
    expect(result.fit.converged).toBe(false);
    expect(result.fit.termination).toBe("iteration-limit");
    expect(result.fit.iterations).toBe(1);
  });

  it("rejects rank-deficient, insufficient, orthographic-distance and invalid-depth fits", () => {
    const input = fitJob();
    expect(() =>
      fitCameraLandmarks({ ...input, landmarks: input.landmarks.slice(0, 2) }),
    ).toThrow(/target coordinates/);
    expect(() =>
      fitCameraLandmarks({
        ...input,
        landmarks: input.landmarks.map((p) => ({ ...p, world: [0, 0, 0] })),
      }),
    ).toThrow(/rank/);
    const ortho = fitJob("orthographic");
    expect(() =>
      fitCameraLandmarks({
        ...ortho,
        fit: {
          parameters: {
            ...ortho.fit!.parameters,
            distance: { min: 5, max: 20 },
          },
        },
      }),
    ).toThrow(/distance must be fixed/);
    const pan = panJob();
    expect(() =>
      fitCameraLandmarks({
        ...pan,
        landmarks: [{ name: "behind", world: [0, 0, 11], target: [100, 100] }],
      }),
    ).toThrow(/positive depth/);
  });

  it("rejects the frontal-plane perspective FOV/distance ambiguity", () => {
    const input = job();
    expect(() =>
      fitCameraLandmarks({
        ...input,
        camera: { ...input.camera, translation: [0, 0, 10], lookAt: [0, 0, 0] },
        landmarks: points.map(([x, y], i) => ({
          name: `flat-${i}`,
          world: [x, y, 0],
          target: [100 + i, 200 - i],
        })),
        fit: {
          parameters: {
            azimuthDegrees: "fixed",
            elevationDegrees: "fixed",
            distance: { min: 5, max: 20 },
            panX: "fixed",
            panY: "fixed",
            fovYDegrees: { min: 30, max: 80 },
          },
        },
      }),
    ).toThrow(/rank 1\/2/);
  });

  it("rejects unsupported, nonfinite, singular and incomplete camera jobs", () => {
    expect(() =>
      projectCameraLandmarks({
        ...job(),
        viewport: { width: Infinity, height: 600 },
      }),
    ).toThrow(/finite/);
    expect(() =>
      projectCameraLandmarks({
        ...job(),
        camera: { ...job().camera, roll: 10 },
      }),
    ).toThrow(/not supported/);
    expect(() =>
      projectCameraLandmarks({
        ...job(),
        camera: { ...job().camera, projection: "auto" },
      }),
    ).toThrow(/explicitly/);
    expect(() =>
      projectCameraLandmarks({
        ...job(),
        camera: { ...job().camera, translation: [0, 1, 0] },
      }),
    ).toThrow(/distinct/);
    expect(() =>
      projectCameraLandmarks({
        ...job(),
        camera: {
          ...job().camera,
          translation: [5e-7, 0, 0],
          lookAt: [0, 0, 0],
        },
      }),
    ).toThrow(/distinct/);
    expect(() =>
      fitCameraLandmarks({
        ...panJob(),
        fit: { parameters: { panX: { min: -1, max: 1 } } },
      }),
    ).toThrow(/azimuthDegrees/);
    expect(() =>
      projectCameraLandmarks({
        ...job(),
        landmarks: [
          { name: "same", world: [0, 0, 0] },
          { name: "same", world: [1, 0, 0] },
        ],
      }),
    ).toThrow(/unique/);
  });
});

const tempRoots: string[] = [];
async function fixture(input: unknown = panJob()): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aperture-camera-"));
  tempRoots.push(dir);
  await writeFile(path.join(dir, "job.json"), JSON.stringify(input));
  return dir;
}
async function cli(argv: string[], cwd: string) {
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
  return { exitCode, stdout, stderr };
}
afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("aperture camera CLI", () => {
  it("dispatches project and fit and writes the same JSON atomically to --out", async () => {
    const cwd = await fixture();
    const projected = await cli(["camera", "project", "job.json"], cwd);
    expect(projected.exitCode).toBe(0);
    expect(JSON.parse(projected.stdout).landmarks[0].residual).toEqual([
      100, 0,
    ]);
    const fitted = await cli(
      ["camera", "fit", "job.json", "--out", "report.json"],
      cwd,
    );
    expect(fitted.stderr).toBe("");
    expect(fitted.exitCode).toBe(0);
    expect(await readFile(path.join(cwd, "report.json"), "utf8")).toBe(
      fitted.stdout,
    );
    expect(
      JSON.parse(fitted.stdout).spawnCamera.transform.translation[0],
    ).toBeCloseTo(1, 5);
  });
  it("emits a reviewable report and exit 2 for an unacceptable fit", async () => {
    const input = panJob(),
      cwd = await fixture({
        ...input,
        landmarks: [{ ...input.landmarks[0], target: [200, 150] }],
      });
    const result = await cli(
      ["camera", "fit", "job.json", "--out", "candidate.json"],
      cwd,
    );
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).fit.accepted).toBe(false);
    expect(
      JSON.parse(await readFile(path.join(cwd, "candidate.json"), "utf8")).fit
        .converged,
    ).toBe(true);
  });
  it("prints discoverable help and structured parse, file and validation errors", async () => {
    const cwd = await fixture();
    const help = await cli(["camera", "--help"], cwd);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("fit: { parameters");
    expect(help.stdout).toContain("Exit 2");
    expect((await cli(["--help"], cwd)).stdout).toContain("aperture camera");
    for (const args of [
      [],
      ["wrong"],
      ["project"],
      ["project", "job.json", "--unknown"],
      ["project", "job.json", "extra.json"],
      ["project", "job.json", "--out"],
      ["project", "job.json", "--out", "job.json"],
    ]) {
      expect((await cli(["camera", ...args], cwd)).stderr).toContain(
        "aperture.camera.usage",
      );
    }
    expect(
      (await cli(["camera", "project", "missing.json"], cwd)).stderr,
    ).toContain("aperture.camera.readFailed");
    expect(
      (
        await cli(
          ["camera", "project", "job.json", "--out", "absent/report.json"],
          cwd,
        )
      ).stderr,
    ).toContain("aperture.camera.writeFailed");
    await writeFile(path.join(cwd, "job.json"), "{");
    expect(
      (await cli(["camera", "project", "job.json"], cwd)).stderr,
    ).toContain("aperture.camera.invalidJson");
    await writeFile(path.join(cwd, "job.json"), "{}");
    expect(
      (await cli(["camera", "project", "job.json"], cwd)).stderr,
    ).toContain("aperture.camera.invalidJob");
  });
});
