import {
  dispatchApertureInputAction,
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";
import {
  FPS_INPUT_COMMAND_CHANNEL,
  type FpsInputCommand,
} from "./lib/fps-data.js";
import {
  sourceKeyboardButtonAction,
  sourceKeyboardButtonPressDispatches,
  sourceKeyboardMouseCaptureAction,
  sourceKeyboardMoveAxis,
  sourceKeyboardMoveKey,
  sourcePointerButtonAction,
  sourcePointerLockLookCommand,
  sourcePointerLockLookAxis,
  SOURCE_INSTANT_BUTTON_TAP_RELEASE_DELAY_MS,
  SOURCE_KEYBOARD_BUTTON_TAP_RELEASE_DELAY_MS,
  sourceHealthText,
  type SourceKeyboardButtonAction,
  type SourceKeyboardMoveKey,
  writeSourceHudCssVariables,
} from "./lib/fps-hud.js";

const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
const gameShellEl = document.querySelector<HTMLElement>("#game-shell");
const healthEl = document.querySelector<HTMLElement>("#health");
const crosshairEl = document.querySelector<HTMLImageElement>("#crosshair");

let pendingLookX = 0;
let pendingLookY = 0;
let lookActionActive = false;
let shootActionActive = false;
let unlockedClickShootFallbackPending = false;
const keyboardMoveKeys = new Set<SourceKeyboardMoveKey>();
const keyboardButtonActions = new Set<SourceKeyboardButtonAction>();
const keyboardButtonReleaseTimers = new Map<
  SourceKeyboardButtonAction,
  number
>();
const instantButtonReleaseTimers = new Map<string, number>();

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function writeText(el: HTMLElement | null, value: string): void {
  if (el !== null && el.textContent !== value) el.textContent = value;
}

function render(signals: GeneratedSignalSummary | null): void {
  if (signals !== null) {
    gameShellEl?.classList.add("boot-complete");
  }

  const crosshair =
    typeof signals?.crosshair === "string" && signals.crosshair.length > 0
      ? signals.crosshair
      : "/sprites/crosshair.png";

  writeText(healthEl, sourceHealthText(readNumber(signals?.health, 100)));

  if (crosshairEl !== null && crosshairEl.getAttribute("src") !== crosshair) {
    crosshairEl.setAttribute("src", crosshair);
  }
}

writeSourceHudCssVariables(document.documentElement.style);
render(null);
subscribeGeneratedSignals(render);

canvas?.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    requestPointerLock(canvas);
  }

  if (unlockedClickShootFallbackPending) {
    unlockedClickShootFallbackPending = false;
    dispatchInstantButtonAction("shoot", "fps-pointer");
  }
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  pendingLookX += event.movementX;
  pendingLookY += event.movementY;
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) {
    pendingLookX = 0;
    pendingLookY = 0;
    dispatchApertureInputAction("mouseLook", {
      x: 0,
      y: 0,
      source: "pointer-lock",
    });
    lookActionActive = false;
    releasePointerLockShoot();
  }
});

window.addEventListener("mousedown", (event) => {
  const pointerAction = sourcePointerButtonAction(event.button);
  if (pointerAction !== null) {
    if (!isCanvasPointerEvent(event)) return;
    event.preventDefault();
    return;
  }

  if (event.button !== 0) return;
  const pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && !isCanvasPointerEvent(event)) return;

  event.preventDefault();
  if (!pointerLocked && canvas !== null) {
    unlockedClickShootFallbackPending = true;
    requestPointerLock(canvas);
  }
  pressPointerLockShoot();
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || !shootActionActive) return;
  event.preventDefault();
  releasePointerLockShoot();
});

window.addEventListener("auxclick", (event) => {
  if (sourcePointerButtonAction(event.button) === null) return;
  if (!isCanvasPointerEvent(event)) return;
  event.preventDefault();
});

window.addEventListener("keydown", (event) => {
  handleKeyboardInput(event, true);
});

window.addEventListener("keyup", (event) => {
  handleKeyboardInput(event, false);
});

window.addEventListener("blur", () => {
  unlockedClickShootFallbackPending = false;
  releaseKeyboardActions();
  releasePointerLockShoot();
});

function dispatchPendingLook(): void {
  if (pendingLookX !== 0 || pendingLookY !== 0) {
    const [x, y] = sourcePointerLockLookAxis(pendingLookX, pendingLookY);
    const [rawX, rawY] = sourcePointerLockLookCommand(
      pendingLookX,
      pendingLookY,
    );
    dispatchApertureInputAction("mouseLook", {
      x,
      y,
      source: "pointer-lock",
    });
    dispatchFpsInputCommand({ kind: "look", x: rawX, y: rawY });
    pendingLookX = 0;
    pendingLookY = 0;
    lookActionActive = true;
  } else if (lookActionActive) {
    dispatchApertureInputAction("mouseLook", {
      x: 0,
      y: 0,
      source: "pointer-lock",
    });
    lookActionActive = false;
  }

  requestAnimationFrame(dispatchPendingLook);
}

function handleKeyboardInput(event: KeyboardEvent, pressed: boolean): void {
  if (isEditableKeyboardTarget(event.target)) return;

  const mouseCaptureAction = sourceKeyboardMouseCaptureAction(event.code);
  if (mouseCaptureAction !== null) {
    event.preventDefault();
    if (pressed) releaseMouseCapture();
    return;
  }

  const moveKey = sourceKeyboardMoveKey(event.code);
  if (moveKey !== null) {
    event.preventDefault();
    if (pressed) {
      keyboardMoveKeys.add(moveKey);
    } else {
      keyboardMoveKeys.delete(moveKey);
    }
    dispatchKeyboardMove();
    return;
  }

  const action = sourceKeyboardButtonAction(event.code);
  if (action === null) return;
  event.preventDefault();

  if (pressed) {
    pressKeyboardButtonAction(action, event.repeat);
  } else {
    releaseKeyboardButtonAction(action);
  }
}

function dispatchKeyboardMove(): void {
  const [x, y] = sourceKeyboardMoveAxis(keyboardMoveKeys);
  dispatchApertureInputAction("move", {
    x,
    y,
    source: "fps-keyboard",
  });
  dispatchFpsInputCommand({ kind: "move", x, y });
}

function releaseKeyboardActions(): void {
  if (keyboardMoveKeys.size > 0) {
    keyboardMoveKeys.clear();
    dispatchKeyboardMove();
  }

  for (const action of [...keyboardButtonActions]) {
    releaseKeyboardButtonActionNow(action);
  }

  for (const timer of keyboardButtonReleaseTimers.values()) {
    window.clearTimeout(timer);
  }
  keyboardButtonReleaseTimers.clear();
}

function pressKeyboardButtonAction(
  action: SourceKeyboardButtonAction,
  repeat: boolean,
): void {
  if (!sourceKeyboardButtonPressDispatches(repeat)) return;

  cancelKeyboardButtonRelease(action);
  keyboardButtonActions.add(action);
  dispatchApertureInputAction(action, {
    pressed: true,
    source: "fps-keyboard",
  });
  dispatchFpsInputCommand({ kind: "button", action, pressed: true });
}

function releaseKeyboardButtonAction(action: SourceKeyboardButtonAction): void {
  if (!keyboardButtonActions.has(action)) return;

  scheduleKeyboardButtonRelease(action);
}

function releaseKeyboardButtonActionNow(
  action: SourceKeyboardButtonAction,
): void {
  cancelKeyboardButtonRelease(action);
  if (!keyboardButtonActions.has(action)) return;

  keyboardButtonActions.delete(action);
  dispatchApertureInputAction(action, {
    pressed: false,
    source: "fps-keyboard",
  });
  dispatchFpsInputCommand({ kind: "button", action, pressed: false });
}

function dispatchInstantButtonAction(
  action: Extract<FpsInputCommand, { readonly kind: "button" }>["action"],
  source: string,
): void {
  cancelInstantButtonRelease(action, source);
  dispatchApertureInputAction(action, {
    pressed: true,
    source,
  });
  dispatchFpsInputCommand({ kind: "button", action, pressed: true });
  scheduleInstantButtonRelease(action, source);
}

function scheduleKeyboardButtonRelease(
  action: SourceKeyboardButtonAction,
): void {
  cancelKeyboardButtonRelease(action);
  keyboardButtonReleaseTimers.set(
    action,
    window.setTimeout(() => {
      keyboardButtonReleaseTimers.delete(action);
      releaseKeyboardButtonActionNow(action);
    }, SOURCE_KEYBOARD_BUTTON_TAP_RELEASE_DELAY_MS),
  );
}

function cancelKeyboardButtonRelease(action: SourceKeyboardButtonAction): void {
  const timer = keyboardButtonReleaseTimers.get(action);
  if (timer === undefined) return;

  window.clearTimeout(timer);
  keyboardButtonReleaseTimers.delete(action);
}

function scheduleInstantButtonRelease(
  action: Extract<FpsInputCommand, { readonly kind: "button" }>["action"],
  source: string,
): void {
  const key = instantButtonReleaseKey(action, source);
  cancelInstantButtonRelease(action, source);
  instantButtonReleaseTimers.set(
    key,
    window.setTimeout(() => {
      instantButtonReleaseTimers.delete(key);
      dispatchApertureInputAction(action, {
        pressed: false,
        source,
      });
      dispatchFpsInputCommand({ kind: "button", action, pressed: false });
    }, SOURCE_INSTANT_BUTTON_TAP_RELEASE_DELAY_MS),
  );
}

function cancelInstantButtonRelease(
  action: Extract<FpsInputCommand, { readonly kind: "button" }>["action"],
  source: string,
): void {
  const key = instantButtonReleaseKey(action, source);
  const timer = instantButtonReleaseTimers.get(key);
  if (timer === undefined) return;

  window.clearTimeout(timer);
  instantButtonReleaseTimers.delete(key);
}

function instantButtonReleaseKey(
  action: Extract<FpsInputCommand, { readonly kind: "button" }>["action"],
  source: string,
): string {
  return `${source}:${action}`;
}

function pressPointerLockShoot(): void {
  shootActionActive = true;
  dispatchApertureInputAction("shoot", {
    pressed: true,
    source: "pointer-lock",
  });
  dispatchFpsInputCommand({ kind: "button", action: "shoot", pressed: true });
}

function releasePointerLockShoot(): void {
  if (!shootActionActive) return;

  shootActionActive = false;
  dispatchApertureInputAction("shoot", {
    pressed: false,
    source: "pointer-lock",
  });
  dispatchFpsInputCommand({ kind: "button", action: "shoot", pressed: false });
}

function releaseMouseCapture(): void {
  unlockedClickShootFallbackPending = false;
  pendingLookX = 0;
  pendingLookY = 0;

  if (lookActionActive) {
    dispatchApertureInputAction("mouseLook", {
      x: 0,
      y: 0,
      source: "pointer-lock",
    });
    lookActionActive = false;
  }

  releasePointerLockShoot();

  try {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  } catch {
    // Browser automation can reject capture state changes outside normal input.
  }
}

function requestPointerLock(target: HTMLCanvasElement): void {
  try {
    const result = target.requestPointerLock() as Promise<void> | void;
    void result?.catch(() => {
      // Some managed-browser automation paths reject pointer lock; raw pointer
      // and generated action input still keep the port controllable.
    });
  } catch {
    // Older browser implementations can throw synchronously here.
  }
}

function isCanvasPointerEvent(event: Event): boolean {
  return canvas !== null && event.composedPath().includes(canvas);
}

function dispatchFpsInputCommand(payload: FpsInputCommand): void {
  window.dispatchEvent(
    new CustomEvent("aperture:command", {
      detail: {
        channel: FPS_INPUT_COMMAND_CHANNEL,
        payload,
      },
    }),
  );
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

requestAnimationFrame(dispatchPendingLook);
