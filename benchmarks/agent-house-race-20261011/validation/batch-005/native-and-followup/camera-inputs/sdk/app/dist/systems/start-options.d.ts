export interface StartOptionsSummary {
    readonly count: number;
    readonly values: Readonly<Record<string, unknown>>;
}
export interface StartOptionsAccess {
    has(name: string): boolean;
    get(name: string): unknown;
    string(name: string): string | null;
    number(name: string): number | null;
    boolean(name: string): boolean | null;
    summary(): StartOptionsSummary;
}
export declare function createStartOptionsAccess(options?: Readonly<Record<string, unknown>>): StartOptionsAccess;
export declare function filterSystemStartOptions(options: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
//# sourceMappingURL=start-options.d.ts.map