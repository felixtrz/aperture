import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { readPngImage, readPngImagePixel } from "./png.js";

const execFileAsync = promisify(execFile);
const CLI = path.resolve("packages/cli/dist/bin/aperture.js");
const FIXTURE_BUNDLE = path.resolve(
  "test/e2e/fixtures/procedural-cube.bundle.json",
);

// P2.4: prove the smaller-loop render path end to end — a render bundle
// written by `aperture headless` becomes a real (non-blank) PNG via
// `aperture render`, on the same SwiftShader software path the rest of the
// WebGPU e2e suite uses. The command boots its own browser + static server,
// so it does not use the example webServer.
test.describe("aperture render CLI", () => {
  test("renders a non-blank PNG from a render bundle", async () => {
    test.setTimeout(180_000);
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "aperture-render-e2e-"),
    );
    const out = path.join(tempDir, "frame.png");

    try {
      // Run from a cwd OUTSIDE the repo to prove the command resolves the
      // engine packages and harness from its own install, not the source tree.
      const { stdout } = await execFileAsync(
        "node",
        [CLI, "render", FIXTURE_BUNDLE, "--out", out, "--json"],
        {
          cwd: tempDir,
          env: { ...process.env },
        },
      );
      const renderReport = JSON.parse(String(stdout)) as {
        readonly ok?: boolean;
        readonly frame?: number | null;
        readonly pngBytes?: number;
        readonly diagnostics?: {
          readonly renderer?: {
            readonly browser?: {
              readonly channel?: string;
              readonly headless?: boolean;
              readonly args?: readonly string[];
            };
            readonly requestedDimensions?: {
              readonly width?: number;
              readonly height?: number;
            };
            readonly actualDimensions?: {
              readonly width?: number;
              readonly height?: number;
            };
            readonly bundleDigest?: {
              readonly algorithm?: string;
              readonly hash?: string;
              readonly byteLength?: number;
            } | null;
            readonly webgpu?: {
              readonly format?: string | null;
              readonly displayColorSpace?: string | null;
              readonly adapterInfo?: Readonly<Record<string, unknown>>;
              readonly adapterFeatures?: readonly unknown[];
              readonly deviceFeatures?: readonly unknown[];
            } | null;
          };
        };
      };

      const fileStat = await stat(out);
      expect(fileStat.isFile()).toBe(true);
      expect(fileStat.size).toBeGreaterThan(1000);
      expect(renderReport.ok).toBe(true);
      expect(renderReport.frame).toBe(0);
      expect(renderReport.pngBytes).toBe(fileStat.size);

      const renderer = renderReport.diagnostics?.renderer;
      expect(renderer?.browser?.channel).toBe(
        process.env["APERTURE_RENDER_CHANNEL"] ?? "chrome",
      );
      expect(renderer?.browser?.args).toEqual(expect.any(Array));
      expect(renderer?.requestedDimensions).toEqual({
        width: 960,
        height: 640,
      });
      expect(renderer?.actualDimensions).toEqual({
        width: 960,
        height: 640,
      });
      expect(renderer?.bundleDigest).toEqual({
        algorithm: "fnv1a32-stable-json-v1",
        hash: "b65b87c8",
        byteLength: 7337,
      });
      expect(renderer?.webgpu).toEqual(
        expect.objectContaining({
          format: expect.any(String),
          displayColorSpace: "srgb",
          adapterInfo: expect.any(Object),
          adapterFeatures: expect.any(Array),
          deviceFeatures: expect.any(Array),
        }),
      );

      const png = await readFile(out);
      const image = readPngImage(png);
      expect(image.width).toBe(960);
      expect(image.height).toBe(640);

      // The procedural cube sits at the center of the frame; a successful render
      // lights it, so the center pixel must be clearly non-black.
      const center = readPngImagePixel(image, 0.5, 0.5);
      const luma = 0.2126 * center.r + 0.7152 * center.g + 0.0722 * center.b;
      expect(luma).toBeGreaterThan(20);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("renders both halves of a split-screen fractional-viewport bundle (#72)", async () => {
    test.setTimeout(180_000);
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "aperture-split-viewport-e2e-"),
    );
    const out = path.join(tempDir, "split.png");
    const fixture = path.resolve(
      "test/e2e/fixtures/split-viewport.bundle.json",
    );

    try {
      // Two cameras with viewport/scissor [0,0,0.5,1] and [0.5,0,0.5,1], both
      // looking at a lit cube. The render harness must honor the fractional
      // rects — regression for the all-black split-screen render (#72).
      await execFileAsync("node", [CLI, "render", fixture, "--out", out], {
        cwd: tempDir,
        env: { ...process.env },
      });

      const png = await readFile(out);
      const image = readPngImage(png);
      expect(image.width).toBe(960);
      expect(image.height).toBe(640);

      for (const x of [0.25, 0.75]) {
        const pixel = readPngImagePixel(image, x, 0.5);
        const luma = 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
        expect(luma).toBeGreaterThan(20);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("render serve reuses one warm browser across bundles (#61)", async () => {
    test.setTimeout(180_000);
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "aperture-render-serve-e2e-"),
    );
    const out1 = path.join(tempDir, "one.png");
    const out2 = path.join(tempDir, "two.png");

    try {
      const requests = [
        JSON.stringify({
          id: 1,
          cmd: "render",
          params: { in: FIXTURE_BUNDLE, out: out1 },
        }),
        JSON.stringify({
          id: 2,
          cmd: "render",
          params: {
            in: path.resolve("test/e2e/fixtures/split-viewport.bundle.json"),
            out: out2,
            width: 480,
            height: 320,
          },
        }),
        JSON.stringify({ id: 3, cmd: "shutdown" }),
      ].join("\n");

      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn("node", [CLI, "render", "serve"], {
          cwd: tempDir,
          env: { ...process.env },
          stdio: ["pipe", "pipe", "pipe"],
        });
        let output = "";
        let errorOutput = "";
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          errorOutput += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(
              new Error(`render serve exited with ${code}: ${errorOutput}`),
            );
          }
        });
        child.stdin.write(`${requests}\n`);
        child.stdin.end();
      });

      const lines = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);

      expect(lines[0]?.["ready"]).toBe(true);
      expect(lines[1]).toMatchObject({ id: 1, ok: true });
      expect(lines[2]).toMatchObject({ id: 2, ok: true });
      expect(lines[3]).toMatchObject({ id: 3, ok: true, shutdown: true });

      const first = readPngImage(await readFile(out1));
      expect(first.width).toBe(960);
      expect(first.height).toBe(640);
      const center = readPngImagePixel(first, 0.5, 0.5);
      expect(
        0.2126 * center.r + 0.7152 * center.g + 0.0722 * center.b,
      ).toBeGreaterThan(20);

      // The second render reuses the same warm browser but honors its own
      // dimensions.
      const second = readPngImage(await readFile(out2));
      expect(second.width).toBe(480);
      expect(second.height).toBe(320);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("renders known pixels from a bundle extracted after SessionSnapshot restore", async () => {
    test.setTimeout(180_000);
    const tempDir = await mkdtemp(
      path.join(os.tmpdir(), "aperture-session-render-e2e-"),
    );
    const bundle = path.join(tempDir, "restored-session.bundle.json");
    const out = path.join(tempDir, "restored-session.png");

    try {
      await execFileAsync(
        "node",
        ["--input-type=module", "-e", SESSION_RESTORE_BUNDLE_SCRIPT],
        {
          cwd: path.resolve("."),
          env: {
            ...process.env,
            APERTURE_RESTORED_SESSION_BUNDLE: bundle,
          },
        },
      );

      const { stdout } = await execFileAsync(
        "node",
        [CLI, "render", bundle, "--out", out, "--json"],
        {
          cwd: tempDir,
          env: { ...process.env },
        },
      );
      const renderReport = JSON.parse(String(stdout)) as {
        readonly ok?: boolean;
        readonly diagnostics?: {
          readonly renderer?: {
            readonly bundleDigest?: { readonly hash?: string } | null;
            readonly actualDimensions?: {
              readonly width?: number;
              readonly height?: number;
            };
          };
        };
      };

      expect(renderReport.ok).toBe(true);
      expect(renderReport.diagnostics?.renderer?.bundleDigest?.hash).toMatch(
        /^[0-9a-f]{8}$/u,
      );
      expect(renderReport.diagnostics?.renderer?.actualDimensions).toEqual({
        width: 960,
        height: 640,
      });

      const png = await readFile(out);
      const image = readPngImage(png);
      const center = readPngImagePixel(image, 0.5, 0.5);
      const luma = 0.2126 * center.r + 0.7152 * center.g + 0.0722 * center.b;
      expect(luma).toBeGreaterThan(20);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

const SESSION_RESTORE_BUNDLE_SCRIPT = `
import { writeFile } from "node:fs/promises";
import { createApertureHeadlessRunner, createApertureSessionSnapshot, restoreApertureHeadlessRunnerFromSessionSnapshot } from "@aperture-engine/app/headless";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { createApertureSnapshotBundle } from "./packages/cli/dist/index.js";

const out = process.env.APERTURE_RESTORED_SESSION_BUNDLE;
if (!out) {
  throw new Error("APERTURE_RESTORED_SESSION_BUNDLE is required.");
}

const config = defineApertureConfig({
  mode: "headless",
  render: { defaultCamera: false, defaultLight: false },
});
const systems = [
  {
    default: class RestoredSessionScene extends createSystem({ priority: 0 }) {
      #ticks = 0;

      init() {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        this.spawn.light({
          key: "light.key",
          kind: "directional",
          illuminance: 4,
          transform: { rotationEulerDegrees: [-45, 35, 0] },
        });
        this.spawn.mesh({
          key: "restored-cube",
          mesh: mesh.box({ size: [1, 1, 1] }),
          material: material.standard(),
          transform: { translation: [0, 0, 0] },
        });
      }

      update() {
        this.#ticks += 1;
      }

      snapshotState() {
        return { ticks: this.#ticks };
      }

      restoreState(payload) {
        if (typeof payload === "object" && payload !== null && typeof payload.ticks === "number") {
          this.#ticks = payload.ticks;
        }
      }
    },
  },
];

const original = await createApertureHeadlessRunner({ config, systems, random: 17 });
original.step(1 / 60, 0);
const session = JSON.parse(JSON.stringify(createApertureSessionSnapshot(original)));
const restored = await restoreApertureHeadlessRunnerFromSessionSnapshot({
  config,
  systems,
  random: 17,
  snapshot: session,
});

if (!restored.restore.ok) {
  throw new Error("Session restore failed: " + JSON.stringify(restored.restore));
}

const report = restored.runner.step(1 / 60, 1 / 60);
const bundle = createApertureSnapshotBundle({
  snapshot: report.snapshot,
  assets: restored.runner.app.lowLevel.assets,
  options: { createdBy: "session-snapshot-e2e" },
});
await writeFile(out, JSON.stringify(bundle) + "\\n", "utf8");
`;
