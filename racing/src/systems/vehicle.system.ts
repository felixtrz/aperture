import {
  AppEntitySource,
  LocalTransform,
  Name,
  RenderInterpolation,
  WorldTransform,
  createSystem,
  type ApertureQuery,
  type SimulationFixedStepContext,
  type InputAxis2dAction,
} from "@aperture-engine/app/systems";
import {
  clamp,
  lerp,
  lerpAngle,
  quatFromAxisAngle,
  quatFromEulerYXZ,
  type Quat,
  type Vec3,
} from "../lib/math.js";
import {
  LINEAR_DAMP,
  MAX_SPEED,
  SPAWN_POS,
  SPHERE_RADIUS,
  VEHICLE_ROOT_SCALE,
} from "../lib/tuning.js";
import { vehicleState } from "../lib/vehicle-state.js";

type QueryEntity = ApertureQuery["entities"] extends Set<infer T> ? T : never;

const PLAYER_ASSET = "vehicle-truck-yellow";
const Y_AXIS: Vec3 = [0, 1, 0];

export default class VehicleSystem extends createSystem({
  priority: 40,
  queries: {
    nodes: { required: [Name, LocalTransform, AppEntitySource] },
  },
}) {
  #sphere: QueryEntity | null = null;
  #root: QueryEntity | null = null;
  #body: QueryEntity | null = null;
  #wheels: QueryEntity[] = [];
  #frontWheels: QueryEntity[] = [];
  #resolved = false;

  // Vehicle dynamics state (mirrors Vehicle.js).
  #linearSpeed = 0;
  #angularSpeed = 0;
  #acceleration = 0;
  #yaw = 0;
  #wheelSpin = 0;
  #frontSteer = 0;
  #bodyPitch = 0;
  #bodyRoll = 0;
  #driftIntensity = 0;
  #prevModel: Vec3 = [SPAWN_POS[0], 0, SPAWN_POS[2]];

  override init(): void {
    // Dynamic sphere body (Physics.js createSphereBody). Density chosen for the
    // reference's ~1000 kg mass given r=0.5 (volume ≈ 0.5236 m³).
    this.#sphere = this.spawn.physics({
      key: "vehicle.sphere",
      name: "vehicle.sphere",
      transform: { translation: [...SPAWN_POS] },
      physics: {
        rigidBody: {
          type: "dynamic",
          gravityScale: 1.5,
          linearDamping: 0.1,
          angularDamping: 4.0,
          ccdEnabled: true,
        },
        collider: {
          shape: { kind: "sphere", radius: SPHERE_RADIUS },
          friction: 5.0,
          restitution: 0.1,
          density: 1910,
        },
        velocity: { linear: [0, 0, 0], angular: [0, 0, 0] },
      },
    }) as QueryEntity;
    // Player vehicle (yellow truck), root scale 0.5 (Godot import).
    this.#root = this.spawn.gltf(this.assets.gltf(PLAYER_ASSET), {
      key: "player.vehicle",
      name: "player",
      tags: ["player"],
      castShadow: true,
      receiveShadow: true,
      transform: {
        translation: [SPAWN_POS[0], SPAWN_POS[1] - 0.5, SPAWN_POS[2]],
        scale: [VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE, VEHICLE_ROOT_SCALE],
      },
    }) as QueryEntity;
    enableRenderInterpolation(this.#root);
  }

  override fixedUpdate(context: SimulationFixedStepContext): void {
    this.#step(context.fixedDelta);
  }

  #step(delta: number): void {
    if (this.#sphere === null || this.#root === null) return;
    if (!this.#resolved) this.#resolveNodes();

    const dt = delta;

    const drive = this.actions.drive as InputAxis2dAction | undefined;
    const inputX = drive?.x.value ?? 0; // steer (+right)
    const inputZ = drive?.y.value ?? 0; // throttle (+forward)
    if (inputX !== 0 || inputZ !== 0) vehicleState.hadInput = true;

    // ── Steering + throttle (keyboard/gamepad path of Vehicle.js) ──
    let direction = Math.sign(this.#linearSpeed);
    if (direction === 0)
      direction = Math.abs(inputZ) > 0.1 ? Math.sign(inputZ) : 1;

    const steeringGrip = clamp(Math.abs(this.#linearSpeed), 0.2, 1.0);
    const targetAngular = -inputX * steeringGrip * 4 * direction;
    this.#angularSpeed = lerp(this.#angularSpeed, targetAngular, dt * 4);
    this.#yaw += this.#angularSpeed * dt;

    const targetSpeed = inputZ;
    if (targetSpeed < 0 && this.#linearSpeed > 0.01) {
      this.#linearSpeed = lerp(this.#linearSpeed, 0, dt * 8);
    } else if (targetSpeed < 0) {
      this.#linearSpeed = lerp(this.#linearSpeed, targetSpeed / 2, dt * 2);
    } else {
      this.#linearSpeed = lerp(
        this.#linearSpeed,
        targetSpeed * MAX_SPEED,
        dt * 1.5,
      );
    }
    this.#linearSpeed *= Math.max(0, 1 - LINEAR_DAMP * dt);

    // ── Drive the sphere via angular velocity along the car's right axis ──
    const forward: Vec3 = [Math.sin(this.#yaw), 0, Math.cos(this.#yaw)];
    const right: Vec3 = [Math.cos(this.#yaw), 0, -Math.sin(this.#yaw)];
    const angvel = this.physics.getAngularVelocity(this.#sphere);
    const driveAmt = this.#linearSpeed * 100 * dt;
    this.physics.setAngularVelocity(this.#sphere, [
      angvel[0] + right[0] * driveAmt,
      angvel[1],
      angvel[2] + right[2] * driveAmt,
    ]);

    // ── Read sphere pose (physics writeback to LocalTransform) ──
    const spherePos = this.#sphere.getVectorView(LocalTransform, "translation");
    let sx = spherePos[0] ?? SPAWN_POS[0];
    let sy = spherePos[1] ?? SPAWN_POS[1];
    let sz = spherePos[2] ?? SPAWN_POS[2];

    this.#acceleration = lerp(
      this.#acceleration,
      this.#linearSpeed +
        0.25 * this.#linearSpeed * Math.abs(this.#linearSpeed),
      dt,
    );

    // Respawn when falling out of the world.
    if (sy < -10) {
      spherePos.set([...SPAWN_POS]);
      this.physics.setLinearVelocity(this.#sphere, [0, 0, 0]);
      this.physics.setAngularVelocity(this.#sphere, [0, 0, 0]);
      sx = SPAWN_POS[0];
      sy = SPAWN_POS[1];
      sz = SPAWN_POS[2];
      this.#linearSpeed = 0;
      this.#angularSpeed = 0;
      this.#acceleration = 0;
      this.#yaw = 0;
    }

    // ── Container follows the sphere (y - 0.5) ──
    const cx = sx;
    const cy = sy - 0.5;
    const cz = sz;
    const rootRot = quatFromAxisAngle(Y_AXIS, this.#yaw);
    this.#root.getVectorView(LocalTransform, "translation").set([cx, cy, cz]);
    this.#root.getVectorView(LocalTransform, "rotation").set(rootRot);

    // ── Visual sub-node animation ──
    this.#updateBody(dt, inputX);
    this.#updateWheels(dt, inputX);
    this.#driftIntensity =
      Math.abs(this.#linearSpeed - this.#acceleration) +
      Math.abs(this.#bodyRoll) * 2;

    // ── Publish shared state ──
    let mvx = 0,
      mvy = 0,
      mvz = 0;
    if (dt > 0) {
      mvx = (cx - this.#prevModel[0]) / dt;
      mvy = (cy - this.#prevModel[1]) / dt;
      mvz = (cz - this.#prevModel[2]) / dt;
      this.#prevModel = [cx, cy, cz];
    }
    vehicleState.ready = true;
    vehicleState.sphere = [sx, sy, sz];
    vehicleState.container = [cx, cy, cz];
    vehicleState.yaw = this.#yaw;
    vehicleState.forward = forward;
    vehicleState.linearSpeed = this.#linearSpeed;
    vehicleState.modelVelocity = [mvx, mvy, mvz];
    vehicleState.driftIntensity = this.#driftIntensity;
    vehicleState.throttle = inputZ;
    this.#updateWheelWorldPositions();

    const speedSignal = this.signals["speed"];
    if (speedSignal !== undefined) {
      speedSignal.value = Number(
        (Math.abs(this.#linearSpeed) / MAX_SPEED).toFixed(3),
      );
    }
    // For the main-thread audio driver (src/audio.ts).
    const throttleSignal = this.signals["throttle"];
    if (throttleSignal !== undefined)
      throttleSignal.value = Number(inputZ.toFixed(3));
    const driftSignal = this.signals["driftIntensity"];
    if (driftSignal !== undefined) {
      driftSignal.value = Number(this.#driftIntensity.toFixed(3));
    }
  }

  #updateBody(dt: number, inputX: number): void {
    if (this.#body === null) return;
    this.#bodyPitch = lerpAngle(
      this.#bodyPitch,
      -(this.#linearSpeed - this.#acceleration) / 6,
      dt * 10,
    );
    this.#bodyRoll = lerpAngle(
      this.#bodyRoll,
      -(inputX / 5) * this.#linearSpeed,
      dt * 5,
    );
    this.#body
      .getVectorView(LocalTransform, "rotation")
      .set(quatFromEulerYXZ(this.#bodyPitch, 0, this.#bodyRoll) as Quat);
    const t = this.#body.getVectorView(LocalTransform, "translation");
    t[1] = lerp(t[1] ?? 0, 0.3, dt * 5);
  }

  #updateWheels(dt: number, inputX: number): void {
    this.#wheelSpin += this.#acceleration * dt * 60;
    this.#frontSteer = lerpAngle(this.#frontSteer, -inputX / 1.5, dt * 10);
    for (const wheel of this.#wheels) {
      const steer = this.#frontWheels.includes(wheel) ? this.#frontSteer : 0;
      wheel
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromEulerYXZ(this.#wheelSpin, steer, 0) as Quat);
    }
  }

  #updateWheelWorldPositions(): void {
    vehicleState.wheelBL = this.#worldPos(this.#findWheel("wheel-back-left"));
    vehicleState.wheelBR = this.#worldPos(this.#findWheel("wheel-back-right"));
  }

  #worldPos(entity: QueryEntity | null): Vec3 | null {
    if (entity === null || !entity.hasComponent(WorldTransform)) return null;
    const c3 = entity.getVectorView(WorldTransform, "col3");
    return [c3[0] ?? 0, c3[1] ?? 0, c3[2] ?? 0];
  }

  #resolveNodes(): void {
    for (const entity of this.queries.nodes.entities) {
      if (entity.getValue(AppEntitySource, "assetId") !== PLAYER_ASSET)
        continue;
      const name = entity.getValue(Name, "value");
      if (name === "body") {
        this.#body = entity;
        enableRenderInterpolation(entity);
      } else if (typeof name === "string" && name.includes("wheel")) {
        if (!this.#wheels.includes(entity)) {
          this.#wheels.push(entity);
        }
        enableRenderInterpolation(entity);
        if (name.includes("front") && !this.#frontWheels.includes(entity)) {
          this.#frontWheels.push(entity);
        }
      }
    }
    if (this.#body !== null && this.#wheels.length >= 4) this.#resolved = true;
  }

  #findWheel(nodeName: string): QueryEntity | null {
    for (const entity of this.queries.nodes.entities) {
      if (entity.getValue(AppEntitySource, "assetId") !== PLAYER_ASSET)
        continue;
      if (entity.getValue(Name, "value") === nodeName) return entity;
    }
    return null;
  }
}

function enableRenderInterpolation(entity: QueryEntity): void {
  if (!entity.hasComponent(RenderInterpolation)) {
    entity.addComponent(RenderInterpolation);
  }
}
