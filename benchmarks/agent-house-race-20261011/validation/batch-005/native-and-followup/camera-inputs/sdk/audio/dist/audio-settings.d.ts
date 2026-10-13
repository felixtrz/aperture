import { type AudioBusId } from "./mixer.js";
/** Minimal storage seam (localStorage-compatible) for volume persistence. */
export interface AudioSettingsStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
/**
 * Main→worker volume command. The app posts this INTO the worker so the
 * authoritative (deterministic) signal updates; the engine realizes it main-side
 * — keeping authored mixer state in the record/replay stream (Inv-6).
 */
export type AudioSettingsCommand = {
    readonly type: "set-master-volume";
    readonly value: number;
} | {
    readonly type: "set-bus-volume";
    readonly bus: AudioBusId;
    readonly value: number;
};
/** The slice of the engine the settings layer drives (click-free ramps). */
export interface AudioSettingsTarget {
    setMasterGain(value: number, rampSec?: number): void;
    setBusGain(bus: AudioBusId, value: number, rampSec?: number): void;
}
export interface AudioSettingsOptions {
    readonly engine: AudioSettingsTarget;
    /** Defaults to `globalThis.localStorage` when available, else no persistence. */
    readonly storage?: AudioSettingsStorage;
    readonly storageKey?: string;
    readonly rampSec?: number;
    /** Forward the change as a command into the worker (deterministic signal). */
    readonly postCommand?: (command: AudioSettingsCommand) => void;
}
export interface AudioSettings {
    readonly masterVolume: number;
    busVolume(bus: AudioBusId): number;
    setMasterVolume(value: number): void;
    setBusVolume(bus: AudioBusId, value: number): void;
}
export declare function createAudioSettings(options: AudioSettingsOptions): AudioSettings;
//# sourceMappingURL=audio-settings.d.ts.map