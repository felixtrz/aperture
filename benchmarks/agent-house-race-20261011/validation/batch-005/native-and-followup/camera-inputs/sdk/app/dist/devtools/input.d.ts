import type { ApertureApp } from "../advanced.js";
import { type ApertureGeneratedInputEvent } from "../input.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";
export declare function callInputDevtoolsTool(app: ApertureApp, tool: string, payload: unknown, options?: {
    readonly enqueueInputEvent?: (event: ApertureGeneratedInputEvent) => void;
}): GeneratedDevtoolsToolResult | null;
//# sourceMappingURL=input.d.ts.map