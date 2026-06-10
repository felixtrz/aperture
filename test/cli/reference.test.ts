import { PassThrough } from "node:stream";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apertureReferenceArchiveFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  callApertureTool,
  readApertureReferenceStatus,
  runApertureCli,
  runApertureMcpServer,
  searchApertureReferences,
  warmApertureReferences,
} from "@aperture-engine/cli";

const tempRoots: string[] = [];

// Warmup spawns subprocesses and rebuilds the on-disk index; under coverage
// instrumentation those runs regularly exceed vitest's 5s default.
const REFERENCE_TEST_TIMEOUT_MS = 60_000;

describe(
  "Aperture reference CLI and MCP tools",
  { timeout: REFERENCE_TEST_TIMEOUT_MS },
  () => {
    afterEach(async () => {
      for (const root of tempRoots.splice(0)) {
        await rm(root, { force: true, recursive: true });
      }
    });

    it("warms, validates, and searches a curated RAG reference corpus", async () => {
      const root = await referenceWorkspace();
      const build = await warmApertureReferences({ cwd: root });

      expect(build.entries).toBeGreaterThan(2);
      expect(build.indexFile).toBe(apertureReferenceIndexFile(root));
      expect(build.manifestFile).toBe(apertureReferenceManifestFile(root));
      expect(build.archiveFile).toBe(apertureReferenceArchiveFile(root));

      const status = await readApertureReferenceStatus(root);
      expect(status).toMatchObject({
        ok: true,
        status: "ready",
        chunks: expect.any(Number),
        sources: expect.any(Number),
      });

      const index = JSON.parse(await readFile(build.indexFile, "utf8")) as {
        readonly chunks: readonly {
          readonly embedding: readonly number[];
          readonly metadata: {
            readonly file: string;
            readonly sourceCategory: string;
            readonly startLine: number;
            readonly endLine: number;
          };
        }[];
        readonly entries: readonly { readonly file: string }[];
      };
      expect(index.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file: "docs/AUTHORING.md" }),
          expect.objectContaining({
            file: "packages/app/src/spin.system.ts",
          }),
        ]),
      );
      expect(index.entries).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file: "agent/HANDOFF.md" }),
          expect.objectContaining({ file: "references/engine/private.ts" }),
          expect.objectContaining({ file: "test/private.test.ts" }),
        ]),
      );
      expect(index.chunks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            embedding: expect.arrayContaining([expect.any(Number)]),
            metadata: expect.objectContaining({
              file: "packages/app/src/spin.system.ts",
              sourceCategory: "api",
              startLine: expect.any(Number),
              endLine: expect.any(Number),
            }),
          }),
        ]),
      );

      const search = await searchApertureReferences({
        cwd: root,
        query: "rotating crate scheduler priority",
      });
      expect(search.total).toBeGreaterThan(0);
      expect(search.results[0]).toMatchObject({
        file: "packages/app/src/spin.system.ts",
        sourceCategory: "api",
        systems: expect.arrayContaining(["SpinSystem"]),
      });
    });

    it("exposes reference warmup/status/search through the CLI", async () => {
      const root = await referenceWorkspace();
      const build = await runCli(["reference", "warmup"], root);
      const status = await runCli(["reference", "status"], root);
      const search = await runCli(
        [
          "reference",
          "search",
          "aperture.entityLookup.notFound",
          "--limit",
          "2",
        ],
        root,
      );

      expect(build.exitCode).toBe(0);
      expect(build.stdout).toContain("Warmed Aperture reference corpus");
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("Status: ready");
      expect(search.exitCode).toBe(0);
      expect(search.stdout).toContain("diagnostics.ts");
      expect(search.stdout).toContain("aperture.entityLookup.notFound");
    });

    it("detects corrupt warmed payloads and repairs them on warmup", async () => {
      const root = await referenceWorkspace();
      await warmApertureReferences({ cwd: root });

      await writeFile(
        path.join(
          root,
          ".aperture/runtime/reference/data/sources/packages/app/src/components.ts",
        ),
        "corrupted source payload",
        "utf8",
      );
      const corruptPayload = await readApertureReferenceStatus(root);
      expect(corruptPayload).toMatchObject({
        ok: false,
        status: "corrupt",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "aperture.reference.fileCorrupt",
          }),
        ]),
      });

      await warmApertureReferences({ cwd: root });
      await writeFile(
        apertureReferenceIndexFile(root),
        "{ invalid json",
        "utf8",
      );

      const corrupt = await readApertureReferenceStatus(root);
      expect(corrupt).toMatchObject({
        ok: false,
        status: "corrupt",
      });

      const repaired = await warmApertureReferences({ cwd: root });
      expect(repaired.chunks).toBeGreaterThan(0);
      await expect(readApertureReferenceStatus(root)).resolves.toMatchObject({
        ok: true,
        status: "ready",
      });
    });

    it("warms from a produced local payload directory", async () => {
      const producerRoot = await referenceWorkspace();
      const consumerRoot = await tempRoot();
      await warmApertureReferences({ cwd: producerRoot });

      const payloadDir = path.dirname(
        apertureReferenceManifestFile(producerRoot),
      );
      const warm = await warmApertureReferences({
        cwd: consumerRoot,
        from: payloadDir,
      });
      const search = await searchApertureReferences({
        cwd: consumerRoot,
        query: "SpinSystem",
      });

      expect(warm.source).toBe("directory");
      expect(search.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file: "packages/app/src/spin.system.ts" }),
        ]),
      );
      await expect(
        readApertureReferenceStatus(consumerRoot),
      ).resolves.toMatchObject({
        ok: true,
        status: "ready",
      });
    });

    it("serves reference tools without a dev browser session", async () => {
      const root = await referenceWorkspace();
      await warmApertureReferences({ cwd: root });

      const results = await callApertureTool({
        cwd: root,
        name: "reference_search",
        arguments: { query: "DebugMetadata", limit: 3 },
      });
      const components = await callApertureTool({
        cwd: root,
        name: "reference_list_components",
        arguments: {},
      });
      const systems = await callApertureTool({
        cwd: root,
        name: "reference_list_systems",
        arguments: {},
      });

      expect(results).toMatchObject({
        total: expect.any(Number),
        results: expect.arrayContaining([
          expect.objectContaining({
            file: expect.stringContaining("components.ts"),
          }),
        ]),
      });
      expect(components).toMatchObject({
        ok: true,
        components: expect.arrayContaining(["aperture.metadata.debug"]),
      });
      expect(systems).toMatchObject({
        ok: true,
        systems: expect.arrayContaining(["SpinSystem"]),
      });
    });

    it("serves every reference MCP tool over stdio without a dev browser session", async () => {
      const root = await referenceWorkspace();
      await warmApertureReferences({ cwd: root });

      const search = await callMcpTool(root, "reference_search", {
        query: "SpinSystem",
        limit: 3,
      });
      expect(search.structuredContent).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            file: "packages/app/src/spin.system.ts",
          }),
        ]),
      });

      const api = await callMcpTool(root, "reference_api_lookup", {
        symbol: "createSystem",
        limit: 3,
      });
      expect(api.structuredContent).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            file: "packages/app/src/spin.system.ts",
          }),
        ]),
      });

      const file = await callMcpTool(root, "reference_file_content", {
        file: "packages/app/src/spin.system.ts",
        startLine: 1,
        endLine: 4,
      });
      expect(file.structuredContent).toMatchObject({
        ok: true,
        entry: {
          file: "packages/app/src/spin.system.ts",
          text: expect.stringContaining("SpinSystem"),
        },
      });

      const examples = await callMcpTool(root, "reference_find_examples", {
        query: "SpinSystem",
        limit: 3,
      });
      expect(examples.structuredContent).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            file: "examples/spinning-cube.ts",
          }),
        ]),
      });

      const components = await callMcpTool(
        root,
        "reference_list_components",
        {},
      );
      expect(components.structuredContent).toMatchObject({
        ok: true,
        components: expect.arrayContaining(["aperture.metadata.debug"]),
      });

      const systems = await callMcpTool(root, "reference_list_systems", {});
      expect(systems.structuredContent).toMatchObject({
        ok: true,
        systems: expect.arrayContaining(["SpinSystem"]),
      });

      const dependents = await callMcpTool(root, "reference_find_dependents", {
        symbol: "DebugMetadata",
        limit: 3,
      });
      expect(dependents.structuredContent).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            file: "packages/app/src/spin.system.ts",
          }),
        ]),
      });

      const diagnostic = await callMcpTool(
        root,
        "reference_explain_diagnostic",
        {
          code: "aperture.entityLookup.notFound",
          limit: 3,
        },
      );
      expect(diagnostic.structuredContent).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            file: "packages/app/src/diagnostics.ts",
          }),
        ]),
      });
    });

    it("prints reference help and missing-query diagnostics", async () => {
      const root = await tempRoot();
      const help = await runCli(["reference", "--help"], root);
      const status = await runCli(["reference", "status"], root);
      const missing = await runCli(["reference", "search"], root);
      const missingWarmup = await runCli(
        ["reference", "search", "createSystem"],
        root,
      );

      expect(help.exitCode).toBe(0);
      expect(help.stdout).toContain("aperture reference warmup");
      expect(help.stdout).toContain("aperture reference build");
      expect(status.exitCode).toBe(0);
      expect(status.stdout).toContain("Status: missing");
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toContain("aperture.reference.missingQuery");
      expect(missingWarmup.exitCode).toBe(1);
      expect(missingWarmup.stderr).toContain("aperture reference warmup");
    });
  },
);

async function referenceWorkspace(): Promise<string> {
  const root = await tempRoot();

  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "examples"), { recursive: true });
  await mkdir(path.join(root, "agent"), { recursive: true });
  await mkdir(path.join(root, "references/engine"), { recursive: true });
  await mkdir(path.join(root, "test"), { recursive: true });
  await mkdir(path.join(root, "packages/app/src"), { recursive: true });
  await writeFile(
    path.join(root, "docs/AUTHORING.md"),
    "# Authoring\n\nUse DebugMetadata and SpinSystem when inspecting Aperture ECS apps.",
    "utf8",
  );
  await writeFile(
    path.join(root, "agent/HANDOFF.md"),
    "private agent note",
    "utf8",
  );
  await writeFile(
    path.join(root, "references/engine/private.ts"),
    "export const privateReference = true;",
    "utf8",
  );
  await writeFile(
    path.join(root, "test/private.test.ts"),
    "export const privateTest = true;",
    "utf8",
  );
  await writeFile(
    path.join(root, "examples/spinning-cube.ts"),
    "export const title = 'SpinSystem example';\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/app/src/components.ts"),
    `export const DebugMetadata = createComponent({
  id: "aperture.metadata.debug",
});
`,
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/app/src/spin.system.ts"),
    `import { DebugMetadata } from "./components.js";

export default class SpinSystem extends createSystem({
  priority: 10,
  queries: {
    debug: { required: [DebugMetadata] },
  },
}) {}
`,
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/app/src/diagnostics.ts"),
    `export const diagnostic = {
  code: "aperture.entityLookup.notFound",
  message: "Entity not found",
};
`,
    "utf8",
  );

  return root;
}

async function callMcpTool(
  cwd: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ readonly structuredContent?: unknown }> {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const chunks: string[] = [];

  stdout.on("data", (chunk: Buffer) => {
    chunks.push(chunk.toString());
  });

  const done = runApertureMcpServer({ cwd, stdin, stdout });
  stdin.end(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    })}\n`,
  );
  await done;

  const line = chunks.join("").trim().split("\n")[0];
  if (line === undefined || line.length === 0) {
    throw new Error(`MCP tool ${name} produced no output.`);
  }

  const message = JSON.parse(line) as {
    readonly result?: { readonly structuredContent?: unknown };
    readonly error?: unknown;
  };

  if (message.error !== undefined) {
    throw new Error(
      `MCP tool ${name} failed: ${JSON.stringify(message.error)}`,
    );
  }

  return {
    structuredContent: message.result?.structuredContent,
  };
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-reference-"));
  tempRoots.push(root);
  return root;
}

async function runCli(
  argv: readonly string[],
  cwd: string,
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runApertureCli({
    argv,
    cwd,
    entryPoint: "/tmp/aperture-test-bin.js",
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });

  return { exitCode, stdout, stderr };
}
