import { ApertureMcpSessionManager } from "./mcp-session-manager.js";
import { APERTURE_CLI_VERSION } from "./version.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";

export interface RunApertureMcpServerOptions {
  readonly cwd: string;
  readonly entryPoint?: string;
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
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  once(event: "end" | "close", listener: () => void): unknown;
}

interface McpOutputStream {
  write(chunk: string): unknown;
}

export async function runApertureMcpServer(
  options: RunApertureMcpServerOptions,
): Promise<void> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const manager = new ApertureMcpSessionManager({
    cwd: options.cwd,
    ...(options.entryPoint === undefined
      ? {}
      : { entryPoint: options.entryPoint }),
  });
  let buffer = "";
  const pending = new Set<Promise<void>>();
  let chain = Promise.resolve();

  stdin.setEncoding?.("utf8");
  stdin.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();

    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) {
        break;
      }

      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);

      if (line.length === 0) {
        continue;
      }

      const task = chain
        .then(() => handleLine(line, manager, stdout, stderr))
        .finally(() => {
          pending.delete(task);
        });
      chain = task.catch(() => undefined);
      pending.add(task);
    }
  });

  await new Promise<void>((resolve) => {
    stdin.once("end", resolve);
    stdin.once("close", resolve);
  });
  await Promise.all(pending);
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
    stderr.write(
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
    writeJson(stdout, {
      jsonrpc: "2.0",
      id: request.id,
      result,
    });
  } catch (error: unknown) {
    writeJson(stdout, {
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

function writeJson(stdout: McpOutputStream, value: unknown): void {
  stdout.write(`${JSON.stringify(value)}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
