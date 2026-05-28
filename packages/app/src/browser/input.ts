import type { SimulationWorker } from "@aperture-engine/runtime";
import type { ApertureConfig } from "../config.js";
import {
  createGeneratedInputEventMessage,
  type ApertureGeneratedInputEvent,
} from "../input.js";
import type { GeneratedBrowserAppStatus } from "./status.js";

export const APERTURE_GENERATED_VIRTUAL_INPUT_EVENT =
  "aperture.generated.virtualAction" as const;

export interface ApertureVirtualActionInput {
  readonly source?: string;
  readonly pressed?: boolean;
  readonly value?: boolean | number;
  readonly x?: number;
  readonly y?: number;
}

export function dispatchApertureInputAction(
  action: string,
  input: boolean | number | ApertureVirtualActionInput = true,
  scope: EventTarget = globalThis as unknown as EventTarget,
): void {
  const detail =
    typeof input === "boolean"
      ? { action, pressed: input }
      : typeof input === "number"
        ? { action, value: input }
        : { action, ...input };

  scope.dispatchEvent(
    new CustomEvent(APERTURE_GENERATED_VIRTUAL_INPUT_EVENT, {
      detail,
    }),
  );
}

export function installGeneratedInputForwarding(
  canvas: HTMLCanvasElement,
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  config: ApertureConfig,
): void {
  if (!canvas.hasAttribute("tabindex")) {
    canvas.tabIndex = 0;
  }

  canvas.addEventListener("pointermove", (event) => {
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.focus();
    canvas.setPointerCapture?.(event.pointerId);
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: true,
    });
  });

  canvas.addEventListener("pointerup", (event) => {
    canvas.releasePointerCapture?.(event.pointerId);
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: false,
    });
  });

  const releasePointer = (event: PointerEvent): void => {
    forwardInput(worker, status, {
      kind: "pointer",
      pointer: "primary",
      position: pointerPosition(canvas, event),
      pressed: false,
    });
  };

  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("pointerleave", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    forwardInput(worker, status, {
      kind: "keyboard",
      key: event.code || event.key,
      pressed: true,
    });
  });

  window.addEventListener("keyup", (event) => {
    forwardInput(worker, status, {
      kind: "keyboard",
      key: event.code || event.key,
      pressed: false,
    });
  });

  window.addEventListener(APERTURE_GENERATED_VIRTUAL_INPUT_EVENT, (event) => {
    const inputEvent = virtualActionEventFromDetail(
      (event as CustomEvent).detail,
    );

    if (inputEvent === null) {
      return;
    }

    forwardInput(worker, status, inputEvent);
  });

  window.addEventListener("blur", () => {
    forwardInputReset(worker, status, "window-blur");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      forwardInputReset(worker, status, "document-hidden");
    }
  });

  installGeneratedGamepadPolling(worker, status, config);
}

function forwardInput(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  event: ApertureGeneratedInputEvent,
): void {
  worker.postMessage(createGeneratedInputEventMessage(event));
  status.forwardedInputEvents += 1;
  status.lastInputEvent = event;
}

function forwardInputReset(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  reason: string,
): void {
  status.lastInputReset = reason;
  forwardInput(worker, status, {
    kind: "reset",
    reason,
  });
}

function installGeneratedGamepadPolling(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  config: ApertureConfig,
): void {
  if (typeof navigator.getGamepads !== "function") {
    return;
  }

  let lastConnected = 0;
  const shouldPoll = configUsesGamepads(config);

  const poll = (): void => {
    const gamepads = browserGamepadSnapshots();
    const shouldForward = gamepads.length > 0 || lastConnected > 0;
    status.connectedGamepads = gamepads.length;

    if (shouldForward) {
      forwardInput(worker, status, {
        kind: "gamepad",
        replace: true,
        gamepads,
      });
      status.forwardedInputFrames += 1;
    }

    lastConnected = gamepads.length;
    requestAnimationFrame(poll);
  };

  if (shouldPoll) {
    requestAnimationFrame(poll);
  } else {
    window.addEventListener(
      "gamepadconnected",
      () => requestAnimationFrame(poll),
      {
        once: true,
      },
    );
  }
}

function browserGamepadSnapshots(): NonNullable<
  Extract<ApertureGeneratedInputEvent, { readonly kind: "gamepad" }>["gamepads"]
> {
  return [...navigator.getGamepads()]
    .filter((gamepad): gamepad is Gamepad => gamepad !== null)
    .map((gamepad) => ({
      index: gamepad.index,
      id: gamepad.id,
      mapping: gamepad.mapping,
      connected: gamepad.connected,
      buttons: gamepad.buttons.map((button) => ({
        pressed: button.pressed,
        touched: button.touched,
        value: button.value,
      })),
      axes: [...gamepad.axes],
    }));
}

function virtualActionEventFromDetail(
  detail: unknown,
): ApertureGeneratedInputEvent | null {
  if (!isRecord(detail)) {
    return null;
  }

  const action = stringFromValue(detail["action"]);
  if (action === undefined) {
    return null;
  }

  const x = numberFromValue(detail["x"]);
  const y = numberFromValue(detail["y"]);

  return {
    kind: "virtualAction",
    action,
    source: stringFromValue(detail["source"]) ?? "browser",
    ...(typeof detail["pressed"] === "boolean"
      ? { pressed: detail["pressed"] }
      : {}),
    ...(typeof detail["value"] === "boolean" ||
    typeof detail["value"] === "number"
      ? { value: detail["value"] }
      : {}),
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
  };
}

function configUsesGamepads(config: ApertureConfig): boolean {
  for (const descriptor of Object.values(config.input?.actions ?? {})) {
    const bindings = Array.isArray(descriptor)
      ? descriptor
      : "bindings" in descriptor
        ? descriptor.bindings
        : [];

    if (
      bindings.some(
        (binding) =>
          "gamepad" in binding ||
          ("kind" in binding && binding.kind.startsWith("gamepad")),
      )
    ) {
      return true;
    }
  }

  return false;
}

function pointerPosition(
  canvas: HTMLCanvasElement,
  event: PointerEvent,
): readonly [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width <= 0 ? 0 : (event.clientX - rect.left) / rect.width;
  const y = rect.height <= 0 ? 0 : (event.clientY - rect.top) / rect.height;

  return [clamp01(x), clamp01(y)];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFromValue(value: unknown): number | undefined {
  return Number.isFinite(value) ? (value as number) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
