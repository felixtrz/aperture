import { PassThrough } from "node:stream";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type * as ApertureCli from "@aperture-engine/cli";

const transformerMock = vi.hoisted(() => ({
  env: {
    allowLocalModels: false,
    allowRemoteModels: true,
  },
  pipeline: vi.fn(),
}));

const tempRoots: string[] = [];
const MOCK_EMBEDDING_DIMENSIONS = 768;
const TRANSFORMERS_LOADER_GLOBAL = "__APERTURE_REFERENCE_TRANSFORMERS_LOADER__";
let embeddedTexts: string[] = [];
let apertureReferenceArchiveFile: typeof ApertureCli.apertureReferenceArchiveFile;
let apertureReferenceIndexFile: typeof ApertureCli.apertureReferenceIndexFile;
let apertureReferenceManifestFile: typeof ApertureCli.apertureReferenceManifestFile;
let callApertureTool: typeof ApertureCli.callApertureTool;
let readApertureReferenceStatus: typeof ApertureCli.readApertureReferenceStatus;
let runApertureCli: typeof ApertureCli.runApertureCli;
let runApertureMcpServer: typeof ApertureCli.runApertureMcpServer;
let searchApertureReferences: typeof ApertureCli.searchApertureReferences;
let warmApertureReferences: typeof ApertureCli.warmApertureReferences;

// Warmup spawns subprocesses and rebuilds the on-disk index; under coverage
// instrumentation those runs regularly exceed vitest's 5s default.
const REFERENCE_TEST_TIMEOUT_MS = 60_000;

describe(
  "Aperture reference CLI and MCP tools",
  { timeout: REFERENCE_TEST_TIMEOUT_MS },
  () => {
    beforeAll(async () => {
      const cli = await import("@aperture-engine/cli");

      apertureReferenceArchiveFile = cli.apertureReferenceArchiveFile;
      apertureReferenceIndexFile = cli.apertureReferenceIndexFile;
      apertureReferenceManifestFile = cli.apertureReferenceManifestFile;
      callApertureTool = cli.callApertureTool;
      readApertureReferenceStatus = cli.readApertureReferenceStatus;
      runApertureCli = cli.runApertureCli;
      runApertureMcpServer = cli.runApertureMcpServer;
      searchApertureReferences = cli.searchApertureReferences;
      warmApertureReferences = cli.warmApertureReferences;
    });

    beforeEach(() => {
      embeddedTexts = [];
      transformerMock.env.allowLocalModels = false;
      transformerMock.env.allowRemoteModels = true;
      transformerMock.pipeline.mockReset();
      transformerMock.pipeline.mockResolvedValue(
        async (input: string | readonly string[]) => {
          const texts = Array.isArray(input) ? input : [input];

          embeddedTexts.push(...texts);
          return {
            data: Float32Array.from(
              texts.flatMap((text) => mockEmbedding(text)),
            ),
          } satisfies { readonly data: Float32Array };
        },
      );
      (globalThis as Record<string, unknown>)[TRANSFORMERS_LOADER_GLOBAL] =
        async () => transformerMock;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          const url = String(input);
          const body = url.endsWith("model_quantized.onnx")
            ? "mock-onnx"
            : "{}\n";

          return new Response(body, { status: 200 });
        }),
      );
    });

    afterEach(async () => {
      vi.unstubAllGlobals();
      delete (globalThis as Record<string, unknown>)[
        TRANSFORMERS_LOADER_GLOBAL
      ];

      for (const root of tempRoots.splice(0)) {
        await rm(root, { force: true, recursive: true });
      }
    });

    it("warms, validates, and searches a curated RAG reference corpus", async () => {
      const root = await referenceWorkspace();
      const build = await warmApertureReferences({
        cwd: root,
        from: "workspace",
      });

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
        readonly model: {
          readonly provider: string;
          readonly format: string;
          readonly model: string;
          readonly revision: string;
          readonly dimensions: number;
          readonly dtype: string;
          readonly pooling: string;
          readonly normalize: boolean;
        };
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
      expect(index.model).toMatchObject({
        provider: "huggingface",
        format: "transformers-js",
        model: "jinaai/jina-embeddings-v2-base-code",
        revision: "516f4baf13dec4ddddda8631e019b5737c8bc250",
        dimensions: MOCK_EMBEDDING_DIMENSIONS,
        dtype: "q8",
        pooling: "mean",
        normalize: true,
      });
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
      expect(index.chunks[0]?.embedding).toHaveLength(
        MOCK_EMBEDDING_DIMENSIONS,
      );
      expect(transformerMock.pipeline).toHaveBeenCalledWith(
        "feature-extraction",
        expect.stringContaining(".aperture/runtime/reference/model"),
        expect.objectContaining({
          dtype: "q8",
          local_files_only: true,
        }),
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
      const build = await runCli(
        ["reference", "warmup", "--from", "workspace"],
        root,
      );
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
      // F13: `query` is a documented alias for `search`.
      const query = await runCli(
        [
          "reference",
          "query",
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
      expect(query.exitCode).toBe(0);
      expect(query.stdout).toBe(search.stdout);
    });

    it("caps oversized embedding inputs while preserving indexed chunk content", async () => {
      const root = await referenceWorkspace();
      const longContent = `export const HugeReference = "${"SpinSystem ".repeat(
        2_000,
      )}";\n`;

      await writeFile(
        path.join(root, "packages/app/src/huge-reference.ts"),
        longContent,
        "utf8",
      );
      await writeFile(
        path.join(root, "packages/app/src/index.ts"),
        `export * from "./components.js";
export * from "./spin.system.js";
export * from "./diagnostics.js";
export * from "./huge-reference.js";
`,
        "utf8",
      );

      const build = await warmApertureReferences({
        cwd: root,
        from: "workspace",
      });
      const oversizedInput = embeddedTexts.find((text) =>
        text.includes("HugeReference"),
      );
      const index = JSON.parse(await readFile(build.indexFile, "utf8")) as {
        readonly chunks: readonly {
          readonly content: string;
          readonly metadata: { readonly file: string };
        }[];
      };
      const storedChunk = index.chunks.find(
        (chunk) => chunk.metadata.file === "packages/app/src/huge-reference.ts",
      );

      expect(oversizedInput).toContain(
        "[reference embedding content truncated:",
      );
      expect(oversizedInput?.length).toBeLessThan(3_500);
      expect(storedChunk?.content.length).toBeGreaterThan(18_000);
      expect(storedChunk?.content).toContain("SpinSystem SpinSystem");
    });

    it("detects corrupt warmed payloads and repairs them on warmup", async () => {
      const root = await referenceWorkspace();
      await warmApertureReferences({ cwd: root, from: "workspace" });

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

      await warmApertureReferences({ cwd: root, from: "workspace" });
      await rm(
        path.join(
          root,
          ".aperture/runtime/reference/model/onnx/model_quantized.onnx",
        ),
        { force: true },
      );

      const missingModel = await readApertureReferenceStatus(root);
      expect(missingModel).toMatchObject({
        ok: false,
        status: "corrupt",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "aperture.reference.modelMissing",
          }),
        ]),
      });

      await warmApertureReferences({ cwd: root, from: "workspace" });
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

      const repaired = await warmApertureReferences({
        cwd: root,
        from: "workspace",
      });
      expect(repaired.chunks).toBeGreaterThan(0);
      await expect(readApertureReferenceStatus(root)).resolves.toMatchObject({
        ok: true,
        status: "ready",
      });
    });

    it("reports stale hash-embedding indexes as model mismatches and repairs them on warmup", async () => {
      const root = await referenceWorkspace();
      await warmApertureReferences({ cwd: root, from: "workspace" });
      const indexFile = apertureReferenceIndexFile(root);
      const index = JSON.parse(await readFile(indexFile, "utf8")) as {
        model: unknown;
        manifest: { model: unknown };
      };
      const oldModel = {
        provider: "aperture-local",
        model: "aperture-reference-hash-embedding",
        revision: "v1",
        dimensions: 384,
        dtype: "float32",
        pooling: "hashed-token-sum",
        normalize: true,
        textFormattingVersion: 1,
        expectedFiles: ["model-contract.json"],
      };

      index.model = oldModel;
      index.manifest.model = oldModel;
      await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");

      await expect(readApertureReferenceStatus(root)).resolves.toMatchObject({
        ok: false,
        status: "model-mismatch",
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "aperture.reference.modelMismatch",
          }),
        ]),
      });
      await expect(
        searchApertureReferences({
          cwd: root,
          query: "rotating scheduler",
        }),
      ).rejects.toThrow("different embedding model contract");

      await warmApertureReferences({ cwd: root, from: "workspace" });
      const search = await searchApertureReferences({
        cwd: root,
        query: "rotating scheduler",
      });

      await expect(readApertureReferenceStatus(root)).resolves.toMatchObject({
        ok: true,
        status: "ready",
      });
      expect(search.results[0]).toMatchObject({
        file: "packages/app/src/spin.system.ts",
      });
    });

    it("warms from a produced local payload directory", async () => {
      const producerRoot = await referenceWorkspace();
      const consumerRoot = await tempRoot();
      await warmApertureReferences({ cwd: producerRoot, from: "workspace" });

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

    it("warms from configured hosted reference assets by default", async () => {
      const producerRoot = await referenceWorkspace();
      const consumerRoot = await tempRoot();
      const baseUrl = "https://assets.example.test/aperture-reference";
      const previousBaseUrl = process.env.APERTURE_REFERENCE_ASSETS_BASE_URL;

      await warmApertureReferences({ cwd: producerRoot, from: "workspace" });
      const payloadDir = path.dirname(
        apertureReferenceManifestFile(producerRoot),
      );
      const manifest = JSON.parse(
        await readFile(path.join(payloadDir, "manifest.json"), "utf8"),
      ) as {
        readonly files: readonly { readonly path: string }[];
      };
      const manifestBody = await readFile(
        path.join(payloadDir, "manifest.json"),
      );
      const archiveBody = await readFile(path.join(payloadDir, "data.tgz"));

      expect(manifest.files.map((file) => file.path)).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^model\//u),
          expect.stringMatching(/^model$/u),
        ]),
      );

      process.env.APERTURE_REFERENCE_ASSETS_BASE_URL = baseUrl;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          const url = String(input);

          if (url === `${baseUrl}/manifest.json`) {
            return new Response(manifestBody, { status: 200 });
          }

          if (url === `${baseUrl}/data.tgz`) {
            return new Response(archiveBody, { status: 200 });
          }

          const body = url.endsWith("model_quantized.onnx")
            ? "mock-onnx"
            : "{}\n";

          return new Response(body, { status: 200 });
        }),
      );

      try {
        const warm = await warmApertureReferences({ cwd: consumerRoot });
        const search = await searchApertureReferences({
          cwd: consumerRoot,
          query: "SpinSystem",
        });

        expect(warm.source).toBe("url");
        expect(search.results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              file: "packages/app/src/spin.system.ts",
            }),
          ]),
        );
        await expect(
          readApertureReferenceStatus(consumerRoot),
        ).resolves.toMatchObject({
          ok: true,
          status: "ready",
        });
      } finally {
        if (previousBaseUrl === undefined) {
          delete process.env.APERTURE_REFERENCE_ASSETS_BASE_URL;
        } else {
          process.env.APERTURE_REFERENCE_ASSETS_BASE_URL = previousBaseUrl;
        }
      }
    });

    it("serves reference tools without a dev browser session", async () => {
      const root = await referenceWorkspace();
      await warmApertureReferences({ cwd: root, from: "workspace" });

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
      await warmApertureReferences({ cwd: root, from: "workspace" });

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

function mockEmbedding(text: string): number[] {
  const normalized = text.toLowerCase();
  const vector = new Array<number>(MOCK_EMBEDDING_DIMENSIONS).fill(0);

  addFeature(vector, normalized, 0, [
    "spin",
    "spinsystem",
    "rotating",
    "scheduler",
    "priority",
  ]);
  addFeature(vector, normalized, 1, [
    "debugmetadata",
    "aperture.metadata.debug",
    "component",
  ]);
  addFeature(vector, normalized, 2, [
    "aperture.entitylookup.notfound",
    "diagnostic",
    "entity not found",
  ]);
  addFeature(vector, normalized, 3, ["createsystem", "system"]);
  addFeature(vector, normalized, 4, ["example", "spinning-cube"]);

  let hash = 2_166_136_261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  vector[16 + (hash % 64)] = 0.1;

  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );

  return magnitude === 0
    ? vector
    : vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function addFeature(
  vector: number[],
  text: string,
  index: number,
  terms: readonly string[],
): void {
  if (terms.some((term) => text.includes(term))) {
    vector[index] = 1;
  }
}

async function referenceWorkspace(): Promise<string> {
  const root = await tempRoot();

  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "examples"), { recursive: true });
  await mkdir(path.join(root, "agent"), { recursive: true });
  await mkdir(path.join(root, "test"), { recursive: true });
  await mkdir(path.join(root, "packages/app/src"), { recursive: true });
  await writeFile(
    path.join(root, "packages/app/package.json"),
    JSON.stringify(
      {
        name: "@aperture-engine/app",
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
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
  await writeFile(
    path.join(root, "packages/app/src/index.ts"),
    `export * from "./components.js";
export * from "./spin.system.js";
export * from "./diagnostics.js";
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
