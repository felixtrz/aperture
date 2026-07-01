// Reproduces the serve `reset` crash by booting the headless runner twice with
// the SAME module-singleton custom component (what reset/bootRunner does).
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { createSystem, defineComponent, EcsType } from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";

const withCustom = process.argv[2] !== "no-custom";
const Foo = defineComponent("repro.foo", { v: { type: EcsType.Float32, default: 1 } });

class SceneSystem extends createSystem({ priority: 0 }) {
  init() {
    const e = this.createEntity();
    if (withCustom) e.addComponent(Foo, { v: 3 });
  }
}

const config = defineApertureConfig({
  mode: "headless",
  systems: [],
  render: { defaultCamera: true, defaultLight: true },
});
const systems = [{ default: SceneSystem }];

async function boot(label) {
  const r = await createApertureHeadlessRunner({ config, systems, random: 1 });
  await r.app.preload;
  r.step(1 / 60, 0);
  console.log(`${label} ok (custom component: ${withCustom})`);
  return r;
}

try {
  await boot("boot1");
  await boot("boot2 (simulated reset)");
  console.log("RESULT: no crash");
} catch (e) {
  console.log("RESULT: CRASH ->", e && e.message);
  console.log(e && e.stack ? e.stack.split("\n").slice(0, 8).join("\n") : "(no stack)");
}
