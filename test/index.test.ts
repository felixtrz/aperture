import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as app from "@aperture-engine/app";
import * as advanced from "@aperture-engine/app/advanced";
import * as browser from "@aperture-engine/app/browser";
import * as cli from "@aperture-engine/cli";
import * as config from "@aperture-engine/app/config";
import * as headless from "@aperture-engine/app/headless";
import * as systems from "@aperture-engine/app/systems";
import * as vite from "@aperture-engine/app/vite";
import * as worker from "@aperture-engine/app/worker";
import * as render from "@aperture-engine/render";
import * as renderTestSupport from "@aperture-engine/render/test-support";
import * as runtime from "@aperture-engine/runtime";
import * as simulation from "@aperture-engine/simulation";

const APP_PUBLIC_SUBPATHS = [
  ".",
  "./advanced",
  "./browser",
  "./commands",
  "./config",
  "./diagnostics",
  "./entity-lookup",
  "./headless",
  "./systems",
  "./vite",
  "./worker",
] as const;

const APP_PUBLIC_IMPORTS = new Set([
  "@aperture-engine/app",
  ...APP_PUBLIC_SUBPATHS.filter((subpath) => subpath !== ".").map(
    (subpath) => `@aperture-engine/app/${subpath.slice(2)}`,
  ),
]);

const PUBLISHABLE_PACKAGE_DIRS = [
  "packages/simulation",
  "packages/render",
  "packages/runtime",
  "packages/webgpu",
  "packages/vite-plugin",
  "packages/app",
  "packages/cli",
] as const;

describe("Aperture package entrypoints", () => {
  it("keeps the app root focused on app runtime APIs", () => {
    expect("aperture" in app).toBe(false);
    expect("createApertureSystemManifest" in app).toBe(false);
    expect("createApertureApp" in app).toBe(true);
    expect("defineApertureConfig" in app).toBe(true);
    expect("createApertureHeadlessRunner" in app).toBe(true);
  });

  it("exposes app subpath surfaces explicitly", () => {
    expect("defineApertureConfig" in config).toBe(true);
    expect("createSystem" in systems).toBe(true);
    expect("createApertureApp" in advanced).toBe(true);
    expect("createApertureHeadlessRunner" in headless).toBe(true);
    expect("startGeneratedBrowserApp" in browser).toBe(true);
    expect("startGeneratedSimulationWorker" in worker).toBe(true);
    expect("aperture" in vite).toBe(true);
  });

  it("keeps focused lower-layer package surfaces available", () => {
    expect("createWorld" in simulation).toBe(true);
    expect("extractRenderSnapshot" in render).toBe(true);
    expect("createExtractionApp" in runtime).toBe(true);
  });

  it("keeps render inspection diagnostics behind test support", () => {
    expect("inspectRenderSnapshot" in render).toBe(true);
    expect("explainRenderSnapshotEntity" in render).toBe(true);
    expect("inspectRenderPackages" in render).toBe(false);
    expect("validateRenderSnapshotCloneability" in render).toBe(false);
    expect("summarizeRenderSnapshotDiagnostics" in render).toBe(false);

    expect("inspectRenderPackages" in renderTestSupport).toBe(true);
    expect("validateRenderSnapshotCloneability" in renderTestSupport).toBe(
      true,
    );
    expect("summarizeRenderSnapshotDiagnostics" in renderTestSupport).toBe(
      true,
    );
  });

  it("keeps CLI root exports intentional", () => {
    expect("runApertureCli" in cli).toBe(true);
    expect("createApertureProject" in cli).toBe(true);
    expect("callApertureTool" in cli).toBe(true);
    expect("buildApertureReferenceIndex" in cli).toBe(true);
    expect("callReferenceTool" in cli).toBe(false);
    expect("connectToManagedPage" in cli).toBe(false);
    expect("runCreateCommand" in cli).toBe(false);
  });

  it("declares only intentional app and CLI package export subpaths", async () => {
    const appPackage = await readPackageJson("packages/app/package.json");
    const cliPackage = await readPackageJson("packages/cli/package.json");

    expect(Object.keys(appPackage.exports).sort()).toEqual(
      [...APP_PUBLIC_SUBPATHS].sort(),
    );
    expect(Object.keys(cliPackage.exports)).toEqual(["."]);
    expect(cliPackage.exports).not.toHaveProperty("./reference");
    expect(cliPackage.exports).not.toHaveProperty("./tools/client");
    expect(cliPackage.exports).not.toHaveProperty("./dev/session");
    expect(cliPackage.exports).not.toHaveProperty("./create/project");
  });

  it("keeps package manifests publishable and export targets resolvable", async () => {
    const rootPackage = await readPackageJson("package.json");
    const rootLicense = await readFile(path.resolve("LICENSE"), "utf8");

    expect(rootPackage).toMatchObject({
      private: true,
      version: "0.1.0",
      license: "MIT",
    });
    expect(rootLicense).toContain("MIT License");

    for (const packageDir of PUBLISHABLE_PACKAGE_DIRS) {
      const packageJson = await readPackageJson(
        path.join(packageDir, "package.json"),
      );

      expect(packageJson.private, packageDir).not.toBe(true);
      expect(packageJson.version, packageDir).toBe(rootPackage.version);
      expect(packageJson.license, packageDir).toBe(rootPackage.license);
      expect(packageJson.files, packageDir).toEqual(
        expect.arrayContaining(["dist", "LICENSE"]),
      );
      expect(packageJson.publishConfig, packageDir).toMatchObject({
        access: "public",
      });
      await expectFileExists(path.join(packageDir, "LICENSE"));

      for (const [sectionName, dependencies] of [
        ["dependencies", packageJson.dependencies],
        ["peerDependencies", packageJson.peerDependencies],
      ] as const) {
        for (const [name, spec] of Object.entries(dependencies ?? {})) {
          if (name.startsWith("@aperture-engine/")) {
            expect(spec, `${packageDir} ${sectionName}.${name}`).toBe(
              "workspace:^",
            );
          }
        }
      }

      for (const [label, target] of [
        ["main", packageJson.main],
        ["types", packageJson.types],
      ] as const) {
        expect(target, `${packageDir} ${label}`).toEqual(expect.any(String));

        if (target === undefined) {
          continue;
        }

        expect(target, `${packageDir} ${label}`).toMatch(/^\.\/dist\//u);
        await expectFileExists(path.join(packageDir, target.slice(2)));
      }

      for (const target of collectExportTargets(packageJson.exports)) {
        expect(target.path, `${packageDir} ${target.label}`).toMatch(
          /^\.\/dist\//u,
        );
        await expectFileExists(path.join(packageDir, target.path.slice(2)));
      }
    }
  });

  it("does not expose internal app or CLI folders through test path aliases", async () => {
    const tsconfig = JSON.parse(
      await readFile(path.resolve("tsconfig.test.json"), "utf8"),
    ) as {
      readonly compilerOptions?: {
        readonly paths?: Record<string, readonly string[]>;
      };
    };
    const pathAliases = Object.keys(tsconfig.compilerOptions?.paths ?? {});

    expect(
      pathAliases.filter((alias) => alias.startsWith("@aperture-engine/cli/")),
    ).toEqual([]);
    expect(
      pathAliases
        .filter((alias) => alias.startsWith("@aperture-engine/app/"))
        .sort(),
    ).toEqual(
      APP_PUBLIC_SUBPATHS.filter((subpath) => subpath !== ".")
        .map((subpath) => `@aperture-engine/app/${subpath.slice(2)}`)
        .sort(),
    );
  });

  it("keeps examples and generated templates on public app imports", async () => {
    const files = [
      ...(await collectSourceFiles(path.resolve("examples"))),
      ...(await collectSourceFiles(path.resolve("packages/cli/src/create"))),
    ];
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const imports = source.matchAll(
        /(?:from\s+|import\s*\(\s*)["'](@aperture-engine\/app(?:\/[^"']+)?)["']/gu,
      );

      for (const match of imports) {
        const specifier = match[1];

        if (specifier !== undefined && !APP_PUBLIC_IMPORTS.has(specifier)) {
          violations.push(
            `${path.relative(process.cwd(), file)} imports ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

async function readPackageJson(file: string): Promise<{
  readonly dependencies?: Record<string, string>;
  readonly exports: Record<string, unknown>;
  readonly files?: readonly string[];
  readonly license?: string;
  readonly main?: string;
  readonly peerDependencies?: Record<string, string>;
  readonly private?: boolean;
  readonly publishConfig?: { readonly access?: string };
  readonly types?: string;
  readonly version?: string;
}> {
  return JSON.parse(await readFile(path.resolve(file), "utf8")) as {
    readonly dependencies?: Record<string, string>;
    readonly exports: Record<string, unknown>;
    readonly files?: readonly string[];
    readonly license?: string;
    readonly main?: string;
    readonly peerDependencies?: Record<string, string>;
    readonly private?: boolean;
    readonly publishConfig?: { readonly access?: string };
    readonly types?: string;
    readonly version?: string;
  };
}

async function expectFileExists(file: string): Promise<void> {
  await expect(readFile(path.resolve(file), "utf8")).resolves.toEqual(
    expect.any(String),
  );
}

function collectExportTargets(
  exportsValue: unknown,
  label = "exports",
): readonly { readonly label: string; readonly path: string }[] {
  if (typeof exportsValue === "string") {
    return [{ label, path: exportsValue }];
  }

  if (exportsValue === null || typeof exportsValue !== "object") {
    return [];
  }

  return Object.entries(exportsValue).flatMap(([key, value]) =>
    collectExportTargets(value, `${label}.${key}`),
  );
}

async function collectSourceFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && isSourceFile(absolute)) {
        files.push(absolute);
      }
    }
  }

  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function isSourceFile(file: string): boolean {
  return [".js", ".mjs", ".ts", ".tsx"].includes(path.extname(file));
}
