import {
  assembleFrameBoundary,
  createFrameBoundarySmokeReport,
  createFrameSubmissionSmokeReport,
  type FrameBoundaryAssemblyReport,
  type FrameBoundarySmokeReport,
  type FrameSubmissionSmokeReport,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";

export type FrameExecutionFailurePoint =
  | "texture"
  | "begin"
  | "execute"
  | "finish"
  | "submit";

export interface FrameExecutionSmokeFixtureOptions {
  readonly failAt?: FrameExecutionFailurePoint;
  readonly commands?: readonly RenderPassCommand[];
}

export interface FrameExecutionSmokeFixture {
  readonly events: readonly string[];
  readonly assembly: FrameBoundaryAssemblyReport;
  readonly boundarySmoke: FrameBoundarySmokeReport;
  readonly submissionSmoke: FrameSubmissionSmokeReport;
}

export function createFrameExecutionSmokeFixture(
  options: FrameExecutionSmokeFixtureOptions = {},
): FrameExecutionSmokeFixture {
  const events: string[] = [];
  const commands = options.commands ?? [drawCommand()];
  const assembly = assembleFrameBoundary({
    context: context(options.failAt),
    device: device(events, options.failAt),
    queue: queue(events, options.failAt),
    commands,
    label: "fixture-frame",
    clearColor: [0, 0, 0, 1],
  });

  return {
    events,
    assembly,
    boundarySmoke: createFrameBoundarySmokeReport(assembly),
    submissionSmoke: createFrameSubmissionSmokeReport({
      attachments: assembly.attachments,
      begin: assembly.begin,
      execution: assembly.execution,
      end: assembly.end,
      finish: assembly.finish,
      submit: assembly.submit,
    }),
  };
}

function context(failAt: FrameExecutionFailurePoint | undefined) {
  return {
    getCurrentTexture: () =>
      failAt === "texture" ? {} : { createView: () => ({ label: "view" }) },
  };
}

function device(
  events: string[],
  failAt: FrameExecutionFailurePoint | undefined,
) {
  return {
    createCommandEncoder: () => ({
      ...(failAt === "begin"
        ? {}
        : {
            beginRenderPass: () => {
              events.push("begin");
              return pass(events, failAt);
            },
          }),
      ...(failAt === "finish"
        ? {}
        : {
            finish: () => {
              events.push("finish");
              return { label: "command-buffer" };
            },
          }),
    }),
  };
}

function pass(
  events: string[],
  failAt: FrameExecutionFailurePoint | undefined,
) {
  return {
    ...(failAt === "execute" ? {} : { draw: () => events.push("draw") }),
    end: () => events.push("end"),
  };
}

function queue(
  events: string[],
  failAt: FrameExecutionFailurePoint | undefined,
) {
  return failAt === "submit"
    ? {}
    : {
        submit: (buffers: readonly unknown[]) =>
          events.push(`submit:${buffers.length}`),
      };
}

function drawCommand(): RenderPassCommand {
  return {
    kind: "draw",
    renderId: 1,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}
