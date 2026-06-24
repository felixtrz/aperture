import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ciSwiftShaderArgs = [
  "--enable-unsafe-webgpu",
  "--use-vulkan=swiftshader",
  "--enable-features=Vulkan",
  "--enable-unsafe-swiftshader",
].join(" ");

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

test("render control drives the five pilot routes from one persistent page", async ({
  browserName: _browserName,
}, testInfo) => {
  // The pilot's browser renders on SwiftShader Vulkan (render-control.mjs
  // default launch args), so five routes plus the persistent shell's two
  // scenario runs take minutes, not seconds, on GPU-less runners.
  test.setTimeout(420000);

  const artifactDir = testInfo.outputPath("render-control-cli");
  let stdout: string;

  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      ["scripts/render-control.mjs", "pilot"],
      {
        cwd: process.cwd(),
        env: renderControlEnv(artifactDir),
        maxBuffer: 16 * 1024 * 1024,
        timeout: 400000,
      },
    ));
  } catch (error) {
    throw new Error(renderExecFailure(error, artifactDir), { cause: error });
  }

  const summary = JSON.parse(stdout) as PilotSummary;

  expect(summary).toMatchObject({
    ok: true,
    artifactDir,
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

function renderControlEnv(artifactDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APERTURE_RENDER_CONTROL_ARTIFACT_DIR: artifactDir,
    APERTURE_RENDER_CONTROL_CHANNEL:
      process.env.APERTURE_RENDER_CONTROL_CHANNEL ??
      (process.env.CI === "true" ? "chrome" : "chromium"),
  };

  if (
    process.env.CI === "true" &&
    process.env.APERTURE_RENDER_CONTROL_BROWSER_ARGS === undefined
  ) {
    env.APERTURE_RENDER_CONTROL_BROWSER_ARGS = ciSwiftShaderArgs;
  }

  return env;
}

function renderExecFailure(error: unknown, artifactDir: string): string {
  const execError = error as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly signal?: unknown;
    readonly stderr?: unknown;
    readonly stdout?: unknown;
  };

  return [
    `render-control pilot failed: ${String(execError.message ?? error)}`,
    `code=${String(execError.code ?? "")}`,
    `signal=${String(execError.signal ?? "")}`,
    `artifactDir=${artifactDir}`,
    `stdout=${formatExecOutput(execError.stdout)}`,
    `stderr=${formatExecOutput(execError.stderr)}`,
  ].join("\n");
}

function formatExecOutput(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "");

  return text.length > 8000 ? `${text.slice(0, 8000)}\n...<truncated>` : text;
}
