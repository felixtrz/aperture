import type { InputActionBinding } from "../config.js";
import type { InputVec2Like, StatefulGamepadsState, StatefulKeyboardState, StatefulPointerState } from "./types.js";
export interface InputBindingResource {
    readonly keyboard: StatefulKeyboardState;
    readonly gamepads: StatefulGamepadsState;
    readonly pointer: StatefulPointerState;
}
export declare function bindingPressed(binding: InputActionBinding, resource: InputBindingResource): boolean;
export declare function bindingAxis1d(binding: InputActionBinding, resource: InputBindingResource): number;
export declare function bindingAxis2d(binding: InputActionBinding, resource: InputBindingResource): InputVec2Like;
//# sourceMappingURL=bindings.d.ts.map