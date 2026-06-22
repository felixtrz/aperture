import { defineResource, resource } from "@aperture-engine/app/systems";
import {
  BRICKS,
  CAMERA_INITIAL_PITCH_DEG,
  CAMERA_INITIAL_YAW_DEG,
  CAMERA_INITIAL_ZOOM,
  COINS,
  FALLING_PLATFORMS,
  MAX_JUMPS,
  PLAYER_BODY_START,
} from "./platformer-data.js";
import { degToRad } from "./platformer-controls.js";

export interface FallingPlatformState {
  readonly falling: boolean;
  readonly velocity: number;
  readonly offsetY: number;
}

export type CoinGrabbedByKey = Record<string, boolean>;
export type FallingByKey = Record<string, FallingPlatformState>;
export type BrickExplodedByKey = Record<string, boolean>;

export function createCoinGrabbed(): CoinGrabbedByKey {
  return Object.fromEntries(COINS.map((coin) => [coin.key, false]));
}

export function createFalling(): FallingByKey {
  return Object.fromEntries(
    FALLING_PLATFORMS.map((platform) => [
      platform.key,
      { falling: false, velocity: 0, offsetY: 0 },
    ]),
  );
}

export function createBrickExploded(): BrickExplodedByKey {
  return Object.fromEntries(BRICKS.map((brick) => [brick.key, false]));
}

export const PlatformerResource = defineResource("platformer.state", {
  // Player (authored by player.system, read by camera/coins/hazards).
  bodyPosition: resource.vec3(PLAYER_BODY_START),
  movementVelocity: resource.vec3([0, 0, 0]),
  verticalVelocity: resource.number(0),
  jumpsRemaining: resource.number(MAX_JUMPS),
  grounded: resource.boolean(false),
  wasGrounded: resource.boolean(true),
  // AppEntityKey of the surface the character controller is standing on this
  // frame ("" when airborne) — lets hazards detect "stood on THIS platform".
  groundKey: resource.string(""),
  facingYaw: resource.number(0),
  modelScale: resource.vec3([1, 1, 1]),
  resetHold: resource.number(0),

  // Camera (authored by camera.system, yaw read by player.system for movement).
  cameraYaw: resource.number(degToRad(CAMERA_INITIAL_YAW_DEG)),
  cameraPitch: resource.number(degToRad(CAMERA_INITIAL_PITCH_DEG)),
  cameraZoom: resource.number(CAMERA_INITIAL_ZOOM),
  cameraTargetYaw: resource.number(degToRad(CAMERA_INITIAL_YAW_DEG)),
  cameraTargetPitch: resource.number(degToRad(CAMERA_INITIAL_PITCH_DEG)),
  cameraFollow: resource.vec3(PLAYER_BODY_START),

  // World state.
  coins: resource.number(0),
  coinGrabbed: resource.value<CoinGrabbedByKey>(createCoinGrabbed, {
    kind: "coin-grabbed",
    summarize: (value) => ({ ...value }),
  }),
  falling: resource.value<FallingByKey>(createFalling, {
    kind: "falling-platforms",
    summarize: (value) => ({ ...value }),
  }),
  brickExploded: resource.value<BrickExplodedByKey>(createBrickExploded, {
    kind: "brick-exploded",
    summarize: (value) => ({ ...value }),
  }),
});
