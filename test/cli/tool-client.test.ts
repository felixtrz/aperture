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
  const pageStatus = {
    url: "http://127.0.0.1:5173/",
    managed: true,
    status: {
      status: "running",
      webgpuOk: true,
    },
  };
  const browser = {
    close: vi.fn(async () => undefined),
  };

  return {
    browser,
    page: {},
    pageStatus,
    connectToManagedPage: vi.fn(async () => ({
      browser,
      page: {},
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
    browserAdapter.browser.close.mockClear();
    browserAdapter.connectToManagedPage.mockClear();
    browserAdapter.readGeneratedStatus.mockClear();

    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("closes the Playwright CDP client after browser-backed tools", async () => {
    const root = await tempRoot();
    const runtimeDir = apertureRuntimeDir(root);
    const { callApertureTool } = await import(
      "../../packages/cli/src/tools/client.js"
    );

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

    const result = await callApertureTool({
      cwd: root,
      name: "browser_status",
      arguments: {},
    });

    expect(result).toMatchObject({
      ok: true,
      page: browserAdapter.pageStatus,
    });
    expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(1);
    expect(browserAdapter.browser.close).toHaveBeenCalledTimes(1);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-cli-tool-"));
  tempRoots.push(root);
  return root;
}
