import type { GlbContainerDiagnostic, GlbContainerDiagnosticInput } from "./glb-container-types.js";
export declare function createErrorDiagnostic(input: Omit<GlbContainerDiagnosticInput, "severity">): GlbContainerDiagnostic;
export declare function createWarningDiagnostic(input: Omit<GlbContainerDiagnosticInput, "severity">): GlbContainerDiagnostic;
export declare function hasErrorDiagnostics(diagnostics: readonly GlbContainerDiagnostic[]): boolean;
//# sourceMappingURL=glb-container-diagnostics.d.ts.map