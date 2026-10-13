export interface ApertureConfigHmrModule {
    readonly file: string | null;
    readonly importers: ReadonlySet<ApertureConfigHmrModule>;
}
export declare function refreshApertureConfigTypesForHotUpdate(options: {
    readonly root: string;
    readonly configFile?: string;
    readonly file: string;
    readonly modules: readonly ApertureConfigHmrModule[];
}): Promise<void>;
//# sourceMappingURL=config-type-hmr.d.ts.map