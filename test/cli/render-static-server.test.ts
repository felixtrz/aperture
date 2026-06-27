import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startApertureStaticServer } from "../../packages/cli/src/render/static-server.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("startApertureStaticServer (mount table, PB.2)", () => {
  it("serves the generated index at / and files from mounts", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-static-"));
    await mkdir(path.join(tempDir, "pkg/dist"), { recursive: true });
    await writeFile(
      path.join(tempDir, "pkg/dist/index.js"),
      "export const value = 1;\n",
    );

    const server = await startApertureStaticServer({
      index: "<!doctype html><title>harness</title>",
      mounts: [{ prefix: "/_engine/pkg/", dir: path.join(tempDir, "pkg") }],
    });

    try {
      const index = await fetch(`${server.url}/`);
      expect(index.status).toBe(200);
      expect(index.headers.get("content-type")).toContain("text/html");
      expect(await index.text()).toContain("harness");

      const mounted = await fetch(`${server.url}/_engine/pkg/dist/index.js`);
      expect(mounted.status).toBe(200);
      expect(mounted.headers.get("content-type")).toContain("text/javascript");
      expect(await mounted.text()).toContain("export const value");

      const missing = await fetch(`${server.url}/_engine/pkg/dist/missing.js`);
      expect(missing.status).toBe(404);

      const unknownMount = await fetch(`${server.url}/_engine/other/x.js`);
      expect(unknownMount.status).toBe(404);

      // Traversal that escapes the mount is never served.
      const traversal = await fetch(
        `${server.url}/_engine/pkg/%2e%2e/%2e%2e/etc/passwd`,
      );
      expect([403, 404]).toContain(traversal.status);
    } finally {
      await server.close();
    }
  });
});
