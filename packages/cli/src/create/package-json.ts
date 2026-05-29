import path from "node:path";
import { APERTURE_CLI_VERSION } from "../version.js";
import type { TemplateFile } from "./types.js";

const DEFAULT_PROJECT_VERSION = "0.1.0";
const LOCAL_DEPENDENCY_SPEC = "workspace:*";

export function npmPackageNameFromPath(targetDir: string): string {
  const baseName = path.basename(targetDir).toLowerCase();
  const normalized = baseName
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    return normalized;
  }

  return `aperture-${normalized || "app"}`;
}

export function defaultApertureDependencySpec(input?: {
  readonly local?: boolean;
}): string {
  if (input?.local === true || isLocalDependencyMode()) {
    return LOCAL_DEPENDENCY_SPEC;
  }

  return `^${APERTURE_CLI_VERSION}`;
}

export function packageJsonFile(input: {
  readonly packageName: string;
  readonly dependencySpec: string;
}): TemplateFile {
  const packageJson = {
    name: input.packageName,
    version: DEFAULT_PROJECT_VERSION,
    private: true,
    type: "module",
    scripts: {
      dev: "vite --host 127.0.0.1",
      build: "vite build",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
      aperture: "aperture",
    },
    dependencies: {
      "@aperture-engine/app": input.dependencySpec,
      "@aperture-engine/vite-plugin": input.dependencySpec,
    },
    devDependencies: {
      "@aperture-engine/cli": input.dependencySpec,
      typescript: "^6.0.3",
      vite: "^8.0.13",
    },
  };

  return {
    path: "package.json",
    contents: `${JSON.stringify(packageJson, null, 2)}\n`,
  };
}

function isLocalDependencyMode(): boolean {
  const value = process.env.APERTURE_LOCAL;

  return value === "1" || value === "true" || value === "workspace";
}
