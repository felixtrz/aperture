import {
  AppEntityKey,
  AudioSimulationSpace,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  serializeEntityRef,
  type Entity,
  type InputAxis2dAction,
  type InputButtonAction,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import type { PhysicsCharacterControllerSettings } from "@aperture-engine/physics";
import {
  GRAVITY,
  JUMP_SQUASH,
  JUMP_STRENGTH,
  LAND_GRAVITY_THRESHOLD,
  LAND_SQUASH,
  MAX_JUMPS,
  MOVEMENT_LERP_RATE,
  PLAYER_BODY_KEY,
  PLAYER_BODY_START,
  PLAYER_MODEL_KEY,
  PLAYER_SHADOW_KEY,
  PLAYER_SPEED,
  RESPAWN_Y,
  ROTATION_LERP_RATE,
  SCALE_LERP_RATE,
  FOOTSTEP_SPEED_THRESHOLD,
} from "../lib/platformer-data.js";
import {
  approachVec3,
  clamp01,
  facingYawFromVelocity,
  horizontalSpeed,
  lerpAngle,
  smoothedMovementStep,
} from "../lib/platformer-controls.js";
import {
  PlatformerResource,
  createBrickExploded,
  createCoinGrabbed,
  createFalling,
} from "../lib/platformer-resource.js";

const CONTROLLER_SETTINGS: PhysicsCharacterControllerSettings = {
  offset: 0.02,
  slide: true,
  snapToGroundDistance: 0.18,
  maxSlopeClimbAngle: Math.PI / 4,
  minSlopeSlideAngle: Math.PI / 3,
  autostep: { maxHeight: 0.35, minWidth: 0.2 },
};
const CONTROLLER_ASCENDING: PhysicsCharacterControllerSettings = {
  ...CONTROLLER_SETTINGS,
  snapToGroundDistance: 0,
};

const ONE_SHOT_GAIN = 0.6;
const FOOTSTEP_GAIN = 0.5;
const ONE_SHOT_VOICES = 8;
const MODEL_YAW_OFFSET = 0;
const IDENTITY_QUAT: [number, number, number, number] = [0, 0, 0, 1];
const HIDDEN: Vec3 = [0, -1000, 0];

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: { keyed: { required: [AppEntityKey] } },
}) {
  #jumpWasPressed = false;
  #resetWasPressed = false;
  #currentClip: string | null = null;
  #voice = 0;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const state = this.resources.read(PlatformerResource);

    let position: Vec3 = [...state.bodyPosition];
    let movementVelocity: Vec3 = [...state.movementVelocity];
    let verticalVelocity = state.verticalVelocity;
    let jumpsRemaining = state.jumpsRemaining;
    let grounded = state.grounded;
    const wasGrounded = state.grounded;
    let facingYaw = state.facingYaw;
    let modelScale: Vec3 = [...state.modelScale];
    let coinReset = false;

    // --- reset (R) -> full level reset --------------------------------------
    if (this.#edge("reset", () => this.#resetWasPressed, (v) => (this.#resetWasPressed = v))) {
      position = [...PLAYER_BODY_START];
      movementVelocity = [0, 0, 0];
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
      grounded = false;
      modelScale = [1, 1, 1];
      coinReset = true;
    }

    // --- input --------------------------------------------------------------
    const move = this.actions.move;
    const moveX = move?.kind === "axis2d" ? (move as InputAxis2dAction).x.value : 0;
    const moveY = move?.kind === "axis2d" ? (move as InputAxis2dAction).y.value : 0;

    // --- gravity ------------------------------------------------------------
    verticalVelocity -= GRAVITY * dt;

    // --- jump (double jump via a recharging counter) ------------------------
    let jumpedThisFrame = false;
    const jumpPressed = this.#edge(
      "jump",
      () => this.#jumpWasPressed,
      (v) => (this.#jumpWasPressed = v),
    );
    if (jumpPressed && jumpsRemaining > 0) {
      verticalVelocity = JUMP_STRENGTH;
      jumpsRemaining -= 1;
      grounded = false;
      jumpedThisFrame = true;
      modelScale = [...JUMP_SQUASH];
      this.#playOneShot("jump");
    }

    // --- horizontal movement (camera-relative) + integrate ------------------
    const step = smoothedMovementStep({
      moveX,
      moveY,
      yaw: state.cameraYaw,
      speed: PLAYER_SPEED,
      currentVelocity: movementVelocity,
      verticalVelocity,
      dt,
      lerpRate: MOVEMENT_LERP_RATE,
    });
    movementVelocity = step.velocity;

    // --- move the character body through the physics controller -------------
    const moved = this.#moveBody(position, step.translation);
    position = moved.position;
    if (moved.blockedUpward && verticalVelocity > 0) verticalVelocity = 0;

    grounded = jumpedThisFrame || verticalVelocity > 0 ? false : moved.grounded;
    const groundKey = grounded ? moved.groundKey : "";

    // --- landing ------------------------------------------------------------
    const justLanded =
      grounded && !wasGrounded && verticalVelocity < -LAND_GRAVITY_THRESHOLD;
    if (grounded) {
      if (verticalVelocity < 0) verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
    }
    if (justLanded) {
      modelScale = [...LAND_SQUASH];
      this.#playOneShot("land");
    }

    // --- respawn ------------------------------------------------------------
    if (position[1] < RESPAWN_Y) {
      position = [...PLAYER_BODY_START];
      movementVelocity = [0, 0, 0];
      verticalVelocity = 0;
      jumpsRemaining = MAX_JUMPS;
      grounded = false;
      modelScale = [1, 1, 1];
      this.#writeBody(position);
      this.#playOneShot("fall");
    }

    // --- facing + squash recovery ------------------------------------------
    const speed = horizontalSpeed(movementVelocity);
    if (speed > 0.05) {
      const target = facingYawFromVelocity(
        movementVelocity[0],
        movementVelocity[2],
      );
      facingYaw = lerpAngle(facingYaw, target + MODEL_YAW_OFFSET, clamp01(ROTATION_LERP_RATE * dt));
    }
    modelScale = approachVec3(modelScale, [1, 1, 1], SCALE_LERP_RATE, dt);

    // --- write visuals ------------------------------------------------------
    this.#writeModel(position, facingYaw, modelScale);
    this.#writeShadow(position);
    this.#updateAnimation(grounded, speed);
    this.#updateFootsteps(grounded, speed);

    // --- persist ------------------------------------------------------------
    this.resources.write(PlatformerResource, (next) => {
      next.bodyPosition = position;
      next.movementVelocity = movementVelocity;
      next.verticalVelocity = verticalVelocity;
      next.jumpsRemaining = jumpsRemaining;
      next.grounded = grounded;
      next.wasGrounded = wasGrounded;
      next.groundKey = groundKey;
      next.facingYaw = facingYaw;
      next.modelScale = modelScale;
      if (coinReset) {
        next.coins = 0;
        next.coinGrabbed = createCoinGrabbed();
        next.falling = createFalling();
        next.brickExploded = createBrickExploded();
      }
    });

    const groundedSignal = this.signals.grounded;
    if (groundedSignal !== undefined) groundedSignal.value = grounded;
    if (this.signals.playerX !== undefined) this.signals.playerX.value = position[0];
    if (this.signals.playerY !== undefined) this.signals.playerY.value = position[1];
    if (this.signals.playerZ !== undefined) this.signals.playerZ.value = position[2];
    if (this.signals.groundKey !== undefined) this.signals.groundKey.value = groundKey;
  }

  // --- physics ---------------------------------------------------------------

  #moveBody(
    position: Vec3,
    desiredTranslation: Vec3,
  ): {
    position: Vec3;
    grounded: boolean;
    blockedUpward: boolean;
    groundKey: string;
  } {
    const body = this.#findByKey(PLAYER_BODY_KEY);
    if (body === null)
      return { position, grounded: false, blockedUpward: false, groundKey: "" };

    const move = this.physics.moveCharacter({
      entity: serializeEntityRef(body),
      desiredTranslation,
      settings:
        desiredTranslation[1] > 0 ? CONTROLLER_ASCENDING : CONTROLLER_SETTINGS,
    });
    if (move === null)
      return { position, grounded: false, blockedUpward: false, groundKey: "" };

    const target: Vec3 = [
      move.targetTranslation[0],
      move.targetTranslation[1],
      move.targetTranslation[2],
    ];
    this.#writeBody(target);

    let blockedUpward = false;
    let groundKey = "";
    for (const collision of move.collisions) {
      if (desiredTranslation[1] > 0 && collision.normal[1] < -0.5) {
        blockedUpward = true;
      }
      if (groundKey === "" && collision.normal[1] > 0.5 && collision.entity) {
        groundKey = this.#keyForRef(collision.entity);
      }
    }

    return { position: target, grounded: move.grounded, blockedUpward, groundKey };
  }

  #keyForRef(ref: string): string {
    for (const entity of this.queries.keyed.entities) {
      if (serializeEntityRef(entity) === ref) {
        const value = entity.getValue(AppEntityKey, "value");
        return typeof value === "string" ? value : "";
      }
    }
    return "";
  }

  #writeBody(translation: Vec3): void {
    const body = this.#findByKey(PLAYER_BODY_KEY);
    if (body === null) return;
    body.getVectorView(LocalTransform, "translation").set(translation);
    body.getVectorView(LocalTransform, "rotation").set(IDENTITY_QUAT);
    this.physics.setKinematicTarget(body, {
      translation,
      rotation: IDENTITY_QUAT,
    });
  }

  // --- visuals ---------------------------------------------------------------

  #writeModel(position: Vec3, facingYaw: number, scale: Vec3): void {
    const model = this.#findByKey(PLAYER_MODEL_KEY);
    if (model === null) return;
    model.getVectorView(LocalTransform, "translation").set(position);
    model.getVectorView(LocalTransform, "rotation").set(quatFromEulerYXZ(0, facingYaw, 0));
    model.getVectorView(LocalTransform, "scale").set(scale);
  }

  #writeShadow(position: Vec3): void {
    const shadow = this.#findByKey(PLAYER_SHADOW_KEY);
    if (shadow === null) return;
    const body = this.#findByKey(PLAYER_BODY_KEY);
    const exclude = body === null ? undefined : { excludeEntity: serializeEntityRef(body) };
    const hit = this.physics.raycastFirst(
      { origin: [position[0], position[1] + 0.5, position[2]], direction: [0, -1, 0], maxDistance: 60 },
      exclude,
    );
    if (hit === null) {
      shadow.getVectorView(LocalTransform, "translation").set(HIDDEN);
      return;
    }
    shadow.getVectorView(LocalTransform, "translation").set([hit.point[0], hit.point[1] + 0.02, hit.point[2]]);
  }

  #updateAnimation(grounded: boolean, speed: number): void {
    const model = this.#findByKey(PLAYER_MODEL_KEY);
    if (model === null) return;
    const anim = this.spawn.animation(model);
    if (anim.clipIds.length === 0) return;

    const target = !grounded ? "jump" : speed > 0.4 ? "walk" : "idle";
    if (!anim.clipIds.includes(target)) return;
    if (this.#currentClip === target && anim.activeClipId !== null) return;

    if (anim.activeClipId === null) {
      anim.playClip(target, { loop: "repeat" });
    } else {
      anim.crossFade(anim.activeClipId, target, 0.12);
    }
    this.#currentClip = target;
  }

  // --- audio -----------------------------------------------------------------

  // Bounded voice pool (mirrors Godot audio.gd's player pool): reuse a fixed set
  // of one-shot ids so a play session never allocates unbounded audio voices.
  #playOneShot(clip: string): void {
    this.audio.playOneShot(`platformer.player.${this.#voice % ONE_SHOT_VOICES}`, {
      clip: this.audio.clip(clip),
      busId: "sfx",
      gain: ONE_SHOT_GAIN,
      timeScale: 0.9 + Math.random() * 0.2,
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.#voice += 1;
  }

  #updateFootsteps(grounded: boolean, speed: number): void {
    this.audio.loop("platformer.walking", {
      clip: this.audio.clip("walking"),
      busId: "sfx",
      gain: FOOTSTEP_GAIN,
      muted: !(grounded && speed > FOOTSTEP_SPEED_THRESHOLD),
      simulationSpace: AudioSimulationSpace.Local,
    });
  }

  // --- helpers ---------------------------------------------------------------

  #edge(name: string, get: () => boolean, set: (value: boolean) => void): boolean {
    const action = this.#button(name);
    const down = action?.down() === true;
    const pressed = action?.pressed() === true;
    const edge = down || (pressed && !get());
    set(pressed);
    return edge;
  }

  #button(name: string): InputButtonAction | null {
    const action = this.actions[name];
    return action?.kind === "button" ? (action as InputButtonAction) : null;
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
