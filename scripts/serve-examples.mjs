#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const allowedTopLevelPaths = new Set(["examples", "node_modules", "packages"]);
const workerModulePrefix = "/worker-modules/";
const workerModuleImportMap = new Map([
  ["@aperture-engine/core", "/worker-modules/packages/core/dist/index.js"],
  ["@aperture-engine/render", "/worker-modules/packages/render/dist/index.js"],
  [
    "@aperture-engine/runtime",
    "/worker-modules/packages/runtime/dist/index.js",
  ],
  [
    "@aperture-engine/simulation",
    "/worker-modules/packages/simulation/dist/index.js",
  ],
  ["@aperture-engine/webgpu", "/worker-modules/packages/webgpu/dist/index.js"],
  ["elics", "/worker-modules/node_modules/elics/lib/index.js"],
  [
    "wgpu-matrix",
    "/worker-modules/node_modules/wgpu-matrix/dist/3.x/wgpu-matrix.module.js",
  ],
  [
    "@preact/signals-core",
    "/worker-modules/node_modules/@preact/signals-core/dist/signals-core.mjs",
  ],
]);

export {
  contentTypeFor,
  createExamplesRequestHandler,
  createExamplesServer,
  parsePort,
  projectRoot,
};

export function resolveStaticPath(pathname, root = projectRoot) {
  const decodedPathname = decodeURIComponent(pathname);
  const decodedSegments = decodedPathname.split("/");

  if (decodedSegments.includes("..")) {
    return null;
  }

  const normalizedPathname =
    decodedPathname === "/" || decodedPathname === "/examples/"
      ? "/examples/index.html"
      : decodedPathname;
  const relativePath = normalizedPathname.replace(/^\/+/, "");
  const [topLevelPath] = relativePath.split("/");

  if (topLevelPath === undefined || !allowedTopLevelPaths.has(topLevelPath)) {
    return null;
  }

  const resolvedPath = path.resolve(root, relativePath);
  const allowedRoot = path.resolve(root, topLevelPath);

  if (!isWithinDirectory(resolvedPath, allowedRoot)) {
    return null;
  }

  return resolvedPath;
}

function createExamplesServer(root = projectRoot) {
  return createServer(createExamplesRequestHandler(root));
}

function createExamplesRequestHandler(root = projectRoot) {
  return async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }

    const rawPathStatus = inspectRawRequestPath(request.url ?? "/");

    if (rawPathStatus === "malformed-path") {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (rawPathStatus === "forbidden-path") {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    if (requestUrl.pathname === "/examples") {
      response.writeHead(308, { location: "/examples/" });
      response.end();
      return;
    }

    if (requestUrl.pathname.startsWith(workerModulePrefix)) {
      await serveWorkerModule(request, response, requestUrl.pathname, root);
      return;
    }

    const filePath = safeResolveStaticPath(requestUrl.pathname, root);

    if (filePath === "malformed-path") {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (filePath === null) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat === null || !fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-length": fileStat.size,
      "content-type": contentTypeFor(filePath),
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  };
}

export function resolveWorkerModulePath(pathname, root = projectRoot) {
  if (!pathname.startsWith(workerModulePrefix)) {
    return null;
  }

  const staticPathname = `/${pathname.slice(workerModulePrefix.length)}`;

  return safeResolveStaticPath(staticPathname, root);
}

export function rewriteWorkerModuleImports(source) {
  let rewritten = source;

  for (const [specifier, target] of workerModuleImportMap) {
    rewritten = rewriteImportSpecifier(rewritten, specifier, target);
  }

  return rewritten;
}

async function serveWorkerModule(request, response, pathname, root) {
  const filePath = safeResolveWorkerModulePath(pathname, root);

  if (filePath === "malformed-path") {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (filePath === null) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const fileStat = await stat(filePath).catch(() => null);

  if (fileStat === null || !fileStat.isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const body = isJavaScriptPath(filePath)
    ? rewriteWorkerModuleImports(await readFile(filePath, "utf8"))
    : await readFile(filePath);
  const contentLength =
    typeof body === "string" ? Buffer.byteLength(body, "utf8") : body.length;

  response.writeHead(200, {
    "content-length": contentLength,
    "content-type": contentTypeFor(filePath),
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": "require-corp",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(body);
}

function rewriteImportSpecifier(source, specifier, target) {
  const escaped = escapeRegExp(specifier);

  return source
    .replace(
      new RegExp(`(\\bfrom\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    )
    .replace(
      new RegExp(`(\\bimport\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    )
    .replace(
      new RegExp(`(\\bimport\\s*\\(\\s*)(["'])${escaped}\\2`, "g"),
      `$1$2${target}$2`,
    );
}

function inspectRawRequestPath(url) {
  const rawPathname = url.split(/[?#]/, 1)[0] ?? "/";

  try {
    return decodeURIComponent(rawPathname).split("/").includes("..")
      ? "forbidden-path"
      : "ok";
  } catch (error) {
    if (error instanceof URIError) {
      return "malformed-path";
    }

    throw error;
  }
}

function safeResolveStaticPath(pathname, root) {
  try {
    return resolveStaticPath(pathname, root);
  } catch (error) {
    if (error instanceof URIError) {
      return "malformed-path";
    }

    throw error;
  }
}

function safeResolveWorkerModulePath(pathname, root) {
  try {
    return resolveWorkerModulePath(pathname, root);
  } catch (error) {
    if (error instanceof URIError) {
      return "malformed-path";
    }

    throw error;
  }
}

function isWithinDirectory(resolvedPath, directory) {
  const relativePath = path.relative(directory, resolvedPath);
  return relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`);
}

function isJavaScriptPath(filePath) {
  const extname = path.extname(filePath);

  return extname === ".js" || extname === ".mjs";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePort(value) {
  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid examples server port: ${value}`);
  }

  return parsedPort;
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}

function messageForError(error) {
  return error instanceof Error ? error.message : String(error);
}

if (isMainModule()) {
  const port = parsePort(process.env.PORT ?? process.argv[2] ?? "4173");
  const server = createExamplesServer(projectRoot);

  server.on("error", (error) => {
    console.error(`Aperture examples server failed: ${messageForError(error)}`);
    process.exitCode = 1;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Aperture examples: http://127.0.0.1:${port}/`);
  });
}

function isMainModule() {
  return (
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}
