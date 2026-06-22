import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apertureRuntimeDir,
  createApertureDevSession,
  writeApertureDevSession,
} from "../../packages/cli/src/session.js";

const browserAdapter = vi.hoisted(() => {
  let connectCount = 0;
  const pageStatus = {
    url: "http://127.0.0.1:5173/",
    managed: true,
    status: {
      status: "running",
      webgpuOk: true,
    },
  };
  return {
    page: { id: "page-0" },
    pageStatus,
    connectToManagedPage: vi.fn(async () => ({
      browser: { id: `browser-${connectCount}` },
      page: { id: `page-${connectCount++}` },
    })),
    readGeneratedStatus: vi.fn(async () => pageStatus),
  };
});

vi.mock("../../packages/cli/src/tools/browser.js", () => ({
  canvasStatus: vi.fn(async () => ({ ok: true, status: null })),
  connectToManagedPage: browserAdapter.connectToManagedPage,
  readGeneratedStatus: browserAdapter.readGeneratedStatus,
  screenshot: vi.fn(async () => ({ ok: true })),
  waitForWebGpu: vi.fn(async () => ({ ok: true })),
}));

const tempRoots: string[] = [];

describe("Aperture CLI tool client", () => {
  afterEach(async () => {
    browserAdapter.connectToManagedPage.mockClear();
    browserAdapter.readGeneratedStatus.mockClear();
    browserAdapter.readGeneratedStatus.mockResolvedValue(
      browserAdapter.pageStatus,
    );
    vi.resetModules();

    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("reuses the managed browser connection for repeated browser-backed tools", async () => {
    const root = await tempRoot();
    const { callApertureTool } =
      await import("../../packages/cli/src/tools/client.js");

    await writeRunningSession(root);

    const result = await callApertureTool({
      cwd: root,
      name: "browser_status",
      arguments: {},
    });
    const secondResult = await callApertureTool({
      cwd: root,
      name: "browser_status",
      arguments: {},
    });

    expect(result).toMatchObject({
      ok: true,
      page: browserAdapter.pageStatus,
    });
    expect(secondResult).toMatchObject({
      ok: true,
      page: browserAdapter.pageStatus,
    });
    expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(1);
    expect(browserAdapter.readGeneratedStatus).toHaveBeenCalledTimes(2);
  });

  it("reconnects once when a cached managed page has closed", async () => {
    const root = await tempRoot();
    const { callApertureTool } =
      await import("../../packages/cli/src/tools/client.js");

    await writeRunningSession(root);
    browserAdapter.readGeneratedStatus
      .mockRejectedValueOnce(
        new Error(
          "page.evaluate: Target page, context or browser has been closed",
        ),
      )
      .mockResolvedValueOnce(browserAdapter.pageStatus);

    const result = await callApertureTool({
      cwd: root,
      name: "browser_status",
      arguments: {},
    });

    expect(result).toMatchObject({
      ok: true,
      page: browserAdapter.pageStatus,
    });
    expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(2);
    expect(browserAdapter.readGeneratedStatus).toHaveBeenCalledTimes(2);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-cli-tool-"));
  tempRoots.push(root);
  return root;
}

async function writeRunningSession(root: string): Promise<void> {
  const runtimeDir = apertureRuntimeDir(root);
  await writeApertureDevSession(
    createApertureDevSession({
      appRoot: root,
      url: "http://127.0.0.1:5173/",
      host: "127.0.0.1",
      port: 5173,
      daemonPid: null,
      serverPid: null,
      browserPid: null,
      browserCdpPort: 6173,
      browserHeadless: true,
      daemonState: "running",
      serverState: "running",
      browserState: "running",
      logs: {
        daemon: path.join(runtimeDir, "daemon.log"),
        server: path.join(runtimeDir, "server.log"),
        browser: path.join(runtimeDir, "browser.log"),
      },
    }),
  );
}
