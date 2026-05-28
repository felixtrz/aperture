import { stat } from "node:fs/promises";
import path from "node:path";
import { ApertureDevSessionError, VITE_CONFIG_FILE } from "./types.js";
import { isNodeErrorCode } from "./process.js";

export async function assertApertureDevAppRoot(appRoot: string): Promise<void> {
  const configPath = path.join(appRoot, VITE_CONFIG_FILE);

  try {
    const configStat = await stat(configPath);

    if (configStat.isFile()) {
      return;
    }
  } catch (error: unknown) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  throw new ApertureDevSessionError(
    "aperture.dev.invalidAppRoot",
    `Expected an Aperture app root with ${VITE_CONFIG_FILE} at ${configPath}. Run this command from a generated Aperture app or pass the app root as the working directory.`,
  );
}
