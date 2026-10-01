import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  ApertureEntityFindReport,
  ApertureEntityLookupSnapshot,
  ApertureEntitySnapshotDiff,
  ApertureEntitySummary,
} from "@aperture-engine/app/entity-lookup";
import type { GeneratedComponentSchemaReport } from "@aperture-engine/app/headless-tools";
import type { CameraFramingReport } from "../../packages/app/src/devtools/camera-framing.js";
import type { ApertureRenderBundle } from "../../packages/cli/src/headless/bundle.js";
import { waitFor } from "../helpers/wait.js";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CLI_BIN = path.join(REPO_ROOT, "packages/cli/dist/bin/aperture.js");
// Snapshot/diff accept the plural tags filter (find/query also accept tag).
const ASSEMBLY_QUERY = { tags: ["native-assembly"] };
const KEYS = ["assembly", "assembly.box", "assembly.ring"];

interface RpcResponse {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: unknown;
}

// Only Node's child process sees engine code at runtime. Type-only imports above
// cannot make the app/system loader accidentally pass via Vitest's src aliases.
function nativeMcp(cwd: string) {
  const child = spawn(process.execPath, [CLI_BIN, "mcp", "stdio"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map<
    number,
    { resolve: (result: unknown) => void; reject: (error: Error) => void }
  >();
  let nextId = 0;
  let stderr = "";
  let failure: Error | undefined;
  let closed = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  const fail = (error: Error): void => {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.on("error", fail);
  child.on("error", fail);
  child.on("close", (code, signal) => {
    closed = true;
    exitCode = code;
    exitSignal = signal;
    fail(new Error(`Native MCP exited (${code}, ${signal}): ${stderr}`));
  });
  lines.on("line", (line) => {
    try {
      const response = JSON.parse(line) as RpcResponse;
      const request = pending.get(response.id);
      if (request === undefined)
        throw new Error(`Unexpected MCP response: ${line}`);
      pending.delete(response.id);
      if (response.error !== undefined) {
        request.reject(
          new Error(`MCP error: ${JSON.stringify(response.error)}\n${stderr}`),
        );
      } else {
        request.resolve(response.result);
      }
    } catch (error: unknown) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
  async function request<T>(method: string, params?: unknown): Promise<T> {
    if (failure !== undefined) throw failure;
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: (value) => resolve(value as T), reject });
        timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(
              `Timed out waiting for native MCP ${method}: ${JSON.stringify(params)}\n${stderr}`,
            ),
          );
        }, 60_000);
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
        );
      });
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    request,
    async tool<T = unknown>(
      name: string,
      args: Record<string, unknown> = {},
    ): Promise<T> {
      const response = await request<{ structuredContent: T }>("tools/call", {
        name,
        arguments: { target: "headless", ...args },
      });
      expect(
        response.structuredContent,
        `${name}: ${JSON.stringify(response)}\n${stderr}`,
      ).toMatchObject({ ok: true, target: "headless" });
      return response.structuredContent;
    },
    async finish(): Promise<void> {
      child.stdin.end();
      await waitFor(() => closed, {
        timeoutMs: 10_000,
        label: "native MCP clean exit",
      });
      expect({ exitCode, exitSignal }, stderr).toEqual({
        exitCode: 0,
        exitSignal: null,
      });
    },
    async dispose(): Promise<void> {
      if (!closed) {
        // This handle is the exact process created above; never signal a PID
        // obtained from session metadata (including fake/stale daemon PIDs).
        child.kill("SIGKILL");
        await waitFor(() => closed, {
          timeoutMs: 10_000,
          label: "native MCP child cleanup",
        });
      }
      lines.close();
    },
  };
}

async function writeApp(root: string): Promise<string> {
  await symlink(
    path.join(REPO_ROOT, "node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  await mkdir(path.join(root, "src/systems"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  const config = path.join(root, "aperture.config.ts");
  await writeFile(
    config,
    `
import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "headless",
  systems: ["src/systems/**/*.system.ts"],
  render: { defaultCamera: false, defaultLight: false, defaultEnvironment: false },
});
`,
  );
  await writeFile(
    path.join(root, "src/systems/assembly.system.ts"),
    `
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
export default class AssemblySystem extends createSystem() {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 3, 15], lookAt: [0, 0, 0] } });
    this.spawn.light({ key: "light.sun", kind: "directional", illuminance: 4,
      transform: { rotationEulerDegrees: [-45, 35, 0] } });
    this.spawn.light({ key: "light.fill", kind: "ambient", intensity: 0.75 });
    const group = this.spawn.group({ key: "assembly", tags: ["native-assembly"],
      transform: { translation: [1, 2, 3] } });
    this.spawn.mesh({ key: "assembly.ring", tags: ["native-assembly"],
      mesh: mesh.torus({ label: "Native authored ring", majorRadius: 2, tubeRadius: 0.5, radialSegments: 12, tubeSegments: 6 }),
      material: material.standard({ baseColor: [0.2, 0.5, 0.8, 1], roughness: 0.6 }),
      transform: { parent: group, translation: [0, 1, 0] } });
    this.spawn.mesh({ key: "assembly.box", tags: ["native-assembly"],
      mesh: mesh.box({ size: [2, 2, 2] }), material: material.standard(),
      transform: { parent: group, translation: [4, 0, 0] } });
  }
}
`,
  );
  return config;
}

function ordered(
  summaries: readonly ApertureEntitySummary[],
): ApertureEntitySummary[] {
  return [...summaries].sort((a, b) =>
    (a.key ?? "").localeCompare(b.key ?? ""),
  );
}

function authoredState(summaries: readonly ApertureEntitySummary[]) {
  return ordered(summaries).map(({ entity: _entity, parent, ...summary }) => {
    const parentKey = summaries.find(
      (candidate) =>
        candidate.entity.index === parent?.index &&
        candidate.entity.generation === parent?.generation,
    )?.key;
    if (parent !== undefined) expect(parentKey).toBeDefined();
    return {
      ...summary,
      // Scene restore remaps live references and rebuilds this derived index
      // from authoritative Parent links; neither is authored scene state.
      componentIds: summary.componentIds.filter(
        (id) => id !== "aperture.transform.children",
      ),
      parentKey,
    };
  });
}

function cameraState(report: { result: Record<string, unknown> }) {
  const { entity: _entity, ...state } = report.result;
  return state;
}

describe("native CLI procedural authoring loop", () => {
  beforeAll(async () => {
    // Match the shipped-binary test: build before Vitest, never while parallel
    // workers may be reading dist. This test must also work in isolation.
    try {
      await stat(CLI_BIN);
    } catch {
      throw new Error(
        `Missing built CLI at ${CLI_BIN}. Run \`pnpm run build\` before this native test; it requires freshly built dist packages.`,
      );
    }
  });

  it("discovers, edits, frames, restores and exports a real torus assembly through MCP stdio", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-native-authoring-"),
    );
    let mcp: ReturnType<typeof nativeMcp> | undefined;
    try {
      const config = await writeApp(root);
      mcp = nativeMcp(root);
      const initialized = await mcp.request<{
        serverInfo: { name: string };
        instructions: string;
      }>("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "native-authoring-test", version: "1.0.0" },
      });
      expect(initialized.serverInfo.name).toBe("aperture");
      expect(initialized.instructions).toContain("camera_frame_entities");
      const discovery = await mcp.request<{
        tools: {
          name: string;
          inputSchema: {
            required?: string[];
            properties: Record<string, unknown>;
          };
        }[];
      }>("tools/list");
      const tool = (name: string) =>
        discovery.tools.find((entry) => entry.name === name)!;
      expect(tool("ecs_set_component_field").inputSchema.required).toEqual([
        "component",
        "field",
        "value",
      ]);
      expect(tool("ecs_find_entities").inputSchema.properties).toHaveProperty(
        "tag",
      );
      expect(tool("camera_frame_entities").inputSchema.required).toEqual([
        "subjects",
      ]);
      for (const name of [
        "app_reset",
        "ecs_snapshot",
        "ecs_diff",
        "session_snapshot_save",
        "session_snapshot_restore",
        "render_bundle",
        "app_stop",
      ])
        expect(tool(name)).toBeDefined();

      await mcp.tool("app_start", {
        config,
        seed: 42,
        assetMode: "strict",
        determinism: "error",
      });
      expect(await mcp.tool("app_status")).toMatchObject({ running: true });
      await mcp.tool("ecs_step", { frames: 1 });
      const found = await mcp.tool<{ result: ApertureEntityFindReport }>(
        "ecs_find_entities",
        ASSEMBLY_QUERY,
      );
      expect(found.result).toMatchObject({
        total: 3,
        truncated: false,
        diagnostics: [],
      });
      const initial = ordered(found.result.summaries);
      expect(initial.map((summary) => summary.key)).toEqual(KEYS);
      expect(new Set(initial.map((summary) => summary.entity.index)).size).toBe(
        3,
      );
      expect(initial[1]?.parent).toEqual(initial[0]?.entity);
      expect(initial[2]?.parent).toEqual(initial[0]?.entity);
      const group = await mcp.tool<{
        result: { summary: ApertureEntitySummary };
      }>("ecs_get_entity", { key: "assembly" });
      expect(group.result.summary).toEqual(initial[0]);
      expect(group.result.summary.componentIds).not.toContain(
        "aperture.render.mesh",
      );
      const schema = await mcp.tool<{ result: GeneratedComponentSchemaReport }>(
        "ecs_get_component_schema",
        { component: "aperture.transform.local" },
      );
      const transform = schema.result.schemas[0]!;
      expect(transform.mutation).toMatchObject({
        supported: true,
        writableFields: ["rotation", "scale", "translation"],
        fieldPathSyntax: "literal-top-level-field",
      });

      const checkpoint = await mcp.tool<{
        result: ApertureEntityLookupSnapshot;
      }>("ecs_snapshot", { query: ASSEMBLY_QUERY, label: "before-edit" });
      expect(ordered(checkpoint.result.summaries)).toEqual(initial);
      await mcp.tool(transform.mutation.tool, {
        key: "assembly",
        component: transform.id,
        field: "translation",
        value: [10, 4, -6],
      });
      await mcp.tool("ecs_step", { frames: 1 });
      const revised = ordered(
        (
          await mcp.tool<{ result: ApertureEntityFindReport }>(
            "ecs_query",
            ASSEMBLY_QUERY,
          )
        ).result.summaries,
      );
      expect(revised[0]?.localTransform?.translation).toEqual([10, 4, -6]);
      expect(revised[1]?.localTransform).toEqual(initial[1]?.localTransform);
      expect(revised[2]?.localTransform).toEqual(initial[2]?.localTransform);
      expect(
        revised.map((summary) => summary.worldTransform?.matrix.slice(12, 15)),
      ).toEqual([
        [10, 4, -6],
        [14, 4, -6],
        [10, 5, -6],
      ]);
      const diff = await mcp.tool<{ result: ApertureEntitySnapshotDiff }>(
        "ecs_diff",
        { query: ASSEMBLY_QUERY, label: "after-edit" },
      );
      expect(diff.result).toMatchObject({
        fromLabel: "before-edit",
        toLabel: "after-edit",
        counts: { added: 0, removed: 0, changed: 3, unchanged: 0 },
        diagnostics: [],
      });
      expect(
        ordered(diff.result.changed.map((change) => change.after)),
      ).toEqual(revised);

      const framed = await mcp.tool<{
        result: { framing: CameraFramingReport };
      }>("camera_frame_entities", {
        key: "camera.main",
        subjects: [{ key: "assembly" }],
        padding: 1.2,
      });
      const framing = framed.result.framing;
      expect(framing).toMatchObject({
        source: "mesh-local-aabb",
        approximation: "static-mesh-bounds",
        includeDescendants: true,
        subjects: [revised[0]?.entity],
        bounds: { min: [7.5, 3, -8.5], max: [15, 5.5, -3.5] },
      });
      expect(framing.meshes).toHaveLength(2);
      expect(framing.meshes).toEqual(
        expect.arrayContaining([revised[1]?.entity, revised[2]?.entity]),
      );
      expect(framing.projectionCheck.maxAbsNdcX).toBeLessThanOrEqual(
        1 / framing.padding + framing.projectionCheck.tolerance,
      );
      expect(framing.projectionCheck.maxAbsNdcY).toBeLessThanOrEqual(
        1 / framing.padding + framing.projectionCheck.tolerance,
      );
      const camera = await mcp.tool<{ result: Record<string, unknown> }>(
        "camera_get",
        { key: "camera.main" },
      );
      expect(camera).toMatchObject({
        result: {
          localTransform: {
            translation: framing.translation.map((value) =>
              expect.closeTo(value, 4),
            ),
          },
        },
      });

      const snapshotPath = path.join(root, "assembly.session.json");
      expect(
        await mcp.tool("session_snapshot_save", { out: snapshotPath }),
      ).toMatchObject({ path: snapshotPath });
      expect(JSON.parse(await readFile(snapshotPath, "utf8"))).toHaveProperty(
        "simulation",
      );
      await mcp.tool("app_reset", { seed: 42 });
      await mcp.tool("ecs_step", { frames: 1 });
      const reset = await mcp.tool<{ result: ApertureEntityFindReport }>(
        "ecs_query",
        ASSEMBLY_QUERY,
      );
      expect(ordered(reset.result.summaries)).toEqual(initial);
      expect(
        await mcp.tool("session_snapshot_restore", { path: snapshotPath }),
      ).toMatchObject({ restore: { ok: true } });
      const restored = await mcp.tool<{ result: ApertureEntityFindReport }>(
        "ecs_query",
        ASSEMBLY_QUERY,
      );
      const restoredSummaries = ordered(restored.result.summaries);
      expect(authoredState(restoredSummaries)).toEqual(authoredState(revised));
      expect(restoredSummaries[1]?.parent).toEqual(
        restoredSummaries[0]?.entity,
      );
      expect(restoredSummaries[2]?.parent).toEqual(
        restoredSummaries[0]?.entity,
      );
      for (const summary of restoredSummaries) {
        const readback = await mcp.tool<{
          result: { summary: ApertureEntitySummary };
        }>("ecs_get_entity", { key: summary.key });
        expect(readback.result.summary).toEqual(summary);
      }
      const restoredCamera = await mcp.tool<{
        result: Record<string, unknown>;
      }>("camera_get", { key: "camera.main" });
      expect(cameraState(restoredCamera)).toEqual(cameraState(camera));

      const bundlePath = path.join(root, "assembly.bundle.json");
      const exported = await mcp.tool("render_bundle", {
        out: bundlePath,
        digest: true,
      });
      expect(exported).toMatchObject({
        path: bundlePath,
        assetProvenance: { placeholderCount: 0, placeholderIds: [] },
      });
      const bundle = JSON.parse(
        await readFile(bundlePath, "utf8"),
      ) as ApertureRenderBundle;
      expect(bundle).toMatchObject({
        format: "aperture.render-bundle",
        version: 1,
        engine: { createdBy: "aperture mcp render_bundle" },
        assets: { completeness: "complete", allowPlaceholders: false },
        closure: { missing: [], unready: [], placeholders: [] },
        assetProvenance: { placeholderCount: 0, placeholderIds: [] },
      });
      const snapshot = bundle.snapshot.value as {
        meshDraws: { mesh: { id: string }; material: { id: string } }[];
      };
      expect(snapshot.meshDraws.map((draw) => draw.mesh.id).sort()).toEqual([
        "assembly.box.mesh",
        "assembly.ring.mesh",
      ]);
      const expectedAssets = [
        "material:assembly.box.material",
        "material:assembly.ring.material",
        "mesh:assembly.box.mesh",
        "mesh:assembly.ring.mesh",
      ];
      expect([...bundle.closure.roots].sort()).toEqual(expectedAssets);
      expect([...bundle.closure.referenced].sort()).toEqual(expectedAssets);
      expect(
        bundle.assets.entries
          .map((entry) => `${entry.handle.kind}:${entry.handle.id}`)
          .sort(),
      ).toEqual(expectedAssets);
      expect(
        bundle.assets.entries.every(
          (entry) => entry.status === "ready" && entry.asset !== null,
        ),
      ).toBe(true);
      expect(bundle.assetProvenance.real).toBe(4);
      const ring = bundle.assets.entries.find(
        (entry) => entry.handle.id === "assembly.ring.mesh",
      )!;
      expect(ring.asset).toMatchObject({
        label: "Native authored ring",
        localAabb: { min: [-2.5, -0.5, -2.5], max: [2.5, 0.5, 2.5] },
        vertexStreams: [{ vertexCount: 91 }],
        submeshes: [{ indexCount: 432 }],
      });
      expect(bundle.digest.hash).toMatch(/^[0-9a-f]+$/);
      await mcp.tool("app_stop");
      expect(await mcp.tool("app_status")).toMatchObject({ running: false });
      await mcp.finish();
    } finally {
      try {
        await mcp?.dispose();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }, 180_000);
});
