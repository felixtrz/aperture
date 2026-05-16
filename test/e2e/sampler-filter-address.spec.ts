import { expect, test } from "@playwright/test";

import type { MultiEntityExampleStatus } from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectedDiagnosticCounts,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

type RgbaTuple = readonly [number, number, number, number];

test("ECS browser example applies sampler filter and address settings", async ({
  page,
}) => {
  await page.goto(
    "/examples/multi-entity.html?scenario=sampler-filter-address",
  );
  const status = await waitForExampleStatus<MultiEntityExampleStatus>(page);

  await attachExampleStatus("sampler-filter-address-status", status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "sampler-filter-address",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, textures: 1, samplers: 1, bindGroups: 3 },
    binding: { planned: 1, applied: 1, ready: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    texture: {
      materialKey: "material:sampler-filter-address-unlit",
      textureKey: "texture:sampler-filter-address-strip",
      samplerKey: "sampler:mirror-linear",
    },
    sampler: {
      samplerKey: "sampler:mirror-linear",
      textureKey: "texture:sampler-filter-address-strip",
      addressModeU: "mirror-repeat",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "nearest",
      expectedSampleIds: ["mirror-linear-blend"],
      expectedColor: [0.75, 0, 0.25, 1],
    },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });

  if (status.sampler === undefined || !status.readback?.ok) {
    test.skip(true, "Sampler pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples.find(
    (entry) => entry.id === "mirror-linear-blend",
  );

  expect(
    sample,
    `expected sampler behavior readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (sample === undefined) {
    return;
  }

  expect(
    pixelDistance(sample.pixel, rgbaTupleToPixel(status.sampler.expectedColor)),
    `mirror-repeat plus linear filtering should produce the expected blend; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeLessThan(60);

  for (const rejectedColor of rejectedSamplerColors(status.sampler)) {
    expect(
      pixelDistance(sample.pixel, rgbaTupleToPixel(rejectedColor)),
    ).toBeGreaterThan(60);
  }
});

function rejectedSamplerColors(
  sampler: NonNullable<MultiEntityExampleStatus["sampler"]>,
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
