import path from "node:path";
import { buildApertureReferenceIndex } from "./build.js";
import type {
  WarmApertureReferenceOptions,
  WarmApertureReferenceReport,
} from "./contracts.js";
import { isHttpUrl } from "./files.js";
import { readApertureReferenceIndex } from "./index-io.js";
import { apertureReferenceStateFile } from "./paths.js";
import {
  warmFromDirectory,
  warmFromUrl,
  warmupReportFromIndex,
} from "./payload.js";

export async function warmApertureReferences(
  options: WarmApertureReferenceOptions,
): Promise<WarmApertureReferenceReport> {
  const root = path.resolve(options.cwd);

  if (options.from === undefined || options.from === "workspace") {
    const report = await buildApertureReferenceIndex({ cwd: root });

    return {
      ...report,
      source: "workspace",
      stateFile: apertureReferenceStateFile(root),
    };
  }

  if (isHttpUrl(options.from)) {
    await warmFromUrl(root, options.from);
    const index = await readApertureReferenceIndex(root);

    return warmupReportFromIndex(root, index, "url");
  }

  await warmFromDirectory(root, path.resolve(root, options.from));
  const index = await readApertureReferenceIndex(root);

  return warmupReportFromIndex(root, index, "directory");
}
