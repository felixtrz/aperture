// Proves rapier physics actually SIMULATES in Node (not just initializes): a
// dynamic body falls under gravity over fixed steps. Reinforces F12 — full
// physics gameplay could be headless-validated if config.physics were wired.
import { createApertureApp } from "@aperture-engine/app/advanced";
import { AppEntityKey, LocalTransform, createSystem, material, mesh } from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";

const sample = { startY: null, endY: null };

class FallSystem extends createSystem({
  priority: 0,
  queries: { bodies: { required: [AppEntityKey, LocalTransform] } },
}) {
  init() {
    this.spawn.mesh({
      key: "faller",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      transform: { translation: [0, 10, 0] },
      physics: { rigidBody: true, collider: true },
    });
  }
  update() {
    for (const e of this.queries.bodies.entities) {
      if (e.getValue(AppEntityKey, "value") !== "faller") continue;
      const y = e.getVectorView(LocalTransform, "translation")[1];
      if (sample.startY === null) sample.startY = y;
      sample.endY = y;
    }
  }
}

const app = await createApertureApp({
  config: defineApertureConfig({ mode: "headless", systems: [], render: { defaultCamera: false, defaultLight: false } }),
  systems: [{ default: FallSystem }],
  physics: { backend: "rapier", gravity: [0, -9.81, 0] },
  fixedStep: { fixedDelta: 1 / 60 },
});
if (app.preload) await app.preload;

for (let i = 0; i < 60; i++) app.stepAndExtract(1 / 60, i / 60, i);

console.log(JSON.stringify({
  startY: sample.startY,
  endY: sample.endY,
  fellUnderGravity: sample.endY < sample.startY - 1,
  drop: sample.startY !== null ? +(sample.startY - sample.endY).toFixed(3) : null,
  physics: app.context?.physics?.summary?.()?.sync ?? "n/a",
}, null, 2));
