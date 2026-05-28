import { promises as fs } from "node:fs";
import path from "node:path";

export function resolveConfigFile(
  root: string,
  configFile: string | undefined,
): string {
  return path.resolve(root, configFile ?? "aperture.config.ts");
}

export async function readOptionalText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export function toModuleUrl(file: string): string {
  return normalizePath(file);
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
