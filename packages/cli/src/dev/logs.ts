import { createWriteStream, type WriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  apertureRuntimeDir,
  readApertureDevSession,
  type ApertureDevSessionLogFiles,
} from "../session.js";
import {
  type ApertureDevLogsOptions,
  type ApertureDevLogsReport,
} from "./types.js";
import { isNodeErrorCode } from "./process.js";

export interface ApertureDevLogStreams {
  readonly daemon: WriteStream;
  readonly server: WriteStream;
  readonly browser: WriteStream;
}

export async function readApertureDevLogs(
  options: ApertureDevLogsOptions,
): Promise<ApertureDevLogsReport> {
  const session = await readApertureDevSession(path.resolve(options.cwd));

  if (session === null) {
    return { session: null, logs: [] };
  }

  const lines = options.lines ?? 80;
  const entries = await Promise.all(
    (
      Object.entries(session.logs) as [
        keyof ApertureDevSessionLogFiles,
        string,
      ][]
    ).map(async ([name, file]) => ({
      name,
      file,
      text: await tailFile(file, lines),
    })),
  );

  return { session, logs: entries };
}

export function logFiles(appRoot: string): ApertureDevSessionLogFiles {
  const runtimeDir = apertureRuntimeDir(appRoot);

  return {
    daemon: path.join(runtimeDir, "daemon.log"),
    server: path.join(runtimeDir, "server.log"),
    browser: path.join(runtimeDir, "browser.log"),
  };
}

export function openApertureDevLogStreams(
  logs: ApertureDevSessionLogFiles,
): ApertureDevLogStreams {
  return {
    daemon: createWriteStream(logs.daemon, { flags: "a" }),
    server: createWriteStream(logs.server, { flags: "a" }),
    browser: createWriteStream(logs.browser, { flags: "a" }),
  };
}

export async function closeApertureDevLogStreams(
  streams: ApertureDevLogStreams,
): Promise<void> {
  await Promise.all([
    closeStream(streams.daemon),
    closeStream(streams.server),
    closeStream(streams.browser),
  ]);
}

export async function appendLog(log: WriteStream, line: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    log.write(`${new Date().toISOString()} ${line}\n`, (error) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

export async function tailFile(file: string, lines: number): Promise<string> {
  try {
    const source = await readFile(file, "utf8");
    const parts = source.split(/\r?\n/);
    if (parts.at(-1) === "") {
      parts.pop();
    }

    return parts.slice(Math.max(0, parts.length - lines)).join("\n");
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return "";
    }

    throw error;
  }
}

async function closeStream(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve) => {
    stream.end(resolve);
  });
}
