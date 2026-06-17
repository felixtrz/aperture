import { SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT } from "./fps-data.js";

export const SOURCE_CROSSHAIR_TEXTURE_PIXELS = 128;
export const SOURCE_CROSSHAIR_SCALE = 0.35;
export const SOURCE_CROSSHAIR_SIZE_PX =
  SOURCE_CROSSHAIR_TEXTURE_PIXELS * SOURCE_CROSSHAIR_SCALE;

export const SOURCE_HEALTH_FONT_SIZE_PX = 36;
export const SOURCE_HEALTH_LINE_HEIGHT_PX = 45;
export const SOURCE_HEALTH_OUTLINE_SIZE_PX = 12;
export const SOURCE_HEALTH_OUTLINE_ALPHA = 0.470588;
export const SOURCE_HEALTH_LEFT_PX = 48;
export const SOURCE_HEALTH_BOTTOM_PX = 48;
export const SOURCE_HEALTH_WIDTH_PX = 90;
export const POINTER_LOCK_LOOK_PIXELS_PER_UNIT =
  SOURCE_POINTER_LOCK_LOOK_PIXELS_PER_UNIT;
export const SOURCE_VIEWPORT_WIDTH_PX = 1280;
export const SOURCE_VIEWPORT_HEIGHT_PX = 720;
export const SOURCE_VIEWPORT_ASPECT =
  SOURCE_VIEWPORT_WIDTH_PX / SOURCE_VIEWPORT_HEIGHT_PX;
export const SOURCE_BOOT_SPLASH_BG_COLOR = "#ececf5";

export interface HudCssVariableSink {
  setProperty(name: string, value: string): void;
}

export type SourceKeyboardMoveKey = "left" | "right" | "forward" | "backward";
export type SourceKeyboardButtonAction = "jump" | "switchWeapon" | "reset";

export function sourceKeyboardMoveKey(
  code: string,
): SourceKeyboardMoveKey | null {
  switch (code) {
    case "KeyA":
    case "ArrowLeft":
      return "left";
    case "KeyD":
    case "ArrowRight":
      return "right";
    case "KeyW":
    case "ArrowUp":
      return "forward";
    case "KeyS":
    case "ArrowDown":
      return "backward";
    default:
      return null;
  }
}

export function sourceKeyboardButtonAction(
  code: string,
): SourceKeyboardButtonAction | null {
  switch (code) {
    case "Space":
      return "jump";
    case "KeyE":
      return "switchWeapon";
    case "KeyR":
      return "reset";
    default:
      return null;
  }
}

export function sourceKeyboardMoveAxis(
  pressed: ReadonlySet<SourceKeyboardMoveKey>,
): readonly [number, number] {
  return [
    (pressed.has("right") ? 1 : 0) - (pressed.has("left") ? 1 : 0),
    (pressed.has("forward") ? 1 : 0) - (pressed.has("backward") ? 1 : 0),
  ];
}

export function sourceHealthText(value: number): string {
  const health = Number.isFinite(value) ? value : 100;
  return `${Math.max(0, Math.round(health))}%`;
}

export function sourcePointerLockLookAxis(
  movementX: number,
  movementY: number,
): readonly [number, number] {
  return [
    clampAxis(-movementX / POINTER_LOCK_LOOK_PIXELS_PER_UNIT),
    clampAxis(-movementY / POINTER_LOCK_LOOK_PIXELS_PER_UNIT),
  ];
}

export function writeSourceHudCssVariables(style: HudCssVariableSink): void {
  style.setProperty("--fps-crosshair-size", `${SOURCE_CROSSHAIR_SIZE_PX}px`);
  style.setProperty(
    "--fps-health-font-size",
    `${SOURCE_HEALTH_FONT_SIZE_PX}px`,
  );
  style.setProperty(
    "--fps-health-line-height",
    `${SOURCE_HEALTH_LINE_HEIGHT_PX}px`,
  );
  style.setProperty(
    "--fps-health-outline-size",
    `${SOURCE_HEALTH_OUTLINE_SIZE_PX}px`,
  );
  style.setProperty(
    "--fps-health-outline-alpha",
    `${SOURCE_HEALTH_OUTLINE_ALPHA}`,
  );
  style.setProperty("--fps-health-left", `${SOURCE_HEALTH_LEFT_PX}px`);
  style.setProperty("--fps-health-bottom", `${SOURCE_HEALTH_BOTTOM_PX}px`);
  style.setProperty("--fps-health-width", `${SOURCE_HEALTH_WIDTH_PX}px`);
  style.setProperty(
    "--fps-source-viewport-width",
    `${SOURCE_VIEWPORT_WIDTH_PX}px`,
  );
  style.setProperty(
    "--fps-source-viewport-height",
    `${SOURCE_VIEWPORT_HEIGHT_PX}px`,
  );
  style.setProperty(
    "--fps-source-viewport-aspect",
    `${SOURCE_VIEWPORT_ASPECT}`,
  );
  style.setProperty(
    "--fps-source-viewport-aspect-ratio",
    `${SOURCE_VIEWPORT_WIDTH_PX} / ${SOURCE_VIEWPORT_HEIGHT_PX}`,
  );
  style.setProperty(
    "--fps-boot-splash-background",
    SOURCE_BOOT_SPLASH_BG_COLOR,
  );
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
