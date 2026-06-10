import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface PilotRouteSummary {
  readonly route: string;
  readonly ok: boolean;
}

interface PilotSummary {
  readonly ok: boolean;
  readonly artifactDir: string;
  readonly routes: readonly PilotRouteSummary[];
}

test.use({ screenshot: "off", trace: "off", video: "off" });

test("render control drives the five pilot routes from one persistent page", async () => {
  // The pilot's browser renders on SwiftShader Vulkan (render-control.mjs
  // default launch args), so five routes plus the persistent shell's two
  // scenario runs take minutes, not seconds, on GPU-less runners.
  test.setTimeout(420000);

  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/render-control.mjs", "pilot"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APERTURE_RENDER_CONTROL_CHANNEL: "chromium",
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 400000,
    },
  );
  const summary = JSON.parse(stdout) as PilotSummary;

  expect(summary).toMatchObject({
    ok: true,
    artifactDir: "test-results/render-control-cli",
  });
  expect(summary.routes.map((route) => route.route)).toEqual([
    "/examples/persistent-render-shell.html",
    "/examples/triangle.html",
    "/examples/spinning-cube.html",
    "/examples/post-effects.html",
    "/examples/glb-viewer.html?asset=slab",
  ]);
  expect(summary.routes.every((route) => route.ok)).toBe(true);
});
