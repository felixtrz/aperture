import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultApertureDependencySpec,
  npmPackageNameFromPath,
} from "./package-json.js";
import { createTemplateFiles } from "./templates/index.js";
import { assertWritableTarget, resolveTargetDir } from "./target.js";
import type {
  CreateApertureProjectOptions,
  CreateApertureProjectReport,
} from "./types.js";

export async function createApertureProject(
  options: CreateApertureProjectOptions,
): Promise<CreateApertureProjectReport> {
  const targetDir = resolveTargetDir(options.cwd, options.name);
  const packageName = npmPackageNameFromPath(targetDir);

  await assertWritableTarget(targetDir, options.force === true);
  const template = options.template ?? "minimal";
  const files = createTemplateFiles({
    packageName,
    dependencySpec: defaultApertureDependencySpec(),
    template,
  });

  for (const file of files) {
    const absolutePath = path.join(targetDir, file.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    if (typeof file.contents === "string") {
      await writeFile(absolutePath, file.contents, "utf8");
    } else {
      await writeFile(absolutePath, file.contents);
    }
  }

  return {
    targetDir,
    packageName,
    template,
    files: files.map((file) => file.path),
  };
}
