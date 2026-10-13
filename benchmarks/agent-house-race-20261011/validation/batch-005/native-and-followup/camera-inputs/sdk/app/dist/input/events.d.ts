import type { ApertureConfig } from "../config.js";
import { type ApertureGeneratedInputEvent, type ApertureInputSummary, type InputResourceBase } from "./state.js";
declare const APERTURE_GENERATED_INPUT_EVENT: "aperture.generated.inputEvent";
export type { ApertureGeneratedInputEvent, ApertureInputSummary };
export interface ApertureGeneratedInputEventMessage {
    readonly type: typeof APERTURE_GENERATED_INPUT_EVENT;
    readonly event: ApertureGeneratedInputEvent;
    /**
     * Simulation frame the event applies to (AI-56 frame-stamping half).
     * Live browser forwarding leaves it unset — the event applies to the next
     * stepped frame, exactly as before. Replay/recording producers stamp it so
     * the worker drains the identical event sequence at the identical frames.
     */
    readonly frame?: number;
}
export declare function createGeneratedInputEventMessage(event: ApertureGeneratedInputEvent, frame?: number): ApertureGeneratedInputEventMessage;
export declare function isGeneratedInputEventMessage(value: unknown): value is ApertureGeneratedInputEventMessage;
/**
 * Deterministic per-frame drain: removes and returns (in arrival order) the
 * queued events that apply to `frame` — unstamped live events plus events
 * stamped with `frame <= current`. Future-stamped events stay queued so a
 * replay applies each event at exactly its recorded frame.
 */
export declare function drainGeneratedInputEventMessagesForFrame(pending: ApertureGeneratedInputEventMessage[], frame: number): ApertureGeneratedInputEvent[];
export declare function applyGeneratedInputEvent(input: {
    readonly signals: InputResourceBase;
    readonly config: ApertureConfig;
    readonly event: ApertureGeneratedInputEvent;
}): void;
export declare function advanceGeneratedInputFrame(input: {
    readonly signals: InputResourceBase;
    readonly config: ApertureConfig;
    readonly events?: readonly ApertureGeneratedInputEvent[];
}): void;
export declare function createInputSummary(input: InputResourceBase): ApertureInputSummary;
//# sourceMappingURL=events.d.ts.map