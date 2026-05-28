import { signal as createSignal, type Signal } from "@preact/signals-core";
import type {
  ApertureConfig,
  GamepadButtonName,
  InputActionBinding,
  InputActionConfigEntry,
  InputActionDescriptor,
  InputGamepadAxisBinding,
  InputGamepadButtonBinding,
  InputGamepadStickBinding,
  InputKeyboard1dBinding,
  InputKeyboard2dBinding,
  KeyboardBinding,
  PointerBinding,
} from "./config.js";
import type {
  ApertureGeneratedGamepadSnapshot,
  ApertureGeneratedInputEvent,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureInputDiagnostic,
  ApertureInputSummary,
  GamepadButtonState,
  InputAction,
  InputAxis1dAction,
  InputAxis2dAction,
  InputButtonAction,
  InputButtonPressedSignal,
  InputResourceBase,
  InputVec2Like,
  StatefulGamepadDevice,
  StatefulGamepadDeviceSummary,
  StatefulGamepadStickState,
  StatefulGamepadsState,
  StatefulGamepadsSummary,
  StatefulKeyboardState,
  StatefulKeyboardSummary,
} from "./input-state-types.js";
export type {
  ApertureGeneratedGamepadInputEvent,
  ApertureGeneratedGamepadSnapshot,
  ApertureGeneratedInputBatchEvent,
  ApertureGeneratedInputEvent,
  ApertureGeneratedInputResetEvent,
  ApertureGeneratedKeyboardInputEvent,
  ApertureGeneratedPointerInputEvent,
  ApertureGeneratedPointerName,
  ApertureGeneratedVirtualActionInputEvent,
  ApertureInputDiagnostic,
  ApertureInputSummary,
  GamepadButtonState,
  InputAction,
  InputActionKind,
  InputActionSignals,
  InputAxis1dAction,
  InputAxis2dAction,
  InputButtonAction,
  InputButtonPressedSignal,
  InputResourceBase,
  InputVec2Like,
  StatefulGamepadDevice,
  StatefulGamepadDeviceSummary,
  StatefulGamepadStickState,
  StatefulGamepadsState,
  StatefulGamepadsSummary,
  StatefulKeyboardState,
  StatefulKeyboardSummary,
} from "./input-state-types.js";

const DEFAULT_GAMEPAD_DEADZONE = 0.12;
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

export function createInputResource(
  config: ApertureConfig | undefined,
): InputResourceBase {
  return new InputResourceImpl(config);
}

export function advanceInputResource(
  input: InputResourceBase,
  events: readonly ApertureGeneratedInputEvent[] = [],
): void {
  input.advanceFrame(events);
}

export function createInputResourceSummary(
  input: InputResourceBase,
): ApertureInputSummary {
  const actions: ApertureInputSummary["actions"] = {};

  for (const [name, action] of Object.entries(input.actions)) {
    if (action.kind === "button") {
      actions[name] = {
        kind: "button",
        pressed: action.pressed.value,
        value: action.value.value,
        down: action.down(),
        up: action.up(),
      };
      continue;
    }

    if (action.kind === "axis1d") {
      actions[name] = {
        kind: "axis1d",
        value: action.value.value,
        previous: action.previous(),
      };
      continue;
    }

    const previous = { x: 0, y: 0 };
    action.previous(previous);
    actions[name] = {
      kind: "axis2d",
      x: action.x.value,
      y: action.y.value,
      previous: [previous.x, previous.y],
    };
  }

  return {
    actions,
    pointer: {
      primary: {
        position: input.pointer.primary.position.value,
        pressed: input.pointer.primary.pressed.value,
      },
    },
    keyboard: input.keyboard.summary(),
    gamepads: input.gamepads.summary(),
    diagnostics: input.diagnostics(),
  };
}

class InputResourceImpl implements InputResourceBase {
  readonly actions: Record<string, InputAction>;
  readonly pointer = {
    primary: {
      position: createSignal<readonly [number, number]>([0, 0]),
      pressed: createSignal(false),
    },
  };
  readonly keyboard =
    new StatefulKeyboardStateImpl() as unknown as StatefulKeyboardState;
  readonly gamepads = new StatefulGamepadsStateImpl();
  readonly gamepad: Record<string, Signal<number>> = {};
  readonly xr = {
    active: createSignal(false),
  };
  readonly #descriptors: Record<string, InputActionDescriptor>;
  readonly #virtualActions = new Map<string, VirtualActionState>();
  #diagnostics: readonly ApertureInputDiagnostic[] = [];

  constructor(config: ApertureConfig | undefined) {
    this.#descriptors = normalizeActionDescriptors(
      config?.input?.actions ?? {},
    );
    this.actions = createInputActions(this.#descriptors);
  }

  advanceFrame(events: readonly ApertureGeneratedInputEvent[] = []): void {
    this.keyboard.advanceFrame();
    this.gamepads.advanceFrame();
    this.#diagnostics = [];

    for (const action of Object.values(this.actions)) {
      beginActionFrame(action);
    }

    for (const event of events) {
      this.#applyEvent(event);
    }

    this.#resolveActions();
    this.#diagnostics = [...this.#diagnostics, ...this.gamepads.diagnostics()];
  }

  diagnostics(): readonly ApertureInputDiagnostic[] {
    return this.#diagnostics;
  }

  #applyEvent(event: ApertureGeneratedInputEvent): void {
    if (event.kind === "batch") {
      for (const nested of event.events) {
        this.#applyEvent(nested);
      }
      return;
    }

    if (event.kind === "pointer") {
      if (event.pointer !== "primary") {
        return;
      }

      if (event.position !== undefined) {
        this.pointer.primary.position.value = [
          clamp01(event.position[0]),
          clamp01(event.position[1]),
        ];
      }

      if (event.pressed !== undefined) {
        this.pointer.primary.pressed.value = event.pressed;
      }
      return;
    }

    if (event.kind === "keyboard") {
      const code = event.code ?? event.key;
      if (typeof code === "string" && code.length > 0) {
        this.keyboard.applyKey(code, event.pressed);
      }
      return;
    }

    if (event.kind === "gamepad") {
      this.gamepads.updateSnapshots(event.gamepads, {
        replace: event.replace ?? true,
      });
      this.#syncLegacyGamepadSignals();
      return;
    }

    if (event.kind === "virtualAction") {
      this.#applyVirtualAction(event);
      return;
    }

    this.#reset(event.reason ?? "reset");
  }

  #applyVirtualAction(event: ApertureGeneratedVirtualActionInputEvent): void {
    const action = this.actions[event.action];
    if (action === undefined) {
      this.#diagnostics = [
        ...this.#diagnostics,
        {
          code: "aperture.input.unknownAction",
          severity: "error",
          message: `Input action '${event.action}' is not configured.`,
          data: {
            action: event.action,
            available: Object.keys(this.actions),
          },
          suggestedFix:
            "Use one of the configured input action names or add the action to aperture.config.ts.",
        },
      ];
      return;
    }

    const state = this.#virtualActions.get(event.action) ?? {};
    const next: VirtualActionState = { ...state };

    if (action.kind === "button") {
      const pressed =
        event.pressed ??
        (typeof event.value === "boolean"
          ? event.value
          : typeof event.value === "number"
            ? event.value > 0
            : undefined);

      if (pressed !== undefined) {
        next.pressed = pressed;
      }
    } else if (action.kind === "axis1d") {
      const value =
        typeof event.value === "number"
          ? event.value
          : event.pressed === true
            ? 1
            : event.pressed === false
              ? 0
              : undefined;

      if (value !== undefined) {
        next.value = clamp(value, -1, 1);
      }
    } else {
      if (event.x !== undefined) {
        next.x = clamp(event.x, -1, 1);
      }
      if (event.y !== undefined) {
        next.y = clamp(event.y, -1, 1);
      }
    }

    this.#virtualActions.set(event.action, next);
  }

  #reset(_reason: string): void {
    this.keyboard.releaseAll();
    this.gamepads.releaseAll();
    this.pointer.primary.pressed.value = false;
    this.#virtualActions.clear();
  }

  #resolveActions(): void {
    for (const [name, descriptor] of Object.entries(this.#descriptors)) {
      const action = this.actions[name];
      if (action === undefined) {
        continue;
      }

      const virtual = this.#virtualActions.get(name);

      if (descriptor.kind === "button" && action.kind === "button") {
        const pressed =
          descriptor.bindings.some((binding) =>
            bindingPressed(binding, this),
          ) || virtual?.pressed === true;
        setButtonActionPressed(action, pressed);
        continue;
      }

      if (descriptor.kind === "axis1d" && action.kind === "axis1d") {
        const value = clamp(
          descriptor.bindings.reduce(
            (sum, binding) => sum + bindingAxis1d(binding, this),
            virtual?.value ?? 0,
          ),
          -1,
          1,
        );
        setAxis1dActionValue(action, value);
        continue;
      }

      if (descriptor.kind === "axis2d" && action.kind === "axis2d") {
        const value = { x: virtual?.x ?? 0, y: virtual?.y ?? 0 };

        for (const binding of descriptor.bindings) {
          const next = bindingAxis2d(binding, this);
          value.x += next.x;
          value.y += next.y;
        }

        setAxis2dActionValue(
          action,
          clamp(value.x, -1, 1),
          clamp(value.y, -1, 1),
        );
      }
    }
  }

  #syncLegacyGamepadSignals(): void {
    const primary = this.gamepads.primary;
    if (primary === null) {
      return;
    }

    const sticks = [
      ["leftStick.x", primary.leftStick.x],
      ["leftStick.y", primary.leftStick.y],
      ["rightStick.x", primary.rightStick.x],
      ["rightStick.y", primary.rightStick.y],
    ] as const;

    for (const [name, value] of sticks) {
      const signal = this.gamepad[name] ?? createSignal(0);
      this.gamepad[name] = signal;
      signal.value = value;
    }
  }
}

class InputButtonActionImpl implements InputButtonAction {
  readonly kind = "button";
  readonly value = createSignal(false);
  readonly pressed = createCallableSignal(this.value);
  #previous = false;
  #down = false;
  #up = false;

  beginFrame(): void {
    this.#previous = this.value.value;
    this.#down = false;
    this.#up = false;
  }

  setPressed(pressed: boolean): void {
    this.value.value = pressed;
    this.#down = !this.#previous && pressed;
    this.#up = this.#previous && !pressed;
  }

  down(): boolean {
    return this.#down;
  }

  up(): boolean {
    return this.#up;
  }
}

function createCallableSignal(
  source: Signal<boolean>,
): InputButtonPressedSignal {
  const callable = (() => source.value) as InputButtonPressedSignal;

  Object.defineProperty(callable, "value", {
    get() {
      return source.value;
    },
    set(value: boolean) {
      source.value = value;
    },
  });
  callable.subscribe = source.subscribe.bind(source);
  callable.peek = source.peek.bind(source);
  callable.valueOf = source.valueOf.bind(source);
  callable.toString = source.toString.bind(source);
  callable.toJSON = source.toJSON.bind(source);
  callable.brand = source.brand;

  return callable;
}

class InputAxis1dActionImpl implements InputAxis1dAction {
  readonly kind = "axis1d";
  readonly value = createSignal(0);
  #previous = 0;

  beginFrame(): void {
    this.#previous = this.value.value;
  }

  setValue(value: number): void {
    this.value.value = value;
  }

  previous(): number {
    return this.#previous;
  }

  read(): number {
    return this.value.value;
  }
}

class InputAxis2dActionImpl implements InputAxis2dAction {
  readonly kind = "axis2d";
  readonly x = createSignal(0);
  readonly y = createSignal(0);
  #previousX = 0;
  #previousY = 0;

  beginFrame(): void {
    this.#previousX = this.x.value;
    this.#previousY = this.y.value;
  }

  setValue(x: number, y: number): void {
    this.x.value = x;
    this.y.value = y;
  }

  previous(out: InputVec2Like): InputVec2Like {
    out.x = this.#previousX;
    out.y = this.#previousY;
    return out;
  }

  read(out: InputVec2Like): InputVec2Like {
    out.x = this.x.value;
    out.y = this.y.value;
    return out;
  }
}

class StatefulKeyboardStateImpl {
  readonly #pressed = new Set<string>();
  readonly #down = new Set<string>();
  readonly #up = new Set<string>();
  readonly #signals = new Map<string, Signal<boolean>>();

  applyKey(code: string, pressed: boolean): void {
    const signal = this.signal(code);

    if (pressed) {
      if (!this.#pressed.has(code)) {
        this.#down.add(code);
      }
      this.#pressed.add(code);
      signal.value = true;
      return;
    }

    if (this.#pressed.has(code)) {
      this.#up.add(code);
    }
    this.#pressed.delete(code);
    signal.value = false;
  }

  advanceFrame(): void {
    this.#down.clear();
    this.#up.clear();
  }

  releaseAll(): void {
    for (const code of this.#pressed) {
      this.#up.add(code);
      this.signal(code).value = false;
    }
    this.#pressed.clear();
  }

  pressed(code: string): boolean {
    return this.#pressed.has(code);
  }

  down(code: string): boolean {
    return this.#down.has(code);
  }

  up(code: string): boolean {
    return this.#up.has(code);
  }

  signal(code: string): Signal<boolean> {
    let signal = this.#signals.get(code);

    if (signal !== undefined) {
      return signal;
    }

    signal = createSignal(false);
    this.#signals.set(code, signal);
    Object.defineProperty(this, code, {
      configurable: true,
      enumerable: true,
      value: signal,
      writable: false,
    });
    return signal;
  }

  pressedCodes(): readonly string[] {
    return [...this.#pressed].sort();
  }

  summary(): StatefulKeyboardSummary {
    return {
      pressed: [...this.#pressed].sort(),
      down: [...this.#down].sort(),
      up: [...this.#up].sort(),
    };
  }
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
    this.pressed = pressed;
    this.touched = touched;
    this.value = value;
    this.down = !this.#previous && pressed;
    this.up = this.#previous && !pressed;
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
    this.x = applyDeadzone(x, deadzone);
    this.y = applyDeadzone(y, deadzone);
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

interface VirtualActionState {
  pressed?: boolean;
  value?: number;
  x?: number;
  y?: number;
}

function normalizeActionDescriptors(
  actions: Readonly<Record<string, InputActionConfigEntry>>,
): Record<string, InputActionDescriptor> {
  const output: Record<string, InputActionDescriptor> = {};

  for (const [name, descriptor] of Object.entries(actions)) {
    output[name] = normalizeActionDescriptor(descriptor);
  }

  return output;
}

function normalizeActionDescriptor(
  descriptor: InputActionConfigEntry,
): InputActionDescriptor {
  if (isInputActionBindingArray(descriptor)) {
    return { kind: "button", bindings: descriptor };
  }

  return descriptor;
}

function isInputActionBindingArray(
  value: InputActionConfigEntry,
): value is readonly InputActionBinding[] {
  return Array.isArray(value);
}

function createInputActions(
  descriptors: Record<string, InputActionDescriptor>,
): Record<string, InputAction> {
  const output: Record<string, InputAction> = {};

  for (const [name, descriptor] of Object.entries(descriptors)) {
    output[name] =
      descriptor.kind === "button"
        ? new InputButtonActionImpl()
        : descriptor.kind === "axis1d"
          ? new InputAxis1dActionImpl()
          : new InputAxis2dActionImpl();
  }

  return output;
}

function beginActionFrame(action: InputAction): void {
  if (action.kind === "button") {
    (action as InputButtonActionImpl).beginFrame();
  } else if (action.kind === "axis1d") {
    (action as InputAxis1dActionImpl).beginFrame();
  } else {
    (action as InputAxis2dActionImpl).beginFrame();
  }
}

function setButtonActionPressed(
  action: InputButtonAction,
  pressed: boolean,
): void {
  (action as InputButtonActionImpl).setPressed(pressed);
}

function setAxis1dActionValue(action: InputAxis1dAction, value: number): void {
  (action as InputAxis1dActionImpl).setValue(value);
}

function setAxis2dActionValue(
  action: InputAxis2dAction,
  x: number,
  y: number,
): void {
  (action as InputAxis2dActionImpl).setValue(x, y);
}

function bindingPressed(
  binding: InputActionBinding,
  resource: InputResourceImpl,
): boolean {
  if (bindingHasKind(binding, "key")) {
    return resource.keyboard.pressed(binding.code);
  }

  if (bindingHasKind(binding, "pointer")) {
    return (
      binding.pointer === "primary" && resource.pointer.primary.pressed.value
    );
  }

  if (bindingHasKind(binding, "gamepad-button")) {
    return gamepadButtonPressed(resource, binding.button, binding.gamepadIndex);
  }

  if (isLegacyKeyboardBinding(binding)) {
    return resource.keyboard.pressed(binding.keyboard);
  }

  if (isLegacyPointerBinding(binding)) {
    return (
      binding.pointer === "primary" && resource.pointer.primary.pressed.value
    );
  }

  if (isLegacyGamepadBinding(binding)) {
    return gamepadButtonPressed(resource, binding.gamepad as GamepadButtonName);
  }

  return false;
}

function bindingAxis1d(
  binding: InputActionBinding,
  resource: InputResourceImpl,
): number {
  if (isLegacyKeyboardBinding(binding)) {
    return resource.keyboard.pressed(binding.keyboard) ? 1 : 0;
  }

  if (bindingHasKind(binding, "key")) {
    return resource.keyboard.pressed(binding.code) ? 1 : 0;
  }

  if (bindingHasKind(binding, "keyboard1d")) {
    return keyboard1dValue(resource.keyboard, binding);
  }

  if (bindingHasKind(binding, "gamepad-axis")) {
    return gamepadAxisValue(resource, binding);
  }

  if (bindingHasKind(binding, "gamepad-button")) {
    return gamepadButtonValue(resource, binding);
  }

  return 0;
}

function bindingAxis2d(
  binding: InputActionBinding,
  resource: InputResourceImpl,
): InputVec2Like {
  if (bindingHasKind(binding, "keyboard2d")) {
    return keyboard2dValue(resource.keyboard, binding);
  }

  if (bindingHasKind(binding, "gamepad-stick")) {
    return gamepadStickValue(resource, binding);
  }

  if (bindingHasKind(binding, "gamepad-axis")) {
    const value = gamepadAxisValue(resource, binding);
    return binding.component === "x" ? { x: value, y: 0 } : { x: 0, y: value };
  }

  return { x: 0, y: 0 };
}

function keyboard1dValue(
  keyboard: StatefulKeyboardState,
  binding: InputKeyboard1dBinding,
): number {
  return (
    anyPressed(keyboard, binding.positive ?? []) -
    anyPressed(keyboard, binding.negative ?? [])
  );
}

function keyboard2dValue(
  keyboard: StatefulKeyboardState,
  binding: InputKeyboard2dBinding,
): InputVec2Like {
  return {
    x:
      anyPressed(keyboard, binding.positiveX ?? []) -
      anyPressed(keyboard, binding.negativeX ?? []),
    y:
      anyPressed(keyboard, binding.positiveY ?? []) -
      anyPressed(keyboard, binding.negativeY ?? []),
  };
}

function anyPressed(
  keyboard: StatefulKeyboardState,
  codes: readonly string[],
): number {
  return codes.some((code) => keyboard.pressed(code)) ? 1 : 0;
}

function gamepadButtonPressed(
  resource: InputResourceImpl,
  button: GamepadButtonName,
  index?: number,
): boolean {
  const device =
    index === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(index);

  return device?.pressed(button) === true;
}

function gamepadButtonValue(
  resource: InputResourceImpl,
  binding: InputGamepadButtonBinding,
): number {
  const device =
    binding.gamepadIndex === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(binding.gamepadIndex);

  return device?.button(binding.button).value ?? 0;
}

function gamepadStickValue(
  resource: InputResourceImpl,
  binding: InputGamepadStickBinding,
): InputVec2Like {
  const device =
    binding.gamepadIndex === undefined
      ? resource.gamepads.primary
      : resource.gamepads.byIndex(binding.gamepadIndex);
  const stick =
    binding.stick === "left" ? device?.leftStick : device?.rightStick;

  if (stick === undefined) {
    return { x: 0, y: 0 };
  }

  const value = { x: 0, y: 0 };
  stick.read(value);
  return {
    x: applyDeadzone(value.x, binding.deadzone ?? DEFAULT_GAMEPAD_DEADZONE),
    y: applyDeadzone(value.y, binding.deadzone ?? DEFAULT_GAMEPAD_DEADZONE),
  };
}

function gamepadAxisValue(
  resource: InputResourceImpl,
  binding: InputGamepadAxisBinding,
): number {
  const stick = gamepadStickValue(resource, {
    kind: "gamepad-stick",
    stick: binding.stick,
    ...(binding.gamepadIndex === undefined
      ? {}
      : { gamepadIndex: binding.gamepadIndex }),
    ...(binding.deadzone === undefined ? {} : { deadzone: binding.deadzone }),
  });
  const raw = binding.component === "x" ? stick.x : stick.y;

  return raw * (binding.scale ?? 1);
}

function isLegacyKeyboardBinding(
  binding: InputActionBinding,
): binding is KeyboardBinding {
  return "keyboard" in binding;
}

function isLegacyPointerBinding(
  binding: InputActionBinding,
): binding is PointerBinding {
  return "pointer" in binding && !("kind" in binding);
}

function isLegacyGamepadBinding(
  binding: InputActionBinding,
): binding is { readonly gamepad: string } {
  return "gamepad" in binding;
}

type ModernInputActionBinding = Extract<
  InputActionBinding,
  { readonly kind: string }
>;

function bindingHasKind<TKind extends ModernInputActionBinding["kind"]>(
  binding: InputActionBinding,
  kind: TKind,
): binding is Extract<ModernInputActionBinding, { readonly kind: TKind }> {
  return "kind" in binding && binding.kind === kind;
}

function applyDeadzone(value: number, deadzone: number): number {
  const finite = Number.isFinite(value) ? value : 0;

  return Math.abs(finite) < deadzone ? 0 : clamp(finite, -1, 1);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(min, Math.min(max, value));
}
