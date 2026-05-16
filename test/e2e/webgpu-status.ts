import { expect, test, type Page } from "@playwright/test";

import type {
  ExampleStatusBase,
  MultiEntityExampleStatus,
} from "./example-status-types.js";

type ExampleGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

type CountStatusSection = Readonly<Record<string, unknown>>;

interface NoDrawSubmissionStatus {
  readonly draw?: CountStatusSection;
  readonly command?: CountStatusSection;
  readonly submission?: CountStatusSection;
}

interface DiagnosticCountSummary {
  readonly extraction: number;
  readonly resources: number;
  readonly binding: number;
  readonly draw: number;
  readonly submission: number;
  readonly readback: number;
}

interface MultiEntityRouteFailureExpectation {
  readonly scenario: string;
  readonly phase: string;
  readonly reason: string;
  readonly diagnosticCounts?: Partial<DiagnosticCountSummary>;
  readonly expectRenderingBackend?: boolean;
  readonly matchObject?: Readonly<Record<string, unknown>>;
}

const unsupportedWebGpuReasons = new Set<string>([
  "navigator-gpu-unavailable",
  "adapter-unavailable",
  "device-request-failed",
  "context-unavailable",
  "device-lost",
]);

const rawGpuStatusJsonPattern =
  /\b(?:GPU[A-Z][A-Za-z0-9]*|create(?:Texture(?:View)?|Sampler|Buffer|BindGroup|CommandEncoder|RenderPipeline|ShaderModule|PipelineLayout)|request(?:Adapter|Device))\b/u;

export async function waitForExampleStatus<T>(
  page: Page,
): Promise<T | undefined> {
  await page.waitForFunction(
    () =>
      (globalThis as ExampleGlobal).__APERTURE_EXAMPLE_STATUS__ !== undefined,
  );

  return page.evaluate(
    () => (globalThis as ExampleGlobal).__APERTURE_EXAMPLE_STATUS__ as T,
  );
}

export async function attachExampleStatus(
  name: string,
  status: unknown,
): Promise<void> {
  await test.info().attach(name, {
    body: JSON.stringify(status ?? null, null, 2),
    contentType: "application/json",
  });
}

export async function loadExampleStatus<T extends ExampleStatusBase>(
  page: Page,
  url: string,
  attachmentName: string,
): Promise<T | undefined> {
  await page.goto(url);
  const status = await waitForExampleStatus<T>(page);

  await attachExampleStatus(attachmentName, status);

  expect(status, "example status should be published").toBeDefined();

  if (status === undefined) {
    return undefined;
  }

  skipIfUnsupportedWebGpu(status);

  return status;
}

export async function loadMultiEntityScenarioStatus(
  page: Page,
  scenario: string | undefined,
  attachmentName = scenario === undefined
    ? "multi-entity-status"
    : `${scenario}-status`,
): Promise<MultiEntityExampleStatus | undefined> {
  return loadExampleStatus<MultiEntityExampleStatus>(
    page,
    scenario === undefined
      ? "/examples/multi-entity.html"
      : `/examples/multi-entity.html?scenario=${scenario}`,
    attachmentName,
  );
}

export function skipIfUnsupportedWebGpu(status: ExampleStatusBase): void {
  if (
    !status.ok &&
    status.reason !== undefined &&
    unsupportedWebGpuReasons.has(status.reason)
  ) {
    test.skip(
      true,
      `WebGPU unsupported in this browser: ${status.reason} - ${
        status.message ?? "no message"
      }`,
    );
  }
}

export function expectStatusJsonSafeForGpu(status: unknown): void {
  expect(
    JSON.stringify(status ?? null, null, 2),
    "status JSON must not expose raw GPU handles or WebGPU creation calls",
  ).not.toMatch(rawGpuStatusJsonPattern);
}

export function expectNoDrawSubmissionStatus(
  status: NoDrawSubmissionStatus,
): void {
  const statusJson = JSON.stringify(status ?? null, null, 2);

  expectNoNonZeroCountSection("draw", status.draw, statusJson);
  expectNoNonZeroCountSection("command", status.command, statusJson);
  expectNoNonZeroCountSection("submission", status.submission, statusJson);
}

export function expectMultiEntityRouteFailureStatus(
  status: MultiEntityExampleStatus,
  expected: MultiEntityRouteFailureExpectation,
): void {
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: expected.scenario,
    ok: false,
    phase: expected.phase,
    reason: expected.reason,
    ...(expected.expectRenderingBackend === false
      ? {}
      : { renderingBackend: "webgpu" }),
    diagnosticCounts: expectedDiagnosticCounts(expected.diagnosticCounts ?? {}),
    ...(expected.matchObject ?? {}),
  });
  expectNoDrawSubmissionStatus(status);
}

export function expectedDiagnosticCounts(
  counts: Partial<DiagnosticCountSummary>,
): DiagnosticCountSummary {
  return {
    extraction: 0,
    resources: 0,
    binding: 0,
    draw: 0,
    submission: 0,
    readback: 0,
    ...counts,
  };
}

function expectNoNonZeroCountSection(
  sectionName: string,
  section: CountStatusSection | undefined,
  statusJson: string,
): void {
  if (section === undefined) {
    return;
  }

  for (const [key, value] of Object.entries(section)) {
    if (typeof value !== "number") {
      continue;
    }

    expect(value, `${sectionName}.${key} should be zero; ${statusJson}`).toBe(
      0,
    );
  }
}
