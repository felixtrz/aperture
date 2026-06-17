import {
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";

const healthEl = document.querySelector<HTMLElement>("#health");
const weaponEl = document.querySelector<HTMLElement>("#weapon");
const enemiesEl = document.querySelector<HTMLElement>("#enemies");
const crosshairEl = document.querySelector<HTMLImageElement>("#crosshair");

const crosshairs = [
  "/sprites/crosshair.png",
  "/sprites/crosshair-repeater.png",
];

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
  const weaponIndex = readNumber(signals?.weaponIndex, 0);
  const weaponName = readString(signals?.weaponName, "Blaster");
  const enemies = Math.max(0, readNumber(signals?.enemiesRemaining, 4));

  writeText(healthEl, `${health}%`);
  writeText(weaponEl, weaponName);
  writeText(enemiesEl, String(enemies));

  const crosshair =
    crosshairs[weaponIndex] ?? crosshairs[0] ?? "/sprites/crosshair.png";
  if (crosshairEl !== null && crosshairEl.src !== crosshair) {
    crosshairEl.src = crosshair;
  }

  document.body.dataset.grounded =
    signals?.grounded === false ? "false" : "true";
}

render(null);
subscribeGeneratedSignals(render);
