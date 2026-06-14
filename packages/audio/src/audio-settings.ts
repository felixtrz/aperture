import { AUDIO_BUS_IDS, type AudioBusId } from "./mixer.js";

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
export type AudioSettingsCommand =
  | { readonly type: "set-master-volume"; readonly value: number }
  | {
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

const DEFAULT_KEY = "aperture.audio.settings";
const DEFAULT_RAMP_SEC = 0.05;

interface PersistedSettings {
  readonly master: number;
  readonly buses: Partial<Record<AudioBusId, number>>;
}

export function createAudioSettings(
  options: AudioSettingsOptions,
): AudioSettings {
  const storage = options.storage ?? defaultStorage();
  const key = options.storageKey ?? DEFAULT_KEY;
  const rampSec = options.rampSec ?? DEFAULT_RAMP_SEC;
  const engine = options.engine;

  const loaded = load(storage, key);
  let master = clamp01(loaded?.master ?? 1);
  const buses = new Map<AudioBusId, number>();
  for (const bus of AUDIO_BUS_IDS) {
    buses.set(bus, clamp01(loaded?.buses[bus] ?? 1));
  }

  // Apply persisted volumes to the engine immediately (click-free).
  engine.setMasterGain(master, rampSec);
  for (const bus of AUDIO_BUS_IDS) {
    engine.setBusGain(bus, buses.get(bus) ?? 1, rampSec);
  }

  function persist(): void {
    if (storage === undefined) {
      return;
    }
    const data: PersistedSettings = {
      master,
      buses: Object.fromEntries(buses) as Partial<Record<AudioBusId, number>>,
    };
    try {
      storage.setItem(key, JSON.stringify(data));
    } catch {
      // Storage full / unavailable — settings still apply for this session.
    }
  }

  return {
    get masterVolume(): number {
      return master;
    },
    busVolume(bus) {
      return buses.get(bus) ?? 1;
    },
    setMasterVolume(value) {
      master = clamp01(value);
      engine.setMasterGain(master, rampSec);
      persist();
      options.postCommand?.({ type: "set-master-volume", value: master });
    },
    setBusVolume(bus, value) {
      const v = clamp01(value);
      buses.set(bus, v);
      engine.setBusGain(bus, v, rampSec);
      persist();
      options.postCommand?.({ type: "set-bus-volume", bus, value: v });
    },
  };
}

function load(
  storage: AudioSettingsStorage | undefined,
  key: string,
): PersistedSettings | null {
  if (storage === undefined) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    return {
      master: typeof parsed.master === "number" ? parsed.master : 1,
      buses:
        parsed.buses !== null && typeof parsed.buses === "object"
          ? parsed.buses
          : {},
    };
  } catch {
    return null;
  }
}

function defaultStorage(): AudioSettingsStorage | undefined {
  const candidate = (globalThis as { localStorage?: AudioSettingsStorage })
    .localStorage;
  return candidate ?? undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return value < 0 ? 0 : 1;
  }
  return value > 1 ? 1 : value;
}
