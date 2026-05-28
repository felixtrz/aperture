import type { Signal } from "@preact/signals-core";
import type { GamepadButtonName } from "../config.js";

export type ApertureGeneratedPointerName = "primary" | "secondary" | "middle";
export type InputActionKind = "button" | "axis1d" | "axis2d";

export interface InputVec2Like {
  x: number;
  y: number;
}

export interface ApertureInputDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix?: string;
}

export interface ApertureGeneratedPointerInputEvent {
  readonly kind: "pointer";
  readonly pointer: ApertureGeneratedPointerName;
  readonly position?: readonly [number, number];
  readonly pressed?: boolean;
}

export interface ApertureGeneratedKeyboardInputEvent {
  readonly kind: "keyboard";
  readonly key?: string;
  readonly code?: string;
  readonly pressed: boolean;
}

export interface ApertureGeneratedGamepadSnapshot {
  readonly index: number;
  readonly id?: string;
  readonly mapping?: string;
  readonly connected?: boolean;
  readonly buttons?: readonly {
    readonly pressed?: boolean;
    readonly touched?: boolean;
    readonly value?: number;
  }[];
  readonly axes?: readonly number[];
}

export interface ApertureGeneratedGamepadInputEvent {
  readonly kind: "gamepad";
  readonly gamepads: readonly ApertureGeneratedGamepadSnapshot[];
  readonly replace?: boolean;
}

export interface ApertureGeneratedVirtualActionInputEvent {
  readonly kind: "virtualAction";
  readonly action: string;
  readonly source?: string;
  readonly pressed?: boolean;
  readonly value?: boolean | number;
  readonly x?: number;
  readonly y?: number;
}

export interface ApertureGeneratedInputResetEvent {
  readonly kind: "reset";
  readonly reason?: string;
}

export interface ApertureGeneratedInputBatchEvent {
  readonly kind: "batch";
  readonly events: readonly ApertureGeneratedInputEvent[];
}

export type ApertureGeneratedInputEvent =
  | ApertureGeneratedPointerInputEvent
  | ApertureGeneratedKeyboardInputEvent
  | ApertureGeneratedGamepadInputEvent
  | ApertureGeneratedVirtualActionInputEvent
  | ApertureGeneratedInputResetEvent
  | ApertureGeneratedInputBatchEvent;

export interface InputButtonAction {
  readonly kind: "button";
  readonly value: Signal<boolean>;
  readonly pressed: InputButtonPressedSignal;
  down(): boolean;
  up(): boolean;
}

export type InputButtonPressedSignal = Signal<boolean> & (() => boolean);

export interface InputAxis1dAction {
  readonly kind: "axis1d";
  readonly value: Signal<number>;
  previous(): number;
  read(): number;
}

export interface InputAxis2dAction {
  readonly kind: "axis2d";
  readonly x: Signal<number>;
  readonly y: Signal<number>;
  previous(out: InputVec2Like): InputVec2Like;
  read(out: InputVec2Like): InputVec2Like;
}

export type InputAction =
  | InputButtonAction
  | InputAxis1dAction
  | InputAxis2dAction;

export type InputActionSignals = InputAction;

export interface StatefulKeyboardState extends Record<string, unknown> {
  applyKey(code: string, pressed: boolean): void;
  advanceFrame(): void;
  releaseAll(): void;
  pressed(code: string): boolean;
  down(code: string): boolean;
  up(code: string): boolean;
  signal(code: string): Signal<boolean>;
  pressedCodes(): readonly string[];
  summary(): StatefulKeyboardSummary;
}

export interface StatefulKeyboardSummary {
  readonly pressed: readonly string[];
  readonly down: readonly string[];
  readonly up: readonly string[];
}

export interface GamepadButtonState {
  readonly value: number;
  readonly touched: boolean;
  readonly pressed: boolean;
  readonly down: boolean;
  readonly up: boolean;
}

export interface StatefulGamepadStickState {
  readonly x: number;
  readonly y: number;
  read(out: InputVec2Like): InputVec2Like;
  previous(out: InputVec2Like): InputVec2Like;
}

export interface StatefulGamepadDevice {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly leftStick: StatefulGamepadStickState;
  readonly rightStick: StatefulGamepadStickState;
  button(button: GamepadButtonName): GamepadButtonState;
  pressed(button: GamepadButtonName): boolean;
  down(button: GamepadButtonName): boolean;
  up(button: GamepadButtonName): boolean;
  summary(): StatefulGamepadDeviceSummary;
}

export interface StatefulGamepadsState {
  readonly primary: StatefulGamepadDevice | null;
  byIndex(index: number): StatefulGamepadDevice | null;
  advanceFrame(): void;
  updateSnapshots(
    snapshots: readonly ApertureGeneratedGamepadSnapshot[],
    options?: { readonly replace?: boolean },
  ): void;
  releaseAll(): void;
  diagnostics(): readonly ApertureInputDiagnostic[];
  summary(): StatefulGamepadsSummary;
}

export interface StatefulGamepadDeviceSummary {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly buttons: Readonly<Record<string, GamepadButtonState>>;
  readonly axes: {
    readonly leftStick: readonly [number, number];
    readonly rightStick: readonly [number, number];
  };
}

export interface StatefulGamepadsSummary {
  readonly primaryIndex: number | null;
  readonly devices: readonly StatefulGamepadDeviceSummary[];
  readonly diagnostics: readonly ApertureInputDiagnostic[];
}

export interface InputResourceBase {
  readonly actions: Record<string, InputAction>;
  readonly pointer: {
    readonly primary: {
      readonly position: Signal<readonly [number, number]>;
      readonly pressed: Signal<boolean>;
    };
  };
  readonly keyboard: StatefulKeyboardState;
  readonly gamepads: StatefulGamepadsState;
  readonly gamepad: Record<string, Signal<number>>;
  readonly xr: {
    readonly active: Signal<boolean>;
  };
  advanceFrame(events?: readonly ApertureGeneratedInputEvent[]): void;
  diagnostics(): readonly ApertureInputDiagnostic[];
}

export interface ApertureInputSummary {
  readonly actions: Record<
    string,
    | {
        readonly kind: "button";
        readonly pressed: boolean;
        readonly value: boolean;
        readonly down: boolean;
        readonly up: boolean;
      }
    | {
        readonly kind: "axis1d";
        readonly value: number;
        readonly previous: number;
      }
    | {
        readonly kind: "axis2d";
        readonly x: number;
        readonly y: number;
        readonly previous: readonly [number, number];
      }
  >;
  readonly pointer: {
    readonly primary: {
      readonly position: readonly [number, number];
      readonly pressed: boolean;
    };
  };
  readonly keyboard: StatefulKeyboardSummary;
  readonly gamepads: StatefulGamepadsSummary;
  readonly diagnostics: readonly ApertureInputDiagnostic[];
}
