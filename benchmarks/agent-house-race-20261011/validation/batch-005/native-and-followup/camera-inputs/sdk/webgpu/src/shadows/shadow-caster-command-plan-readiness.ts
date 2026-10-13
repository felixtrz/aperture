import type { ShadowCasterDrawListPlanReport } from "./shadow-caster-draw-list-plan.js";
import type {
  ShadowMatrixBufferDescriptorReport,
  ShadowViewProjectionPlanReportLike,
} from "./shadow-matrix-buffer-descriptor.js";
import type { ShadowPassPlanReport } from "./shadow-pass-plan.js";

export type ShadowCasterCommandPlanStatus =
  | "ready"
  | "deferred"
  | "missing"
  | "unsupported"
  | "not-required";

export type ShadowCasterCommandEncodingMode = "ready" | "deferred";

export type ShadowCasterCommandPlanDiagnosticCode =
  | "shadowCasterCommandPlan.missingPassPlan"
  | "shadowCasterCommandPlan.missingViewProjection"
  | "shadowCasterCommandPlan.unsupportedViewProjection"
  | "shadowCasterCommandPlan.missingMatrixBuffer"
  | "shadowCasterCommandPlan.unsupportedMatrixBuffer"
  | "shadowCasterCommandPlan.missingCasterDrawList"
  | "shadowCasterCommandPlan.missingMatrixEntry"
  | "shadowCasterCommandPlan.commandEncodingDeferred";

export interface ShadowCasterCommandPlanDiagnostic {
  readonly code: ShadowCasterCommandPlanDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
}

export interface ShadowCasterCommandPlan {
  readonly commandKey: string;
  readonly shadowId: number;
  readonly lightId: number;
  readonly passKey: string;
  readonly matrixResourceKey: string;
  readonly matrixOffsetBytes: number;
  readonly drawCount: number;
  readonly commandEncoding: ShadowCasterCommandEncodingMode;
}

export interface ShadowCasterCommandPlanReadinessReport {
  readonly ready: boolean;
  readonly status: ShadowCasterCommandPlanStatus;
  readonly counts: {
    readonly requests: number;
    readonly passes: number;
    readonly viewProjectionPlans: number;
    readonly matrices: number;
    readonly casterLists: number;
    readonly drawCommands: number;
    readonly commandPlans: number;
  };
  readonly sections: {
    readonly shadowPassPlan: boolean;
    readonly viewProjectionPlanning: boolean;
    readonly matrixBufferDescriptor: boolean;
    readonly casterDrawLists: boolean;
    readonly commandEncoding: boolean;
    readonly gpuCommands: false;
  };
  readonly commands: readonly ShadowCasterCommandPlan[];
  readonly diagnostics: readonly ShadowCasterCommandPlanDiagnostic[];
}

export type ShadowCasterCommandPlanReadinessReportJsonValue =
  ShadowCasterCommandPlanReadinessReport;

export interface ShadowCasterCommandPlanReadinessScratch {
  readonly commands: ShadowCasterCommandPlan[];
  readonly commandPool: ShadowCasterCommandPlan[];
  readonly diagnostics: ShadowCasterCommandPlanDiagnostic[];
  readonly report: ShadowCasterCommandPlanReadinessReport;
}

export interface ShadowCasterCommandPlanReadinessInput {
  readonly shadowPassPlan: ShadowPassPlanReport;
  readonly viewProjection: ShadowViewProjectionPlanReportLike;
  readonly matrixBuffer: ShadowMatrixBufferDescriptorReport;
  readonly casterDrawList: ShadowCasterDrawListPlanReport;
  readonly commandEncoding?: ShadowCasterCommandEncodingMode;
}

export function createShadowCasterCommandPlanReadinessReport(
  input: ShadowCasterCommandPlanReadinessInput,
): ShadowCasterCommandPlanReadinessReport {
  return writeShadowCasterCommandPlanReadinessReport(
    input,
    createShadowCasterCommandPlanReadinessScratch(),
  );
}

export function createShadowCasterCommandPlanReadinessScratch(): ShadowCasterCommandPlanReadinessScratch {
  const commands: ShadowCasterCommandPlan[] = [];
  const diagnostics: ShadowCasterCommandPlanDiagnostic[] = [];

  return {
    commands,
    commandPool: [],
    diagnostics,
    report: {
      ready: true,
      status: "not-required",
      counts: {
        requests: 0,
        passes: 0,
        viewProjectionPlans: 0,
        matrices: 0,
        casterLists: 0,
        drawCommands: 0,
        commandPlans: 0,
      },
      sections: {
        shadowPassPlan: true,
        viewProjectionPlanning: true,
        matrixBufferDescriptor: true,
        casterDrawLists: true,
        commandEncoding: true,
        gpuCommands: false,
      },
      commands,
      diagnostics,
    },
  };
}

export function writeShadowCasterCommandPlanReadinessReport(
  input: ShadowCasterCommandPlanReadinessInput,
  scratch: ShadowCasterCommandPlanReadinessScratch,
): ShadowCasterCommandPlanReadinessReport {
  const commandEncoding = input.commandEncoding ?? "deferred";
  scratch.commands.length = 0;
  scratch.diagnostics.length = 0;

  if (input.shadowPassPlan.requestCount === 0) {
    writeReport(
      scratch,
      "not-required",
      {
        requests: 0,
        passes: input.shadowPassPlan.passCount,
        viewProjectionPlans: input.viewProjection.planCount,
        matrices: input.matrixBuffer.matrixCount,
        casterLists: input.casterDrawList.listCount,
        drawCommands: 0,
        commandPlans: 0,
      },
      {
        shadowPassPlan: true,
        viewProjectionPlanning: true,
        matrixBufferDescriptor: true,
        casterDrawLists: true,
        commandEncoding: true,
        gpuCommands: false,
      },
    );
    return scratch.report;
  }

  writePrerequisiteDiagnostics(input, scratch.diagnostics);
  const matrixEntries = input.matrixBuffer.descriptor?.entries ?? [];

  for (const list of input.casterDrawList.lists) {
    const matrix = findMatrixEntry(matrixEntries, list.passKey);

    if (matrix === undefined) {
      scratch.diagnostics.push({
        code: "shadowCasterCommandPlan.missingMatrixEntry",
        severity: "warning",
        message: `Shadow caster command plan for shadow '${list.shadowId}' has no matching matrix-buffer entry.`,
      });
      continue;
    }

    if (list.includedDrawCount === 0) {
      continue;
    }

    writeCommandPlan(
      scratch,
      scratch.commands.length,
      list,
      input.matrixBuffer.descriptor?.resourceKey ?? "",
      matrix.offsetBytes,
      commandEncoding,
    );
  }

  const status = determineStatus({
    shadowPassPlanStatus: input.shadowPassPlan.status,
    viewProjectionStatus: input.viewProjection.status,
    matrixBufferStatus: input.matrixBuffer.status,
    casterDrawListStatus: input.casterDrawList.status,
    hasMissingMatrixEntry: scratch.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "shadowCasterCommandPlan.missingMatrixEntry",
    ),
    commandEncoding,
  });

  if (status === "deferred" && scratch.commands.length > 0) {
    scratch.diagnostics.push({
      code: "shadowCasterCommandPlan.commandEncodingDeferred",
      severity: "warning",
      message:
        "Shadow caster command plans are ready as data, but GPU command encoding is deferred.",
    });
  }

  writeReport(
    scratch,
    status,
    {
      requests: input.shadowPassPlan.requestCount,
      passes: input.shadowPassPlan.passCount,
      viewProjectionPlans: input.viewProjection.planCount,
      matrices: input.matrixBuffer.matrixCount,
      casterLists: input.casterDrawList.listCount,
      drawCommands: scratch.commands.reduce(
        (sum, command) => sum + command.drawCount,
        0,
      ),
      commandPlans: scratch.commands.length,
    },
    {
      shadowPassPlan: sectionAvailable(input.shadowPassPlan.status),
      viewProjectionPlanning: sectionAvailable(input.viewProjection.status),
      matrixBufferDescriptor: sectionAvailable(input.matrixBuffer.status),
      casterDrawLists: sectionAvailable(input.casterDrawList.status),
      commandEncoding: status === "ready",
      gpuCommands: false,
    },
  );
  return scratch.report;
}

export function shadowCasterCommandPlanReadinessReportToJsonValue(
  report: ShadowCasterCommandPlanReadinessReport,
): ShadowCasterCommandPlanReadinessReportJsonValue {
  return {
    ready: report.ready,
    status: report.status,
    counts: { ...report.counts },
    sections: { ...report.sections },
    commands: report.commands.map((command) => ({ ...command })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterCommandPlanReadinessReportToJson(
  report: ShadowCasterCommandPlanReadinessReport,
): string {
  return JSON.stringify(
    shadowCasterCommandPlanReadinessReportToJsonValue(report),
  );
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

function writePrerequisiteDiagnostics(
  input: ShadowCasterCommandPlanReadinessInput,
  diagnostics: ShadowCasterCommandPlanDiagnostic[],
): void {
  if (input.shadowPassPlan.status === "missing") {
    diagnostics.push({
      code: "shadowCasterCommandPlan.missingPassPlan",
      severity: "warning",
      message:
        "Shadow caster command planning requires a valid shadow pass plan.",
    });
  }

  if (input.viewProjection.status === "missing") {
    diagnostics.push({
      code: "shadowCasterCommandPlan.missingViewProjection",
      severity: "warning",
      message:
        "Shadow caster command planning requires shadow view/projection plans.",
    });
  } else if (input.viewProjection.status === "unsupported") {
    diagnostics.push({
      code: "shadowCasterCommandPlan.unsupportedViewProjection",
      severity: "warning",
      message:
        "Shadow caster command planning cannot use the current shadow view/projection plans.",
    });
  }

  if (input.matrixBuffer.status === "missing") {
    diagnostics.push({
      code: "shadowCasterCommandPlan.missingMatrixBuffer",
      severity: "warning",
      message:
        "Shadow caster command planning requires a shadow matrix-buffer descriptor.",
    });
  } else if (input.matrixBuffer.status === "unsupported") {
    diagnostics.push({
      code: "shadowCasterCommandPlan.unsupportedMatrixBuffer",
      severity: "warning",
      message:
        "Shadow caster command planning cannot use the current matrix-buffer descriptor.",
    });
  }

  if (input.casterDrawList.status === "missing") {
    diagnostics.push({
      code: "shadowCasterCommandPlan.missingCasterDrawList",
      severity: "warning",
      message:
        "Shadow caster command planning requires shadow caster draw-list plans.",
    });
  }
}

function writeCommandPlan(
  scratch: ShadowCasterCommandPlanReadinessScratch,
  index: number,
  list: ShadowCasterCommandPlanReadinessInput["casterDrawList"]["lists"][number],
  matrixResourceKey: string,
  matrixOffsetBytes: number,
  commandEncoding: ShadowCasterCommandEncodingMode,
): void {
  const existing = scratch.commandPool[index];
  const command =
    existing ??
    ({
      commandKey: "",
      shadowId: 0,
      lightId: 0,
      passKey: "",
      matrixResourceKey: "",
      matrixOffsetBytes: 0,
      drawCount: 0,
      commandEncoding,
    } satisfies Mutable<ShadowCasterCommandPlan>);
  const mutable = command as Mutable<ShadowCasterCommandPlan>;

  mutable.commandKey = `${list.passKey}:caster-commands`;
  mutable.shadowId = list.shadowId;
  mutable.lightId = list.lightId;
  mutable.passKey = list.passKey;
  mutable.matrixResourceKey = matrixResourceKey;
  mutable.matrixOffsetBytes = matrixOffsetBytes;
  mutable.drawCount = list.includedDrawCount;
  mutable.commandEncoding = commandEncoding;

  scratch.commandPool[index] = command;
  scratch.commands.push(command);
}

function writeReport(
  scratch: ShadowCasterCommandPlanReadinessScratch,
  status: ShadowCasterCommandPlanStatus,
  counts: ShadowCasterCommandPlanReadinessReport["counts"],
  sections: ShadowCasterCommandPlanReadinessReport["sections"],
): void {
  const report =
    scratch.report as Mutable<ShadowCasterCommandPlanReadinessReport>;
  const mutableCounts = report.counts as Mutable<
    ShadowCasterCommandPlanReadinessReport["counts"]
  >;
  const mutableSections = report.sections as Mutable<
    ShadowCasterCommandPlanReadinessReport["sections"]
  >;

  report.ready = status === "ready" || status === "not-required";
  report.status = status;
  mutableCounts.requests = counts.requests;
  mutableCounts.passes = counts.passes;
  mutableCounts.viewProjectionPlans = counts.viewProjectionPlans;
  mutableCounts.matrices = counts.matrices;
  mutableCounts.casterLists = counts.casterLists;
  mutableCounts.drawCommands = counts.drawCommands;
  mutableCounts.commandPlans = counts.commandPlans;
  mutableSections.shadowPassPlan = sections.shadowPassPlan;
  mutableSections.viewProjectionPlanning = sections.viewProjectionPlanning;
  mutableSections.matrixBufferDescriptor = sections.matrixBufferDescriptor;
  mutableSections.casterDrawLists = sections.casterDrawLists;
  mutableSections.commandEncoding = sections.commandEncoding;
  mutableSections.gpuCommands = sections.gpuCommands;
}

function findMatrixEntry(
  entries: NonNullable<
    ShadowMatrixBufferDescriptorReport["descriptor"]
  >["entries"],
  passKey: string,
) {
  return entries.find((entry) => entry.passKey === passKey);
}

function determineStatus(input: {
  readonly shadowPassPlanStatus: ShadowPassPlanReport["status"];
  readonly viewProjectionStatus: ShadowViewProjectionPlanReportLike["status"];
  readonly matrixBufferStatus: ShadowMatrixBufferDescriptorReport["status"];
  readonly casterDrawListStatus: ShadowCasterDrawListPlanReport["status"];
  readonly hasMissingMatrixEntry: boolean;
  readonly commandEncoding: ShadowCasterCommandEncodingMode;
}): ShadowCasterCommandPlanStatus {
  if (
    input.shadowPassPlanStatus === "not-required" ||
    input.viewProjectionStatus === "not-required" ||
    input.matrixBufferStatus === "not-required" ||
    input.casterDrawListStatus === "not-required"
  ) {
    return "not-required";
  }

  if (
    input.viewProjectionStatus === "unsupported" ||
    input.matrixBufferStatus === "unsupported"
  ) {
    return "unsupported";
  }

  if (
    input.shadowPassPlanStatus === "missing" ||
    input.viewProjectionStatus === "missing" ||
    input.matrixBufferStatus === "missing" ||
    input.casterDrawListStatus === "missing" ||
    input.hasMissingMatrixEntry
  ) {
    return "missing";
  }

  if (
    input.shadowPassPlanStatus === "deferred" ||
    input.viewProjectionStatus === "deferred" ||
    input.matrixBufferStatus === "deferred" ||
    input.casterDrawListStatus === "deferred" ||
    input.commandEncoding === "deferred"
  ) {
    return "deferred";
  }

  return "ready";
}

function sectionAvailable(status: ShadowCasterCommandPlanStatus): boolean {
  return status !== "missing" && status !== "unsupported";
}
