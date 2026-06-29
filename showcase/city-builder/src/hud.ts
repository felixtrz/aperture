import {
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";
import {
  CITY_BUILD_CHANNEL,
  CITY_CAMERA_CHANNEL,
  type CityBuildCommand,
  type CityCameraCommand,
} from "./lib/city-data.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
const amountEl = document.querySelector<HTMLElement>("#cash .amount");
const nameEl = document.querySelector<HTMLElement>("#selection .name");
const metaEl = document.querySelector<HTMLElement>("#selection .meta");

// --- browser -> simulation command bridge ----------------------------------
function dispatchCommand(channel: string, payload: unknown): void {
  window.dispatchEvent(
    new CustomEvent("aperture:command", { detail: { channel, payload } }),
  );
}
const sendBuild = (payload: CityBuildCommand) =>
  dispatchCommand(CITY_BUILD_CHANNEL, payload);
const sendCamera = (payload: CityCameraCommand) =>
  dispatchCommand(CITY_CAMERA_CHANNEL, payload);

function normalizedPointer(event: MouseEvent): [number, number] | null {
  if (canvas === null) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
}

let orbiting = false;

canvas?.addEventListener("pointermove", (event) => {
  const pointer = normalizedPointer(event);
  if (pointer !== null)
    sendBuild({ kind: "pointer", x: pointer[0], y: pointer[1] });
});

canvas?.addEventListener("mousedown", (event) => {
  if (event.button === 0) {
    // Left button: place the current structure under the cursor.
    const pointer = normalizedPointer(event);
    if (pointer !== null)
      sendBuild({ kind: "pointer", x: pointer[0], y: pointer[1] });
    sendBuild({ kind: "build" });
  } else if (event.button === 1) {
    // Middle button: hold to orbit the camera.
    event.preventDefault();
    orbiting = true;
  } else if (event.button === 2) {
    // Right button: rotate the selected piece 90°.
    sendBuild({ kind: "rotate" });
  }
});

window.addEventListener("mousemove", (event) => {
  if (orbiting && event.movementX !== 0) {
    sendCamera({ kind: "yaw", delta: event.movementX });
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 1) orbiting = false;
});

window.addEventListener("blur", () => {
  orbiting = false;
});

canvas?.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    // Wheel up (deltaY < 0) zooms in (reduces camera distance).
    sendCamera({ kind: "zoom", delta: Math.sign(event.deltaY) });
  },
  { passive: false },
);

// Suppress the browser context menu so right-click can rotate pieces.
canvas?.addEventListener("contextmenu", (event) => event.preventDefault());

// --- signal-driven HUD ------------------------------------------------------
function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function render(signals: GeneratedSignalSummary | null): void {
  const cash = readNumber(signals?.cash, 10000);
  if (amountEl !== null) {
    amountEl.textContent = `$${cash.toLocaleString("en-US")}`;
    amountEl.classList.toggle("negative", cash < 0);
  }

  const name =
    typeof signals?.structureName === "string" ? signals.structureName : "Road";
  if (nameEl !== null) nameEl.textContent = name;

  const price = readNumber(signals?.structurePrice, 25);
  const placed = readNumber(signals?.cellCount, 0);
  if (metaEl !== null) {
    metaEl.textContent = `$${price} · ${placed} placed`;
  }
}

render(null);
subscribeGeneratedSignals(render);
