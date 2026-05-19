import type { ShadowCasterCommandPlanReadinessReport } from "./shadow-caster-command-plan-readiness.js";
import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type { ShadowDepthTextureResourceReport } from "./shadow-depth-texture-resource.js";
import type { ShadowMatrixBufferResourceReport } from "./shadow-matrix-buffer-resource.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type ShadowPassCommandEncodingStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "not-required";

export type ShadowPassCommandEncodingMode = "ready" | "deferred";

export type ShadowPassCommandEncodingDiagnosticCode =
  | "shadowPassCommandEncoding.missingPassPlan"
  | "shadowPassCommandEncoding.missingDepthView"
  | "shadowPassCommandEncoding.missingMatrixBuffer"
  | "shadowPassCommandEncoding.missingCasterDrawList"
  | "shadowPassCommandEncoding.missingCommandPlan"
  | "shadowPassCommandEncoding.commandEncodingDeferred";

export interface ShadowPassCommandEncodingDiagnostic {
  readonly code: ShadowPassCommandEncodingDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly passKey?: string;
  readonly shadowId?: number;
  readonly lightId?: number;
  readonly resourceKey?: string;
}

export interface ShadowPassCommandEncodingRecord {
  readonly passKey: string;
  readonly shadowId: number;
  readonly lightId: number;
  readonly depthTextureKey: string;
  readonly depthViewKey: string;
  readonly matrixResourceKey: string;
  readonly commandKey: string;
  readonly drawCount: number;
  readonly commandEncoding: ShadowPassCommandEncodingMode;
}

export interface ShadowPassCommandEncodingReport {
  readonly ready: boolean;
  readonly status: ShadowPassCommandEncodingStatus;
  readonly counts: {
    readonly passes: number;
    readonly depthViews: number;
    readonly matrixBuffers: number;
    readonly casterLists: number;
    readonly commandPlans: number;
    readonly commandRecords: number;
    readonly drawCommands: number;
  };
  readonly sections: {
    readonly passPlans: boolean;
    readonly depthTextureResources: boolean;
    readonly matrixBufferResource: boolean;
    readonly casterDrawLists: boolean;
    readonly commandPlans: boolean;
    readonly commandEncoding: boolean;
    readonly passSubmission: false;
    readonly shaderSampling: false;
  };
  readonly records: readonly ShadowPassCommandEncodingRecord[];
  readonly diagnostics: readonly ShadowPassCommandEncodingDiagnostic[];
}

export type ShadowPassCommandEncodingReportJsonValue =
  ShadowPassCommandEncodingReport;

export interface ShadowPassCommandEncodingInput {
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly depthTextureResources: ShadowDepthTextureResourceReport;
  readonly matrixBufferResource: ShadowMatrixBufferResourceReport;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
  readonly commandEncoding?: ShadowPassCommandEncodingMode;
}

export interface ShadowPassCommandEncodingScratch {
  readonly records: ShadowPassCommandEncodingRecord[];
  readonly recordPool: ShadowPassCommandEncodingRecord[];
  readonly diagnostics: ShadowPassCommandEncodingDiagnostic[];
  readonly report: ShadowPassCommandEncodingReport;
}

export function createShadowPassCommandEncodingReport(
  input: ShadowPassCommandEncodingInput,
): ShadowPassCommandEncodingReport {
  return writeShadowPassCommandEncodingReport(
    input,
    createShadowPassCommandEncodingScratch(),
  );
}

export function createShadowPassCommandEncodingScratch(): ShadowPassCommandEncodingScratch {
  const records: ShadowPassCommandEncodingRecord[] = [];
  const diagnostics: ShadowPassCommandEncodingDiagnostic[] = [];

  return {
    records,
    recordPool: [],
    diagnostics,
    report: {
      ready: true,
      status: "not-required",
      counts: {
        passes: 0,
        depthViews: 0,
        matrixBuffers: 0,
        casterLists: 0,
        commandPlans: 0,
        commandRecords: 0,
        drawCommands: 0,
      },
      sections: {
        passPlans: true,
        depthTextureResources: true,
        matrixBufferResource: true,
        casterDrawLists: true,
        commandPlans: true,
        commandEncoding: true,
        passSubmission: false,
        shaderSampling: false,
      },
      records,
      diagnostics,
    },
  };
}

export function writeShadowPassCommandEncodingReport(
  input: ShadowPassCommandEncodingInput,
  scratch: ShadowPassCommandEncodingScratch,
): ShadowPassCommandEncodingReport {
  const commandEncoding = input.commandEncoding ?? "ready";
  scratch.records.length = 0;
  scratch.diagnostics.length = 0;

  if (input.shadowPassPlan.requestCount === 0) {
    writeReport(scratch, "not-required", input);
    return scratch.report;
  }

  const depthResourcesByPass = new Map(
    input.depthTextureResources.resources.map((resource) => [
      shadowInputKey(resource.shadowId, resource.lightId),
      resource,
    ]),
  );
  const casterListsByPass = new Map(
    input.casterDrawList.lists.map((list) => [list.passKey, list]),
  );
  const commandPlansByPass = new Map(
    input.commandPlan.commands.map((command) => [command.passKey, command]),
  );
  const matrixResource = input.matrixBufferResource.resource;

  if (matrixResource === null) {
    scratch.diagnostics.push({
      code: "shadowPassCommandEncoding.missingMatrixBuffer",
      severity: "warning",
      message:
        "Shadow pass command encoding requires an uploaded shadow matrix buffer resource.",
    });
  }

  if (input.shadowPassPlan.passCount === 0) {
    scratch.diagnostics.push({
      code: "shadowPassCommandEncoding.missingPassPlan",
      severity: "warning",
      message: "Shadow pass command encoding requires at least one pass plan.",
    });
  }

  for (const pass of input.shadowPassPlan.passes) {
    const key = shadowInputKey(pass.shadowId, pass.lightId);
    const depthResource = depthResourcesByPass.get(key);
    const casterList = casterListsByPass.get(pass.passKey);
    const commandPlan = commandPlansByPass.get(pass.passKey);
    const hasDepthView =
      depthResource?.attachmentViews.some(
        (view) => view.viewKey === pass.viewKey,
      ) ?? false;

    if (depthResource?.allocation.resource === null || !hasDepthView) {
      scratch.diagnostics.push({
        code: "shadowPassCommandEncoding.missingDepthView",
        severity: "warning",
        passKey: pass.passKey,
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        resourceKey: pass.viewKey,
        message: `Shadow pass '${pass.passKey}' requires a live depth texture view resource.`,
      });
    }

    if (depthResource === undefined) {
      scratch.diagnostics.push({
        code: "shadowPassCommandEncoding.missingDepthView",
        severity: "warning",
        passKey: pass.passKey,
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        resourceKey: pass.viewKey,
        message: `Shadow pass '${pass.passKey}' has no matching depth texture resource report.`,
      });
    }

    if (casterList === undefined) {
      scratch.diagnostics.push({
        code: "shadowPassCommandEncoding.missingCasterDrawList",
        severity: "warning",
        passKey: pass.passKey,
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        message: `Shadow pass '${pass.passKey}' has no matching caster draw list.`,
      });
    }

    if (commandPlan === undefined) {
      scratch.diagnostics.push({
        code: "shadowPassCommandEncoding.missingCommandPlan",
        severity: "warning",
        passKey: pass.passKey,
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        message: `Shadow pass '${pass.passKey}' has no matching caster command plan.`,
      });
    }

    if (
      depthResource?.allocation.resource === null ||
      depthResource === undefined ||
      !hasDepthView ||
      matrixResource === null ||
      casterList === undefined ||
      commandPlan === undefined
    ) {
      continue;
    }

    writeRecord(
      scratch,
      scratch.records.length,
      pass,
      depthResource.textureKey,
      pass.viewKey,
      matrixResource.resourceKey,
      commandPlan.commandKey,
      commandPlan.drawCount,
      commandEncoding,
    );
  }

  if (commandEncoding === "deferred" && scratch.records.length > 0) {
    scratch.diagnostics.push({
      code: "shadowPassCommandEncoding.commandEncodingDeferred",
      severity: "warning",
      message:
        "Shadow pass command records are available, but WebGPU command encoding is deferred.",
    });
  }

  const status = determineStatus(input, scratch, commandEncoding);
  writeReport(scratch, status, input);
  return scratch.report;
}

export function shadowPassCommandEncodingReportToJsonValue(
  report: ShadowPassCommandEncodingReport,
): ShadowPassCommandEncodingReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    counts: { ...report.counts },
    sections: { ...report.sections },
    records: report.records.map((record) => ({ ...record })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowPassCommandEncodingReportToJson(
  report: ShadowPassCommandEncodingReport,
): string {
  return JSON.stringify(shadowPassCommandEncodingReportToJsonValue(report));
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

function writeRecord(
  scratch: ShadowPassCommandEncodingScratch,
  index: number,
  pass: ShadowPassPlanReport["passes"][number],
  depthTextureKey: string,
  depthViewKey: string,
  matrixResourceKey: string,
  commandKey: string,
  drawCount: number,
  commandEncoding: ShadowPassCommandEncodingMode,
): void {
  const existing = scratch.recordPool[index];
  const record =
    existing ??
    ({
      passKey: "",
      shadowId: 0,
      lightId: 0,
      depthTextureKey: "",
      depthViewKey: "",
      matrixResourceKey: "",
      commandKey: "",
      drawCount: 0,
      commandEncoding,
    } satisfies Mutable<ShadowPassCommandEncodingRecord>);
  const mutable = record as Mutable<ShadowPassCommandEncodingRecord>;

  mutable.passKey = pass.passKey;
  mutable.shadowId = pass.shadowId;
  mutable.lightId = pass.lightId;
  mutable.depthTextureKey = depthTextureKey;
  mutable.depthViewKey = depthViewKey;
  mutable.matrixResourceKey = matrixResourceKey;
  mutable.commandKey = commandKey;
  mutable.drawCount = drawCount;
  mutable.commandEncoding = commandEncoding;

  scratch.recordPool[index] = record;
  scratch.records.push(record);
}

function writeReport(
  scratch: ShadowPassCommandEncodingScratch,
  status: ShadowPassCommandEncodingStatus,
  input: ShadowPassCommandEncodingInput,
): void {
  const report = scratch.report as Mutable<ShadowPassCommandEncodingReport>;
  const counts = report.counts as Mutable<
    ShadowPassCommandEncodingReport["counts"]
  >;
  const sections = report.sections as Mutable<
    ShadowPassCommandEncodingReport["sections"]
  >;

  report.ready = status === "ready" || status === "not-required";
  report.status = status;
  counts.passes = input.shadowPassPlan.passCount;
  counts.depthViews = input.depthTextureResources.resources.filter(
    (resource) => resource.allocation.resource !== null,
  ).length;
  counts.matrixBuffers = input.matrixBufferResource.resource === null ? 0 : 1;
  counts.casterLists = input.casterDrawList.listCount;
  counts.commandPlans = input.commandPlan.counts.commandPlans;
  counts.commandRecords = scratch.records.length;
  counts.drawCommands = scratch.records.reduce(
    (sum, record) => sum + record.drawCount,
    0,
  );
  sections.passPlans = input.shadowPassPlan.passCount > 0;
  sections.depthTextureResources =
    input.depthTextureResources.status === "available" ||
    input.depthTextureResources.status === "not-required";
  sections.matrixBufferResource =
    input.matrixBufferResource.status === "available" ||
    input.matrixBufferResource.status === "not-required";
  sections.casterDrawLists =
    input.casterDrawList.status === "ready" ||
    input.casterDrawList.status === "not-required";
  sections.commandPlans =
    input.commandPlan.status === "ready" ||
    input.commandPlan.status === "not-required";
  sections.commandEncoding = status === "ready" || status === "not-required";
  sections.passSubmission = false;
  sections.shaderSampling = false;
}

function determineStatus(
  input: ShadowPassCommandEncodingInput,
  scratch: ShadowPassCommandEncodingScratch,
  commandEncoding: ShadowPassCommandEncodingMode,
): ShadowPassCommandEncodingStatus {
  if (input.shadowPassPlan.requestCount === 0) {
    return "not-required";
  }

  if (
    scratch.diagnostics.some(
      (diagnostic) =>
        diagnostic.code !== "shadowPassCommandEncoding.commandEncodingDeferred",
    )
  ) {
    return "missing";
  }

  if (
    input.shadowPassPlan.status === "missing" ||
    input.depthTextureResources.status === "missing" ||
    input.matrixBufferResource.status === "missing" ||
    input.casterDrawList.status === "missing" ||
    input.commandPlan.status === "missing"
  ) {
    return "missing";
  }

  if (
    input.shadowPassPlan.status === "deferred" ||
    input.casterDrawList.status === "deferred" ||
    input.commandPlan.status === "deferred" ||
    commandEncoding === "deferred"
  ) {
    return "deferred";
  }

  return "ready";
}

function shadowInputKey(shadowId: number, lightId: number): string {
  return `${shadowId}:${lightId}`;
}
