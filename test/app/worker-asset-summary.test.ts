import { signal } from "@preact/signals-core";
import { describe, expect, it } from "vitest";
import { asset } from "@aperture-engine/app/config";
import type { SystemParticleEffectAssetHandle } from "@aperture-engine/app/systems";
import { createParticleEffectHandle } from "@aperture-engine/simulation";
import type { ParticleEffectRuntimeFeatureReport } from "@aperture-engine/render";

import { createAssetSummary } from "../../packages/app/src/worker/assets.js";

describe("worker asset summary", () => {
  it("caches particle runtime feature analysis until the descriptor changes", () => {
    const firstDescriptor = asset.particleEffect({
      capacity: 64,
      emissionRate: 0,
    });
    const secondDescriptor = asset.particleEffect({
      capacity: 64,
      duration: 2,
      emissionRate: 0,
    });
    const handle = {
      id: "smoke",
      kind: "particle-effect",
      preload: "manual",
      ready: signal(false),
      error: signal(null),
      renderHandle: createParticleEffectHandle("smoke"),
      descriptor: firstDescriptor,
    } satisfies SystemParticleEffectAssetHandle;

    const firstRuntimeFeatures = particleRuntimeFeatures(
      createAssetSummary([handle]),
    );
    const secondRuntimeFeatures = particleRuntimeFeatures(
      createAssetSummary([handle]),
    );
    expect(secondRuntimeFeatures).toBe(firstRuntimeFeatures);

    (
      handle as {
        descriptor: SystemParticleEffectAssetHandle["descriptor"];
      }
    ).descriptor = secondDescriptor;

    const refreshedRuntimeFeatures = particleRuntimeFeatures(
      createAssetSummary([handle]),
    );
    expect(refreshedRuntimeFeatures).not.toBe(firstRuntimeFeatures);
    expect(refreshedRuntimeFeatures.unsupportedFields).toContain("duration");
  });
});

function particleRuntimeFeatures(
  summaries: readonly Record<string, unknown>[],
): ParticleEffectRuntimeFeatureReport {
  const [summary] = summaries;
  expect(summary).toBeDefined();

  const runtimeFeatures = summary?.runtimeFeatures;
  expect(runtimeFeatures).toBeDefined();

  return runtimeFeatures as ParticleEffectRuntimeFeatureReport;
}
