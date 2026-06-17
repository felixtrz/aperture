import { describe, expect, it } from "vitest";
import {
  SOURCE_CROSSHAIR_SCALE,
  SOURCE_CROSSHAIR_SIZE_PX,
  SOURCE_CROSSHAIR_TEXTURE_PIXELS,
  SOURCE_HEALTH_BOTTOM_PX,
  SOURCE_HEALTH_FONT_SIZE_PX,
  SOURCE_HEALTH_LEFT_PX,
  SOURCE_HEALTH_LINE_HEIGHT_PX,
  SOURCE_HEALTH_OUTLINE_ALPHA,
  SOURCE_HEALTH_OUTLINE_SIZE_PX,
  SOURCE_HEALTH_WIDTH_PX,
  SOURCE_BOOT_SPLASH_BG_COLOR,
  SOURCE_VIEWPORT_ASPECT,
  SOURCE_VIEWPORT_HEIGHT_PX,
  SOURCE_VIEWPORT_WIDTH_PX,
  SOURCE_WEAPON_TOGGLE_MOUSE_BUTTON_INDEX,
  BROWSER_MIDDLE_MOUSE_BUTTON,
  POINTER_LOCK_LOOK_PIXELS_PER_UNIT,
  sourceKeyboardButtonAction,
  sourceKeyboardButtonPressDispatches,
  sourceKeyboardMoveAxis,
  sourceKeyboardMoveKey,
  sourceHealthText,
  sourcePointerButtonAction,
  sourcePointerLockLookAxis,
  writeSourceHudCssVariables,
} from "../../fps/src/lib/fps-hud.js";

describe("Starter Kit FPS HUD", () => {
  it("derives crosshair size from the source TextureRect scale", () => {
    expect(SOURCE_CROSSHAIR_TEXTURE_PIXELS).toBe(128);
    expect(SOURCE_CROSSHAIR_SCALE).toBe(0.35);
    expect(SOURCE_CROSSHAIR_SIZE_PX).toBeCloseTo(44.8);
  });

  it("keeps source health label font, outline, and position constants", () => {
    expect(SOURCE_HEALTH_FONT_SIZE_PX).toBe(36);
    expect(SOURCE_HEALTH_LINE_HEIGHT_PX).toBe(45);
    expect(SOURCE_HEALTH_OUTLINE_SIZE_PX).toBe(12);
    expect(SOURCE_HEALTH_OUTLINE_ALPHA).toBeCloseTo(0.470588);
    expect(SOURCE_HEALTH_LEFT_PX).toBe(48);
    expect(SOURCE_HEALTH_BOTTOM_PX).toBe(48);
    expect(SOURCE_HEALTH_WIDTH_PX).toBe(90);
  });

  it("keeps source project viewport and boot splash constants", () => {
    expect(SOURCE_VIEWPORT_WIDTH_PX).toBe(1280);
    expect(SOURCE_VIEWPORT_HEIGHT_PX).toBe(720);
    expect(SOURCE_VIEWPORT_ASPECT).toBeCloseTo(16 / 9, 10);
    expect(SOURCE_BOOT_SPLASH_BG_COLOR).toBe("#ececf5");
  });

  it("formats health like the source HUD signal handler", () => {
    expect(sourceHealthText(100)).toBe("100%");
    expect(sourceHealthText(62.4)).toBe("62%");
    expect(sourceHealthText(-5)).toBe("0%");
    expect(sourceHealthText(Number.NaN)).toBe("100%");
  });

  it("maps pointer-lock mouse deltas to the source look action vector", () => {
    expect(POINTER_LOCK_LOOK_PIXELS_PER_UNIT).toBe(26);
    expect(sourcePointerLockLookAxis(26, -26)).toEqual([-1, 1]);
    expect(sourcePointerLockLookAxis(-13, 13)).toEqual([0.5, -0.5]);
    expect(sourcePointerLockLookAxis(260, -260)).toEqual([-1, 1]);
  });

  it("maps keyboard codes into source FPS virtual actions", () => {
    expect(sourceKeyboardMoveKey("KeyW")).toBe("forward");
    expect(sourceKeyboardMoveKey("ArrowLeft")).toBe("left");
    expect(sourceKeyboardMoveKey("KeyD")).toBe("right");
    expect(sourceKeyboardMoveKey("KeyS")).toBe("backward");
    expect(sourceKeyboardMoveKey("Space")).toBeNull();

    expect(sourceKeyboardButtonAction("Space")).toBe("jump");
    expect(sourceKeyboardButtonAction("KeyE")).toBe("switchWeapon");
    expect(sourceKeyboardButtonAction("KeyR")).toBe("reset");
    expect(sourceKeyboardButtonAction("KeyW")).toBeNull();
  });

  it("maps the source middle mouse weapon toggle into browser buttons", () => {
    expect(SOURCE_WEAPON_TOGGLE_MOUSE_BUTTON_INDEX).toBe(3);
    expect(BROWSER_MIDDLE_MOUSE_BUTTON).toBe(1);
    expect(sourcePointerButtonAction(0)).toBeNull();
    expect(sourcePointerButtonAction(1)).toBe("switchWeapon");
    expect(sourcePointerButtonAction(2)).toBeNull();
  });

  it("keeps non-repeat keyboard button edges recoverable after stale latches", () => {
    expect(sourceKeyboardButtonPressDispatches(false)).toBe(true);
    expect(sourceKeyboardButtonPressDispatches(true)).toBe(false);
  });

  it("keeps keyboard move axes aligned with the source local move vector", () => {
    expect(sourceKeyboardMoveAxis(new Set(["forward"]))).toEqual([0, 1]);
    expect(sourceKeyboardMoveAxis(new Set(["backward"]))).toEqual([0, -1]);
    expect(sourceKeyboardMoveAxis(new Set(["left", "forward"]))).toEqual([
      -1, 1,
    ]);
    expect(sourceKeyboardMoveAxis(new Set(["left", "right"]))).toEqual([0, 0]);
  });

  it("writes source-derived HUD CSS variables", () => {
    const values = new Map<string, string>();

    writeSourceHudCssVariables({
      setProperty(name, value) {
        values.set(name, value);
      },
    });

    expect(values.get("--fps-crosshair-size")).toBe("44.8px");
    expect(values.get("--fps-health-font-size")).toBe("36px");
    expect(values.get("--fps-health-line-height")).toBe("45px");
    expect(values.get("--fps-health-outline-size")).toBe("12px");
    expect(values.get("--fps-health-outline-alpha")).toBe("0.470588");
    expect(values.get("--fps-health-left")).toBe("48px");
    expect(values.get("--fps-health-bottom")).toBe("48px");
    expect(values.get("--fps-health-width")).toBe("90px");
    expect(values.get("--fps-source-viewport-width")).toBe("1280px");
    expect(values.get("--fps-source-viewport-height")).toBe("720px");
    expect(values.get("--fps-source-viewport-aspect")).toBe(`${16 / 9}`);
    expect(values.get("--fps-source-viewport-aspect-ratio")).toBe("1280 / 720");
    expect(values.get("--fps-boot-splash-background")).toBe("#ececf5");
  });
});
