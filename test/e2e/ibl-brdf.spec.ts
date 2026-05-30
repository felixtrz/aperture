import { expect, test, type Page } from "@playwright/test";

import { pixelDistance } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type IblBrdfMode = "brdf" | "proof";

interface RgbaPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface IblBrdfStatus extends ExampleStatusBase {
  readonly iblMode?: string;
  readonly clearColor?: RgbaPixel;
  readonly extraction?: {
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly diagnostics: number;
  };
  readonly environment?: {
    readonly extracted: number;
    readonly specularPrefiltering?: boolean;
    readonly specularDiagnosticCodes?: readonly string[];
    readonly brdfLut?: {
      readonly ready: boolean;
      readonly bound: boolean;
      readonly size: number;
      readonly format: string;
      readonly diagnosticCodes?: readonly string[];
    };
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
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

interface IblBrdfReadback {
  readonly status: IblBrdfStatus;
  readonly facing: RgbaPixel;
  readonly grazing: RgbaPixel;
}

test("ibl-brdf renders split-sum specular IBL with a measurable horizon term", async ({
  page,
}) => {
  const brdf = await loadIblBrdfReadback(page, "brdf");

  // (Done-when #3) The pipeline selected the iblSpecularBrdf variant, NOT the
  // hand-tuned proof term, once the BRDF LUT is ready.
  expect(brdf.status.pipeline?.key ?? "").toContain("iblSpecularBrdf");
  expect(brdf.status.pipeline?.key ?? "").not.toContain("iblSpecularProof");

  // (Done-when #2) The GPU BRDF integration LUT is built and reported.
  expect(brdf.status.environment?.brdfLut).toMatchObject({
    ready: true,
    bound: true,
    size: 256,
    format: "rg16float",
  });

  // (Done-when #4) Status is JSON-safe and the specular path is real PMREM (no
  // proof-upload placeholder diagnostic on the BRDF path).
  expectStatusJsonSafeForGpu(brdf.status);
  expect(
    brdf.status.environment?.specularDiagnosticCodes ?? ["x"],
  ).not.toContain("iblTextureResource.specularProofUploadPlaceholder");
  expect(brdf.status.environment?.specularPrefiltering).toBe(true);

  // (Done-when #2) The grazing edge is brighter than the facing center: the
  // split-sum B/F90 horizon term is present.
  const brdfDelta = pixelDistance(brdf.grazing, brdf.facing);
  expect(
    brdfDelta,
    `split-sum DFG should brighten the grazing edge vs the facing center; grazing=${JSON.stringify(
      brdf.grazing,
    )} facing=${JSON.stringify(brdf.facing)}`,
  ).toBeGreaterThan(12);

  const proof = await loadIblBrdfReadback(page, "proof");

  expect(proof.status.pipeline?.key ?? "").toContain("iblSpecularProof");
  expect(proof.status.pipeline?.key ?? "").not.toContain("iblSpecularBrdf");

  // The split-sum term renders a measurably different metal than the old proof
  // term at the grazing edge (energy-conserving horizon vs the roughness fudge).
  const grazingModelDelta = pixelDistance(brdf.grazing, proof.grazing);
  expect(
    grazingModelDelta,
    `BRDF and proof should shade the grazing edge differently; brdf=${JSON.stringify(
      brdf.grazing,
    )} proof=${JSON.stringify(proof.grazing)}`,
  ).toBeGreaterThan(6);

  // (Done-when #2) The split-sum horizon delta exceeds the legacy proof delta.
  const proofDelta = pixelDistance(proof.grazing, proof.facing);
  expect(
    brdfDelta,
    `split-sum grazing/facing delta (${brdfDelta}) should exceed the proof delta (${proofDelta})`,
  ).toBeGreaterThanOrEqual(proofDelta);
});

async function loadIblBrdfReadback(
  page: Page,
  mode: IblBrdfMode,
): Promise<IblBrdfReadback> {
  await page.goto(`/examples/ibl-brdf.html?ibl=${mode}`);

  const initialStatus = await waitForExampleStatus<IblBrdfStatus>(page);

  expect(initialStatus, `ibl-brdf ${mode} status should publish`).toBeDefined();

  if (initialStatus === undefined) {
    throw new Error(`ibl-brdf ${mode} status did not publish.`);
  }

  skipIfUnsupportedWebGpu(initialStatus);

  await page.waitForFunction((expected) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: IblBrdfStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    if (
      status?.ok !== true ||
      status.iblMode !== expected ||
      status.readback?.ok !== true
    ) {
      return false;
    }

    const facing = status.readback.samples?.find(
      (candidate) => candidate.id === "facing-probe",
    );
    const grazing = status.readback.samples?.find(
      (candidate) => candidate.id === "grazing-probe",
    );

    if (facing === undefined || grazing === undefined) {
      return false;
    }

    const clear = status.clearColor ?? { r: 4, g: 6, b: 9, a: 255 };
    const clearPixel = {
      r: Math.round(clear.r <= 1 ? clear.r * 255 : clear.r),
      g: Math.round(clear.g <= 1 ? clear.g * 255 : clear.g),
      b: Math.round(clear.b <= 1 ? clear.b * 255 : clear.b),
      a: 255,
    };

    // Both probes must land on the lit sphere, not the cleared background.
    const onSphere = (pixel: { r: number; g: number; b: number; a: number }) =>
      Math.hypot(
        pixel.r - clearPixel.r,
        pixel.g - clearPixel.g,
        pixel.b - clearPixel.b,
      ) > 24;

    return onSphere(facing.pixel) && onSphere(grazing.pixel);
  }, mode);

  const status = await waitForExampleStatus<IblBrdfStatus>(page);

  if (status === undefined) {
    throw new Error(`ibl-brdf ${mode} status disappeared.`);
  }

  await attachExampleStatus(`ibl-brdf-${mode}`, status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ibl-brdf",
    ok: true,
    iblMode: mode,
    extraction: { meshDraws: 1, environments: 1, diagnostics: 0 },
  });

  const facing = findSample(status, "facing-probe");
  const grazing = findSample(status, "grazing-probe");

  return { status, facing, grazing };
}

function findSample(status: IblBrdfStatus, id: string): RgbaPixel {
  const sample = status.readback?.samples?.find(
    (candidate) => candidate.id === id,
  );

  if (sample === undefined) {
    throw new Error(`ibl-brdf status is missing the ${id} readback sample.`);
  }

  return sample.pixel;
}
