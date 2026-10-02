import type { WriteStream } from "node:fs";
import { PassThrough } from "node:stream";
import { chromium, type Browser, type Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchManagedBrowser } from "../../packages/cli/src/dev/browser.js";

const page = {
  on: vi.fn(),
  addInitScript: vi.fn<() => Promise<void>>(),
  goto: vi.fn<() => Promise<null>>(),
};
const browser = {
  newPage: vi.fn<() => Promise<Page>>(),
  close: vi.fn<() => Promise<void>>(),
};

beforeEach(() => {
  page.on.mockReset();
  page.addInitScript.mockReset().mockResolvedValue();
  page.goto.mockReset().mockResolvedValue(null);
  browser.newPage.mockReset().mockResolvedValue(page as unknown as Page);
  browser.close.mockReset().mockResolvedValue();
  vi.spyOn(chromium, "launch").mockResolvedValue(browser as unknown as Browser);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function launch() {
  return launchManagedBrowser({
    url: "http://127.0.0.1:4173/",
    host: "127.0.0.1",
    cdpPort: 5173,
    headless: true,
    software: false,
    log: new PassThrough() as unknown as WriteStream,
  });
}

describe("managed browser startup ownership", () => {
  it.each(["newPage", "addInitScript", "goto"] as const)(
    "closes the acquired browser when %s fails before handoff",
    async (stage) => {
      const primary = new Error(`${stage} failed`);
      if (stage === "newPage") browser.newPage.mockRejectedValueOnce(primary);
      else page[stage].mockRejectedValueOnce(primary);

      await expect(launch()).rejects.toBe(primary);
      expect(browser.close).toHaveBeenCalledTimes(1);
    },
  );

  it("awaits failed-startup cleanup before rejecting", async () => {
    const primary = new Error("navigation failed");
    let release!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      release = resolve;
    });
    let closeStarted!: () => void;
    const closing = new Promise<void>((resolve) => {
      closeStarted = resolve;
    });
    page.goto.mockRejectedValueOnce(primary);
    browser.close.mockImplementationOnce(() => {
      closeStarted();
      return cleanup;
    });
    let settled = false;
    const startup = launch().catch((error: unknown) => {
      settled = true;
      return error;
    });
    try {
      await Promise.race([closing, startup]);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(browser.close).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);
    } finally {
      release();
    }
    expect(await startup).toBe(primary);
  });

  it("preserves the startup error when browser cleanup also rejects", async () => {
    const primary = new Error("navigation failed");
    page.goto.mockRejectedValueOnce(primary);
    browser.close.mockRejectedValueOnce(new Error("browser cleanup failed"));
    await expect(launch()).rejects.toBe(primary);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("hands successful browser ownership to the caller", async () => {
    const managed = await launch();
    expect(browser.close).not.toHaveBeenCalled();
    expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:4173/", {
      waitUntil: "domcontentloaded",
    });
    await managed.close();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("does not close an unacquired browser after launch failure", async () => {
    const primary = new Error("browser launch failed");
    vi.mocked(chromium.launch).mockRejectedValueOnce(primary);
    await expect(launch()).rejects.toBe(primary);
    expect(browser.close).not.toHaveBeenCalled();
  });
});
