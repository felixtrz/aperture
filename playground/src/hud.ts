import { readGeneratedBrowserAppStatus } from "@aperture-engine/app/browser";

type JsonRecord = Record<string, unknown>;

const gemsEl = document.querySelector<HTMLElement>("#gems");
const totalGemsEl = document.querySelector<HTMLElement>("#total-gems");
const timeEl = document.querySelector<HTMLElement>("#run-time");
const stateEl = document.querySelector<HTMLElement>("#run-state");
const deathsEl = document.querySelector<HTMLElement>("#deaths");
const messageEl = document.querySelector<HTMLElement>("#message");

for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-key]",
)) {
  const code = button.dataset.key;
  if (code === undefined) {
    continue;
  }

  const press = (event: PointerEvent): void => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    dispatchKey(code, true);
  };
  const release = (event: PointerEvent): void => {
    event.preventDefault();
    button.releasePointerCapture?.(event.pointerId);
    dispatchKey(code, false);
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

function dispatchKey(code: string, pressed: boolean): void {
  window.dispatchEvent(
    new KeyboardEvent(pressed ? "keydown" : "keyup", {
      bubbles: true,
      code,
      key: keyFromCode(code),
    }),
  );
}

function keyFromCode(code: string): string {
  if (code === "Space") {
    return " ";
  }

  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3).toLowerCase();
  }

  return code;
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

function readRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

renderHud();
