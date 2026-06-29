import { describe, expect, it } from "vitest";

import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { defineApertureConfig, input } from "@aperture-engine/app/config";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import type {
  ApertureGeneratedInputEvent,
  ApertureInputSummary,
} from "@aperture-engine/app/input";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import { createGeneratedInputEventMessage } from "../../packages/app/src/input.js";

describe("generated input replay parity", () => {
  it("matches headless and browser-worker manual-step input semantics", async () => {
    const config = defineApertureConfig({
      mode: "headless",
      input: {
        actions: {
          select: input.button([input.pointer("primary")]),
          fire: input.button([input.key("KeyF")]),
          boost: input.button([input.virtual()]),
          drive: input.axis2d([input.gamepadStick("left", { deadzone: 0 })]),
        },
      },
      render: { defaultCamera: false, defaultLight: false },
    });
    const runner = await createApertureHeadlessRunner({
      config,
      systems: [],
    });
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config,
      systems: [],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      simulationPaused: true,
    });
    await port.nextPostedMessage(isSimulationWorkerReadyMessage);

    const frames: readonly InputParityFrame[] = [
      {
        frame: 0,
        delta: 1 / 60,
        time: 0,
        events: [
          {
            kind: "pointer",
            pointer: "primary",
            position: [0.25, 0.75],
            pressed: true,
          },
          {
            kind: "pointer",
            pointer: "primary",
            position: [0.25, 0.75],
            pressed: false,
          },
          { kind: "wheel", deltaX: 4, deltaY: -8 },
          { kind: "keyboard", code: "KeyF", pressed: true },
          {
            kind: "gamepad",
            replace: true,
            gamepads: [
              {
                index: 0,
                id: "Parity Pad",
                mapping: "standard",
                connected: true,
                buttons: [{ pressed: true, touched: true, value: 1 }],
                axes: [0.5, -0.25, 0, 0],
              },
            ],
          },
          { kind: "virtualAction", action: "boost", pressed: true },
        ],
      },
      {
        frame: 1,
        delta: 1 / 60,
        time: 1 / 60,
        events: [
          { kind: "keyboard", code: "KeyF", pressed: false },
          { kind: "virtualAction", action: "boost", pressed: false },
        ],
      },
      {
        frame: 2,
        delta: 1 / 60,
        time: 2 / 60,
        events: [{ kind: "reset", reason: "parity-test" }],
      },
      {
        frame: 3,
        delta: 1 / 60,
        time: 3 / 60,
        events: [],
      },
    ];

    for (const frame of frames) {
      enqueueWorkerInput(port, frame.events, frame.frame);
      const worker = await stepWorkerAndReadInput(port, frame);
      const headless = stepHeadlessAndReadInput(runner, frame);

      expect(worker.step.time).toEqual({
        delta: frame.delta,
        elapsed: frame.time,
        frame: frame.frame + 1,
      });
      expect(worker.input).toEqual(headless);
    }
  });
});

interface InputParityFrame {
  readonly frame: number;
  readonly delta: number;
  readonly time: number;
  readonly events: readonly ApertureGeneratedInputEvent[];
}

interface DevtoolsResponseMessage {
  readonly type: "aperture.devtools.response";
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
}

interface WorkerStepResult {
  readonly time: {
    readonly delta: number;
    readonly elapsed: number;
    readonly frame: number;
  };
}

function enqueueWorkerInput(
  port: TestGeneratedWorkerPort,
  events: readonly ApertureGeneratedInputEvent[],
  frame: number,
): void {
  for (const event of events) {
    port.dispatch(createGeneratedInputEventMessage(event, frame));
  }
}

async function stepWorkerAndReadInput(
  port: TestGeneratedWorkerPort,
  frame: InputParityFrame,
): Promise<{
  readonly step: WorkerStepResult;
  readonly input: ApertureInputSummary;
}> {
  const stepRequestId = `step-${frame.frame}`;
  const inputRequestId = `input-${frame.frame}`;

  port.dispatch(
    createApertureDevtoolsRequest({
      requestId: stepRequestId,
      tool: "ecs_step",
      payload: { delta: frame.delta, time: frame.time },
    }),
  );
  const step = await port.nextPostedMessage(
    devtoolsResponseWithId(stepRequestId),
  );

  port.dispatch(
    createApertureDevtoolsRequest({
      requestId: inputRequestId,
      tool: "input_get_state",
    }),
  );
  const inputState = await port.nextPostedMessage(
    devtoolsResponseWithId(inputRequestId),
  );

  expect(step.ok).toBe(true);
  expect(inputState.ok).toBe(true);

  return {
    step: step.result as WorkerStepResult,
    input: inputState.result as ApertureInputSummary,
  };
}

function stepHeadlessAndReadInput(
  runner: ApertureHeadlessRunner,
  frame: InputParityFrame,
): ApertureInputSummary {
  runner.enqueueInputBatch(frame.events, frame.frame);
  runner.step(frame.delta, frame.time);
  return runner.getStatus().input;
}

class TestGeneratedWorkerPort {
  readonly posted: unknown[] = [];
  #listeners = new Set<(event: MessageEvent<unknown>) => void>();
  #waiters: {
    readonly predicate: (message: unknown) => boolean;
    readonly resolve: (message: unknown) => void;
  }[] = [];

  postMessage(message: unknown): void {
    this.posted.push(message);

    for (const waiter of [...this.#waiters]) {
      if (waiter.predicate(message)) {
        this.#waiters = this.#waiters.filter((entry) => entry !== waiter);
        waiter.resolve(message);
      }
    }
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.#listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.#listeners.delete(listener);
  }

  start(): void {}

  dispatch(message: unknown): void {
    for (const listener of this.#listeners) {
      listener({ data: message } as MessageEvent<unknown>);
    }
  }

  nextPostedMessage<T>(
    predicate: (message: unknown) => message is T,
  ): Promise<T> {
    const existing = this.posted.find(predicate);
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve) => {
      this.#waiters.push({
        predicate,
        resolve: (message) => {
          resolve(message as T);
        },
      });
    });
  }
}

function isSimulationWorkerReadyMessage(value: unknown): value is {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.ready;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.ready
  );
}

function devtoolsResponseWithId(
  requestId: string,
): (value: unknown) => value is DevtoolsResponseMessage {
  return (value: unknown): value is DevtoolsResponseMessage =>
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      "aperture.devtools.response" &&
    (value as { readonly requestId?: unknown }).requestId === requestId;
}
