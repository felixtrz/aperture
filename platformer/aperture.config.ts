import {
  asset,
  defineApertureConfig,
  input,
  signal,
} from "@aperture-engine/app/config";

const model = (name: string) =>
  asset.gltf(`/models/${name}.glb`, { preload: "blocking" });

const sound = (name: string, durationHint: number) =>
  asset.audio(`/sounds/${name}.ogg`, { preload: "blocking", durationHint });

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
    character: model("character"),
    platform: model("platform"),
    "platform-medium": model("platform-medium"),
    "platform-grass-large-round": model("platform-grass-large-round"),
    "platform-falling": model("platform-falling"),
    brick: model("brick"),
    coin: model("coin"),
    cloud: model("cloud"),
    flag: model("flag"),
    "blob-shadow": sprite("blob_shadow"),
    skybox: sprite("skybox"),
    "coin-pickup": sound("coin", 0.3),
    jump: sound("jump", 0.3),
    land: sound("land", 0.3),
    fall: sound("fall", 0.4),
    break: sound("break", 0.5),
    walking: sound("walking", 0.7),
  },
  signals: {
    coins: signal.number(0),
    grounded: signal.boolean(false),
    playerX: signal.number(0),
    playerY: signal.number(0),
    playerZ: signal.number(0),
    groundKey: signal.string(""),
  },
  audio: true,
  input: {
    actions: {
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["KeyA"],
          positiveX: ["KeyD"],
          negativeY: ["KeyS"],
          positiveY: ["KeyW"],
        }),
        input.gamepadAxis("left", "x"),
        input.gamepadAxis("left", "y", { scale: -1 }),
      ]),
      cameraRotate: input.axis2d([
        input.keyboard2d({
          negativeX: ["ArrowLeft"],
          positiveX: ["ArrowRight"],
          negativeY: ["ArrowUp"],
          positiveY: ["ArrowDown"],
        }),
        input.gamepadAxis("right", "x"),
        input.gamepadAxis("right", "y"),
      ]),
      jump: input.button([input.key("Space"), input.gamepadButton("south")]),
      zoomIn: input.button([
        input.key("KeyQ"),
        input.key("Equal"),
        input.gamepadButton("rightTrigger"),
      ]),
      zoomOut: input.button([
        input.key("KeyE"),
        input.key("Minus"),
        input.gamepadButton("leftTrigger"),
      ]),
      reset: input.button([input.key("KeyR")]),
    },
  },
  physics: {
    backend: "rapier",
    gravity: [0, -25, 0],
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
    bloom: { threshold: 0.8, intensity: 0.05, radiusPixels: 2 },
  },
  diagnostics: {
    level: "info",
  },
});
