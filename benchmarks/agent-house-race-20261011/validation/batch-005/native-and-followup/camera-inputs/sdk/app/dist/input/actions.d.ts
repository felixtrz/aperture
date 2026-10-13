import type { InputActionDescriptor } from "../config.js";
import type { InputAction, InputAxis1dAction, InputAxis2dAction, InputButtonAction } from "./types.js";
export declare function createInputActions(descriptors: Record<string, InputActionDescriptor>): Record<string, InputAction>;
export declare function beginActionFrame(action: InputAction): void;
export declare function setButtonActionPressed(action: InputButtonAction, pressed: boolean): void;
export declare function setAxis1dActionValue(action: InputAxis1dAction, value: number): void;
export declare function setAxis2dActionValue(action: InputAxis2dAction, x: number, y: number): void;
//# sourceMappingURL=actions.d.ts.map