import { afterEach, describe, expect, it, vi } from "vitest";

import { defineApertureConfig } from "@aperture-engine/app/config";
import { installGeneratedInputForwarding } from "../../packages/app/src/browser/input.js";
import type { GeneratedBrowserAppStatus } from "../../packages/app/src/browser/status.js";

describe("generated browser input forwarding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards pointer events even when pointer capture throws", () => {
    const canvas = new FakeCanvas();
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const messages: unknown[] = [];
    const status = createStatus();

    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", {
      addEventListener: documentTarget.addEventListener.bind(documentTarget),
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("WheelEvent", {
      DOM_DELTA_LINE: 1,
      DOM_DELTA_PAGE: 2,
    });

    installGeneratedInputForwarding(
      canvas as unknown as HTMLCanvasElement,
      {
        postMessage(message: unknown) {
          messages.push(message);
        },
      } as never,
      status,
      defineApertureConfig({ mode: "browser", canvas: "#aperture" }),
    );

    canvas.dispatch("pointerdown", {
      pointerId: 7,
      button: 0,
      clientX: 50,
      clientY: 25,
    });
    canvas.dispatch("pointerup", {
      pointerId: 7,
      button: 0,
      clientX: 50,
      clientY: 25,
    });

    expect(canvas.focus).toHaveBeenCalledOnce();
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(messages.map((message) => eventFromMessage(message))).toEqual([
      {
        kind: "pointer",
        pointer: "primary",
        position: [0.5, 0.25],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "primary",
        position: [0.5, 0.25],
        pressed: false,
      },
    ]);
    expect(status.forwardedInputEvents).toBe(2);
  });

  it("forwards middle and secondary mouse buttons as named pointer presses", () => {
    const canvas = new FakeCanvas();
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const messages: unknown[] = [];
    const status = createStatus();

    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", {
      addEventListener: documentTarget.addEventListener.bind(documentTarget),
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("WheelEvent", {
      DOM_DELTA_LINE: 1,
      DOM_DELTA_PAGE: 2,
    });

    installGeneratedInputForwarding(
      canvas as unknown as HTMLCanvasElement,
      {
        postMessage(message: unknown) {
          messages.push(message);
        },
      } as never,
      status,
      defineApertureConfig({ mode: "browser", canvas: "#aperture" }),
    );

    canvas.dispatch("pointerdown", {
      pointerId: 7,
      button: 1,
      clientX: 50,
      clientY: 25,
    });
    canvas.dispatch("pointerup", {
      pointerId: 7,
      button: 1,
      clientX: 50,
      clientY: 25,
    });
    canvas.dispatch("pointerdown", {
      pointerId: 8,
      button: 2,
      clientX: 25,
      clientY: 75,
    });
    canvas.dispatch("pointerup", {
      pointerId: 8,
      button: 2,
      clientX: 25,
      clientY: 75,
    });

    expect(canvas.focus).toHaveBeenCalledTimes(2);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(8);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(8);
    expect(messages.map((message) => eventFromMessage(message))).toEqual([
      {
        kind: "pointer",
        pointer: "middle",
        position: [0.5, 0.25],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "middle",
        position: [0.5, 0.25],
        pressed: false,
      },
      {
        kind: "pointer",
        pointer: "secondary",
        position: [0.25, 0.75],
        pressed: true,
      },
      {
        kind: "pointer",
        pointer: "secondary",
        position: [0.25, 0.75],
        pressed: false,
      },
    ]);
    expect(status.forwardedInputEvents).toBe(4);
  });

  it("does not start gamepad RAF polling until a configured gamepad is connected", () => {
    const canvas = new FakeCanvas();
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const requestAnimationFrame = vi.fn();

    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", {
      addEventListener: documentTarget.addEventListener.bind(documentTarget),
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", {
      getGamepads: () => [],
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("WheelEvent", {
      DOM_DELTA_LINE: 1,
      DOM_DELTA_PAGE: 2,
    });

    installGeneratedInputForwarding(
      canvas as unknown as HTMLCanvasElement,
      {
        postMessage() {},
      } as never,
      createStatus(),
      defineApertureConfig({
        mode: "browser",
        canvas: "#aperture",
        input: {
          actions: {
            drive: {
              kind: "axis2d",
              bindings: [{ kind: "gamepad-stick", stick: "left" }],
            },
          },
        },
      }),
    );

    expect(requestAnimationFrame).not.toHaveBeenCalled();

    windowTarget.dispatch("gamepadconnected", {});
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("polls and forwards gamepad snapshots while a gamepad is connected", () => {
    const canvas = new FakeCanvas();
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const messages: unknown[] = [];
    const status = createStatus();
    const callbacks: FrameRequestCallback[] = [];
    let gamepads: (Gamepad | null)[] = [fakeGamepad()];

    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", {
      addEventListener: documentTarget.addEventListener.bind(documentTarget),
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", {
      getGamepads: () => gamepads,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("WheelEvent", {
      DOM_DELTA_LINE: 1,
      DOM_DELTA_PAGE: 2,
    });

    installGeneratedInputForwarding(
      canvas as unknown as HTMLCanvasElement,
      {
        postMessage(message: unknown) {
          messages.push(message);
        },
      } as never,
      status,
      defineApertureConfig({
        mode: "browser",
        canvas: "#aperture",
        input: {
          actions: {
            drive: {
              kind: "axis2d",
              bindings: [{ kind: "gamepad-stick", stick: "left" }],
            },
          },
        },
      }),
    );

    expect(callbacks).toHaveLength(1);
    callbacks.shift()?.(0);

    expect(status.connectedGamepads).toBe(1);
    expect(status.forwardedInputFrames).toBe(1);
    expect(messages.map((message) => eventFromMessage(message))).toEqual([
      {
        kind: "gamepad",
        replace: true,
        gamepads: [
          {
            index: 0,
            id: "Fake Pad",
            mapping: "standard",
            connected: true,
            buttons: [{ pressed: true, touched: false, value: 1 }],
            axes: [0.25, -0.5],
          },
        ],
      },
    ]);
    expect(callbacks).toHaveLength(1);

    gamepads = [];
    callbacks.shift()?.(16);

    expect(status.connectedGamepads).toBe(0);
    expect(status.forwardedInputFrames).toBe(2);
    expect(eventFromMessage(messages.at(-1))).toMatchObject({
      kind: "gamepad",
      replace: true,
      gamepads: [],
    });
    expect(callbacks).toHaveLength(0);
  });
});

class FakeEventTarget {
  readonly #listeners = new Map<string, ((event: never) => void)[]>();

  addEventListener(type: string, listener: (event: never) => void): void {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  dispatch(type: string, event: object): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event as never);
    }
  }
}

class FakeCanvas extends FakeEventTarget {
  tabIndex = -1;
  readonly focus = vi.fn();
  readonly setPointerCapture = vi.fn(() => {
    throw new Error("synthetic pointer cannot be captured");
  });
  readonly releasePointerCapture = vi.fn(() => {
    throw new Error("synthetic pointer cannot be released");
  });

  hasAttribute(name: string): boolean {
    return name === "tabindex" && this.tabIndex >= 0;
  }

  getBoundingClientRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }
}

function createStatus(): GeneratedBrowserAppStatus {
  return {
    status: "running",
    webgpuOk: false,
    snapshots: 0,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
    forwardedInputEvents: 0,
    forwardedInputFrames: 0,
    connectedGamepads: 0,
    lastInputReset: null,
    lastInputEvent: null,
    forwardedCommandEvents: 0,
    lastCommandEvent: null,
    lastFrame: 0,
    lastError: null,
    lastFailure: null,
    lastWorkerSummary: null,
    workerMessages: emptyWorkerMessages(),
    performance: null,
    diagnostics: null,
    render: null,
    canvas: null,
    systems: [],
  };
}

function emptyWorkerMessages(): GeneratedBrowserAppStatus["workerMessages"] {
  return {
    snapshotDecisions: {
      total: 0,
      latest: null,
      postedMessages: {},
      postMessageReasons: {},
    },
    sidebandDecisions: {
      total: 0,
      latest: null,
      postedMessages: {},
      postMessageReasons: {},
    },
  };
}

function eventFromMessage(message: unknown): unknown {
  if (typeof message !== "object" || message === null) return null;
  return (message as { readonly event?: unknown }).event;
}

function fakeGamepad(): Gamepad {
  return {
    index: 0,
    id: "Fake Pad",
    mapping: "standard",
    connected: true,
    buttons: [{ pressed: true, touched: false, value: 1 }],
    axes: [0.25, -0.5],
    timestamp: 0,
    vibrationActuator: null,
  } as unknown as Gamepad;
}
