import { AUDIO_BUS_IDS } from "./mixer.js";
const DEFAULT_KEY = "aperture.audio.settings";
const DEFAULT_RAMP_SEC = 0.05;
export function createAudioSettings(options) {
    const storage = options.storage ?? defaultStorage();
    const key = options.storageKey ?? DEFAULT_KEY;
    const rampSec = options.rampSec ?? DEFAULT_RAMP_SEC;
    const engine = options.engine;
    const loaded = load(storage, key);
    let master = clamp01(loaded?.master ?? 1);
    const buses = new Map();
    for (const bus of AUDIO_BUS_IDS) {
        buses.set(bus, clamp01(loaded?.buses[bus] ?? 1));
    }
    // Apply persisted volumes to the engine immediately (click-free).
    engine.setMasterGain(master, rampSec);
    for (const bus of AUDIO_BUS_IDS) {
        engine.setBusGain(bus, buses.get(bus) ?? 1, rampSec);
    }
    function persist() {
        if (storage === undefined) {
            return;
        }
        const data = {
            master,
            buses: Object.fromEntries(buses),
        };
        try {
            storage.setItem(key, JSON.stringify(data));
        }
        catch {
            // Storage full / unavailable — settings still apply for this session.
        }
    }
    return {
        get masterVolume() {
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
function load(storage, key) {
    if (storage === undefined) {
        return null;
    }
    try {
        const raw = storage.getItem(key);
        if (raw === null) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return {
            master: typeof parsed.master === "number" ? parsed.master : 1,
            buses: parsed.buses !== null && typeof parsed.buses === "object"
                ? parsed.buses
                : {},
        };
    }
    catch {
        return null;
    }
}
function defaultStorage() {
    const candidate = globalThis
        .localStorage;
    return candidate ?? undefined;
}
function clamp01(value) {
    if (!Number.isFinite(value) || value < 0) {
        return value < 0 ? 0 : 1;
    }
    return value > 1 ? 1 : value;
}
//# sourceMappingURL=audio-settings.js.map