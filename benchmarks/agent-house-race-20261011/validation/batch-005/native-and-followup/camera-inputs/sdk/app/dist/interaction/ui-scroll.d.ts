import { type UiNodePacket } from "@aperture-engine/render";
import type { ApertureSystemContext } from "../systems/context.js";
export declare const UI_SCROLL_DISABLED_DIAGNOSTIC = "aperture.interaction.uiScrollDisabled";
type UiScrollFrameContext = Pick<ApertureSystemContext, "world" | "input" | "diagnostics">;
/**
 * Maps this frame's wheel delta and active pointer drag onto the hovered
 * UiScroll node's offset. Called by the interaction driver with the UI layout
 * it already extracted; worker-side ECS mutation only.
 */
export declare function runUiScrollFrame(context: UiScrollFrameContext, nodes: readonly UiNodePacket[]): void;
export {};
//# sourceMappingURL=ui-scroll.d.ts.map