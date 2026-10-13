import { type ComponentInitialData } from "@aperture-engine/simulation";
import { type UiHitTargetInput, type UiImageInput, type UiNodeInput, type UiPanelInput, type UiScreenInput, type UiScrollInput, type UiTextInput } from "./authoring-types.js";
import type { UiHitTarget, UiImage, UiNode, UiPanel, UiScreen, UiScroll, UiText } from "./authoring-components.js";
export declare function createUiScreen(input?: UiScreenInput): ComponentInitialData<typeof UiScreen>;
export declare function createUiNode(input?: UiNodeInput): ComponentInitialData<typeof UiNode>;
export declare function createUiPanel(input?: UiPanelInput): ComponentInitialData<typeof UiPanel>;
export declare function createUiImage(input: UiImageInput): ComponentInitialData<typeof UiImage>;
export declare function createUiText(input: UiTextInput): ComponentInitialData<typeof UiText>;
export declare function createUiHitTarget(input?: UiHitTargetInput): ComponentInitialData<typeof UiHitTarget>;
export declare function createUiScroll(input?: UiScrollInput): ComponentInitialData<typeof UiScroll>;
//# sourceMappingURL=authoring-create-ui.d.ts.map