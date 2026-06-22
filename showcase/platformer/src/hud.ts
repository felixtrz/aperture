import {
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";

const coinsEl = document.querySelector<HTMLElement>("#coins");

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function render(signals: GeneratedSignalSummary | null): void {
  if (coinsEl !== null) {
    const coins = String(readNumber(signals?.coins, 0));
    if (coinsEl.textContent !== coins) coinsEl.textContent = coins;
  }
}

render(null);
subscribeGeneratedSignals(render);
