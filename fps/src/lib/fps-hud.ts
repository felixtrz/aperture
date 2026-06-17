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
export const POINTER_LOCK_LOOK_PIXELS_PER_UNIT = 26;

export interface HudCssVariableSink {
  setProperty(name: string, value: string): void;
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
  style.setProperty(
    "--fps-crosshair-size",
    `${SOURCE_CROSSHAIR_SIZE_PX}px`,
  );
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
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
