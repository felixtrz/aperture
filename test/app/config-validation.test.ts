import { describe, expect, it } from "vitest";

import {
  ApertureConfigError,
  asset,
  input,
  validateApertureConfig,
  type ApertureConfig,
  type ApertureConfigAssetDescriptor,
  type GamepadButtonName,
  type GamepadStickName,
  type InputActionBinding,
  type InputActionConfigEntry,
  type InputGamepadAxisBinding,
  type InputPointerBinding,
} from "@aperture-engine/app/config";
import { isPreloadPolicy } from "../../packages/app/src/config/validation.js";

function actionConfig(
  actions: Readonly<Record<string, InputActionConfigEntry>>,
): ApertureConfig {
  return { mode: "headless", input: { actions } };
}

function configError(run: () => void): ApertureConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApertureConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected validateApertureConfig to throw");
}

describe("validateApertureConfig", () => {
  describe("mode and canvas", () => {
    it("accepts a minimal headless config", () => {
      expect(() => validateApertureConfig({ mode: "headless" })).not.toThrow();
    });

    it("accepts a browser config with a canvas selector", () => {
      expect(() =>
        validateApertureConfig({ mode: "browser", canvas: "#aperture" }),
      ).not.toThrow();
    });

    it("rejects unknown modes", () => {
      const error = configError(() =>
        validateApertureConfig({ mode: "native" } as unknown as ApertureConfig),
      );

      expect(error.code).toBe("aperture.config.invalidMode");
      expect(error.message).toContain("received 'native'");
    });

    it("rejects browser configs without a canvas selector", () => {
      const error = configError(() =>
        validateApertureConfig({ mode: "browser" }),
      );

      expect(error.code).toBe("aperture.config.missingCanvas");
    });

    it("rejects browser configs with a blank canvas selector", () => {
      const error = configError(() =>
        validateApertureConfig({ mode: "browser", canvas: "   " }),
      );

      expect(error.code).toBe("aperture.config.missingCanvas");
    });
  });

  describe("assets", () => {
    it("accepts declared asset descriptors", () => {
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            robot: asset.gltf("/assets/robot.glb", { preload: "blocking" }),
            floorColor: asset.texture("/assets/floor.png", {
              colorSpace: "srgb",
              semantic: "base-color",
              mimeType: "image/png",
            }),
            sky: asset.hdr("/assets/sky.hdr", { preload: "background" }),
            "level.crate": asset.shader("/assets/crate.wgsl"),
            engine: asset.audio("/assets/engine.ogg", {
              preload: "blocking",
              durationHint: 2.1,
              channels: 2,
            }),
            smoke: asset.particleEffect({
              main: {
                maxParticles: 1280,
                startLifetime: { min: 2.5, max: 2.5 },
              },
              renderer: {
                texture: "floorColor",
                blendMode: "alpha",
              },
            }),
          },
          audio: { autoUnlock: true },
        }),
      ).not.toThrow();
    });

    it("rejects asset ids that are not identifier-like", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: { "9robot": asset.gltf("/assets/robot.glb") },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidAssetId");
      expect(error.message).toContain("'9robot'");
    });

    it("rejects unsupported asset kinds", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            theme: {
              kind: "video",
              url: "/assets/theme.mp4",
              preload: "manual",
            } as unknown as ApertureConfigAssetDescriptor,
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidAssetKind");
      expect(error.message).toContain("'video'");
    });

    it("rejects invalid audio asset options", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            engine: asset.audio("/assets/engine.ogg", {
              durationHint: -1,
            }),
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidAudioAsset");
      expect(error.message).toContain("durationHint");
    });

    it("rejects invalid texture asset options", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            normalMap: asset.texture("/assets/normal.png", {
              colorSpace: "srgb",
              semantic: "normal",
            }),
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidTextureAsset");
      expect(error.message).toContain("normal");
    });

    it("rejects invalid particle effect asset options", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            smoke: asset.particleEffect({
              main: {
                maxParticles: 0,
              },
              renderer: {
                texture: "9smoke",
              },
            }),
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidParticleEffectAsset");
      expect(error.message).toContain("texture");
    });

    it("accepts a valid composite particle effect", () => {
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            smoke: asset.particleEffect({ main: { maxParticles: 16 } }),
            sparks: asset.particleEffect({ main: { maxParticles: 16 } }),
            explosion: asset.particleEffect({
              type: "composite",
              emitters: [
                { effect: "smoke", delay: 0.05 },
                { effect: "sparks", timeScale: 2 },
              ],
            }),
          },
        }),
      ).not.toThrow();
    });

    it("rejects a raw composite descriptor that mixes leaf modules", () => {
      // The typed asset.particleEffect() helper makes mixing a compile error and
      // simply drops stray fields, so feed a raw descriptor to exercise the
      // runtime mixing-rejection path in config validation.
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            explosion: {
              kind: "particle-effect",
              preload: "manual",
              version: 2,
              type: "composite",
              emitters: [{ effect: "smoke" }],
              main: { maxParticles: 16 },
            },
          } as never,
        }),
      );

      expect(error.code).toBe("aperture.config.invalidParticleEffectAsset");
    });

    it("rejects a composite with an invalid child effect reference", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            explosion: asset.particleEffect({
              type: "composite",
              emitters: [{ effect: "9smoke" }],
            }),
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidParticleEffectAsset");
      expect(error.message).toContain("effect");
    });

    it("rejects a composite without emitters", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            explosion: asset.particleEffect({
              type: "composite",
              emitters: [],
            }),
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidParticleEffectAsset");
    });

    it("rejects asset descriptors with empty URLs", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: { robot: { kind: "gltf", url: "   ", preload: "manual" } },
        }),
      );

      expect(error.code).toBe("aperture.config.emptyAssetUrl");
    });

    it("rejects unsupported preload policies", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assets: {
            robot: {
              kind: "gltf",
              url: "/assets/robot.glb",
              preload: "eager",
            } as unknown as ApertureConfigAssetDescriptor,
          },
        }),
      );

      expect(error.code).toBe("aperture.config.invalidPreloadPolicy");
      expect(error.message).toContain("'eager'");
    });
  });

  describe("audio", () => {
    it("accepts generated audio enablement config", () => {
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          audio: { enabled: true, autoUnlock: false },
        }),
      ).not.toThrow();
    });

    it("rejects invalid generated audio config", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          audio: { autoUnlock: "yes" } as never,
        }),
      );

      expect(error.code).toBe("aperture.config.invalidAudio");
      expect(error.message).toContain("autoUnlock");
    });
  });

  describe("physics", () => {
    it("accepts generated app asset-backed collider geometry config", () => {
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          physics: {
            backend: "rapier",
            gravity: [0, -20, 0],
            colliderGeometry: { kind: "assets" },
          },
        }),
      ).not.toThrow();
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          physics: {
            colliderGeometry: { kind: "none" },
          },
        }),
      ).not.toThrow();
    });

    it("rejects unsupported generated app collider geometry config", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          physics: {
            colliderGeometry: { kind: "provider" },
          } as unknown as NonNullable<ApertureConfig["physics"]>,
        }),
      );

      expect(error.code).toBe("aperture.config.invalidPhysics");
      expect(error.message).toContain("colliderGeometry");
    });
  });

  describe("systems and asset decoders", () => {
    it("accepts non-empty system globs", () => {
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          systems: ["systems/**/*.system.ts"],
        }),
      ).not.toThrow();
    });

    it("rejects blank system glob entries", () => {
      const error = configError(() =>
        validateApertureConfig({ mode: "headless", systems: ["  "] }),
      );

      expect(error.code).toBe("aperture.config.emptySystemGlob");
    });

    it("accepts asset decoder base URLs and omitted decoder config", () => {
      expect(() =>
        validateApertureConfig({
          mode: "headless",
          assetDecoders: { baseUrl: "/assets/" },
        }),
      ).not.toThrow();
      expect(() =>
        validateApertureConfig({ mode: "headless", assetDecoders: {} }),
      ).not.toThrow();
    });

    it("rejects blank asset decoder base URLs", () => {
      const error = configError(() =>
        validateApertureConfig({
          mode: "headless",
          assetDecoders: { baseUrl: "   " },
        }),
      );

      expect(error.code).toBe("aperture.config.emptyAssetDecoderBaseUrl");
    });
  });

  describe("isPreloadPolicy", () => {
    it("accepts the three supported policies and rejects everything else", () => {
      expect(isPreloadPolicy("blocking")).toBe(true);
      expect(isPreloadPolicy("background")).toBe(true);
      expect(isPreloadPolicy("manual")).toBe(true);
      expect(isPreloadPolicy("eager")).toBe(false);
      expect(isPreloadPolicy(undefined)).toBe(false);
      expect(isPreloadPolicy(1)).toBe(false);
    });
  });

  describe("input actions", () => {
    it("accepts helpers-built and legacy bindings", () => {
      expect(() =>
        validateApertureConfig(
          actionConfig({
            jump: input.button([input.key("Space"), { keyboard: "KeyE" }]),
            fire: [{ pointer: "primary" }, { gamepad: "south" }],
            aim: input.button([input.pointer()]),
            altFire: input.button([
              input.pointer("secondary"),
              input.pointer("middle"),
            ]),
            throttle: input.axis1d([
              input.keyboard1d({ positive: ["KeyW"], negative: ["KeyS"] }),
              input.gamepadAxis("left", "y", {
                gamepadIndex: 0,
                deadzone: 0.25,
                scale: -1,
              }),
            ]),
            idle1d: input.axis1d([input.keyboard1d({})]),
            move: input.axis2d([
              input.keyboard2d({
                negativeX: ["KeyA"],
                positiveX: ["KeyD"],
                negativeY: ["KeyS"],
                positiveY: ["KeyW"],
              }),
              input.keyboard2d({}),
              input.gamepadStick("right", { gamepadIndex: 1, deadzone: 0.5 }),
            ]),
            grab: input.button([
              input.gamepadButton("home", { gamepadIndex: 0 }),
            ]),
            scriptedLook: input.axis2d([input.virtual()]),
          }),
        ),
      ).not.toThrow();
    });

    it("rejects action names that are not identifier-like", () => {
      const error = configError(() =>
        validateApertureConfig(
          actionConfig({ "dash-attack": [input.key("ShiftLeft")] }),
        ),
      );

      expect(error.code).toBe("aperture.config.invalidInputActionName");
    });

    it("rejects unsupported action descriptor kinds", () => {
      const error = configError(() =>
        validateApertureConfig(
          actionConfig({
            spin: {
              kind: "axis3d",
              bindings: [input.key("KeyR")],
            } as unknown as InputActionConfigEntry,
          }),
        ),
      );

      expect(error.code).toBe("aperture.config.invalidInputActionKind");
      expect(error.message).toContain("'axis3d'");
    });

    it("rejects actions without bindings", () => {
      const error = configError(() =>
        validateApertureConfig(actionConfig({ jump: [] })),
      );

      expect(error.code).toBe("aperture.config.emptyInputAction");
    });

    interface InvalidBindingCase {
      readonly name: string;
      readonly binding: InputActionBinding;
      readonly message: string;
    }

    const invalidBindingCases: readonly InvalidBindingCase[] = [
      {
        name: "blank legacy keyboard code",
        binding: { keyboard: " " },
        message: "non-empty KeyboardEvent.code",
      },
      {
        name: "blank legacy gamepad name",
        binding: { gamepad: "" },
        message: "Legacy gamepad bindings require a name.",
      },
      {
        name: "empty key code",
        binding: input.key(""),
        message: "non-empty KeyboardEvent.code",
      },
      {
        name: "unsupported pointer name",
        binding: {
          kind: "pointer",
          pointer: "eraser",
        } as unknown as InputPointerBinding,
        message: "Unsupported pointer binding 'eraser'.",
      },
      {
        name: "empty keyboard1d code",
        binding: input.keyboard1d({ positive: [""] }),
        message: "non-empty KeyboardEvent.code",
      },
      {
        name: "empty keyboard2d code",
        binding: input.keyboard2d({ negativeY: [""] }),
        message: "non-empty KeyboardEvent.code",
      },
      {
        name: "unsupported gamepad button",
        binding: input.gamepadButton("triangle" as GamepadButtonName),
        message: "Unsupported standard gamepad button 'triangle'.",
      },
      {
        name: "negative gamepad button index",
        binding: input.gamepadButton("south", { gamepadIndex: -1 }),
        message: "Gamepad index must be a non-negative integer.",
      },
      {
        name: "fractional gamepad button index",
        binding: input.gamepadButton("south", { gamepadIndex: 0.5 }),
        message: "Gamepad index must be a non-negative integer.",
      },
      {
        name: "unsupported gamepad stick",
        binding: input.gamepadStick("middle" as GamepadStickName),
        message: "Unsupported standard gamepad stick 'middle'.",
      },
      {
        name: "gamepad stick deadzone of one",
        binding: input.gamepadStick("left", { deadzone: 1 }),
        message: "Gamepad deadzone must be in the range [0, 1).",
      },
      {
        name: "negative gamepad stick deadzone",
        binding: input.gamepadStick("left", { deadzone: -0.25 }),
        message: "Gamepad deadzone must be in the range [0, 1).",
      },
      {
        name: "non-finite gamepad stick deadzone",
        binding: input.gamepadStick("left", { deadzone: Number.NaN }),
        message: "Gamepad deadzone must be in the range [0, 1).",
      },
      {
        name: "unsupported gamepad axis component",
        binding: {
          kind: "gamepad-axis",
          stick: "left",
          component: "z",
        } as unknown as InputGamepadAxisBinding,
        message: "Unsupported gamepad axis component 'z'.",
      },
      {
        name: "unsupported gamepad axis stick",
        binding: input.gamepadAxis("center" as GamepadStickName, "x"),
        message: "Unsupported standard gamepad stick 'center'.",
      },
      {
        name: "non-finite gamepad axis scale",
        binding: input.gamepadAxis("left", "x", {
          scale: Number.POSITIVE_INFINITY,
        }),
        message: "Gamepad axis scale must be finite.",
      },
      {
        name: "unknown binding kind",
        binding: { kind: "midi" } as unknown as InputActionBinding,
        message: "Unsupported input binding.",
      },
    ];

    it.each(invalidBindingCases)(
      "rejects a $name binding",
      ({ binding, message }) => {
        const error = configError(() =>
          validateApertureConfig(actionConfig({ jump: [binding] })),
        );

        expect(error.code).toBe("aperture.config.invalidInputBinding");
        expect(error.message).toContain("Input action 'jump'");
        expect(error.message).toContain(message);
      },
    );
  });
});
