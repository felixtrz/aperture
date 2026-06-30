// Proves fixedUpdate + rapier physics CAN run in Node via the low-level
// createApertureApp API with explicit physics/fixedStep options — i.e. F12 is
// a config-wiring gap in the headless CLI, not a Node limitation.
import { createApertureApp } from "@aperture-engine/app/advanced";
import { createSystem } from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";

const counters = { update: 0, fixed: 0, lastFixedDelta: 0 };

class ProbeSystem extends createSystem({ priority: 0 }) {
  update() {
    counters.update += 1;
  }
  fixedUpdate(context) {
    counters.fixed += 1;
    counters.lastFixedDelta = context.fixedDelta;
  }
}

const config = defineApertureConfig({
  mode: "headless",
  systems: [],
  render: { defaultCamera: false, defaultLight: false },
});

const app = await createApertureApp({
  config,
  systems: [{ default: ProbeSystem }],
  // The options the headless CLI never sets from config.physics:
  physics: { backend: "rapier", gravity: [0, -25, 0] },
  fixedStep: { fixedDelta: 1 / 60 },
});

if (app.preload) await app.preload;

for (let i = 0; i < 10; i++) {
  app.stepAndExtract(1 / 60, i / 60, i);
}

console.log(JSON.stringify({
  updateCalls: counters.update,
  fixedUpdateCalls: counters.fixed,
  lastFixedDelta: counters.lastFixedDelta,
  fixedStepClock: app.snapshotFixedStepClock?.() ?? null,
  physics: app.context?.physics?.summary?.() ?? "n/a",
}, null, 2));
