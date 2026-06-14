import { describe, expect, it } from "vitest";

import {
  audioClipDependencies,
  createAudioClipAsset,
  validateAudioClipAsset,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createAudioClipHandle,
} from "@aperture-engine/simulation";

describe("audio-clip asset", () => {
  it("creates a clip with defaults and validates", () => {
    const asset = createAudioClipAsset({ url: "boom.mp3", durationHint: 1.5 });

    expect(asset.kind).toBe("audio-clip");
    expect(asset.label).toBe("AudioClip");
    expect(asset.streaming).toBe(false);
    expect(asset.channels).toBe(2);
    expect(asset.durationHint).toBeCloseTo(1.5);
    expect(validateAudioClipAsset(asset).valid).toBe(true);
    expect(audioClipDependencies(asset)).toEqual([]);
  });

  it("accepts inline bytes and a streaming flag", () => {
    const asset = createAudioClipAsset({
      bytes: new ArrayBuffer(8),
      streaming: true,
      durationHint: 90,
    });

    expect(asset.streaming).toBe(true);
    expect(asset.bytes?.byteLength).toBe(8);
    expect(validateAudioClipAsset(asset).valid).toBe(true);
  });

  it("flags a negative duration and a missing source", () => {
    const report = validateAudioClipAsset(
      createAudioClipAsset({ durationHint: -1 }),
    );
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.valid).toBe(false);
    expect(codes).toContain("audioClip.invalidDuration");
    expect(codes).toContain("audioClip.missingSource");
  });

  it("flags a non-positive channel count", () => {
    const report = validateAudioClipAsset(
      createAudioClipAsset({ url: "x.ogg", channels: 0 }),
    );

    expect(report.diagnostics.map((d) => d.code)).toContain(
      "audioClip.invalidChannels",
    );
  });

  it("builds a stable handle key", () => {
    expect(assetHandleKey(createAudioClipHandle("boom"))).toBe(
      "audio-clip:boom",
    );
  });
});
