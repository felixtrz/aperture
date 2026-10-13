export interface DiscoveredApertureSystem {
    readonly file: string;
    readonly moduleUrl: string;
    readonly hasDefaultExport: boolean;
    readonly schedule: {
        readonly priority: number;
    };
    readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
}
export interface ApertureSystemManifest {
    readonly systems: readonly DiscoveredApertureSystem[];
    readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
}
export interface ApertureVitePluginDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly file?: string;
    readonly glob?: string;
    readonly suggestedFix: string;
}
export declare function createApertureSystemManifest(options: {
    readonly root: string;
    readonly configFile?: string;
    readonly systemGlobs?: readonly string[];
}): Promise<ApertureSystemManifest>;
export declare function parseApertureSystemGlobs(source: string | null): string[];
/** Static config dependencies used consistently by discovery and HMR. */
export declare function readApertureSystemConfigGraph(configFile: string): Promise<{
    readonly globs: readonly string[];
    readonly files: readonly string[];
}>;
export declare function apertureSystemFileMatchesGlobs(root: string, file: string, globs: readonly string[]): boolean;
export declare function apertureSystemGlobBase(root: string, glob: string): string;
//# sourceMappingURL=system-discovery.d.ts.map