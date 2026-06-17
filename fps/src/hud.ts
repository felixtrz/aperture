import {
  dispatchApertureInputAction,
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";

const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
const healthEl = document.querySelector<HTMLElement>("#health");
const weaponEl = document.querySelector<HTMLElement>("#weapon");
const enemiesEl = document.querySelector<HTMLElement>("#enemies");
const crosshairEl = document.querySelector<HTMLImageElement>("#crosshair");

const MOUSE_LOOK_PIXELS_PER_UNIT = 26;
let pendingLookX = 0;
let pendingLookY = 0;
let lookActionActive = false;

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function writeText(el: HTMLElement | null, value: string): void {
  if (el !== null && el.textContent !== value) el.textContent = value;
}

function render(signals: GeneratedSignalSummary | null): void {
  const health = Math.max(0, Math.round(readNumber(signals?.health, 100)));
  const weaponName = readString(signals?.weaponName, "Blaster");
  const enemies = Math.max(0, readNumber(signals?.enemiesRemaining, 4));
  const crosshair = readString(signals?.crosshair, "/sprites/crosshair.png");

  writeText(healthEl, `${health}%`);
  writeText(weaponEl, weaponName);
  writeText(enemiesEl, String(enemies));

  if (crosshairEl !== null && crosshairEl.src !== crosshair) {
    crosshairEl.src = crosshair;
  }

  document.body.dataset.grounded =
    signals?.grounded === false ? "false" : "true";
}

render(null);
subscribeGeneratedSignals(render);

canvas?.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    void canvas.requestPointerLock();
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
    dispatchApertureInputAction("look", { x: 0, y: 0, source: "pointer-lock" });
    lookActionActive = false;
  }
});

function dispatchPendingLook(): void {
  if (pendingLookX !== 0 || pendingLookY !== 0) {
    dispatchApertureInputAction("look", {
      x: clampAxis(pendingLookX / MOUSE_LOOK_PIXELS_PER_UNIT),
      y: clampAxis(-pendingLookY / MOUSE_LOOK_PIXELS_PER_UNIT),
      source: "pointer-lock",
    });
    pendingLookX = 0;
    pendingLookY = 0;
    lookActionActive = true;
  } else if (lookActionActive) {
    dispatchApertureInputAction("look", {
      x: 0,
      y: 0,
      source: "pointer-lock",
    });
    lookActionActive = false;
  }

  requestAnimationFrame(dispatchPendingLook);
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

requestAnimationFrame(dispatchPendingLook);
