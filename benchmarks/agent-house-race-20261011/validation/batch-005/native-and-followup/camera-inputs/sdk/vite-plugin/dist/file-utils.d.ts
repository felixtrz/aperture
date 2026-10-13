export declare function resolveConfigFile(root: string, configFile: string | undefined): string;
export declare function readOptionalText(file: string): Promise<string | null>;
/**
 * Write through a same-directory temp file and rename into place. Consumers
 * poll these outputs (editors watching generated types, tooling reading
 * session.json), and a plain writeFile lets a reader observe an empty or
 * half-written file between open and flush; rename is atomic on POSIX and
 * NTFS, so readers only ever see the previous or the complete content.
 */
export declare function writeFileAtomic(file: string, contents: string): Promise<void>;
export declare function toModuleUrl(file: string): string;
export declare function normalizePath(value: string): string;
//# sourceMappingURL=file-utils.d.ts.map