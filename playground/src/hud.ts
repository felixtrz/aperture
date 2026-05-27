import {
  dispatchApertureInputAction,
  readGeneratedBrowserAppStatus,
} from "@aperture-engine/app/browser";

type JsonRecord = Record<string, unknown>;

const gemsEl = document.querySelector<HTMLElement>("#gems");
const totalGemsEl = document.querySelector<HTMLElement>("#total-gems");
const timeEl = document.querySelector<HTMLElement>("#run-time");
const stateEl = document.querySelector<HTMLElement>("#run-state");
const deathsEl = document.querySelector<HTMLElement>("#deaths");
const messageEl = document.querySelector<HTMLElement>("#message");

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-action]",
)) {
  const action = button.dataset.action;
  if (action === undefined) {
    continue;
  }

  const press = (event: PointerEvent): void => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    dispatchTouchAction(button, action, true);
  };
  const release = (event: PointerEvent): void => {
    event.preventDefault();
    button.releasePointerCapture?.(event.pointerId);
    dispatchTouchAction(button, action, false);
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

function renderHud(): void {
  const status = readGeneratedBrowserAppStatus();
  const worker = readRecord(status?.lastWorkerSummary);
  const signals = readRecord(worker?.signals);
  const gems = readNumber(signals?.gems, 0);
  const totalGems = readNumber(signals?.totalGems, 0);
  const runTime = readNumber(signals?.time, 0);
  const runState = readString(signals?.runState, "run");
  const deaths = readNumber(signals?.deaths, 0);
  const message = readString(
    signals?.message,
    "Collect every gem and reach the flag",
  );

  writeText(gemsEl, String(gems));
  writeText(totalGemsEl, String(totalGems));
  writeText(timeEl, runTime.toFixed(1));
  writeText(stateEl, runState === "clear" ? "Clear" : "Run");
  writeText(deathsEl, String(deaths));
  writeText(messageEl, message);

  document.body.dataset.apertureStatus = status?.status ?? "starting";
  document.body.dataset.apertureSnapshots = String(status?.snapshots ?? 0);
  document.body.dataset.gameState = runState;
  document.body.dataset.gems = String(gems);
  document.body.dataset.webgpuOk = String(status?.webgpuOk ?? false);

  requestAnimationFrame(renderHud);
}

function dispatchTouchAction(
  button: HTMLButtonElement,
  action: string,
  pressed: boolean,
): void {
  const x = readNumberAttribute(button.dataset.x);
  const y = readNumberAttribute(button.dataset.y);

  if (x !== null || y !== null) {
    dispatchApertureInputAction(action, {
      source: "touch-hud",
      x: pressed ? (x ?? 0) : 0,
      y: pressed ? (y ?? 0) : 0,
    });
    return;
  }

  dispatchApertureInputAction(action, {
    source: "touch-hud",
    pressed,
  });
}

function writeText(element: HTMLElement | null, value: string): void {
  if (element !== null && element.textContent !== value) {
    element.textContent = value;
  }
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNumberAttribute(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

renderHud();
