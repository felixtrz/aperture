// Tests SessionSnapshot capture/restore continuation determinism in headless.
// A system accumulates context.random each step, so identical continuation
// after restore proves the snapshot captured the RNG (and time) state.
import {
  createApertureHeadlessRunner,
  createApertureSessionSnapshot,
} from "@aperture-engine/app/headless";
import { createSystem } from "@aperture-engine/app/systems";
import { defineApertureConfig, signal } from "@aperture-engine/app/config";

class AccumSystem extends createSystem({ priority: 0 }) {
  update() {
    const acc = this.signals.acc;
    if (acc) acc.value = Number(acc.value) + this.random.next();
  }
}

const config = defineApertureConfig({
  mode: "headless",
  systems: [],
  signals: { acc: signal.number(0) },
  render: { defaultCamera: false, defaultLight: false },
});

const runner = await createApertureHeadlessRunner({
  config,
  systems: [{ default: AccumSystem }],
});
if (runner.app.preload) await runner.app.preload;

const accOf = () => Number(runner.getStatus().signals.acc);

for (let i = 0; i < 30; i++) runner.step(1 / 60, i / 60);
const acc30 = accOf();

const snap = createApertureSessionSnapshot(runner);

for (let i = 30; i < 50; i++) runner.step(1 / 60, i / 60);
const acc50_a = accOf();

const report = runner.restoreSessionSnapshot(snap);
const acc30_restored = accOf();

for (let i = 30; i < 50; i++) runner.step(1 / 60, i / 60);
const acc50_b = accOf();

console.log(JSON.stringify({
  acc30,
  acc30_restored,
  restoredBackToFrame30: Math.abs(acc30 - acc30_restored) < 1e-12,
  acc50_a,
  acc50_b,
  continuationDeterministic: Math.abs(acc50_a - acc50_b) < 1e-12,
  restoreReportOk: report?.ok ?? report ?? null,
}, null, 2));
