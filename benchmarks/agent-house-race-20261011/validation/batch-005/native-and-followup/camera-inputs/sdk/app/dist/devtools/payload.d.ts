export { jsonSafeValue } from "../internal/json-safe.js";
export declare function tuple3FromValue(value: unknown): readonly [number, number, number] | null;
export declare function tuple4FromValue(value: unknown): readonly [number, number, number, number] | null;
export declare function tuple3FromView(view: ArrayLike<number>): readonly [number, number, number];
export declare function tuple4FromView(view: ArrayLike<number>): readonly [number, number, number, number];
export declare function jsonSafeRecord(value: unknown): Readonly<Record<string, unknown>>;
export declare function degreesToRadians(degrees: number): number;
export declare function stringFromValue(value: unknown): string | undefined;
export declare function stringArrayFromValue(value: unknown): readonly string[] | undefined;
export declare function standardGamepadButtonIndex(button: string): number | null;
export declare function gamepadAxesFromPayload(record: Record<string, unknown>): readonly number[];
export declare function numberFromValue(value: unknown): number | undefined;
export declare function booleanFromValue(value: unknown): boolean | undefined;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
//# sourceMappingURL=payload.d.ts.map