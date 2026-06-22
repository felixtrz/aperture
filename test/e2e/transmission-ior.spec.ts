import { expect, test, type Page } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface TransmissionIorStatus extends ExampleStatusBase {
  readonly config?: {
    readonly ior?: number;
    readonly thickness?: number;
    readonly attenuation?: string;
    readonly attenuationColor?: readonly number[];
    readonly attenuationDistance?: number;
    readonly background?: string;
  };
  readonly material?: {
    readonly transmission?: {
      readonly transmissionFactor: number;
      readonly ior: number;
      readonly thickness: number;
      readonly attenuationColor: readonly number[];
      readonly attenuationDistance: number;
    };
  };
  readonly pipeline?: { readonly key: string | null };
  readonly extraction?: {
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

interface TransmissionIorReadback {
  readonly status: TransmissionIorStatus;
  readonly center: RgbaPixel;
  readonly offset: RgbaPixel;
  readonly background: RgbaPixel;
}

test("transmission-ior refracts the background by IOR and absorbs by thickness", async ({
  page,
}) => {
  const ior10 = await loadTransmissionIor(page, "ior=1.0&thickness=1.6");
  const ior15 = await loadTransmissionIor(page, "ior=1.5&thickness=1.6");
  const ior20 = await loadTransmissionIor(page, "ior=2.0&thickness=1.6");

  // (Done-when #3) Status surfaces the parsed volume parameters.
  expect(ior20.status.material?.transmission).toMatchObject({
    transmissionFactor: 1,
    ior: 2,
    thickness: 1.6,
    attenuationColor: [1, 1, 1],
    attenuationDistance: 0,
  });
  expect(ior20.status.pipeline?.key ?? "").toContain("transmission");

  // (Done-when #1) IOR bends the refracted ray, so the off-center probe behind
  // the glass shifts across the striped background. ior=1 (no bend) vs ior=2
  // differs strongly, and the shift grows with IOR.
  const shift10to20 = pixelDistance(ior10.offset, ior20.offset);
  const shift10to15 = pixelDistance(ior10.offset, ior15.offset);

  expect(
    shift10to20,
    `ior=1.0 vs 2.0 through-glass offset should shift; 1.0=${json(ior10.offset)} 2.0=${json(ior20.offset)}`,
  ).toBeGreaterThan(30);
  expect(
    shift10to20,
    `ior shift should grow with IOR; 1.0->1.5=${shift10to15} 1.0->2.0=${shift10to20}`,
  ).toBeGreaterThan(shift10to15 + 8);

  // (Done-when #2) Beer-Lambert: amber volume over a white wall, ior=1 (no
  // refraction shift). thickness=0 => no absorption (~white); thick => the
  // transmitted light is absorbed in blue/green and warms toward the
  // attenuation passband.
  const thin = await loadTransmissionIor(
    page,
    "bg=white&ior=1&attenuation=amber&thickness=0",
  );
  const thick = await loadTransmissionIor(
    page,
    "bg=white&ior=1&attenuation=amber&thickness=3&attenuationDistance=1",
  );

  expect(
    pixelDistance(thin.center, thick.center),
    `thin vs thick amber center should differ; thin=${json(thin.center)} thick=${json(thick.center)}`,
  ).toBeGreaterThan(40);
  expect(
    thin.center.b - thick.center.b,
    `thick amber volume should absorb blue; thin.b=${thin.center.b} thick.b=${thick.center.b}`,
  ).toBeGreaterThan(30);
  expect(
    thick.center.r - thick.center.b - (thin.center.r - thin.center.b),
    `thick amber should warm (r-b) more than thin; thin=${json(thin.center)} thick=${json(thick.center)}`,
  ).toBeGreaterThan(25);
});

async function loadTransmissionIor(
  page: Page,
  query: string,
): Promise<TransmissionIorReadback> {
  await page.goto(`/examples/transmission-ior.html?${query}`);

  const initialStatus = await waitForExampleStatus<TransmissionIorStatus>(page);

  expect(
    initialStatus,
    `transmission-ior ${query} status publishes`,
  ).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error(`transmission-ior ${query} status did not publish.`);
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction(() => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: TransmissionIorStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    if (status?.ok !== true || status.readback?.ok !== true) {
      return false;
    }

    const ids = ["through-center", "through-offset", "background"];

    return ids.every((id) =>
      status.readback?.samples?.some((sample) => sample.id === id),
    );
  });

  const status = await waitForExampleStatus<TransmissionIorStatus>(page);

  if (status === undefined) {
    throw new Error(`transmission-ior ${query} status disappeared.`);
  }

  await attachExampleStatus(`transmission-ior-${query}`, status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "transmission-ior",
    ok: true,
    extraction: { diagnostics: 0 },
  });

  return {
    status,
    center: findSample(status, "through-center"),
    offset: findSample(status, "through-offset"),
    background: findSample(status, "background"),
  };
}

function findSample(status: TransmissionIorStatus, id: string): RgbaPixel {
  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === id,
  );

  if (sample === undefined) {
    throw new Error(`transmission-ior status is missing the ${id} sample.`);
  }

  return sample.pixel;
}

function json(pixel: RgbaPixel): string {
  return JSON.stringify(pixel);
}
