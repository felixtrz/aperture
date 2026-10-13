import type { SystemDiagnostics } from "./diagnostics.js";
export type ApertureDeterminismDiagnosticsMode = "off" | "warn" | "error";
export interface ApertureDeterminismDiagnosticsOptions {
    readonly globals?: ApertureDeterminismDiagnosticsMode;
}
export type ApertureDeterminismRunPhase = "init" | "update" | "fixedUpdate" | "effect:input" | "effect:update" | "effect:postUpdate";
export interface ApertureDeterminismRunInput {
    readonly system: string;
    readonly phase: ApertureDeterminismRunPhase;
}
export interface ApertureDeterminismDiagnostics {
    run<T>(input: ApertureDeterminismRunInput, callback: () => T): T;
}
export declare function createApertureDeterminismDiagnostics(options: {
    readonly diagnostics: SystemDiagnostics;
    readonly mode?: ApertureDeterminismDiagnosticsMode;
}): ApertureDeterminismDiagnostics;
//# sourceMappingURL=determinism.d.ts.map