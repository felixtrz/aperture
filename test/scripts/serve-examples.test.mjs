import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  contentTypeFor,
  createExamplesRequestHandler,
  parsePort,
  projectRoot,
  resolveStaticPath,
} from "../../scripts/serve-examples.mjs";

describe("examples static server helpers", () => {
  it("resolves allowed example, dist, and root paths without listening", () => {
    expect(resolveStaticPath("/")).toBe(
      path.resolve(projectRoot, "examples/index.html"),
    );
    expect(resolveStaticPath("/examples/")).toBe(
      path.resolve(projectRoot, "examples/index.html"),
    );
    expect(resolveStaticPath("/examples/triangle.html")).toBe(
      path.resolve(projectRoot, "examples/triangle.html"),
    );
    expect(resolveStaticPath("/dist/index.js")).toBe(
      path.resolve(projectRoot, "dist/index.js"),
    );
    expect(resolveStaticPath("/node_modules/elics/lib/index.js")).toBe(
      path.resolve(projectRoot, "node_modules/elics/lib/index.js"),
    );
    expect(
      resolveStaticPath(
        "/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
      ),
    ).toBe(
      path.resolve(
        projectRoot,
        "node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
      ),
    );
  });

  it("denies paths outside allowed static roots and traversal attempts", () => {
    expect(resolveStaticPath("/package.json")).toBeNull();
    expect(resolveStaticPath("/docs/ARCHITECTURE.md")).toBeNull();
    expect(resolveStaticPath("/examples/../package.json")).toBeNull();
    expect(resolveStaticPath("/examples/%2e%2e/package.json")).toBeNull();
    expect(resolveStaticPath("/dist/../examples/index.html")).toBeNull();
  });

  it("maps common browser artifact extensions to content types", () => {
    expect(contentTypeFor("examples/index.html")).toBe(
      "text/html; charset=utf-8",
    );
    expect(contentTypeFor("examples/styles.css")).toBe(
      "text/css; charset=utf-8",
    );
    expect(contentTypeFor("dist/index.js")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(contentTypeFor("dist/chunk.mjs")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(contentTypeFor("dist/manifest.json")).toBe(
      "application/json; charset=utf-8",
    );
    expect(contentTypeFor("dist/index.js.map")).toBe(
      "application/json; charset=utf-8",
    );
    expect(contentTypeFor("dist/module.wasm")).toBe("application/wasm");
    expect(contentTypeFor("dist/asset.bin")).toBe("application/octet-stream");
  });

  it("parses valid ports and rejects invalid CLI values", () => {
    expect(parsePort("1")).toBe(1);
    expect(parsePort("4173")).toBe(4173);
    expect(parsePort("65535")).toBe(65535);

    for (const value of ["0", "65536", "-1", "abc", "4173.5"]) {
      expect(() => parsePort(value)).toThrow(
        `Invalid examples server port: ${value}`,
      );
    }
  });

  it("exits non-zero for invalid CLI port input without listening", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(projectRoot, "scripts/serve-examples.mjs"), "not-a-port"],
      {
        cwd: projectRoot,
        encoding: "utf8",
        env: withoutPortEnv(),
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Invalid examples server port: not-a-port",
    );
  });
});

describe("examples static server request handler", () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "aperture-examples-"));
    await mkdir(path.join(tempRoot, "examples"), { recursive: true });
    await mkdir(path.join(tempRoot, "dist"), { recursive: true });
    await mkdir(path.join(tempRoot, "node_modules/elics/lib"), {
      recursive: true,
    });
    await mkdir(path.join(tempRoot, "node_modules/wgpu-matrix/dist/3.x"), {
      recursive: true,
    });
    await mkdir(path.join(tempRoot, "node_modules/@preact/signals-core/dist"), {
      recursive: true,
    });
    await writeFile(
      path.join(tempRoot, "examples/index.html"),
      "<!doctype html>",
    );
    await writeFile(path.join(tempRoot, "examples/styles.css"), "body {}");
    await writeFile(
      path.join(tempRoot, "examples/webgpu-readback.js"),
      "export const readback = true;",
    );
    await writeFile(path.join(tempRoot, "dist/index.js"), "export {};");
    await writeFile(
      path.join(tempRoot, "node_modules/elics/lib/index.js"),
      "export const elics = true;",
    );
    await writeFile(
      path.join(
        tempRoot,
        "node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
      ),
      "export const mat4 = {};",
    );
    await writeFile(
      path.join(
        tempRoot,
        "node_modules/@preact/signals-core/dist/signals-core.mjs",
      ),
      "export const signal = () => {};",
    );
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("serves GET responses with browser isolation headers", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers["cross-origin-embedder-policy"]).toBe(
      "require-corp",
    );
    expect(response.text()).toBe("<!doctype html>");
  });

  it("serves HEAD responses without a body", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "HEAD",
      url: "/dist/index.js",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(response.headers["content-length"]).toBe(10);
    expect(response.text()).toBe("");
  });

  it("redirects /examples to the directory URL", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples",
    });

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe("/examples/");
    expect(response.text()).toBe("");
  });

  it("serves the examples directory URL as the harness index", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.text()).toBe("<!doctype html>");
  });

  it("serves shared browser example helper modules", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples/webgpu-readback.js",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(response.text()).toBe("export const readback = true;");
  });

  it("ignores query strings when resolving static files", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples/styles.css?v=1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/css; charset=utf-8");
    expect(response.text()).toBe("body {}");
  });

  it("serves explicitly allowed node_modules ESM paths", async () => {
    const dependencyPaths = [
      {
        url: "/node_modules/elics/lib/index.js",
        body: "export const elics = true;",
      },
      {
        url: "/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
        body: "export const mat4 = {};",
      },
      {
        url: "/node_modules/@preact/signals-core/dist/signals-core.mjs",
        body: "export const signal = () => {};",
      },
    ];

    for (const dependency of dependencyPaths) {
      const response = await requestExample({
        root: tempRoot,
        method: "GET",
        url: dependency.url,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe(
        "text/javascript; charset=utf-8",
      );
      expect(response.headers["cross-origin-opener-policy"]).toBe(
        "same-origin",
      );
      expect(response.headers["cross-origin-embedder-policy"]).toBe(
        "require-corp",
      );
      expect(response.text()).toBe(dependency.body);
    }
  });

  it("returns not found for allowed but missing files", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples/missing.js",
    });

    expect(response.statusCode).toBe(404);
    expect(response.text()).toBe("Not found");
  });

  it("rejects unsupported methods and traversal requests", async () => {
    const methodResponse = await requestExample({
      root: tempRoot,
      method: "POST",
      url: "/",
    });
    const traversalResponse = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples/../package.json",
    });

    expect(methodResponse.statusCode).toBe(405);
    expect(methodResponse.headers.allow).toBe("GET, HEAD");
    expect(methodResponse.text()).toBe("Method not allowed");
    expect(traversalResponse.statusCode).toBe(403);
    expect(traversalResponse.text()).toBe("Forbidden");
  });

  it("rejects encoded traversal through node_modules", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/node_modules/elics/%2e%2e/package.json",
    });

    expect(response.statusCode).toBe(403);
    expect(response.text()).toBe("Forbidden");
  });

  it("returns a bad request for malformed encoded paths", async () => {
    const response = await requestExample({
      root: tempRoot,
      method: "GET",
      url: "/examples/%E0%A4%A",
    });

    expect(response.statusCode).toBe(400);
    expect(response.text()).toBe("Bad request");
  });
});

async function requestExample({ root, method, url }) {
  const handler = createExamplesRequestHandler(root);
  const response = new CaptureResponse();
  const finished = once(response, "finish");

  await handler(
    {
      method,
      url,
      headers: { host: "localhost" },
    },
    response,
  );
  await finished;

  return response;
}

class CaptureResponse extends Writable {
  statusCode = 200;
  headers = {};
  chunks = [];

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function withoutPortEnv() {
  const env = { ...process.env };
  delete env.PORT;
  return env;
}
