import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveApertureWebRoot } from "../../packages/cli/src/render/driver.js";
import { startApertureStaticServer } from "../../packages/cli/src/render/static-server.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("startApertureStaticServer (P2.3)", () => {
  it("serves files under allowed top-level directories and rejects others", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-static-"));
    await mkdir(path.join(tempDir, "packages/demo"), { recursive: true });
    await mkdir(path.join(tempDir, "secret"), { recursive: true });
    await writeFile(
      path.join(tempDir, "packages/demo/app.js"),
      "export const value = 1;\n",
    );
    await writeFile(path.join(tempDir, "secret/keys.txt"), "nope");

    const server = await startApertureStaticServer(tempDir);

    try {
      const allowed = await fetch(`${server.url}/packages/demo/app.js`);
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("content-type")).toContain("text/javascript");
      expect(await allowed.text()).toContain("export const value");

      // A directory outside the allow-list is not served even though it exists.
      const blocked = await fetch(`${server.url}/secret/keys.txt`);
      expect(blocked.status).toBe(404);

      const missing = await fetch(`${server.url}/packages/demo/missing.js`);
      expect(missing.status).toBe(404);

      // Path traversal never serves a file outside the web root (the HTTP
      // client normalizes dot segments; the server's resolve guard backstops
      // anything that slips through).
      const traversal = await fetch(
        `${server.url}/packages/%2e%2e/%2e%2e/%2e%2e/etc/passwd`,
      );
      expect([403, 404]).toContain(traversal.status);
    } finally {
      await server.close();
    }
  });
});

describe("resolveApertureWebRoot (P2.3)", () => {
  it("walks up to the directory that holds the render harness", async () => {
    const root = await resolveApertureWebRoot();
    const fromNested = await resolveApertureWebRoot(
      path.join(root, "packages/cli/src/render"),
    );
    expect(fromNested).toBe(root);
  });

  it("throws aperture.render.harnessNotFound when no harness exists above", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-noharness-"));
    await expect(resolveApertureWebRoot(tempDir)).rejects.toMatchObject({
      code: "aperture.render.harnessNotFound",
    });
  });
});
