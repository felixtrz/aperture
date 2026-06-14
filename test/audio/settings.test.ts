import { describe, expect, it } from "vitest";

import {
  createAudioSettings,
  type AudioSettingsCommand,
  type AudioSettingsStorage,
  type AudioSettingsTarget,
} from "@aperture-engine/audio";

function memoryStorage(
  seed: Record<string, string> = {},
): AudioSettingsStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function recordingEngine() {
  const master: number[] = [];
  const buses: Array<[string, number]> = [];
  const engine: AudioSettingsTarget = {
    setMasterGain: (v) => master.push(v),
    setBusGain: (bus, v) => buses.push([bus, v]),
  };
  return { engine, master, buses };
}

describe("audio settings + persistence (AU-15)", () => {
  it("applies a master volume change, persists it, and posts a worker command", () => {
    const storage = memoryStorage();
    const { engine, master } = recordingEngine();
    const commands: AudioSettingsCommand[] = [];
    const settings = createAudioSettings({
      engine,
      storage,
      postCommand: (c) => commands.push(c),
    });

    settings.setMasterVolume(0.4);

    expect(settings.masterVolume).toBeCloseTo(0.4);
    expect(master.at(-1)).toBeCloseTo(0.4); // applied click-free to the engine
    expect(commands).toContainEqual({ type: "set-master-volume", value: 0.4 });
    // Persisted.
    const raw = storage.getItem("aperture.audio.settings");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}").master).toBeCloseTo(0.4);
  });

  it("posts a set-bus-volume command and persists per-bus", () => {
    const storage = memoryStorage();
    const { engine, buses } = recordingEngine();
    const commands: AudioSettingsCommand[] = [];
    const settings = createAudioSettings({
      engine,
      storage,
      postCommand: (c) => commands.push(c),
    });

    settings.setBusVolume("music", 0.25);

    expect(settings.busVolume("music")).toBeCloseTo(0.25);
    expect(buses.at(-1)).toEqual(["music", 0.25]);
    expect(commands).toContainEqual({
      type: "set-bus-volume",
      bus: "music",
      value: 0.25,
    });
  });

  it("restores persisted volumes across a reload", () => {
    const storage = memoryStorage({
      "aperture.audio.settings": JSON.stringify({
        master: 0.5,
        buses: { sfx: 0.3 },
      }),
    });
    const { engine, master, buses } = recordingEngine();

    const settings = createAudioSettings({ engine, storage });

    expect(settings.masterVolume).toBeCloseTo(0.5);
    expect(settings.busVolume("sfx")).toBeCloseTo(0.3);
    // Applied to the engine on construction.
    expect(master.at(-1)).toBeCloseTo(0.5);
    expect(buses).toContainEqual(["sfx", 0.3]);
  });

  it("clamps volumes to [0,1]", () => {
    const { engine } = recordingEngine();
    const settings = createAudioSettings({ engine, storage: memoryStorage() });
    settings.setMasterVolume(5);
    expect(settings.masterVolume).toBe(1);
    settings.setMasterVolume(-1);
    expect(settings.masterVolume).toBe(0);
  });
});
