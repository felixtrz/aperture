import { AppEntityKey, createSystem, material, mesh, physics, serializeEntityRef } from "@aperture-engine/app/systems";

// A kinematic capsule walks +x toward a wall at x=3. Rapier's character
// controller should stop it before the wall (collision resolved in Node).
export default class CharSystem extends createSystem({
  priority: 0,
  queries: { bodies: { required: [AppEntityKey] } },
}) {
  override init(): void {
    this.spawn.camera({ key: "camera.main", transform: { translation: [0, 3, 12], lookAt: [1, 0, 0] } });
    this.spawn.mesh({ key: "floor", mesh: mesh.box({ size: [20, 1, 8] }), material: material.standard(), transform: { translation: [0, -0.5, 0] },
      physics: { rigidBody: { type: "static" }, collider: { shape: { kind: "box", halfExtents: [10, 0.5, 4] } } } });
    this.spawn.mesh({ key: "wall", mesh: mesh.box({ size: [0.5, 4, 8] }), material: material.standard({ baseColor: [0.8, 0.2, 0.2, 1] }), transform: { translation: [3, 1.5, 0] },
      physics: { rigidBody: { type: "static" }, collider: { shape: { kind: "box", halfExtents: [0.25, 2, 4] } } } });
    this.spawn.physics({ key: "char", tags: ["character"], transform: { translation: [0, 1, 0] },
      physics: {
        rigidBody: { type: "kinematicPosition", canSleep: false },
        collider: { shape: { kind: "capsule", radius: 0.4, halfHeight: 0.6 } },
        kinematicTarget: { enabled: true, translation: [0, 1, 0] },
        characterController: { offset: 0.02, slide: true, snapToGroundDistance: 0.2, maxSlopeClimbAngle: Math.PI / 4 },
      } });
  }

  override fixedUpdate(): void {
    const body = this.#char();
    if (body === null) return;
    const move = this.physics.moveCharacter({ entity: serializeEntityRef(body), desiredTranslation: [0.08, -0.02, 0] });
    if (move !== null) this.physics.setKinematicTarget(body, { translation: move.targetTranslation });
  }

  #char() {
    for (const e of this.queries.bodies.entities) if (e.getValue(AppEntityKey, "value") === "char") return e;
    return null;
  }
}
