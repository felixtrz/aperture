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

  it("follows public type-only, inline type and namespace re-exports through shared cycles", async () => {
    const root = await typeExportWorkspace({
      "index.ts": [
        'export type { NamedType } from "./named.js";',
        'export type * from "./star.js";',
        'export type * as Types from "./namespace.js";',
        'export { type InlineType } from "./inline.js";',
        'export * as Values from "./values.js";',
        'export type { SharedType } from "./shared.js";',
        "",
      ].join("\n"),
      "named.ts":
        'export type { SharedType } from "./shared.js";\nexport interface NamedType { value: number }\n',
      "shared.ts":
        'export type { NamedType } from "./named.js";\nexport type { StarType } from "./star.js";\nexport interface SharedType { key: string }\n',
      "star.ts":
        'export type { SharedType } from "./shared.js";\nexport type StarType = string;\n',
      "namespace.ts": "export type NamespaceType = boolean;\n",
      "inline.ts": "export type InlineType = number;\n",
      "values.ts": "export const value = 1;\n",
    });

    const infos = await discoverPackageExportInfo(root);
    const engine = findPackage(infos, "@aperture/type-fixture");
    const publicFiles = [
      "index.ts",
      "named.ts",
      "shared.ts",
      "star.ts",
      "namespace.ts",
      "inline.ts",
      "values.ts",
    ].map((file) => `packages/type-fixture/src/${file}`);
    // Preserve declaration-order depth-first traversal while visiting cycles and
    // shared descendants once per independently exported entrypoint.
    expect([...engine.entrypointsByFile.keys()]).toEqual(publicFiles);
    for (const file of publicFiles) {
      expect(engine.entrypointsByFile.get(file)).toEqual([
        "@aperture/type-fixture",
        "@aperture/type-fixture/alias",
      ]);
    }
    const candidates = await collectCandidateSources(root, infos);
    expect(candidates.map((candidate) => candidate.file)).toEqual(
      [...publicFiles].sort((a, b) => a.localeCompare(b)),
    );
    for (const candidate of candidates) {
      expect(candidate).toMatchObject({
        sourceCategory: "api",
        packageName: "@aperture/type-fixture",
        entrypoint: "@aperture/type-fixture, @aperture/type-fixture/alias",
      });
    }
  });

  it("ignores re-export examples, private imports and ambient-module declarations", async () => {
    const root = await typeExportWorkspace({
      "index.ts": [
        '// export type { CommentType } from "./comment-private.js";',
        '// export { CommentValue } from "./comment-value-private.js";',
        '/* export type * from "./block-private.js"; */',
        `export const sourceExample = 'export type { StringType } from "./string-private.js";';`,
        'export const documentation = `export type * from "./template-private.js";`;',
        'export const valueDocumentation = `export * from "./template-value-private.js";`;',
        'import type { ImportedType } from "./import-private.js";',
        'type DynamicType = import("./dynamic-private.js").DynamicType;',
        'declare module "external-augmentation" {',
        '  export type { AmbientType } from "./ambient-private.js";',
        "}",
        'export type { ExternalType } from "external-package";',
        'export type { MissingType } from "./missing.js";',
        'export type { PublicType } /* comment before from */ from "./public.js";',
        "",
      ].join("\n"),
      "public.ts": "export interface PublicType { value: string }\n",
      "comment-private.ts": "export type CommentType = unknown;\n",
      "comment-value-private.ts": "export const CommentValue = true;\n",
      "block-private.ts": "export type BlockType = unknown;\n",
      "string-private.ts": "export type StringType = unknown;\n",
      "template-private.ts": "export type TemplateType = unknown;\n",
      "template-value-private.ts": "export const templateValue = true;\n",
      "import-private.ts": "export type ImportedType = unknown;\n",
      "dynamic-private.ts": "export type DynamicType = unknown;\n",
      "ambient-private.ts": "export type AmbientType = unknown;\n",
      "unreachable-private.ts": 'export type * from "./also-private.js";\n',
      "also-private.ts": "export type AlsoPrivate = unknown;\n",
    });

    const infos = await discoverPackageExportInfo(root);
    const engine = findPackage(infos, "@aperture/type-fixture");
    expect([...engine.entrypointsByFile.keys()]).toEqual([
      "packages/type-fixture/src/index.ts",
      "packages/type-fixture/src/public.ts",
    ]);
    const candidates = await collectCandidateSources(root, infos);
    expect(candidates.map((candidate) => candidate.file)).toEqual([
      "packages/type-fixture/src/index.ts",
      "packages/type-fixture/src/public.ts",
    ]);
  });

  it("preserves the explicit WebGPU implementation curation boundary for type exports", async () => {
    const root = await typeExportWorkspace(
      {
        "index.ts": 'export type { InnerType } from "./inner.js";\n',
        "inner.ts": "export interface InnerType { privateDetail: number }\n",
      },
      "@aperture-engine/webgpu",
    );

    const infos = await discoverPackageExportInfo(root);
    const webgpu = findPackage(infos, "@aperture-engine/webgpu");
    expect([...webgpu.entrypointsByFile.keys()]).toEqual([
      "packages/type-fixture/src/index.ts",
    ]);
    expect(
      (await collectCandidateSources(root, infos)).map(
        (candidate) => candidate.file,
      ),
    ).toEqual(["packages/type-fixture/src/index.ts"]);
  });

  it("includes public execution and submitted-geometry contracts without renderer internals", async () => {
    const root = await tempRoot();
    const inputs = {
      "docs/HEADLESS_SOURCE_REALMS.md": "# Fresh source execution\n",
      "docs/RENDERED_GEOMETRY_INSPECTION.md":
        "# Submitted geometry inspection\n",
      "packages/webgpu/src/app/rendered-geometry-types.ts":
        "export interface RenderedGeometryInspection { readonly frame: number }\n",
      "packages/webgpu/src/app/rendered-geometry-inspector.ts":
        "export const privateInspector = true;\n",
      "packages/webgpu/src/app/rendered-geometry-upload.ts":
        "export const privateUpload = true;\n",
      "docs/AGENT_ARCHITECTURE_AUDIT.md": "# Internal review evidence\n",
    };
    for (const [file, content] of Object.entries(inputs)) {
      const target = path.join(root, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }
    const candidates = await collectCandidateSources(root, []);
    expect(
      candidates.map(({ file, sourceCategory }) => ({ file, sourceCategory })),
    ).toEqual([
      { file: "docs/HEADLESS_SOURCE_REALMS.md", sourceCategory: "docs" },
      { file: "docs/RENDERED_GEOMETRY_INSPECTION.md", sourceCategory: "docs" },
      {
        file: "packages/webgpu/src/app/rendered-geometry-types.ts",
        sourceCategory: "api",
      },
    ]);
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

  it("includes public authoring guides and skips private/cache directories even inside source roots", async () => {
    const root = await tempRoot();
    const publicFiles = [
      "docs/BROWSER_FRAME_CONTROL.md",
      "docs/VISUAL_QUALITY.md",
      "docs/MIXED_SHADOWS.md",
      "src/custom-module/api.ts",
    ];
    const privateFiles = [
      "src/.aperture-env/private.ts",
      "src/.pnpm-store/private.ts",
      "src/.cache/private.ts",
      "docs/AGENT_ARCHITECTURE_AUDIT.md",
    ];
    for (const file of [...publicFiles, ...privateFiles]) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), "export const fixture = true;\n");
    }
    const candidates = await collectCandidateSources(root, []);
    expect(candidates.map((candidate) => candidate.file)).toEqual(
      [...publicFiles].sort((a, b) => a.localeCompare(b)),
    );
    for (const file of publicFiles.slice(0, 3))
      expect(findCandidate(candidates, file).sourceCategory).toBe("docs");
    expect(
      findCandidate(candidates, "src/custom-module/api.ts").sourceCategory,
    ).toBe("api");
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

async function typeExportWorkspace(
  files: Readonly<Record<string, string>>,
  packageName = "@aperture/type-fixture",
): Promise<string> {
  const root = await tempRoot();
  const packageRoot = path.join(root, "packages/type-fixture");
  await mkdir(path.join(packageRoot, "src"), { recursive: true });
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      name: packageName,
      exports: {
        ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
        "./alias": "./dist/index.js",
      },
    }),
    "utf8",
  );
  for (const [file, text] of Object.entries(files)) {
    const destination = path.join(packageRoot, "src", file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, text, "utf8");
  }
  return root;
}

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
