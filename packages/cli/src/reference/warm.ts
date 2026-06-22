import path from "node:path";
import { getApertureReferenceAssetsBaseUrls } from "./assets.js";
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

  if (options.from === "workspace") {
    const report = await buildApertureReferenceIndex({ cwd: root });

    return {
      ...report,
      source: "workspace",
      stateFile: apertureReferenceStateFile(root),
    };
  }

  if (options.from === undefined) {
    return warmFromConfiguredAssets(root);
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

async function warmFromConfiguredAssets(
  root: string,
): Promise<WarmApertureReferenceReport> {
  const errors: string[] = [];

  for (const baseUrl of getApertureReferenceAssetsBaseUrls()) {
    try {
      await warmFromUrl(root, baseUrl);
      const index = await readApertureReferenceIndex(root);

      return warmupReportFromIndex(root, index, "url");
    } catch (error) {
      errors.push(
        `${baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    `Unable to warm Aperture reference assets from configured sources.\n${errors
      .map((error) => `- ${error}`)
      .join(
        "\n",
      )}\nSet APERTURE_REFERENCE_ASSETS_BASE_URL to a hosted dist directory, pass '--from <path-or-url>', or pass '--from workspace' to build from the current source tree.`,
  );
}
