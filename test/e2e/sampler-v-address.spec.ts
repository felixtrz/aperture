import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

type RgbaTuple = readonly [number, number, number, number];

test("ECS browser example applies vertical sampler address settings", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "sampler-v-address",
    "sampler-v-address-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "sampler-v-address",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, textures: 1, samplers: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    texture: {
      materialKey: "material:sampler-v-address-unlit",
      textureKey: "texture:sampler-v-address-strip",
      samplerKey: "sampler:mirror-v-linear",
    },
    samplerVAddress: {
      samplerKey: "sampler:mirror-v-linear",
      textureKey: "texture:sampler-v-address-strip",
      addressModeU: "clamp-to-edge",
      addressModeV: "mirror-repeat",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      expectedSampleIds: ["mirror-v-linear-blend"],
      expectedColor: [0.75, 0, 0.25, 1],
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });

  if (status.samplerVAddress === undefined || !status.readback?.ok) {
    test.skip(
      true,
      "Vertical sampler address pixel assertion requires readback.",
    );
    return;
  }

  const sample = status.readback.samples.find(
    (entry) => entry.id === "mirror-v-linear-blend",
  );

  expect(
    sample,
    `expected vertical sampler readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (sample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaTupleToPixel(status.samplerVAddress.expectedColor),
    ),
    `mirror-repeat V plus linear filtering should produce the expected blend; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(60);

  for (const rejectedColor of rejectedSamplerColors(status.samplerVAddress)) {
    expect(
      pixelDistance(sample.pixel, rgbaTupleToPixel(rejectedColor)),
    ).toBeGreaterThan(60);
  }
});

function rejectedSamplerColors(
  sampler: NonNullable<MultiEntityExampleStatus["samplerVAddress"]>,
): readonly RgbaTuple[] {
  return [
    sampler.rejectedColors?.nearestMirror,
    sampler.rejectedColors?.repeatLinear,
    sampler.rejectedColors?.clamp,
  ].filter((color): color is RgbaTuple => color !== undefined);
}

function rgbaTupleToPixel(
  color: RgbaTuple,
): ReturnType<typeof rgbaColorToPixel> {
  return rgbaColorToPixel({
    r: color[0],
    g: color[1],
    b: color[2],
    a: color[3],
  });
}
