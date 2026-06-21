import { promises as fs } from "node:fs";
import path from "node:path";
export function resolveConfigFile(root, configFile) {
    return path.resolve(root, configFile ?? "aperture.config.ts");
}
export async function readOptionalText(file) {
    try {
        return await fs.readFile(file, "utf8");
    }
    catch (error) {
        if (typeof error === "object" &&
            error !== null &&
            error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
export function toModuleUrl(file) {
    return normalizePath(file);
}
export function normalizePath(value) {
    return value.replace(/\\/g, "/");
}
//# sourceMappingURL=file-utils.js.map