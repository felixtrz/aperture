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
/**
 * Write through a same-directory temp file and rename into place. Consumers
 * poll these outputs (editors watching generated types, tooling reading
 * session.json), and a plain writeFile lets a reader observe an empty or
 * half-written file between open and flush; rename is atomic on POSIX and
 * NTFS, so readers only ever see the previous or the complete content.
 */
export async function writeFileAtomic(file, contents) {
    const tempFile = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Math.random()
        .toString(36)
        .slice(2)}.tmp`);
    await fs.writeFile(tempFile, contents, "utf8");
    try {
        await fs.rename(tempFile, file);
    }
    catch (error) {
        await fs.rm(tempFile, { force: true });
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