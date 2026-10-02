import { Writable } from "node:stream";
import {
  ApertureMcpSessionManager,
  type ApertureMcpSessionManagerOptions,
} from "./mcp-session-manager.js";
import { APERTURE_CLI_VERSION } from "./version.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * Connect-time guidance for MCP clients (agents). Keep this short and
 * operational: it is the first thing an agent reads about this server.
 */
const APERTURE_MCP_INSTRUCTIONS = `Aperture is a deterministic, simulation-first engine. Iterate headlessly: app_start({target:"headless"}), then ecs_step / ecs_find_entities / ecs_get_entity / ecs_snapshot / ecs_diff / resource_get. Assert on signals, transforms, and step digests — they are machine-checkable; render pixels (frame_capture) only when a human-visible artifact is the point. Do not drive the app through your own browser automation; the headed target exists for per-feature parity checks.

Key contracts: after any mutating call, read state back instead of trusting ok:true. command_dispatch payloads should be structured JSON values (JSON-encoded strings are parsed with a commandPayloadCoerced diagnostic). ecs_step supports untilQuiescent/maxFrames and reports a quiescence block — prefer it over polling. viewport_pick answers "what is at viewport x,y" via deterministic bounds-ray picking (not GPU-accurate). For unfamiliar mesh sizes or imported roots, camera_create_agent then camera_frame_entities({subjects:[{key:"model"}]}) fits static descendant bounds and returns projection evidence; use frame_capture for pixels. reference_* tools warm their corpus automatically on first use.`;

export interface RunApertureMcpServerOptions {
  readonly cwd: string;
  readonly entryPoint?: string;
  readonly renderSessionFactory?: ApertureMcpSessionManagerOptions["renderSessionFactory"];
  readonly stdin?: McpInputStream;
  readonly stdout?: McpOutputStream;
  readonly stderr?: McpOutputStream;
}

interface JsonRpcRequest {
  readonly jsonrpc?: "2.0";
  readonly id?: string | number | null;
  readonly method?: string;
  readonly params?: unknown;
}

interface McpInputStream {
  setEncoding?(encoding: BufferEncoding): void;
  pause?(): unknown;
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  once(event: "end" | "close", listener: () => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  removeListener?(
    event: "data",
    listener: (chunk: Buffer | string) => void,
  ): unknown;
  removeListener?(event: "end" | "close", listener: () => void): unknown;
  removeListener?(event: "error", listener: (error: Error) => void): unknown;
}

interface McpOutputStream {
  write(chunk: string): unknown;
  on?(event: "error", listener: (error: Error) => void): unknown;
  removeListener?(event: "error", listener: (error: Error) => void): unknown;
}

export async function runApertureMcpServer(
  options: RunApertureMcpServerOptions,
): Promise<void> {
  const stdin: McpInputStream = options.stdin ?? process.stdin;
  const stdout: McpOutputStream = options.stdout ?? process.stdout;
  const stderr: McpOutputStream = options.stderr ?? process.stderr;
  const manager = new ApertureMcpSessionManager({
    cwd: options.cwd,
    ...(options.renderSessionFactory === undefined
      ? {}
      : { renderSessionFactory: options.renderSessionFactory }),
    ...(options.entryPoint === undefined
      ? {}
      : { entryPoint: options.entryPoint }),
  });
  let buffer = "";
  let chain = Promise.resolve();
  let closed = false;
  const errors: unknown[] = [];
  let finish: () => void;
  const disconnected = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const onClose = (): void => {
    closed = true;
    stdin.pause?.();
    finish();
  };
  const onError = (error: Error): void => {
    errors.push(error);
    onClose();
  };
  const onData = (chunk: Buffer | string): void => {
    if (closed) return;
    buffer += chunk.toString();

    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) break;

      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length === 0) continue;

      // Catch immediately so a broken output stream cannot create an unhandled
      // rejection. Keep draining queued calls before disposing their resources.
      chain = chain
        .then(() => handleLine(line, manager, stdout, stderr))
        .catch((error: unknown) => {
          errors.push(error);
          onClose();
        });
    }
  };

  stdout.on?.("error", onError);
  stderr.on?.("error", onError);
  stdin.setEncoding?.("utf8");
  stdin.on("data", onData);
  stdin.once("end", onClose);
  stdin.once("close", onClose);
  stdin.once("error", onError);

  try {
    await disconnected;
    await chain;
  } finally {
    stdin.removeListener?.("data", onData);
    stdin.removeListener?.("end", onClose);
    stdin.removeListener?.("close", onClose);
    stdin.removeListener?.("error", onError);
    stdout.removeListener?.("error", onError);
    stderr.removeListener?.("error", onError);
    try {
      await manager.dispose();
    } catch (error: unknown) {
      errors.push(error);
    }
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "MCP transport or resource cleanup failed.",
    );
  }
}

async function handleLine(
  line: string,
  manager: ApertureMcpSessionManager,
  stdout: McpOutputStream,
  stderr: McpOutputStream,
): Promise<void> {
  let request: JsonRpcRequest;

  try {
    request = JSON.parse(line) as JsonRpcRequest;
  } catch (error: unknown) {
    await writeText(
      stderr,
      `aperture.mcp.invalidJson: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    return;
  }

  if (request.id === undefined || request.id === null) {
    return;
  }

  try {
    const result = await handleRequest(request, manager);
    await writeJson(stdout, {
      jsonrpc: "2.0",
      id: request.id,
      result,
    });
  } catch (error: unknown) {
    await writeJson(stdout, {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32_000,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function handleRequest(
  request: JsonRpcRequest,
  manager: ApertureMcpSessionManager,
): Promise<unknown> {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "aperture",
          version: APERTURE_CLI_VERSION,
        },
        // Sanctioned-loop guidance surfaced to MCP clients at connect time.
        // Agent-session audits showed most tool friction came from not
        // knowing this surface (hand-rolled browser drivers, screenshot
        // pixel-hunting, string payloads), so state it up front.
        instructions: APERTURE_MCP_INSTRUCTIONS,
      };
    case "tools/list":
      return {
        tools: manager.toolDefinitions(),
      };
    case "tools/call":
      return callTool(request.params, manager);
    default:
      throw new Error(
        `Unsupported MCP method '${request.method ?? "<missing>"}'.`,
      );
  }
}

async function callTool(
  params: unknown,
  manager: ApertureMcpSessionManager,
): Promise<unknown> {
  if (!isRecord(params)) {
    throw new Error("MCP tools/call requires params.");
  }

  const name = params["name"];
  const args = isRecord(params["arguments"])
    ? (params["arguments"] as Record<string, unknown>)
    : {};

  if (typeof name !== "string" || name.length === 0) {
    throw new Error("MCP tools/call requires a tool name.");
  }

  const result = await manager.call({
    name,
    args,
  });

  // If a tool returns an image payload (e.g. frame_capture), emit a real MCP
  // `image` content block so clients render it directly. Otherwise the base64 was
  // stringified into a `text` block, forcing callers to decode it to a file (and
  // overflowing text token limits on every screenshot).
  if (isImageToolResult(result)) {
    const {
      data,
      mimeType,
      encoding: _encoding,
      includeData,
      ...metadata
    } = result;
    return {
      content: [
        {
          type: "image",
          data,
          mimeType,
        },
      ],
      // Keep structuredContent free of the (huge) base64 so it stays small.
      structuredContent: {
        ...metadata,
        ok: typeof metadata.ok === "boolean" ? metadata.ok : true,
        mimeType,
        encoding: "base64",
        ...(includeData === true ? { data } : {}),
      },
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result,
  };
}

function isImageToolResult(value: unknown): value is {
  ok?: boolean;
  mimeType: string;
  encoding?: string;
  data: string;
  includeData?: boolean;
  readonly [key: string]: unknown;
} {
  return (
    isRecord(value) &&
    typeof value["data"] === "string" &&
    typeof value["mimeType"] === "string" &&
    (value["mimeType"] as string).startsWith("image/") &&
    value["encoding"] === "base64"
  );
}

async function writeJson(
  stdout: McpOutputStream,
  value: unknown,
): Promise<void> {
  await writeText(stdout, `${JSON.stringify(value)}\n`);
}

async function writeText(stream: McpOutputStream, text: string): Promise<void> {
  if (stream instanceof Writable) {
    // A write can fail asynchronously (for example, EPIPE after the client
    // disconnects). Wait for its callback before removing error listeners.
    await new Promise<void>((resolve, reject) => {
      stream.write(text, (error) => {
        if (error === null || error === undefined) resolve();
        else reject(error);
      });
    });
  } else {
    stream.write(text);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
