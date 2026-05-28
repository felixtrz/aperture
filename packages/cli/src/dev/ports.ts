import net from "node:net";
import type { ResolveApertureDevServerPortOptions } from "./types.js";

export async function resolveApertureDevServerPort(
  options: ResolveApertureDevServerPortOptions,
): Promise<number> {
  if (options.strictPort) {
    return options.port;
  }

  return findAvailablePort(options.port, options.host);
}

export async function findAvailablePort(
  start: number,
  host: string,
): Promise<number> {
  for (let port = start; port < start + 200; port += 1) {
    if (await canListen(port, host)) {
      return port;
    }
  }

  throw new Error(`Unable to find an available port starting at ${start}.`);
}

async function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}
