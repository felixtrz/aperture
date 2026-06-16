import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createAudioClipHandle } from "@aperture-engine/simulation";
import type { AudioClipAsset } from "@aperture-engine/render";

describe("app audio asset config", () => {
  it("preloads non-streaming audio clips as encoded audio-clip source assets", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          engine: asset.audio("data:audio/ogg;base64,AQIDBA==", {
            preload: "blocking",
            durationHint: 2.5,
            channels: 1,
          }),
        },
        audio: true,
      }),
    });

    const handle = app.context.assets.audio("engine");
    expect(handle.ready.value).toBe(true);
    expect(handle.renderHandle).toEqual(createAudioClipHandle("engine"));

    const entry = app.context.assetsRegistry.get<"audio-clip", AudioClipAsset>(
      handle.renderHandle,
    );
    expect(entry?.status).toBe("ready");
    expect(entry?.asset?.kind).toBe("audio-clip");
    expect(entry?.asset?.bytes?.byteLength).toBe(4);
    expect(entry?.asset?.durationHint).toBe(2.5);
    expect(entry?.asset?.channels).toBe(1);
    expect(entry?.asset?.streaming).toBe(false);
  });

  it("registers streaming audio clips without fetching encoded bytes", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        assets: {
          music: asset.audio("https://example.test/music.ogg", {
            preload: "blocking",
            streaming: true,
            durationHint: 30,
          }),
        },
      }),
    });

    const handle = app.context.assets.audio("music");
    const entry = app.context.assetsRegistry.get<"audio-clip", AudioClipAsset>(
      handle.renderHandle,
    );

    expect(entry?.status).toBe("ready");
    expect(entry?.asset?.url).toBe("https://example.test/music.ogg");
    expect(entry?.asset?.bytes).toBeUndefined();
    expect(entry?.asset?.streaming).toBe(true);
  });
});
