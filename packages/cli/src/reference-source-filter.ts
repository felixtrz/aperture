import path from "node:path";

export type ApertureReferenceSourceCategory =
  | "api"
  | "diagnostic"
  | "docs"
  | "example"
  | "external"
  | "template";

export const IGNORED_DIRECTORIES = new Set([
  ".aperture",
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "references",
  "test-results",
]);

export const SELECTED_DEPENDENCY_FILES = [
  "node_modules/elics/README.md",
  "node_modules/elics/lib/index.d.ts",
  "node_modules/elics/lib/component.d.ts",
  "node_modules/elics/lib/system.d.ts",
  "node_modules/elics/lib/world.d.ts",
  "node_modules/elics/lib/entity.d.ts",
] as const;

const INDEXABLE_SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const INDEXABLE_EXAMPLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".wgsl",
]);
const DOC_ALLOWLIST = new Set([
  "README.md",
  "docs/AI_TOOLING.md",
  "docs/AI_TOOLING_PLAN.md",
  "docs/ARCHITECTURE.md",
  "docs/AUTHORING.md",
  "docs/DECISIONS.md",
  "docs/MEDIUM_LONG_TERM_GOALS.md",
  "docs/NORTH_STAR.md",
  "docs/RAG_REFERENCE_PLAN.md",
  "docs/ROADMAP.md",
]);
const TEMPLATE_OR_CONFIG_FILES = new Set([
  "aperture.config.ts",
  "package.json",
  "vite.config.ts",
]);
const CLI_PUBLIC_SOURCE_FILES = new Set([
  "packages/cli/src/cli.ts",
  "packages/cli/src/devtools-client.ts",
  "packages/cli/src/index.ts",
  "packages/cli/src/mcp.ts",
  "packages/cli/src/reference.ts",
  "packages/cli/src/session.ts",
]);
const WEBGPU_PUBLIC_SOURCE_FILES = new Set([
  "packages/webgpu/src/index.ts",
  "packages/webgpu/src/app/app.ts",
  "packages/webgpu/src/app/app-diagnostics-summary.ts",
  "packages/webgpu/src/render/frame/frame-readiness.ts",
  "packages/webgpu/src/render/frame/frame-report.ts",
  "packages/webgpu/src/picking/id-buffer-pick.ts",
]);
const PUBLIC_PACKAGE_PREFIXES = [
  "packages/app/src/",
  "packages/render/src/",
  "packages/runtime/src/",
  "packages/simulation/src/",
  "packages/vite-plugin/src/",
] as const;

export function sourceCategoryForFile(
  file: string,
  exportedEntrypoints: ReadonlyMap<string, readonly string[]>,
): ApertureReferenceSourceCategory | null {
  const extension = path.extname(file);

  if (DOC_ALLOWLIST.has(file)) {
    return "docs";
  }

  if (TEMPLATE_OR_CONFIG_FILES.has(file)) {
    return "template";
  }

  if (
    file.startsWith("examples/") &&
    INDEXABLE_EXAMPLE_EXTENSIONS.has(extension)
  ) {
    return "example";
  }

  if (file.startsWith("src/") && INDEXABLE_SOURCE_EXTENSIONS.has(extension)) {
    return "api";
  }

  if (exportedEntrypoints.has(file)) {
    return "api";
  }

  if (
    PUBLIC_PACKAGE_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
    INDEXABLE_SOURCE_EXTENSIONS.has(extension)
  ) {
    return "api";
  }

  if (
    (CLI_PUBLIC_SOURCE_FILES.has(file) ||
      WEBGPU_PUBLIC_SOURCE_FILES.has(file)) &&
    INDEXABLE_SOURCE_EXTENSIONS.has(extension)
  ) {
    return "api";
  }

  return null;
}
