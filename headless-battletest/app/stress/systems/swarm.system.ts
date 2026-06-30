import {
  AppEntityKey, LocalTransform, createSystem, material, mesh, quatFromAxisAngle,
} from "@aperture-engine/app/systems";

const COUNT = Number(process.env.SWARM_COUNT) || 2000;
const SIDE = 45;

export default class SwarmSystem extends createSystem({
  priority: 0,
  queries: { movers: { required: [AppEntityKey, LocalTransform] } },
}) {
  override init(): void {
    this.spawn.camera({ key: "cam", transform: { translation: [0, 40, 90], lookAt: [0, 0, 0] }, fovYDegrees: 60 });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 4, transform: { rotationEulerDegrees: [-45, 35, 0] } });
    for (let i = 0; i < COUNT; i++) {
      const x = (i % SIDE) - SIDE / 2;
      const z = Math.floor(i / SIDE) - SIDE / 2;
      this.spawn.mesh({
        key: `swarm.${i}`,
        mesh: mesh.box({ size: [0.5, 0.5, 0.5] }),
        material: material.standard({ baseColor: [0.5, 0.6, 0.9, 1] }),
        transform: { translation: [x, 0, z] },
      });
    }
  }
  override update(): void {
    const t = this.time.elapsed;
    let i = 0;
    for (const e of this.queries.movers.entities) {
      const key = e.getValue(AppEntityKey, "value");
      if (typeof key !== "string" || !key.startsWith("swarm.")) continue;
      e.getVectorView(LocalTransform, "rotation").set(quatFromAxisAngle([0, 1, 0], t + i * 0.01));
      i++;
    }
  }
}
