import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
  type CandidateSource,
  type PackageExportInfo,
} from "../../packages/cli/src/reference/source-collection.js";

const tempRoots: string[] = [];

describe("reference source collection", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("discovers package exports and follows relative re-export chains", async () => {
    const root = await exportWorkspace();

    const infos = await discoverPackageExportInfo(root);
    const engine = findPackage(infos, "@aperture/engine");
    const noname = findPackage(infos, "packages/noname");
    const webgpu = findPackage(infos, "@aperture-engine/webgpu");
    const empty = findPackage(infos, "@aperture/empty");

    expect(infos.map((info) => info.packageName).sort()).toEqual([
      "@aperture-engine/webgpu",
      "@aperture/empty",
      "@aperture/engine",
      "packages/noname",
    ]);
    expect(
      engine.entrypointsByFile.get("packages/engine/src/index.ts"),
    ).toEqual(["@aperture/engine", "@aperture/engine/alias"]);
    expect(engine.entrypointsByFile.get("packages/engine/src/core.ts")).toEqual(
      ["@aperture/engine", "@aperture/engine/alias"],
    );
    expect(
      engine.entrypointsByFile.get("packages/engine/src/nested/deep.ts"),
    ).toEqual(["@aperture/engine", "@aperture/engine/alias"]);
    expect(
      engine.entrypointsByFile.get("packages/engine/src/util/helper.ts"),
    ).toEqual(["@aperture/engine", "@aperture/engine/alias"]);
    expect(
      engine.entrypointsByFile.get("packages/engine/src/sub/index.ts"),
    ).toEqual(["@aperture/engine", "@aperture/engine/alias"]);
    expect(
      engine.entrypointsByFile.get("packages/engine/src/widget.tsx"),
    ).toEqual(["@aperture/engine", "@aperture/engine/alias"]);
    expect(
      engine.entrypointsByFile.get("packages/engine/src/legacy.js"),
    ).toEqual(["@aperture/engine", "@aperture/engine/alias"]);
    expect(
      engine.entrypointsByFile.get("packages/engine/src/types-only.ts"),
    ).toEqual(["@aperture/engine/types-only"]);
    expect(engine.entrypointsByFile.has("packages/engine/src/skipped.ts")).toBe(
      false,
    );
    expect(noname.entrypointsByFile.get("packages/noname/src/main.ts")).toEqual(
      ["packages/noname"],
    );
    expect(
      webgpu.entrypointsByFile.get("packages/webgpu-clone/src/index.ts"),
    ).toEqual(["@aperture-engine/webgpu"]);
    expect(
      webgpu.entrypointsByFile.has("packages/webgpu-clone/src/inner.ts"),
    ).toBe(false);
    expect(empty.entrypointsByFile.size).toBe(0);
  });

  it("categorizes candidate sources and annotates exported entrypoints", async () => {
    const root = await exportWorkspace();
    await mkdir(path.join(root, "docs"), { recursive: true });
    await mkdir(path.join(root, "examples"), { recursive: true });
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "packages/runtime/src"), { recursive: true });
    await mkdir(path.join(root, "node_modules/elics/lib"), {
      recursive: true,
    });
    await mkdir(path.join(root, ".aperture"), { recursive: true });
    await writeFile(path.join(root, "README.md"), "# Readme\n", "utf8");
    await writeFile(path.join(root, "docs/AUTHORING.md"), "# Docs\n", "utf8");
    await writeFile(path.join(root, "package.json"), "{}\n", "utf8");
    await writeFile(
      path.join(root, "examples/demo.ts"),
      "export const demo = true;\n",
      "utf8",
    );
    await writeFile(path.join(root, "examples/asset.bin"), "binary", "utf8");
    await writeFile(
      path.join(root, "src/main.ts"),
      "export const main = true;\n",
      "utf8",
    );
    await writeFile(
      path.join(root, "packages/runtime/package.json"),
      JSON.stringify({
        name: "@aperture-engine/runtime",
        exports: {
          ".": {
            import: "./dist/index.js",
            types: "./dist/index.d.ts",
          },
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, "packages/runtime/src/index.ts"),
      'export * from "./extra.js";\n',
      "utf8",
    );
    await writeFile(
      path.join(root, "packages/runtime/src/extra.ts"),
      "export const extra = true;\n",
      "utf8",
    );
    await writeFile(
      path.join(root, "packages/runtime/src/internal.ts"),
      "export const internal = true;\n",
      "utf8",
    );
    await writeFile(
      path.join(root, "node_modules/elics/README.md"),
      "# elics\n",
      "utf8",
    );
    await writeFile(
      path.join(root, "node_modules/elics/lib/index.d.ts"),
      "export declare const elics: true;\n",
      "utf8",
    );
    await writeFile(path.join(root, "notes.txt"), "scratch\n", "utf8");
    await writeFile(path.join(root, ".aperture/cache.ts"), "ignored\n", "utf8");

    const infos = await discoverPackageExportInfo(root);
    const candidates = await collectCandidateSources(root, infos);
    const files = candidates.map((candidate) => candidate.file);

    expect(files).toEqual([...files].sort((a, b) => a.localeCompare(b)));
    expect(findCandidate(candidates, "packages/engine/src/index.ts")).toEqual({
      file: "packages/engine/src/index.ts",
      absoluteFile: path.join(root, "packages/engine/src/index.ts"),
      sourceCategory: "api",
      packageName: "@aperture/engine",
      entrypoint: "@aperture/engine, @aperture/engine/alias",
    });
    expect(
      findCandidate(candidates, "packages/engine/src/nested/deep.ts"),
    ).toMatchObject({
      sourceCategory: "api",
      packageName: "@aperture/engine",
      entrypoint: "@aperture/engine, @aperture/engine/alias",
    });
    expect(
      findCandidate(candidates, "packages/engine/src/types-only.ts"),
    ).toMatchObject({
      sourceCategory: "api",
      entrypoint: "@aperture/engine/types-only",
    });
    expect(findCandidate(candidates, "node_modules/elics/README.md")).toEqual({
      file: "node_modules/elics/README.md",
      absoluteFile: path.join(root, "node_modules/elics/README.md"),
      sourceCategory: "external",
      packageName: "elics",
      entrypoint: "elics",
    });
    expect(
      findCandidate(candidates, "node_modules/elics/lib/index.d.ts"),
    ).toMatchObject({ sourceCategory: "external" });
    expect(findCandidate(candidates, "docs/AUTHORING.md")).toMatchObject({
      sourceCategory: "docs",
    });
    expect(findCandidate(candidates, "README.md")).toMatchObject({
      sourceCategory: "docs",
    });
    expect(findCandidate(candidates, "package.json")).toMatchObject({
      sourceCategory: "template",
    });
    expect(findCandidate(candidates, "examples/demo.ts")).toMatchObject({
      sourceCategory: "example",
    });
    expect(findCandidate(candidates, "src/main.ts")).toEqual({
      file: "src/main.ts",
      absoluteFile: path.join(root, "src/main.ts"),
      sourceCategory: "api",
    });
    expect(
      findCandidate(candidates, "packages/runtime/src/extra.ts"),
    ).toMatchObject({
      sourceCategory: "api",
      packageName: "@aperture-engine/runtime",
      entrypoint: "@aperture-engine/runtime",
    });
    expect(files).not.toContain("notes.txt");
    expect(files).not.toContain("examples/asset.bin");
    expect(files).not.toContain(".aperture/cache.ts");
    expect(files).not.toContain("packages/runtime/src/internal.ts");
    expect(files).not.toContain("packages/engine/package.json");
    expect(files).not.toContain("packages/webgpu-clone/src/inner.ts");
    expect(files).toContain("packages/webgpu-clone/src/index.ts");
  });

  it("skips selected dependency files that are missing from the workspace", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src/only.ts"),
      "export const only = true;\n",
      "utf8",
    );

    const candidates = await collectCandidateSources(root, []);

    expect(candidates.map((candidate) => candidate.file)).toEqual([
      "src/only.ts",
    ]);
  });

  it("returns no package info when the packages directory is missing", async () => {
    const root = await tempRoot();

    await expect(discoverPackageExportInfo(root)).resolves.toEqual([]);
  });

  it("propagates unexpected filesystem errors instead of swallowing them", async () => {
    const root = await tempRoot();
    const filePosingAsRoot = path.join(root, "not-a-directory.txt");
    await writeFile(filePosingAsRoot, "plain file\n", "utf8");

    await expect(
      discoverPackageExportInfo(filePosingAsRoot),
    ).rejects.toMatchObject({ code: "ENOTDIR" });

    const brokenDependencyRoot = await tempRoot();
    await mkdir(path.join(brokenDependencyRoot, "node_modules"), {
      recursive: true,
    });
    await writeFile(
      path.join(brokenDependencyRoot, "node_modules/elics"),
      "file where a directory should be\n",
      "utf8",
    );

    await expect(
      collectCandidateSources(brokenDependencyRoot, []),
    ).rejects.toMatchObject({ code: "ENOTDIR" });
  });
});

async function exportWorkspace(): Promise<string> {
  const root = await tempRoot();

  await mkdir(path.join(root, "packages/engine/src/nested"), {
    recursive: true,
  });
  await mkdir(path.join(root, "packages/engine/src/util"), {
    recursive: true,
  });
  await mkdir(path.join(root, "packages/engine/src/sub"), { recursive: true });
  await mkdir(path.join(root, "packages/noname/src"), { recursive: true });
  await mkdir(path.join(root, "packages/webgpu-clone/src"), {
    recursive: true,
  });
  await mkdir(path.join(root, "packages/empty-exports"), { recursive: true });
  await mkdir(path.join(root, "packages/no-manifest"), { recursive: true });
  await writeFile(path.join(root, "packages/stray.txt"), "stray\n", "utf8");
  await writeFile(
    path.join(root, "packages/engine/package.json"),
    JSON.stringify({
      name: "@aperture/engine",
      exports: {
        ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
        "./alias": "./dist/index.js",
        "./types-only": { types: "./dist/types-only.d.ts" },
        "./skipped": { require: "./dist/skipped.cjs" },
        "./bad": 42,
        "./missing": "./dist/missing.js",
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/index.ts"),
    [
      'export * from "./core.js";',
      'export { helper } from "./util/helper.js";',
      'export * from "./core.js";',
      'export * from "left-pad";',
      'export * from "./missing-target.js";',
      'export * from "./sub";',
      'export * from "./widget.js";',
      'export * from "./legacy.js";',
      'export const version = "1.0.0";',
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/core.ts"),
    'export * from "./nested/deep.js";\nexport const core = true;\n',
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/nested/deep.ts"),
    "export const deep = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/util/helper.ts"),
    "export const helper = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/sub/index.ts"),
    "export const sub = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/widget.tsx"),
    "export const widget = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/legacy.js"),
    "export const legacy = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/engine/src/types-only.ts"),
    "export type TypesOnly = string;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/noname/package.json"),
    JSON.stringify({ exports: { ".": "./dist/main.js" } }),
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/noname/src/main.ts"),
    "export const main = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/webgpu-clone/package.json"),
    JSON.stringify({
      name: "@aperture-engine/webgpu",
      exports: { ".": "./dist/index.js" },
    }),
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/webgpu-clone/src/index.ts"),
    'export * from "./inner.js";\n',
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/webgpu-clone/src/inner.ts"),
    "export const inner = true;\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages/empty-exports/package.json"),
    JSON.stringify({ name: "@aperture/empty" }),
    "utf8",
  );

  return root;
}

function findPackage(
  infos: readonly PackageExportInfo[],
  packageName: string,
): PackageExportInfo {
  const info = infos.find((candidate) => candidate.packageName === packageName);

  if (info === undefined) {
    throw new Error(`Expected package export info for '${packageName}'.`);
  }

  return info;
}

function findCandidate(
  candidates: readonly CandidateSource[],
  file: string,
): CandidateSource {
  const candidate = candidates.find((entry) => entry.file === file);

  if (candidate === undefined) {
    throw new Error(`Expected a candidate source for '${file}'.`);
  }

  return candidate;
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "aperture-source-collection-"),
  );
  tempRoots.push(root);
  return root;
}
