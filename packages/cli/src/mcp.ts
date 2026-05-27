import { callApertureTool } from "./devtools-client.js";
import { APERTURE_REFERENCE_TOOL_CONTRACT } from "./reference.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";

export interface RunApertureMcpServerOptions {
  readonly cwd: string;
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

interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties?: Record<string, unknown>;
    readonly additionalProperties?: boolean;
  };
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
  let buffer = "";
  const pending = new Set<Promise<void>>();

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

      const task = handleLine(line, options.cwd, stdout, stderr).finally(() => {
        pending.delete(task);
      });
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
  cwd: string,
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
    const result = await handleRequest(request, cwd);
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
  cwd: string,
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
          version: "0.0.0",
        },
      };
    case "tools/list":
      return {
        tools: toolDefinitions(),
      };
    case "tools/call":
      return callTool(request.params, cwd);
    default:
      throw new Error(
        `Unsupported MCP method '${request.method ?? "<missing>"}'.`,
      );
  }
}

async function callTool(params: unknown, cwd: string): Promise<unknown> {
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

  const result = await callApertureTool({
    cwd,
    name,
    arguments: args,
  });

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

function writeJson(stdout: McpOutputStream, value: unknown): void {
  stdout.write(`${JSON.stringify(value)}\n`);
}

function toolDefinitions(): readonly McpToolDefinition[] {
  return [
    tool("browser_status", "Read the active Aperture browser/session status."),
    tool(
      "browser_canvas_status",
      "Read canvas CSS size, backing size, DPR policy, and render-target size.",
    ),
    tool("browser_screenshot", "Capture a PNG screenshot of the managed tab."),
    tool("browser_console_logs", "Read recent managed-browser console logs.", {
      lines: { type: "number" },
    }),
    tool("browser_reload", "Reload the managed Aperture tab."),
    tool(
      "browser_wait_for_webgpu",
      "Wait until the generated app reports WebGPU readiness.",
      {
        timeoutMs: { type: "number" },
      },
    ),
    tool(
      "browser_pick_pixel",
      "Sample a pixel from the managed browser render output.",
      {
        x: { type: "number" },
        y: { type: "number" },
        coordinateSpace: { enum: ["auto", "normalized", "pixel"] },
      },
    ),
    tool(
      "ecs_find_entities",
      "Find ECS entities by key, name, tags, components, or source metadata.",
    ),
    tool("ecs_get_entity", "Read one ECS entity summary."),
    tool("ecs_query", "Run a structured ECS query."),
    tool("ecs_get_component_schema", "Inspect an ECS component schema."),
    tool("ecs_snapshot", "Capture an ECS entity summary snapshot."),
    tool(
      "ecs_diff",
      "Diff the current ECS entity summary against the last snapshot.",
    ),
    tool("ecs_list_systems", "List generated systems and schedule metadata."),
    tool("ecs_pause", "Pause generated simulation."),
    tool("ecs_resume", "Resume generated simulation."),
    tool("ecs_step", "Single-step generated simulation."),
    tool(
      "ecs_set_component_field",
      "Mutate an allowlisted ECS component field.",
    ),
    tool("ecs_get_hierarchy", "Return a derived ECS parent/child hierarchy."),
    tool("asset_list", "List configured Aperture assets and readiness state."),
    tool("input_key", "Send keyboard input through the managed browser.", {
      key: { type: "string" },
      action: { enum: ["press", "down", "up"] },
    }),
    tool("input_pointer_move", "Move the pointer over the Aperture canvas.", {
      x: { type: "number" },
      y: { type: "number" },
    }),
    tool("input_pointer_click", "Click the Aperture canvas.", {
      x: { type: "number" },
      y: { type: "number" },
    }),
    tool("input_drag", "Drag across the Aperture canvas.", {
      from: { type: "object" },
      to: { type: "object" },
    }),
    tool("input_action_set", "Set a generated Aperture input action.", {
      action: { type: "string" },
      pressed: { type: "boolean" },
      value: { type: "number" },
    }),
    tool("input_reset", "Release transient pointer input."),
    tool("camera_list", "List app and agent cameras."),
    tool("camera_get", "Read a camera transform and projection."),
    tool("camera_save", "Save camera state for later restoration."),
    tool("camera_restore", "Restore saved camera state."),
    tool("camera_create_agent", "Create an agent inspection camera."),
    tool("camera_set_transform", "Set an agent camera transform."),
    tool("camera_look_at", "Point an agent camera at a target."),
    tool("camera_orbit", "Orbit an agent camera around a target."),
    tool("camera_fit_entity", "Fit an entity in the agent camera view."),
    tool(
      "camera_use_agent_view",
      "Render the managed browser from the agent camera.",
    ),
    tool(
      "render_get_frame_report",
      "Read the latest render frame report from generated diagnostics.",
    ),
    tool(
      "render_get_snapshot_summary",
      "Read latest render snapshot counts and diagnostics.",
    ),
    tool("render_get_packets", "Inspect render packets.", {
      family: {
        enum: [
          "views",
          "meshDraws",
          "lights",
          "environments",
          "shadows",
          "bounds",
        ],
      },
      families: {
        type: "array",
        items: {
          enum: [
            "views",
            "meshDraws",
            "lights",
            "environments",
            "shadows",
            "bounds",
          ],
        },
      },
    }),
    tool(
      "render_explain_entity",
      "Explain why an entity did or did not render.",
    ),
    tool("render_get_diagnostics", "Read render diagnostics."),
    tool("render_readback_samples", "Read JSON-safe pixel samples.", {
      samples: { type: "array" },
    }),
    tool("render_pick_entity", "Pick a rendered entity.", {
      x: { type: "number" },
      y: { type: "number" },
      coordinateSpace: { enum: ["auto", "normalized", "pixel"] },
    }),
    ...APERTURE_REFERENCE_TOOL_CONTRACT.map((definition) =>
      tool(
        definition.name,
        definition.description,
        definition.properties ?? {},
      ),
    ),
  ];
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
): McpToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
      additionalProperties: true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
