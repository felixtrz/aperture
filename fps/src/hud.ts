import {
  dispatchApertureInputAction,
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";
import {
  sourcePointerLockLookAxis,
  sourceHealthText,
  writeSourceHudCssVariables,
} from "./lib/fps-hud.js";

const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
const healthEl = document.querySelector<HTMLElement>("#health");
const crosshairEl = document.querySelector<HTMLImageElement>("#crosshair");

const POINTER_LOCK_SHOOT_RELEASE_DELAY_MS = 40;
let pendingLookX = 0;
let pendingLookY = 0;
let lookActionActive = false;
let shootActionActive = false;
let shootReleaseTimer: number | undefined;

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function writeText(el: HTMLElement | null, value: string): void {
  if (el !== null && el.textContent !== value) el.textContent = value;
}

function render(signals: GeneratedSignalSummary | null): void {
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
    releasePointerLockShoot({ immediate: true });
  }
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  const pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && !isCanvasPointerEvent(event)) return;

  event.preventDefault();
  if (!pointerLocked && canvas !== null) requestPointerLock(canvas);
  pressPointerLockShoot();
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || !shootActionActive) return;
  event.preventDefault();
  releasePointerLockShoot();
});

window.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  const pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && !isCanvasPointerEvent(event)) return;

  event.preventDefault();
  if (!pointerLocked && canvas !== null) requestPointerLock(canvas);
  pressPointerLockShoot();
});

window.addEventListener("pointerup", (event) => {
  if (!event.isPrimary || event.button !== 0 || !shootActionActive) return;
  event.preventDefault();
  releasePointerLockShoot();
});

function dispatchPendingLook(): void {
  if (pendingLookX !== 0 || pendingLookY !== 0) {
    const [x, y] = sourcePointerLockLookAxis(pendingLookX, pendingLookY);
    dispatchApertureInputAction("mouseLook", {
      x,
      y,
      source: "pointer-lock",
    });
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

function pressPointerLockShoot(): void {
  if (shootReleaseTimer !== undefined) {
    window.clearTimeout(shootReleaseTimer);
    shootReleaseTimer = undefined;
  }

  if (shootActionActive) return;
  shootActionActive = true;
  dispatchApertureInputAction("shoot", {
    pressed: true,
    source: "pointer-lock",
  });
}

function releasePointerLockShoot(
  options: { readonly immediate?: boolean } = {},
): void {
  if (!shootActionActive) return;

  if (options.immediate === true) {
    if (shootReleaseTimer !== undefined) {
      window.clearTimeout(shootReleaseTimer);
      shootReleaseTimer = undefined;
    }
    dispatchPointerLockShootRelease();
    return;
  }

  if (shootReleaseTimer !== undefined) return;
  shootReleaseTimer = window.setTimeout(() => {
    shootReleaseTimer = undefined;
    dispatchPointerLockShootRelease();
  }, POINTER_LOCK_SHOOT_RELEASE_DELAY_MS);
}

function dispatchPointerLockShootRelease(): void {
  if (!shootActionActive) return;
  shootActionActive = false;
  dispatchApertureInputAction("shoot", {
    pressed: false,
    source: "pointer-lock",
  });
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

requestAnimationFrame(dispatchPendingLook);
