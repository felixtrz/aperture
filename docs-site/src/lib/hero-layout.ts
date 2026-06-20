export const HERO_LAYOUT_COMMAND_CHANNEL = "landing-scene.layout";
export const HERO_LAYOUT_STATE_COMMAND_CHANNEL = "landing-scene.layout-state";

export const HERO_DESKTOP_COMPOSITION_MAX_WIDTH_PX = 1500;
export const HERO_DESKTOP_COMPOSITION_SIDE_GUTTER_PX = 48;
export const HERO_DESKTOP_CITY_TARGET_WIDTH_PX = 1040;
export const HERO_DESKTOP_CITY_PANEL_GAP_PX = 56;
export const HERO_DESKTOP_CARD_WIDTH_PX = 380;
export const HERO_DESKTOP_CARD_VISUAL_LEFT_SHIFT_MAX_PX = 165;
export const HERO_DESKTOP_CARD_VISUAL_LEFT_SHIFT_FULL_WIDTH_PX = 1715;
export const HERO_MOBILE_NAV_BREAKPOINT_PX = 760;
export const HERO_DESKTOP_COMPOSITION_MIN_WIDTH_PX =
  HERO_DESKTOP_CITY_TARGET_WIDTH_PX +
  HERO_DESKTOP_CITY_PANEL_GAP_PX +
  HERO_DESKTOP_CARD_WIDTH_PX;
export const HERO_COMPACT_LAYOUT_BREAKPOINT_PX =
  HERO_DESKTOP_COMPOSITION_MIN_WIDTH_PX - 1;

export interface HeroLayoutSetCompactCommand {
  readonly kind: "set-compact";
  readonly compact: boolean;
}

export interface HeroLayoutSetCompositionCommand {
  readonly kind: "set-composition";
  readonly compact: boolean;
  readonly mobile: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly stageWidth: number;
  readonly cardLeft: number;
  readonly cardWidth: number;
  readonly cityTargetWidth: number;
  readonly cityPanelGap: number;
}

export type HeroLayoutCommand =
  | HeroLayoutSetCompactCommand
  | HeroLayoutSetCompositionCommand;
