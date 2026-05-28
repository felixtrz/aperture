import path from "node:path";
import type { TemplateFile } from "./types.js";

const CLI_VERSION = "0.0.0";

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

export function defaultApertureDependencySpec(): string {
  return CLI_VERSION === "0.0.0" ? "workspace:*" : `^${CLI_VERSION}`;
}

export function packageJsonFile(input: {
  readonly packageName: string;
  readonly dependencySpec: string;
}): TemplateFile {
  const packageJson = {
    name: input.packageName,
    version: "0.0.0",
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
