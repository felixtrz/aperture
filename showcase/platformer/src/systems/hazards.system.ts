import {
  AppEntityKey,
  AudioSimulationSpace,
  LocalTransform,
  createSystem,
  type Entity,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import { Collider } from "@aperture-engine/physics";
import {
  BRICKS,
  BRICK_HALF_EXTENT,
  FALLING_PLATFORMS,
  FALLING_PLATFORM_GRAVITY,
  FALLING_PLATFORM_SQUASH,
  PLAYER_CAPSULE_RADIUS,
  PLAYER_CAPSULE_TOP_OFFSET,
} from "../lib/platformer-data.js";
import { approachVec3 } from "../lib/platformer-controls.js";
import { PlatformerResource } from "../lib/platformer-resource.js";

const HIDDEN: Vec3 = [0, -1000, 0];
const SCALE_LERP_RATE = 10;
const BRICK_HIT_TOLERANCE = 0.35;
// ~0.13s after a falling platform is triggered before its collider drops out.
const FALL_GRACE_VELOCITY = 2;

export default class HazardsSystem extends createSystem({
  priority: 26,
  queries: { keyed: { required: [AppEntityKey] } },
}) {
  #squash = new Map<string, Vec3>();
  #voice = 0;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const state = this.resources.read(PlatformerResource);
    const player = state.bodyPosition;

    const falling = { ...state.falling };
    const exploded = { ...state.brickExploded };
    let fallingDirty = false;
    let brickDirty = false;

    // --- falling platforms --------------------------------------------------
    for (const platform of FALLING_PLATFORMS) {
      const collider = this.#findByKey(platform.key);
      const model = this.#findByKey(`${platform.key}.model`);
      let entry = falling[platform.key] ?? {
        falling: false,
        velocity: 0,
        offsetY: 0,
      };

      // Trigger only when the controller is actually standing on THIS platform's
      // collider — precise, no footprint false-positives that drop the platform
      // before the player arrives.
      if (!entry.falling && state.grounded && state.groundKey === platform.key) {
        entry = { falling: true, velocity: 0, offsetY: 0 };
        this.#playOneShot("fall");
        this.#squash.set(platform.key, [...FALLING_PLATFORM_SQUASH]);
        fallingDirty = true;
      }

      if (entry.falling) {
        const velocity = entry.velocity + FALLING_PLATFORM_GRAVITY * dt;
        const offsetY = entry.offsetY - velocity * dt;
        entry = { falling: true, velocity, offsetY };
        fallingDirty = true;
      }

      // The collider is static (never moves). Keep it solid for a short grace
      // after the trigger, then disable it so the player drops through while the
      // visual model continues to fall away.
      const colliderSolid = !entry.falling || entry.velocity < FALL_GRACE_VELOCITY;
      if (collider !== null && collider.hasComponent(Collider)) {
        collider.setValue(Collider, "enabled", colliderSolid);
      }

      const scale = approachVec3(
        this.#squash.get(platform.key) ?? [1, 1, 1],
        [1, 1, 1],
        SCALE_LERP_RATE,
        dt,
      );
      this.#squash.set(platform.key, scale);
      const y = platform.position[1] + entry.offsetY;
      if (model !== null) {
        model
          .getVectorView(LocalTransform, "translation")
          .set(y < -40 ? HIDDEN : [platform.position[0], y, platform.position[2]]);
        model.getVectorView(LocalTransform, "scale").set(scale);
      }

      falling[platform.key] = entry;
    }

    // --- breakable bricks ---------------------------------------------------
    for (const brick of BRICKS) {
      const collider = this.#findByKey(brick.key);
      const model = this.#findByKey(`${brick.key}.model`);
      const isExploded = exploded[brick.key] === true;

      if (!isExploded) {
        const withinFootprint =
          Math.abs(player[0] - brick.position[0]) <
            BRICK_HALF_EXTENT + PLAYER_CAPSULE_RADIUS &&
          Math.abs(player[2] - brick.position[2]) <
            BRICK_HALF_EXTENT + PLAYER_CAPSULE_RADIUS;
        // Brick glb origin is at its bottom face, so the underside is at
        // brick.position.y; the player strikes it with the capsule top.
        const headHit =
          state.verticalVelocity > 0 &&
          Math.abs(player[1] + PLAYER_CAPSULE_TOP_OFFSET - brick.position[1]) <
            BRICK_HIT_TOLERANCE;
        if (withinFootprint && headHit) {
          exploded[brick.key] = true;
          brickDirty = true;
          this.#playOneShot("break");
        }
      }

      const nowExploded = exploded[brick.key] === true;
      if (model !== null) {
        model
          .getVectorView(LocalTransform, "translation")
          .set(nowExploded ? HIDDEN : brick.position);
      }
      if (collider !== null && collider.hasComponent(Collider)) {
        collider.setValue(Collider, "enabled", !nowExploded);
      }
    }

    if (fallingDirty || brickDirty) {
      this.resources.write(PlatformerResource, (next) => {
        if (fallingDirty) next.falling = falling;
        if (brickDirty) next.brickExploded = exploded;
      });
    }
  }

  #playOneShot(clip: string): void {
    this.audio.playOneShot(`platformer.hazard.${this.#voice % 8}`, {
      clip: this.audio.clip(clip),
      busId: "sfx",
      gain: 0.6,
      timeScale: 0.9 + Math.random() * 0.2,
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.#voice += 1;
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
