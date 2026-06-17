import {
  dispatchApertureInputAction,
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";
import { clamp } from "@aperture-engine/simulation";

const lapEl = document.querySelector<HTMLElement>("#lap-timer .lap");
const currentEl = document.querySelector<HTMLElement>("#lap-timer .current");
const lastEl = document.querySelector<HTMLElement>("#lap-timer .last");
const bestEl = document.querySelector<HTMLElement>("#lap-timer .best");

function formatTime(t: number | null): string {
  if (t === null || t === undefined || t < 0) return "0:00.00";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function writeText(el: HTMLElement | null, value: string): void {
  if (el && el.textContent !== value) el.textContent = value;
}

function renderSignals(signals: GeneratedSignalSummary | null): void {
  const lap = readNumber(signals?.lap, 1);
  const current = readNumber(signals?.currentLapTime, 0);
  const last = readNumber(signals?.lastLapTime, -1);
  const best = readNumber(signals?.bestLapTime, -1);

  writeText(lapEl, String(lap));
  writeText(currentEl, formatTime(current));
  writeText(lastEl, formatTime(last));
  writeText(bestEl, formatTime(best));

  document.body.dataset.speed = String(
    readNumber(signals?.speed, 0).toFixed(2),
  );
}

renderSignals(null);
subscribeGeneratedSignals(renderSignals);

// ── Touch / pointer drive controls (Controls.js touch path) ──────────────────
// A virtual joystick: press anywhere, drag to steer (x) + throttle (y). Forwards
// to the sim worker via the app's virtual-input event (same path as keyboard).
function setupTouchControls(): void {
  const RADIUS = 64; // px drag for full deflection
  let active = false;
  let originX = 0;
  let originY = 0;

  const drive = (x: number, y: number) =>
    dispatchApertureInputAction("drive", { x, y });

  const begin = (x: number, y: number) => {
    active = true;
    originX = x;
    originY = y;
    drive(0, 0);
  };
  const move = (x: number, y: number) => {
    if (!active) return;
    drive(
      clamp((x - originX) / RADIUS, -1, 1),
      clamp((originY - y) / RADIUS, -1, 1),
    );
  };
  const end = () => {
    if (!active) return;
    active = false;
    drive(0, 0);
  };

  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (t) begin(t.clientX, t.clientY);
    },
    { passive: true },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    },
    { passive: true },
  );
  window.addEventListener("touchend", end, { passive: true });
  window.addEventListener("touchcancel", end, { passive: true });

  // Pointer drag (mouse/trackpad) for desktop testing of the same path.
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    begin(e.clientX, e.clientY);
  });
  window.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
  window.addEventListener("pointerup", end);
}

setupTouchControls();
