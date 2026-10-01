import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apertureRuntimeDir,
  createApertureDevSession,
  writeApertureDevSession,
  readApertureDevSession,
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
    closeBrowserConnection: vi.fn(async () => {}),
    connectToManagedPage: vi.fn(async () => ({
      browser: { id: `browser-${connectCount}` },
      page: { id: `page-${connectCount++}` },
    })),
    readGeneratedStatus: vi.fn(async () => pageStatus),
  };
});

vi.mock("../../packages/cli/src/tools/browser.js", () => ({
  canvasStatus: vi.fn(async () => ({ ok: true, status: null })),
  closeBrowserConnection: browserAdapter.closeBrowserConnection,
  connectToManagedPage: browserAdapter.connectToManagedPage,
  readGeneratedStatus: browserAdapter.readGeneratedStatus,
  screenshot: vi.fn(async () => ({ ok: true })),
  waitForWebGpu: vi.fn(async () => ({ ok: true })),
}));

const tempRoots: string[] = [];

describe("Aperture CLI tool client", () => {
  afterEach(async () => {
    browserAdapter.closeBrowserConnection.mockClear();
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
      keepBrowserConnection: true,
    });
    const secondResult = await callApertureTool({
      cwd: root,
      name: "browser_status",
      arguments: {},
      keepBrowserConnection: true,
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
    expect(browserAdapter.closeBrowserConnection).not.toHaveBeenCalled();
    expect(browserAdapter.readGeneratedStatus).toHaveBeenCalledTimes(2);
  });

  it("closes the managed browser connection for one-shot browser-backed tools", async () => {
    const root = await tempRoot();
    const { callApertureTool } =
      await import("../../packages/cli/src/tools/client.js");

    await writeRunningSession(root);

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
    expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(1);
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

  it("keeps each MCP connection's cached browser independent and disconnects on EOF", async () => {
    const root = await tempRoot();
    await writeRunningSession(root);
    const { runApertureMcpServer } =
      await import("../../packages/cli/src/mcp.js");
    const { ApertureToolClient } =
      await import("../../packages/cli/src/tools/client.js");
    const otherClient = new ApertureToolClient();
    const options = {
      cwd: root,
      name: "browser_status",
      keepBrowserConnection: true,
    };
    await otherClient.call(options);
    const otherConnection =
      await browserAdapter.connectToManagedPage.mock.results[0]!.value;
    const stdin = new PassThrough();
    const output: string[] = [];
    const done = runApertureMcpServer({
      cwd: root,
      stdin,
      stdout: { write: (chunk) => output.push(chunk) },
    });
    stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "app_status", arguments: { target: "headed", waitUntilReady: true } } })}\n`,
    );
    stdin.end();
    await done;
    expect(JSON.parse(output[0]!).result.structuredContent.ok).toBe(true);
    expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(2);
    expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(1);
    expect(browserAdapter.closeBrowserConnection).not.toHaveBeenCalledWith(
      otherConnection,
    );
    // Closing the MCP transport only disconnects its CDP client; the managed
    // daemon session belongs to `dev up` and remains available.
    expect(await readApertureDevSession(root)).not.toBeNull();
    await otherClient.call(options);
    expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(2);
    await otherClient.dispose();
    await otherClient.dispose();
    expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(2);
    expect(browserAdapter.closeBrowserConnection).toHaveBeenLastCalledWith(
      otherConnection,
    );
  });

  it("releases the previous browser connection when switching managed sessions", async () => {
    const firstRoot = await tempRoot();
    const secondRoot = await tempRoot();
    await writeRunningSession(firstRoot);
    await writeRunningSession(secondRoot);
    const { ApertureToolClient } =
      await import("../../packages/cli/src/tools/client.js");
    const client = new ApertureToolClient();
    try {
      await client.call({
        cwd: firstRoot,
        name: "browser_status",
        keepBrowserConnection: true,
      });
      const previous =
        await browserAdapter.connectToManagedPage.mock.results[0]!.value;
      await client.call({
        cwd: secondRoot,
        name: "browser_status",
        keepBrowserConnection: true,
      });
      expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(2);
      expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(1);
      expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledWith(
        previous,
      );
    } finally {
      await client.dispose();
    }
    expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(2);
  });

  it("releases a closed persistent connection before retrying it", async () => {
    const root = await tempRoot();
    await writeRunningSession(root);
    const { ApertureToolClient } =
      await import("../../packages/cli/src/tools/client.js");
    const client = new ApertureToolClient();
    browserAdapter.readGeneratedStatus.mockRejectedValueOnce(
      new Error("Target closed"),
    );
    try {
      await expect(
        client.call({
          cwd: root,
          name: "browser_status",
          keepBrowserConnection: true,
        }),
      ).resolves.toMatchObject({ ok: true });
      expect(browserAdapter.connectToManagedPage).toHaveBeenCalledTimes(2);
      expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(1);
    } finally {
      await client.dispose();
    }
    expect(browserAdapter.closeBrowserConnection).toHaveBeenCalledTimes(2);
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
