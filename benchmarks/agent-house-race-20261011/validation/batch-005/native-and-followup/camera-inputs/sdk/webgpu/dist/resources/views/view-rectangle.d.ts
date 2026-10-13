export type NormalizedViewRectangleDiagnosticCode = "viewRectangle.invalidTargetSize" | "viewRectangle.invalidRect" | "viewRectangle.emptyRect";
export interface NormalizedViewRectangleDiagnostic {
    readonly code: NormalizedViewRectangleDiagnosticCode;
    readonly message: string;
    readonly label?: string;
}
export interface NormalizedViewRectangleTarget {
    readonly width: number;
    readonly height: number;
}
export interface ResolvedViewRectangle {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface ResolveNormalizedViewRectangleOptions {
    readonly rect: ArrayLike<number>;
    readonly target: NormalizedViewRectangleTarget;
    readonly label?: string;
}
export interface ResolveNormalizedViewRectangleResult {
    readonly valid: boolean;
    readonly rect: ResolvedViewRectangle | null;
    readonly diagnostics: readonly NormalizedViewRectangleDiagnostic[];
}
export declare function resolveNormalizedViewRectangle(options: ResolveNormalizedViewRectangleOptions): ResolveNormalizedViewRectangleResult;
//# sourceMappingURL=view-rectangle.d.ts.map