import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

const model = (name: string) =>
  asset.gltf(`/models/${name}.glb`, { preload: "blocking" });

const sound = (name: string, durationHint: number) =>
  asset.audio(`/sounds/${name}.ogg`, {
    preload: "blocking",
    durationHint,
  });

const sprite = (name: string) =>
  asset.texture(`/sprites/${name}.png`, {
    preload: "blocking",
    colorSpace: "srgb",
    semantic: "base-color",
    mimeType: "image/png",
  });

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    platform: model("platform"),
    "platform-large-grass": model("platform-large-grass"),
    "wall-low": model("wall-low"),
    "wall-high": model("wall-high"),
    grass: model("grass"),
    "grass-small": model("grass-small"),
    cloud: model("cloud"),
    "enemy-flying": model("enemy-flying"),
    blaster: model("blaster"),
    "blaster-repeater": model("blaster-repeater"),
    "blaster-shot": sound("blaster", 0.35),
    "blaster-repeater-shot": sound("blaster_repeater", 0.16),
    "muzzle-burst": sprite("burst"),
    "impact-hit": sprite("hit"),
    "blob-shadow": sprite("blob_shadow"),
    skybox: sprite("skybox"),
    "enemy-hurt": sound("enemy_hurt", 0.2),
    "enemy-destroy": sound("enemy_destroy", 0.45),
    "enemy-attack": sound("enemy_attack", 0.22),
    "jump-a": sound("jump_a", 0.25),
    "jump-b": sound("jump_b", 0.25),
    "jump-c": sound("jump_c", 0.25),
    land: sound("land", 0.25),
    "weapon-change": sound("weapon_change", 0.2),
    walking: sound("walking", 0.7),
  },
  signals: {
    health: signal.number(100),
    weaponIndex: signal.number(0),
    weaponName: signal.string("Blaster"),
    crosshair: signal.string("/sprites/crosshair.png"),
    enemiesRemaining: signal.number(4),
    destroyedEnemies: signal.number(0),
    enemyDestroyedPulse: signal.number(0),
    lastDestroyedEnemy: signal.string(""),
    gameStatus: signal.string("active"),
    shotsFired: signal.number(0),
    hits: signal.number(0),
    grounded: signal.boolean(false),
    damagePulse: signal.number(0),
    playerX: signal.number(0),
    playerY: signal.number(1.5),
    playerZ: signal.number(0),
    lastShotFrame: signal.number(-1),
  },
  audio: true,
  input: {
    actions: {
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["KeyA", "ArrowLeft"],
          positiveX: ["KeyD", "ArrowRight"],
          negativeY: ["KeyS", "ArrowDown"],
          positiveY: ["KeyW", "ArrowUp"],
        }),
        input.gamepadAxis("left", "x"),
        input.gamepadAxis("left", "y", { scale: -1 }),
      ]),
      look: input.axis2d([
        input.gamepadAxis("right", "x", { deadzone: 0.12, scale: -1 }),
        input.gamepadAxis("right", "y", { deadzone: 0.12, scale: -1 }),
        input.keyboard2d({
          negativeX: ["KeyL"],
          positiveX: ["KeyJ"],
          negativeY: ["KeyK"],
          positiveY: ["KeyI"],
        }),
      ]),
      mouseLook: input.axis2d([input.virtual()]),
      jump: input.button([input.key("Space"), input.gamepadButton("south")]),
      shoot: input.button([
        input.pointer("primary"),
        input.gamepadButton("rightTrigger"),
      ]),
      switchWeapon: input.button([
        input.key("KeyE"),
        input.gamepadButton("leftStick"),
      ]),
      reset: input.button([input.key("KeyR")]),
    },
  },
  physics: {
    backend: "rapier",
    gravity: [0, -20, 0],
    colliderGeometry: { kind: "assets" },
  },
  render: {
    clearColor: [0.36, 0.39, 0.46, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
    tonemap: "aces",
    exposure: 1,
    bloom: { threshold: 0.7, intensity: 0.06, radiusPixels: 2 },
  },
  diagnostics: {
    level: "info",
  },
});
