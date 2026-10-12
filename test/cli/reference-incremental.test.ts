import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApertureReferenceIndex } from "../../packages/cli/src/reference/build.js";
import { withReferenceBuildLock } from "../../packages/cli/src/reference/build-lock.js";
import type { RawReferenceChunk } from "../../packages/cli/src/reference/chunking.js";
import type {
  ApertureReferenceIndex,
  ApertureReferenceModelContract,
} from "../../packages/cli/src/reference/contracts.js";
import { createEmbeddedReferenceChunks } from "../../packages/cli/src/reference/corpus.js";
import { readReusableReferenceIndex } from "../../packages/cli/src/reference/embedding-cache.js";
import { disposeReferenceEmbeddingServices } from "../../packages/cli/src/reference/embedding.js";
import { sha256 } from "../../packages/cli/src/reference/files.js";
import {
  MODEL_CONTRACT,
  REQUIRED_MODEL_FILES,
  writeReferenceModelContract,
} from "../../packages/cli/src/reference/model.js";
import {
  apertureReferenceModelDir,
  apertureReferenceRuntimeDir,
} from "../../packages/cli/src/reference/paths.js";
import { publishReferenceDirectory } from "../../packages/cli/src/reference/publication.js";

const TRANSFORMERS_LOADER_GLOBAL = "__APERTURE_REFERENCE_TRANSFORMERS_LOADER__";
const tar = createRequire(
  new URL("../../packages/cli/package.json", import.meta.url),
)("tar") as {
  x(options: { cwd: string; file: string }): Promise<void>;
};
const extract = vi.fn(async (texts: readonly string[]) => ({
  data: Float32Array.from(texts.flatMap((text) => vector(text.length))),
}));
const pipeline = vi.fn(async () => extract);
let root: string;
let modelDir: string;

describe("incremental reference producer", { timeout: 60_000 }, () => {
  beforeEach(async () => {
    root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-reference-incremental-"),
    );
    modelDir = apertureReferenceModelDir(root);
    await modelFixture(modelDir);
    pipeline.mockClear();
    extract.mockReset();
    extract.mockImplementation(async (texts) => ({
      data: Float32Array.from(texts.flatMap((text) => vector(text.length))),
    }));
    vi.stubEnv("APERTURE_REFERENCE_CACHE_DIR", path.join(root, "shared-cache"));
    vi.stubGlobal(TRANSFORMERS_LOADER_GLOBAL, async () => ({
      env: {},
      pipeline,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("Unexpected model download");
      }),
    );
  });

  afterEach(async () => {
    await disposeReferenceEmbeddingServices();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("reuses exact inputs without loading a model, while retaining fresh content and metadata", async () => {
    const raw = chunk("x".repeat(2100));
    const first = await createEmbeddedReferenceChunks([raw], { modelDir });
    await disposeReferenceEmbeddingServices();
    pipeline.mockClear();
    extract.mockClear();
    const current = {
      ...raw,
      content: `${"x".repeat(2000)}${"y".repeat(100)}`,
      metadata: {
        ...raw.metadata,
        usesTypes: ["UpdatedType"],
        exportedName: "UpdatedExport",
      },
    };
    const result = await createEmbeddedReferenceChunks([current], {
      modelDir: "/missing-model",
      previousIndex: index(first.chunks),
    });
    expect(result).toMatchObject({ reused: 1, generated: 0 });
    expect(result.chunks[0]).toMatchObject({
      content: current.content,
      metadata: { usesTypes: ["UpdatedType"], exportedName: "UpdatedExport" },
      embedding: first.chunks[0]!.embedding,
    });
    expect(pipeline).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
  });

  it("embeds changed text and changed source locations even when a chunk ID is unchanged", async () => {
    const original = [chunk("before", "one"), chunk("same", "two")];
    const first = await createEmbeddedReferenceChunks(original, { modelDir });
    extract.mockClear();
    const current = [
      chunk("after!", "one"),
      {
        ...original[1]!,
        metadata: { ...original[1]!.metadata, startLine: 20, endLine: 20 },
      },
    ];
    const result = await createEmbeddedReferenceChunks(current, {
      modelDir,
      previousIndex: index(first.chunks),
    });
    expect(result).toMatchObject({ reused: 0, generated: 2 });
    expect(result.chunks[0]!.id).toBe(first.chunks[0]!.id);
    expect(extract).toHaveBeenCalledWith(
      result.chunks.map((item) => item.embeddingText),
      expect.any(Object),
    );
    expect(result.chunks[1]!.metadata.startLine).toBe(20);
  });

  it("drops deleted chunks and preserves current ordering across mixed reused/new batches", async () => {
    const original = [
      chunk("one", "one"),
      chunk("two", "two"),
      chunk("deleted", "deleted"),
    ];
    const first = await createEmbeddedReferenceChunks(original, { modelDir });
    extract.mockClear();
    const result = await createEmbeddedReferenceChunks(
      [original[1]!, chunk("new", "new"), original[0]!],
      { modelDir, previousIndex: index(first.chunks) },
    );
    expect(result).toMatchObject({ reused: 2, generated: 1 });
    expect(result.chunks.map((item) => item.metadata.name)).toEqual([
      "two",
      "new",
      "one",
    ]);
    expect(extract.mock.calls[0]![0]).toEqual([
      result.chunks[1]!.embeddingText,
    ]);
    expect(result.chunks[0]!.embedding).toEqual(first.chunks[1]!.embedding);
  });

  it.each([
    ["provider", "other"],
    ["format", "other"],
    ["model", "other"],
    ["revision", "other"],
    ["dimensions", 3],
    ["dtype", "fp32"],
    ["pooling", "max"],
    ["normalize", false],
    ["textFormattingVersion", 99],
    ["expectedFiles", []],
    ["files", []],
  ] as const)(
    "regenerates when the cached model %s differs",
    async (field, value) => {
      const raw = [chunk("exact")];
      const first = await createEmbeddedReferenceChunks(raw, { modelDir });
      const old = index(first.chunks);
      const incompatible = {
        ...old,
        model: {
          ...MODEL_CONTRACT,
          [field]: value,
        } as ApertureReferenceModelContract,
      };
      extract.mockClear();
      const result = await createEmbeddedReferenceChunks(raw, {
        modelDir,
        previousIndex: incompatible,
      });
      expect(result).toMatchObject({ reused: 0, generated: 1 });
      expect(extract).toHaveBeenCalledOnce();
    },
  );

  it("rejects a mismatched manifest contract and invalid cached vectors individually", async () => {
    const raw = [
      chunk("ok", "ok"),
      chunk("bad-dimension", "short"),
      chunk("bad-value", "nan"),
    ];
    const first = await createEmbeddedReferenceChunks(raw, { modelDir });
    const previous = index(
      first.chunks.map((item, offset) => ({
        ...item,
        embedding:
          offset === 1
            ? [1]
            : offset === 2
              ? [NaN, ...vector(1).slice(1)]
              : item.embedding,
      })),
    );
    extract.mockClear();
    const result = await createEmbeddedReferenceChunks(raw, {
      modelDir,
      previousIndex: previous,
    });
    expect(result).toMatchObject({ reused: 1, generated: 2 });
    expect(extract.mock.calls[0]![0]).toHaveLength(2);
    extract.mockClear();
    const mismatch = {
      ...previous,
      manifest: {
        ...previous.manifest,
        model: { ...MODEL_CONTRACT, normalize: false },
      },
    };
    expect(
      await createEmbeddedReferenceChunks(raw, {
        modelDir,
        previousIndex: mismatch,
      }),
    ).toMatchObject({ reused: 0, generated: 3 });
  });

  it("regenerates conflicting duplicate vectors rather than arbitrarily choosing one", async () => {
    const raw = [chunk("duplicate")];
    const first = await createEmbeddedReferenceChunks(raw, { modelDir });
    const previous = index([
      first.chunks[0]!,
      { ...first.chunks[0]!, embedding: vector(99) },
    ]);
    expect(
      await createEmbeddedReferenceChunks(raw, {
        modelDir,
        previousIndex: previous,
      }),
    ).toMatchObject({ reused: 0, generated: 1 });
  });

  it("rejects malformed fresh model output before returning incomplete/nonfinite chunks", async () => {
    extract.mockResolvedValueOnce({
      data: Float32Array.from([NaN, ...vector(0).slice(1)]),
    });
    await expect(
      createEmbeddedReferenceChunks([chunk("new")], { modelDir }),
    ).rejects.toThrow("nonfinite");
  });

  it("rebuilds sources, entries and the archive with exact reuse and current deletions", async () => {
    await docs("# Authoring\n\nOriginal corpus.\n");
    const first = await buildApertureReferenceIndex({ cwd: root });
    expect(first.embeddingsGenerated).toBe(first.chunks);
    pipeline.mockClear();
    const second = await buildApertureReferenceIndex({ cwd: root });
    expect(second).toMatchObject({
      embeddingsReused: first.chunks,
      embeddingsGenerated: 0,
    });
    expect(pipeline).not.toHaveBeenCalled();
    await rm(path.join(root, "docs/AUTHORING.md"));
    await writeFile(
      path.join(root, "README.md"),
      "# New\n\nReplacement source.\n",
    );
    const third = await buildApertureReferenceIndex({ cwd: root });
    const fresh = JSON.parse(
      await readFile(third.indexFile, "utf8"),
    ) as ApertureReferenceIndex;
    expect(fresh.sources.map((source) => source.file)).toEqual(["README.md"]);
    expect(fresh.entries.map((entry) => entry.file)).toEqual(["README.md"]);
    expect(
      fresh.chunks.every((item) => item.metadata.file === "README.md"),
    ).toBe(true);
    const archiveRoot = path.join(root, "unpacked");
    await mkdir(archiveRoot);
    await tar.x({ cwd: archiveRoot, file: third.archiveFile });
    expect(
      await readFile(path.join(archiveRoot, "data/sources/README.md"), "utf8"),
    ).toBe(fresh.sources[0]!.text);
    await expect(
      readFile(path.join(archiveRoot, "data/sources/docs/AUTHORING.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["missing-manifest", "corrupt-json", "changed-bytes", "wrong-model"])(
    "repairs %s cache through fresh embedding",
    async (damage) => {
      await docs("# Authoring\n\nA tiny real corpus.\n");
      const first = await buildApertureReferenceIndex({ cwd: root });
      const embeddings = path.join(first.dataDir, "embeddings.json");
      if (damage === "missing-manifest") await rm(first.manifestFile);
      if (damage === "corrupt-json") await writeFile(first.manifestFile, "{");
      if (damage === "changed-bytes")
        await writeFile(embeddings, `${await readFile(embeddings, "utf8")}\n`);
      if (damage === "wrong-model") {
        const previous = JSON.parse(
          await readFile(embeddings, "utf8"),
        ) as ApertureReferenceIndex;
        await writeHashedCache(first.manifestFile, embeddings, {
          ...previous,
          model: { ...MODEL_CONTRACT, revision: "wrong" },
        });
      }
      expect(await readReusableReferenceIndex(root)).toBeUndefined();
      extract.mockClear();
      const repaired = await buildApertureReferenceIndex({ cwd: root });
      expect(repaired).toMatchObject({
        embeddingsReused: 0,
        embeddingsGenerated: first.chunks,
      });
      expect(extract).toHaveBeenCalled();
      expect(await readReusableReferenceIndex(root)).toBeDefined();
    },
  );

  it("preserves all previous cache bytes when a later embedding batch fails", async () => {
    await docs(sections("original"));
    const first = await buildApertureReferenceIndex({ cwd: root });
    const before = await fileSnapshot(apertureReferenceRuntimeDir(root));
    await docs(sections("changed"));
    extract.mockImplementationOnce(async (texts) => ({
      data: Float32Array.from(texts.flatMap(() => vector(1))),
    }));
    extract.mockRejectedValueOnce(new Error("second batch failed"));
    await expect(buildApertureReferenceIndex({ cwd: root })).rejects.toThrow(
      "second batch failed",
    );
    expect(await fileSnapshot(apertureReferenceRuntimeDir(root))).toEqual(
      before,
    );
    expect(JSON.parse(await readFile(first.indexFile, "utf8"))).toMatchObject({
      chunks: expect.any(Array),
    });
    expect(
      (await readdir(path.dirname(apertureReferenceRuntimeDir(root)))).filter(
        (name) => name.startsWith(".reference-build-"),
      ),
    ).toEqual([]);
  });

  it("restores the previous snapshot when a publication callback fails", async () => {
    const destination = path.join(root, "previous");
    const staged = path.join(root, "staged");
    await mkdir(destination);
    await mkdir(staged);
    await writeFile(path.join(destination, "bytes"), "previous");
    await writeFile(path.join(staged, "bytes"), "new");
    await expect(
      publishReferenceDirectory(staged, destination, async () => {
        throw new Error("publish failed");
      }),
    ).rejects.toThrow("publish failed");
    expect(await readFile(path.join(destination, "bytes"), "utf8")).toBe(
      "previous",
    );
    expect(
      (await readdir(root)).filter((name) => name.includes(".previous-")),
    ).toEqual([]);
  });

  it("rejects simultaneous same-root builders and other processes, and releases its lock on failure", async () => {
    await docs("# Authoring\n\nExclusive producer.\n");
    const runtimeDir = apertureReferenceRuntimeDir(root);
    await withReferenceBuildLock(runtimeDir, async () => {
      await expect(buildApertureReferenceIndex({ cwd: root })).rejects.toThrow(
        "already generating",
      );
      const lockModuleUrl = new URL(
        "../../packages/cli/src/reference/build-lock.ts",
        import.meta.url,
      ).href;
      const script = `const { withReferenceBuildLock } = await import(${JSON.stringify(lockModuleUrl)}); await withReferenceBuildLock(process.argv[1], async () => { throw new Error("Unexpected lock ownership"); });`;
      await expect(
        promisify(execFile)(
          process.execPath,
          ["--input-type=module", "-e", script, runtimeDir],
          { timeout: 10_000 },
        ),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("already generating"),
      });
    });
    await expect(
      withReferenceBuildLock(runtimeDir, async () => {
        throw new Error("generation failed");
      }),
    ).rejects.toThrow("generation failed");
    await expect(readFile(`${runtimeDir}.build.lock`)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      buildApertureReferenceIndex({ cwd: root }),
    ).resolves.toMatchObject({ embeddingsGenerated: expect.any(Number) });
  });

  it("publishes refreshed browser/archive assets and retains old dist after a late payload error", async () => {
    await docs("# Authoring\n\nCurrent public guide.\n");
    const built = await buildApertureReferenceIndex({ cwd: root });
    const producer = path.join(root, "producer");
    await mkdir(producer);
    await cp(built.dataDir, path.join(producer, "data"), { recursive: true });
    const moduleUrl = new URL(
      "../../packages/reference-assets/scripts/build-assets.mjs",
      import.meta.url,
    ).href;
    const { buildReferenceAssets } = (await import(moduleUrl)) as {
      buildReferenceAssets(options: { root: string }): Promise<void>;
    };
    await buildReferenceAssets({ root: producer });
    const before = await fileSnapshot(path.join(producer, "dist"));
    const browser = JSON.parse(
      await readFile(path.join(producer, "dist/browser-search.json"), "utf8"),
    ) as { chunks: { content: string }[] };
    expect(
      browser.chunks.some((item) =>
        item.content.includes("Current public guide"),
      ),
    ).toBe(true);
    const embeddingsFile = path.join(producer, "data/embeddings.json");
    const broken = JSON.parse(
      await readFile(embeddingsFile, "utf8"),
    ) as ApertureReferenceIndex;
    await writeFile(
      embeddingsFile,
      JSON.stringify({
        ...broken,
        chunks: broken.chunks.map((item) => ({ ...item, embedding: [1] })),
      }),
    );
    await expect(buildReferenceAssets({ root: producer })).rejects.toThrow(
      "embedding dimensions",
    );
    expect(await fileSnapshot(path.join(producer, "dist"))).toEqual(before);
    expect(
      (await readdir(producer)).filter((name) =>
        name.startsWith(".dist-build-"),
      ),
    ).toEqual([]);
  });
});

function vector(value: number): number[] {
  return Array.from({ length: MODEL_CONTRACT.dimensions }, () => value);
}
function chunk(content: string, name = "example"): RawReferenceChunk {
  return {
    content,
    metadata: {
      sourceCategory: "api",
      file: `src/${name}.ts`,
      chunkType: "function",
      name,
      startLine: 1,
      endLine: 1,
      imports: [],
      exports: [],
      calls: [],
      extends: [],
      implements: [],
      usesTypes: [],
      componentIds: [],
      systemNames: [],
      diagnostics: [],
    },
  };
}
function index(
  chunks: ApertureReferenceIndex["chunks"],
): ApertureReferenceIndex {
  return {
    version: 2,
    schemaVersion: 1,
    root,
    createdAt: "2026-10-12T00:00:00.000Z",
    model: MODEL_CONTRACT,
    chunks,
    sources: [],
    entries: [],
    manifest: {
      schemaVersion: 1,
      indexVersion: 2,
      corpus: {
        name: "test",
        root,
        generatedAt: "2026-10-12T00:00:00.000Z",
        chunks: chunks.length,
        sources: 0,
      },
      model: MODEL_CONTRACT,
      files: [],
    },
  };
}
async function modelFixture(directory: string): Promise<void> {
  for (const file of REQUIRED_MODEL_FILES) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), "{}");
  }
  await writeReferenceModelContract(directory);
}
async function docs(content: string): Promise<void> {
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs/AUTHORING.md"), content);
}
function sections(content: string): string {
  return Array.from(
    { length: 20 },
    (_, offset) => `# Section ${offset}\n\n${content} ${offset}.\n`,
  ).join("\n");
}
async function writeHashedCache(
  manifestFile: string,
  embeddingsFile: string,
  value: ApertureReferenceIndex,
): Promise<void> {
  const serialized = JSON.stringify(value);
  await writeFile(embeddingsFile, serialized);
  const manifest = JSON.parse(
    await readFile(manifestFile, "utf8"),
  ) as ApertureReferenceIndex["manifest"];
  await writeFile(
    manifestFile,
    JSON.stringify({
      ...manifest,
      files: manifest.files.map((file) =>
        file.path === "data/embeddings.json"
          ? {
              ...file,
              bytes: Buffer.byteLength(serialized),
              sha256: sha256(serialized),
            }
          : file,
      ),
    }),
  );
}
async function fileSnapshot(
  directory: string,
  prefix = "",
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory())
      Object.assign(
        files,
        await fileSnapshot(path.join(directory, entry.name), relative),
      );
    else
      files[relative] = (
        await readFile(path.join(directory, entry.name))
      ).toString("base64");
  }
  return files;
}
