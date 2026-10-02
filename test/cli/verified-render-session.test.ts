import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import type * as verifiedWebGpu from "../../scripts/verified-webgpu.mjs";
import {
  cloudTestRenderSessionFactory,
  createVerifiedRenderSessionFactory,
} from "../helpers/verified-render-session.js";
import { waitFor } from "../helpers/wait.js";

// Contract/lifecycle unit tests only. dev-session.test.ts keeps the native
// runner and original lighting/pixel assertions; this mock is file-isolated.
vi.mock("../../scripts/verified-webgpu.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof verifiedWebGpu>()),
  runVerifiedScene: vi.fn(),
}));

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
  "base64",
);
const sceneStatus = {
  ok: true,
  frame: 17,
  diagnostics: [{ code: "unit-feedback" }],
  shadow: { casterCounts: { submitted: 2 } },
  metadata: {
    webgpu: {
      format: "bgra8unorm",
      displayColorSpace: "srgb",
      adapterInfo: { vendor: "unit" },
      adapterFeatures: ["b", "a"],
      deviceFeatures: ["b"],
    },
    lightingHealth: { lighting: { specularIblActive: true } },
  },
};
const roots: string[] = [];
const sessions: Awaited<
  ReturnType<ReturnType<typeof createVerifiedRenderSessionFactory>>
>[] = [];

beforeEach(() => {
  vi.mocked(runVerifiedScene)
    .mockReset()
    .mockImplementation(async (options) => {
      await writeFile(options.screenshotPath!, png);
      return {
        schema: 1,
        status: "passed",
        browserVersion: "Chromium/unit",
        launch: {
          actualArgv: ["/unit/chromium", "--headless", "--unit-proof"],
        },
        sceneStatus,
      };
    });
});
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.dispose();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function fixture() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "aperture-verified-session-unit-"),
  );
  roots.push(root);
  const options = {
    runtimeRoot: path.join(root, "runtime"),
    scratchRoot: path.join(root, "scratch"),
    outputRoot: path.join(root, "evidence"),
  };
  await mkdir(options.scratchRoot);
  const session = await createVerifiedRenderSessionFactory(options)();
  sessions.push(session);
  return { session, options };
}
const input = {
  bundle: { digest: { algorithm: "unit", hash: "abc", byteLength: 12 } },
  width: 1,
  height: 1,
  timeoutMs: 12345,
};

describe("verified cloud session adapter contract (no browser)", () => {
  it("maps actual runner bytes/status and observed browser provenance", async () => {
    const { session } = await fixture();
    expect(() => session.browser).toThrow("No browser");
    const result = await session.render(input);
    expect(result.png).toEqual(png);
    expect(result.frame).toBe(17);
    expect(result.metadata).toEqual({
      diagnostics: sceneStatus.diagnostics,
      shadow: sceneStatus.shadow,
      browser: {
        channel: "Chromium/unit",
        headless: true,
        args: ["--headless", "--unit-proof"],
      },
      requestedDimensions: { width: 1, height: 1 },
      actualDimensions: { width: 1, height: 1 },
      bundleDigest: input.bundle.digest,
      webgpu: { ...sceneStatus.metadata.webgpu, adapterFeatures: ["a", "b"] },
      lightingHealth: sceneStatus.metadata.lightingHealth,
    });
    expect(session.browser).toBe(result.metadata.browser);
    const call = vi.mocked(runVerifiedScene).mock.calls[0]![0];
    expect(call.viewport).toEqual({ width: 1, height: 1 });
    expect(call.timeout).toBe(12345);
    expect(JSON.parse(await readFile(call.bundlePath!, "utf8"))).toEqual(
      input.bundle,
    );
    // The real static server has been closed when render resolves.
    await expect(fetch(call.url)).rejects.toThrow();
  });

  it("serializes accepted renders with distinct evidence and drains disposal", async () => {
    const { session } = await fixture();
    const impl = vi.mocked(runVerifiedScene).getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(runVerifiedScene).mockImplementationOnce(async (options) => {
      await gate;
      return impl(options);
    });
    const first = session.render(input);
    const second = session.render(input);
    const disposal = session.dispose();
    expect(session.dispose()).toBe(disposal);
    try {
      await waitFor(() => vi.mocked(runVerifiedScene).mock.calls.length === 1);
      await expect(session.render(input)).rejects.toThrow("disposed");
      release();
      await Promise.all([first, second, disposal]);
    } finally {
      release();
    }
    const calls = vi.mocked(runVerifiedScene).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0].outputPath).not.toBe(calls[1]![0].outputPath);
    expect(calls[0]![0].bundlePath).not.toBe(calls[1]![0].bundlePath);
  });

  it("closes failed render servers and allows the next isolated render", async () => {
    const { session } = await fixture();
    vi.mocked(runVerifiedScene).mockRejectedValueOnce(
      new Error("native proof rejected"),
    );
    await expect(session.render(input)).rejects.toThrow(
      "native proof rejected",
    );
    await expect(
      fetch(vi.mocked(runVerifiedScene).mock.calls[0]![0].url),
    ).rejects.toThrow();
    await expect(session.render(input)).resolves.toMatchObject({ frame: 17 });
  });

  it("rejects malformed status or incorrectly sized PNGs rather than fabricating results", async () => {
    const { session } = await fixture();
    vi.mocked(runVerifiedScene).mockResolvedValueOnce({
      schema: 1,
      status: "passed",
      sceneStatus: { ok: true },
    });
    await expect(session.render(input)).rejects.toThrow(
      "Harness metadata missing",
    );
    await expect(session.render({ ...input, width: 2 })).rejects.toThrow(
      "PNG does not match",
    );
  });

  it("rejects evidence under disposable scratch and invalid dimensions before launch", async () => {
    const { session, options } = await fixture();
    await expect(
      createVerifiedRenderSessionFactory({
        ...options,
        outputRoot: path.join(options.scratchRoot, "evidence"),
      })(),
    ).rejects.toThrow("outside disposable scratch");
    await expect(session.render({ ...input, width: 0 })).rejects.toThrow(
      "width",
    );
    expect(runVerifiedScene).not.toHaveBeenCalled();
  });

  it("opts in explicitly and fails closed on missing wrapper configuration", () => {
    vi.stubEnv("APERTURE_TEST_CLOUD_RENDER_OUTPUT", undefined);
    expect(cloudTestRenderSessionFactory()).toBeUndefined();
    vi.stubEnv("APERTURE_TEST_CLOUD_RENDER_OUTPUT", "/retained/evidence");
    vi.stubEnv("APERTURE_WEBGPU_RUNTIME", "/runtime");
    vi.stubEnv("APERTURE_TMP_RUN", undefined);
    expect(() => cloudTestRenderSessionFactory()).toThrow(
      "cleanup lifecycle wrapper",
    );
  });
});
