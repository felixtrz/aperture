type GeneratedActionKind = "button" | "axis1d" | "axis2d";
type GeneratedSignalKind = "ref" | "string" | "number" | "boolean";
interface GeneratedActionEntry {
    readonly name: string;
    readonly kind: GeneratedActionKind;
}
interface GeneratedSignalEntry {
    readonly name: string;
    readonly kind: GeneratedSignalKind;
}
export interface ApertureGeneratedTypeEntries {
    readonly actions: readonly GeneratedActionEntry[];
    readonly signals: readonly GeneratedSignalEntry[];
}
export declare function writeApertureGeneratedActionTypes(options: {
    readonly root: string;
    readonly configFile?: string;
}): Promise<string>;
/** Extract action/signal codegen entries from an EVALUATED config object. */
export declare function apertureGeneratedTypeEntriesFromConfig(config: unknown): ApertureGeneratedTypeEntries | null;
export declare function createApertureGeneratedActionTypes(source: string | null, fileName?: string): string;
export declare function renderApertureGeneratedTypes(entries: ApertureGeneratedTypeEntries): string;
export {};
//# sourceMappingURL=generated-action-types.d.ts.map