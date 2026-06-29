import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createParticleEffectHandle,
} from "@aperture-engine/simulation";
import {
  createParticleBurstQueue,
  createParticleEffectAsset,
  type RenderDiagnostic,
} from "@aperture-engine/render";

describe("particle burst queue", () => {
  it("scales burst lifetime by request timeScale", () => {
    const assets = new AssetRegistry();
    const effect = createParticleEffectHandle("scaled-burst");
    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        main: {
          startLifetime: { min: 1, max: 1 },
        },
      }),
    );
    const diagnostics: RenderDiagnostic[] = [];
    const queue = createParticleBurstQueue();

    queue.enqueue({
      effect,
      count: 1,
      position: [0, 0, 0],
      timeScale: 0.5,
    });

    const slowBursts = queue.drain({ frame: 0, time: 0, assets, diagnostics });
    expect(slowBursts).toHaveLength(1);
    expect(slowBursts[0]?.ttlSeconds).toBeCloseTo(2 + 2 / 60, 6);

    expect(
      queue.drain({ frame: 122, time: 2 + 2 / 60, assets, diagnostics }),
    ).toHaveLength(1);
    expect(
      queue.drain({ frame: 123, time: 2.04, assets, diagnostics }),
    ).toHaveLength(0);

    queue.enqueue({
      effect,
      count: 1,
      position: [0, 0, 0],
      timeScale: 2,
    });

    const fastBursts = queue.drain({
      frame: 200,
      time: 10,
      assets,
      diagnostics,
    });
    expect(fastBursts).toHaveLength(1);
    expect(fastBursts[0]?.ttlSeconds).toBeCloseTo(0.5 + 2 / 60, 6);
    expect(
      queue.drain({ frame: 232, time: 10.5 + 2 / 60, assets, diagnostics }),
    ).toHaveLength(1);
    expect(
      queue.drain({ frame: 233, time: 10.54, assets, diagnostics }),
    ).toHaveLength(0);
    expect(diagnostics).toEqual([]);
  });
});
