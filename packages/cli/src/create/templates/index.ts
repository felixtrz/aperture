import { adapterTemplateFiles } from "../../adapter-templates.js";
import { packageJsonFile } from "../package-json.js";
import type { ApertureCreateTemplate, TemplateFile } from "../types.js";
import { gameTemplateFiles } from "./game.js";
import { glbViewerTemplateFiles } from "./glb-viewer.js";
import { minimalTemplateFiles } from "./minimal.js";
import { sharedTemplateFiles } from "./shared.js";

export function createTemplateFiles(input: {
  readonly packageName: string;
  readonly dependencySpec: string;
  readonly template: ApertureCreateTemplate;
}): readonly TemplateFile[] {
  return [
    packageJsonFile(input),
    ...sharedTemplateFiles(),
    ...createAppTemplateFiles(input.template),
    ...adapterTemplateFiles(),
  ];
}

function createAppTemplateFiles(
  template: ApertureCreateTemplate,
): readonly TemplateFile[] {
  if (template === "glb-viewer") {
    return glbViewerTemplateFiles();
  }

  if (template === "game") {
    return gameTemplateFiles();
  }

  return minimalTemplateFiles();
}
