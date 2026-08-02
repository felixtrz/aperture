import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runApertureMcpServer } from "@aperture-engine/cli";
import { ApertureMcpSessionManager } from "../../packages/cli/src/mcp-session-manager.js";

// Booting a real headless runner through the MCP stdio surface (Vite SSR
// config evaluation + stepping) regularly exceeds vitest's 5s default under
// coverage; same slack rationale as test/cli/dev-session.test.ts.
vi.setConfig({ testTimeout: 120_000 });

type JsonRecord = Record<string, unknown>;

const tempRoots: string[] = [];

/**
 * Every non-string parameter an MCP tool handler actually reads, per tool.
 * MCP clients serialize arguments that are NOT declared in the tool's input
 * schema as JSON strings, and the handlers type-check structurally
 * (isRecord / Array.isArray / typeof number), so an undeclared entry in this
 * table silently arrives as a string and is dropped — input_inject reported
 * `ok: true` with an empty result, and ecs_get_entity fell back to the
 * previous query's entity. String parameters survive stringification, but the
 * ones listed here must all be declared (with descriptions) to reach their
 * handlers typed.
 */
const HANDLER_CONSUMED_NON_STRING_PARAMS: Readonly<
  Record<string, readonly string[]>
> = {
  input_inject: ["pointer", "actions", "gamepad"],
  ecs_get_entity: ["entity", "index", "generation", "summaries"],
  ecs_set_component_field: [
    "entity",
    "index",
    "generation",
    "summaries",
    "value",
  ],
  ecs_find_entities: ["query", "source", "withComponents", "tags", "limit"],
  ecs_query: ["query", "source", "withComponents", "tags", "limit"],
  ecs_snapshot: [
    "query",
    "source",
    "withComponents",
    "tags",
    "limit",
    "entities",
  ],
  ecs_diff: ["query", "source", "withComponents", "tags", "limit", "entities"],
  camera_get: ["entity", "index", "generation"],
  camera_save: ["entity", "index", "generation"],
  camera_restore: ["entity", "index", "generation"],
  camera_create_agent: ["translation", "lookAt"],
  camera_set_transform: [
    "entity",
    "index",
    "generation",
    "translation",
    "rotation",
    "scale",
  ],
  camera_look_at: ["entity", "index", "generation", "translation", "target"],
  camera_orbit: [
    "entity",
    "index",
    "generation",
    "target",
    "radius",
    "yawDegrees",
    "pitchDegrees",
  ],
  camera_fit_entity: [
    "entity",
    "index",
    "generation",
    "target",
    "radius",
    "yawDegrees",
    "pitchDegrees",
  ],
  camera_use_agent_view: ["entity", "index", "generation"],
  resource_set: ["values", "fields"],
};

describe("Aperture MCP tool schemas", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("declares every non-string parameter its handlers consume, with descriptions", () => {
    const manager = new ApertureMcpSessionManager({ cwd: process.cwd() });
    const definitions = new Map(
      manager
        .toolDefinitions()
        .map((definition) => [definition.name, definition]),
    );

    for (const [toolName, parameters] of Object.entries(
      HANDLER_CONSUMED_NON_STRING_PARAMS,
    )) {
      const definition = definitions.get(toolName);
      expect(definition, `tool '${toolName}' must be registered`).toBeDefined();
      const properties = definition?.inputSchema.properties ?? {};

      for (const parameter of parameters) {
        const declaration = properties[parameter];
        expect(
          declaration,
          `'${toolName}' must declare '${parameter}' in its input schema — ` +
            "undeclared non-string parameters arrive as JSON strings and are " +
            "silently dropped by the handler",
        ).toBeDefined();
        expect(
          isRecord(declaration) ? declaration["description"] : undefined,
          `'${toolName}.${parameter}' needs a description`,
        ).toEqual(expect.any(String));
      }
    }
  });

  it("delivers object arguments to input_inject and ecs_get_entity through a schema-respecting client", async () => {
    const root = await inputActionFixtureProject();
    const client = new McpStdioTestClient(process.cwd());

    try {
      const listed = await client.request("tools/list");
      const definitions = toolDefinitionsByName(listed["result"]);
      const call = async (
        name: string,
        args: Record<string, unknown>,
      ): Promise<JsonRecord | undefined> => {
        const response = await client.request("tools/call", {
          name,
          arguments: encodeArgumentsLikeSchemaClient(
            definitions.get(name),
            args,
          ),
        });
        const result = response["result"];
        const structured = isRecord(result)
          ? result["structuredContent"]
          : undefined;
        return isRecord(structured) ? structured : undefined;
      };

      expect(
        await call("app_start", {
          target: "headless",
          config: path.join(root, "aperture.headless.config.ts"),
          seed: 1,
        }),
      ).toMatchObject({ ok: true, target: "headless" });
      await call("ecs_step", { frames: 1 });

      const findB = await call("ecs_find_entities", { key: "probe-b" });
      const probeB = valueAt(findB, ["result", "summaries", 0, "entity"]);
      expect(probeB).toMatchObject({
        index: expect.any(Number),
        generation: expect.any(Number),
      });

      // Point the entity bridge's "last find" at a DIFFERENT entity, so a
      // dropped `entity` argument cannot accidentally resolve to the right
      // one — the schema-less registration then silently returns probe-a.
      await call("ecs_find_entities", { key: "probe-a" });

      const got = await call("ecs_get_entity", { entity: probeB });
      expect(got).toMatchObject({ ok: true });
      expect(valueAt(got, ["result", "summary", "key"])).toBe("probe-b");

      const injected = await call("input_inject", {
        actions: { jump: true },
        pointer: { position: [0.25, 0.75], pressed: true },
      });
      expect(injected).toMatchObject({ ok: true });
      // The schema-less registration dropped both sub-objects and reported a
      // success that did nothing: { ok: true, results: [] }.
      expect(valueAt(injected, ["result", "results"])).toEqual([
        expect.objectContaining({ ok: true }),
        expect.objectContaining({
          ok: true,
          result: expect.objectContaining({ action: "jump", queued: true }),
        }),
      ]);

      // Injected events apply before the next stepped frame; read the input
      // state back instead of trusting ok: true alone.
      await call("ecs_step", { frames: 1 });
      const state = await call("input_get_state", {});
      expect(valueAt(state, ["result", "actions", "jump"])).toMatchObject({
        pressed: true,
      });
      expect(valueAt(state, ["result", "pointer", "primary"])).toMatchObject({
        position: [0.25, 0.75],
        pressed: true,
      });

      expect(await call("app_stop", { target: "headless" })).toMatchObject({
        ok: true,
      });
    } finally {
      await client.close();
    }
  });
});

/**
 * Minimal MCP stdio client that awaits each response before the caller sends
 * the next request, so results (entity references) can feed later calls.
 */
class McpStdioTestClient {
  readonly #stdin = new PassThrough();
  readonly #pending = new Map<number, (message: JsonRecord) => void>();
  readonly #done: Promise<void>;
  #nextId = 1;

  constructor(cwd: string) {
    const stdout = new PassThrough();
    let buffer = "";
    stdout.on("data", (chunk: Buffer) => {
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
        const message = JSON.parse(line) as JsonRecord;
        const id = message["id"];
        if (typeof id === "number") {
          this.#pending.get(id)?.(message);
          this.#pending.delete(id);
        }
      }
    });
    this.#done = runApertureMcpServer({ cwd, stdin: this.#stdin, stdout });
  }

  async request(method: string, params?: unknown): Promise<JsonRecord> {
    const id = this.#nextId;
    this.#nextId += 1;
    const message = new Promise<JsonRecord>((resolve) => {
      this.#pending.set(id, resolve);
    });
    this.#stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        ...(params === undefined ? {} : { params }),
      })}\n`,
    );
    return message;
  }

  async close(): Promise<void> {
    this.#stdin.end();
    await this.#done;
  }
}

/**
 * Encode tool arguments the way schema-respecting MCP clients do: parameters
 * declared in the tool's input schema keep their JSON types; everything else
 * is serialized to a JSON string (the same client behavior the
 * command_dispatch payload coercion in the session controller documents).
 */
function encodeArgumentsLikeSchemaClient(
  definition: JsonRecord | undefined,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const schema = isRecord(definition?.["inputSchema"])
    ? definition["inputSchema"]
    : {};
  const properties = isRecord(schema["properties"]) ? schema["properties"] : {};

  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      key in properties || typeof value === "string"
        ? value
        : JSON.stringify(value),
    ]),
  );
}

function toolDefinitionsByName(value: unknown): Map<string, JsonRecord> {
  const tools =
    isRecord(value) && Array.isArray(value["tools"]) ? value["tools"] : [];
  const definitions = new Map<string, JsonRecord>();
  for (const tool of tools) {
    if (isRecord(tool) && typeof tool["name"] === "string") {
      definitions.set(tool["name"], tool);
    }
  }
  return definitions;
}

function valueAt(
  value: unknown,
  segments: readonly (string | number)[],
): unknown {
  let current: unknown = value;
  for (const segment of segments) {
    current =
      typeof segment === "number"
        ? Array.isArray(current)
          ? current[segment]
          : undefined
        : isRecord(current)
          ? current[segment]
          : undefined;
  }
  return current;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-mcp-schemas-"));
  tempRoots.push(root);
  return root;
}

/**
 * Fixture app with a configured button action and two keyed entities, so the
 * test can prove input_inject actions reach the input layer and
 * ecs_get_entity resolves the exact entity reference it was given.
 */
async function inputActionFixtureProject(): Promise<string> {
  const root = await tempRoot();
  const systemsDir = path.join(root, "src", "systems");
  await mkdir(systemsDir, { recursive: true });
  await writeFile(
    path.join(root, "aperture.headless.config.ts"),
    `import { defineApertureConfig, input } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false },
  input: {
    actions: {
      jump: input.button([input.key("Space")]),
    },
  },
});
`,
    "utf8",
  );
  await writeFile(
    path.join(systemsDir, "probe.system.ts"),
    `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class ProbeSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    for (const key of ["probe-a", "probe-b"]) {
      this.spawn.mesh({
        key,
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  }
}
`,
    "utf8",
  );

  return root;
}
