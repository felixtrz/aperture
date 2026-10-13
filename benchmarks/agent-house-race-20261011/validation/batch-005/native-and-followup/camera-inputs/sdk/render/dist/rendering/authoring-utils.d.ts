import type { RenderAuthoringDiagnostic, SpriteInput } from "./authoring-types.js";
export declare function validateRect(rect: readonly [number, number, number, number], field: string, diagnostics: RenderAuthoringDiagnostic[]): void;
export declare function tuple4(x: number, y: number, z: number, w: number): [number, number, number, number];
export declare function tuple3(x: number, y: number, z: number): [number, number, number];
export declare function tuple2(x: number, y: number): [number, number];
export declare function spriteSize(size: SpriteInput["size"]): readonly [number, number];
//# sourceMappingURL=authoring-utils.d.ts.map