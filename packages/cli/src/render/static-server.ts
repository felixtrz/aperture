import { createReadStream, realpathSync } from "node:fs";
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

export interface StaticMount {
  /** URL prefix, e.g. "/_engine/render/". Must start and end with "/". */
  readonly prefix: string;
  /** Absolute directory served under the prefix. */
  readonly dir: string;
}

export interface ApertureStaticServer {
  readonly url: string;
  close(): Promise<void>;
}

/**
 * A minimal static file server for the render harness. It serves a single
 * generated `index.html` at "/" and maps each {@link StaticMount} prefix to a
 * real directory (the resolved engine/vendor package roots). 127.0.0.1 is a
 * secure context, so WebGPU works without TLS.
 */
export async function startApertureStaticServer(options: {
  readonly mounts: readonly StaticMount[];
  readonly index: string;
}): Promise<ApertureStaticServer> {
  // Pre-resolve each mount's real root once for fast, escape-proof containment.
  const mounts = options.mounts.map((mount) => ({
    prefix: mount.prefix,
    realDir: realpathSync(mount.dir),
  }));

  const server: Server = createServer((req, res) => {
    void serveRequest(mounts, options.index, req.url ?? "/", res);
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
  mounts: ReadonlyArray<{ prefix: string; realDir: string }>,
  index: string,
  requestUrl: string,
  res: ServerResponse,
): Promise<void> {
  try {
    const pathname = decodeURIComponent(
      new URL(requestUrl, "http://localhost").pathname,
    );

    if (pathname === "/" || pathname === "/index.html") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(index);
      return;
    }

    const mount = mounts.find((entry) => pathname.startsWith(entry.prefix));

    if (mount === undefined) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const relative = pathname.slice(mount.prefix.length);
    const filePath = path.join(mount.realDir, relative);

    if (!path.resolve(filePath).startsWith(mount.realDir + path.sep)) {
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
