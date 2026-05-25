import {
  LocalTransform,
  Name,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export const schedule = { priority: 100 };

const SpinCrateSystemBase = createSystem({
  crates: {
    required: [Name, LocalTransform],
    where: [{ component: Name, key: "value", op: "eq", value: "crate" }],
  },
});

export default class SpinCrateSystem extends SpinCrateSystemBase {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.crates.entities) {
      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time));
    }
  }
}
