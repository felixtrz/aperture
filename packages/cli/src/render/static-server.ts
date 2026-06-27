import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import path from "node:path";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wgsl": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
};

// Only the directory trees the render harness needs: its own page plus the
// engine dist and third-party module files referenced by the import map.
const ALLOWED_TOP_LEVEL = new Set(["examples", "packages", "node_modules"]);

export interface ApertureStaticServer {
  readonly url: string;
  close(): Promise<void>;
}

/**
 * A minimal static file server rooted at the Aperture repo/install layout used
 * by the render harness. WebGPU is exposed on a secure context, and 127.0.0.1
 * counts as secure, so no TLS is needed.
 */
export async function startApertureStaticServer(
  webRoot: string,
): Promise<ApertureStaticServer> {
  const server: Server = createServer((req, res) => {
    void serveRequest(webRoot, req.url ?? "/", res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

async function serveRequest(
  webRoot: string,
  requestUrl: string,
  res: ServerResponse,
): Promise<void> {
  try {
    const pathname = decodeURIComponent(
      new URL(requestUrl, "http://localhost").pathname,
    );
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    const topLevel = segments[0];

    if (topLevel === undefined || !ALLOWED_TOP_LEVEL.has(topLevel)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const filePath = path.join(webRoot, ...segments);
    const normalizedRoot = path.resolve(webRoot);

    if (!path.resolve(filePath).startsWith(normalizedRoot)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat === null || !fileStat.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
    );
    createReadStream(filePath).pipe(res);
  } catch {
    res.statusCode = 500;
    res.end("Internal error");
  }
}
