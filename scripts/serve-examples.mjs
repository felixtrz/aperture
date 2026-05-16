#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const allowedTopLevelPaths = new Set(["dist", "examples", "node_modules"]);
const port = parsePort(process.env.PORT ?? process.argv[2] ?? "4173");

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end("Method not allowed");
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

  const filePath = resolveStaticPath(requestUrl.pathname);

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
});

server.on("error", (error) => {
  console.error(`Aperture examples server failed: ${messageForError(error)}`);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Aperture examples: http://127.0.0.1:${port}/`);
});

function resolveStaticPath(pathname) {
  const decodedPathname = decodeURIComponent(pathname);
  const normalizedPathname =
    decodedPathname === "/" ? "/examples/index.html" : decodedPathname;
  const relativePath = normalizedPathname.replace(/^\/+/, "");
  const [topLevelPath] = relativePath.split("/");

  if (topLevelPath === undefined || !allowedTopLevelPaths.has(topLevelPath)) {
    return null;
  }

  const resolvedPath = path.resolve(projectRoot, relativePath);

  if (!isWithinProjectRoot(resolvedPath)) {
    return null;
  }

  return resolvedPath;
}

function isWithinProjectRoot(resolvedPath) {
  const relativePath = path.relative(projectRoot, resolvedPath);
  return relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`);
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
