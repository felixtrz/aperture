// Stress rapier determinism in Node with a MULTI-BODY contact scene: a leaning
// stack of boxes (offset so they collide/topple/settle) over a fixed ground.
// Prints a digest of all final positions; run twice and compare to judge
// whether the contact solver is deterministic in Node — the real question for
// headless physics validation.
import { createApertureApp } from "@aperture-engine/app/advanced";
import { AppEntityKey, LocalTransform, createSystem, material, mesh } from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";

const COUNT = 8;
let snapshot = [];

class StackSystem extends createSystem({
  priority: 0,
  queries: { bodies: { required: [AppEntityKey, LocalTransform] } },
}) {
  init() {
    this.spawn.mesh({
      key: "ground",
      mesh: mesh.box({ size: [10, 0.5, 10] }),
      material: material.standard(),
      transform: { translation: [0, -0.25, 0] },
      physics: { rigidBody: { kind: "fixed" }, collider: true },
    });
    for (let i = 0; i < COUNT; i += 1) {
      this.spawn.mesh({
        key: `box.${i}`,
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard(),
        transform: { translation: [i * 0.12, 1 + i * 1.05, 0] },
        physics: { rigidBody: true, collider: true },
      });
    }
  }
  update() {
    const rows = [];
    for (const e of this.queries.bodies.entities) {
      const key = e.getValue(AppEntityKey, "value");
      if (typeof key !== "string" || !key.startsWith("box.")) continue;
      const t = e.getVectorView(LocalTransform, "translation");
      rows.push(`${key}:${t[0].toFixed(6)},${t[1].toFixed(6)},${t[2].toFixed(6)}`);
    }
    rows.sort();
    snapshot = rows;
  }
}

const app = await createApertureApp({
  config: defineApertureConfig({ mode: "headless", systems: [], render: { defaultCamera: false, defaultLight: false } }),
  systems: [{ default: StackSystem }],
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  fixedStep: { fixedDelta: 1 / 60 },
});
if (app.preload) await app.preload;
for (let i = 0; i < 180; i += 1) app.stepAndExtract(1 / 60, i / 60, i);

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}
console.log(JSON.stringify({ bodies: snapshot.length, digest: fnv(snapshot.join("|")), sample: snapshot.slice(0, 2) }));
