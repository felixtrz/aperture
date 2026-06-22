import type { GamepadButtonName } from "../config.js";
import type {
  ApertureGeneratedGamepadSnapshot,
  ApertureInputDiagnostic,
  GamepadButtonState,
  InputVec2Like,
  StatefulGamepadDevice,
  StatefulGamepadDeviceSummary,
  StatefulGamepadStickState,
  StatefulGamepadsState,
  StatefulGamepadsSummary,
} from "./types.js";

export const DEFAULT_GAMEPAD_DEADZONE = 0.12;

const GAMEPAD_BUTTON_INDICES: Readonly<Record<GamepadButtonName, number>> = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  select: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  home: 16,
};

export function createStatefulGamepadsState(): StatefulGamepadsState {
  return new StatefulGamepadsStateImpl();
}

export function applyGamepadDeadzone(value: number, deadzone: number): number {
  const finite = Number.isFinite(value) ? value : 0;

  return Math.abs(finite) < deadzone ? 0 : clamp(finite, -1, 1);
}

class StatefulGamepadsStateImpl implements StatefulGamepadsState {
  readonly #devices = new Map<number, StatefulGamepadDeviceImpl>();
  #diagnostics: readonly ApertureInputDiagnostic[] = [];

  get primary(): StatefulGamepadDevice | null {
    return (
      [...this.#devices.values()]
        .filter((device) => device.connected)
        .sort((a, b) => a.index - b.index)[0] ?? null
    );
  }

  byIndex(index: number): StatefulGamepadDevice | null {
    const device = this.#devices.get(index);
    return device?.connected === true ? device : null;
  }

  advanceFrame(): void {
    this.#diagnostics = [];
    for (const device of this.#devices.values()) {
      device.advanceFrame();
    }
  }

  updateSnapshots(
    snapshots: readonly ApertureGeneratedGamepadSnapshot[],
    options: { readonly replace?: boolean } = {},
  ): void {
    const seen = new Set<number>();

    for (const snapshot of snapshots) {
      if (!Number.isInteger(snapshot.index) || snapshot.index < 0) {
        this.#diagnostics = [
          ...this.#diagnostics,
          {
            code: "aperture.input.gamepad.invalidIndex",
            severity: "warning",
            message: "Ignored a gamepad snapshot with an invalid device index.",
            data: { index: snapshot.index },
          },
        ];
        continue;
      }

      const device = this.#device(snapshot.index);
      seen.add(snapshot.index);
      device.update(snapshot);

      if (device.lastDiagnostic !== null) {
        this.#diagnostics = [...this.#diagnostics, device.lastDiagnostic];
      }
    }

    if (options.replace !== false) {
      for (const [index, device] of this.#devices) {
        if (!seen.has(index)) {
          device.disconnect();
        }
      }
    }
  }

  releaseAll(): void {
    for (const device of this.#devices.values()) {
      device.disconnect();
    }
  }

  diagnostics(): readonly ApertureInputDiagnostic[] {
    return this.#diagnostics;
  }

  summary(): StatefulGamepadsSummary {
    return {
      primaryIndex: this.primary?.index ?? null,
      devices: [...this.#devices.values()]
        .filter((device) => device.connected)
        .sort((a, b) => a.index - b.index)
        .map((device) => device.summary()),
      diagnostics: this.#diagnostics,
    };
  }

  #device(index: number): StatefulGamepadDeviceImpl {
    let device = this.#devices.get(index);

    if (device === undefined) {
      device = new StatefulGamepadDeviceImpl(index);
      this.#devices.set(index, device);
    }

    return device;
  }
}

class StatefulGamepadDeviceImpl implements StatefulGamepadDevice {
  readonly index: number;
  readonly leftStick = new StatefulGamepadStickStateImpl();
  readonly rightStick = new StatefulGamepadStickStateImpl();
  #id = "";
  #mapping = "";
  #connected = false;
  #buttons = new Map<GamepadButtonName, StatefulGamepadButtonStateImpl>();
  lastDiagnostic: ApertureInputDiagnostic | null = null;

  constructor(index: number) {
    this.index = index;
  }

  get id(): string {
    return this.#id;
  }

  get mapping(): string {
    return this.#mapping;
  }

  get connected(): boolean {
    return this.#connected;
  }

  advanceFrame(): void {
    this.lastDiagnostic = null;
    for (const button of this.#buttons.values()) {
      button.advanceFrame();
    }
    this.leftStick.advanceFrame();
    this.rightStick.advanceFrame();
  }

  update(snapshot: ApertureGeneratedGamepadSnapshot): void {
    this.#id = snapshot.id ?? "";
    this.#mapping = snapshot.mapping ?? "";

    if (snapshot.connected === false) {
      this.disconnect();
      return;
    }

    if (this.#mapping.length > 0 && this.#mapping !== "standard") {
      this.disconnect();
      this.lastDiagnostic = {
        code: "aperture.input.gamepad.unsupportedMapping",
        severity: "warning",
        message:
          "Ignored a connected gamepad because its browser mapping is not 'standard'.",
        data: {
          index: this.index,
          id: this.#id,
          mapping: this.#mapping,
        },
        suggestedFix:
          "Use a standard-mapped controller or provide a custom mapping adapter in a future input extension.",
      };
      return;
    }

    this.#connected = true;
    this.#updateButtons(snapshot.buttons ?? []);
    this.#updateAxes(snapshot.axes ?? []);
  }

  disconnect(): void {
    this.#connected = false;
    for (const button of this.#buttons.values()) {
      button.set(false, false, 0);
    }
    this.leftStick.set(0, 0, DEFAULT_GAMEPAD_DEADZONE);
    this.rightStick.set(0, 0, DEFAULT_GAMEPAD_DEADZONE);
  }

  button(button: GamepadButtonName): GamepadButtonState {
    return this.#button(button).snapshot();
  }

  pressed(button: GamepadButtonName): boolean {
    return this.#button(button).pressed;
  }

  down(button: GamepadButtonName): boolean {
    return this.#button(button).down;
  }

  up(button: GamepadButtonName): boolean {
    return this.#button(button).up;
  }

  summary(): StatefulGamepadDeviceSummary {
    const buttons: Record<string, GamepadButtonState> = {};

    for (const name of Object.keys(
      GAMEPAD_BUTTON_INDICES,
    ) as GamepadButtonName[]) {
      buttons[name] = this.button(name);
    }

    return {
      index: this.index,
      id: this.id,
      mapping: this.mapping,
      connected: this.connected,
      buttons,
      axes: {
        leftStick: [this.leftStick.x, this.leftStick.y],
        rightStick: [this.rightStick.x, this.rightStick.y],
      },
    };
  }

  #updateButtons(
    buttons: readonly {
      readonly pressed?: boolean;
      readonly touched?: boolean;
      readonly value?: number;
    }[],
  ): void {
    for (const [name, index] of Object.entries(GAMEPAD_BUTTON_INDICES) as [
      GamepadButtonName,
      number,
    ][]) {
      const button = buttons[index];
      this.#button(name).set(
        button?.pressed === true || (button?.value ?? 0) >= 0.5,
        button?.touched === true,
        clamp(button?.value ?? 0, 0, 1),
      );
    }
  }

  #updateAxes(axes: readonly number[]): void {
    this.leftStick.set(axes[0] ?? 0, axes[1] ?? 0, DEFAULT_GAMEPAD_DEADZONE);
    this.rightStick.set(axes[2] ?? 0, axes[3] ?? 0, DEFAULT_GAMEPAD_DEADZONE);
  }

  #button(name: GamepadButtonName): StatefulGamepadButtonStateImpl {
    let button = this.#buttons.get(name);

    if (button === undefined) {
      button = new StatefulGamepadButtonStateImpl();
      this.#buttons.set(name, button);
    }

    return button;
  }
}

class StatefulGamepadButtonStateImpl {
  value = 0;
  touched = false;
  pressed = false;
  down = false;
  up = false;
  #previous = false;

  advanceFrame(): void {
    this.#previous = this.pressed;
    this.down = false;
    this.up = false;
  }

  set(pressed: boolean, touched: boolean, value: number): void {
    const wasPressed = this.pressed;
    this.pressed = pressed;
    this.touched = touched;
    this.value = value;
    this.down = this.down || (!this.#previous && pressed);
    this.up = this.up || ((this.#previous || wasPressed) && !pressed);
  }

  snapshot(): GamepadButtonState {
    return {
      value: this.value,
      touched: this.touched,
      pressed: this.pressed,
      down: this.down,
      up: this.up,
    };
  }
}

class StatefulGamepadStickStateImpl implements StatefulGamepadStickState {
  x = 0;
  y = 0;
  #previousX = 0;
  #previousY = 0;

  advanceFrame(): void {
    this.#previousX = this.x;
    this.#previousY = this.y;
  }

  set(x: number, y: number, deadzone: number): void {
    this.x = applyGamepadDeadzone(x, deadzone);
    this.y = applyGamepadDeadzone(y, deadzone);
  }

  read(out: InputVec2Like): InputVec2Like {
    out.x = this.x;
    out.y = this.y;
    return out;
  }

  previous(out: InputVec2Like): InputVec2Like {
    out.x = this.#previousX;
    out.y = this.#previousY;
    return out;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(min, Math.min(max, value));
}
