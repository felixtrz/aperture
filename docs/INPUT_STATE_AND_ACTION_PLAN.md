# Input State And Action Plan

Date: 2026-05-27
Status: implemented for the immediate input state/action layer; retained as
historical design context. Advanced app-local generated action typings and
broader CLI/gamepad tooling remain follow-ups.

## Purpose

Make input a first-class Aperture app capability instead of a thin event-to-signal
adapter. The immediate target is a stateful keyboard wrapper, stateful browser
gamepad wrapper, and action layer that systems can read deterministically from
the worker/ECS side.

This plan is grounded in the current platformer playground, IWSDK's stateful
input layer, Bevy's input resources, and the engine reference's browser device
wrappers. The result should fit Aperture's architecture: ECS remains
authoritative, system code still runs in the worker, and browser APIs stay on
the browser side.

## Current State

The platformer works, but it exposes the current input gaps:

- `playground/aperture.config.ts` defines separate boolean actions such as
  `moveLeft`, `moveRight`, `jump`, and `reset`.
- `playground/src/systems/player.system.ts` manually combines left/right
  booleans into an axis and keeps `#wasJumpPressed` / `#wasResetPressed` fields
  to detect rising edges.
- `playground/src/hud.ts` maps touch buttons by dispatching synthetic
  `KeyboardEvent`s to `window`, which bypasses any explicit Aperture input API.
- `packages/app/src/input.ts` supports pointer and keyboard messages only, even
  though config has a `GamepadBinding` type.
- `packages/app/src/browser.ts` forwards key and pointer events immediately, but
  does not reset on blur/visibility loss, poll gamepads, handle pointer cancel
  as a release, or produce per-frame input snapshots.
- `packages/app/src/systems.ts` exposes action signals with only `pressed` and
  `value`; there is no `justPressed`, `justReleased`, `axis1d`, `axis2d`,
  duration, source metadata, or typed gamepad state.
- CLI/MCP input tooling can send pointer, keyboard, reset, and action-set
  commands, but cannot emulate gamepad state or inspect the resolved input
  resource in a structured way.

## Reference Anchors

### Aperture

- `playground/aperture.config.ts`
- `playground/src/systems/player.system.ts`
- `playground/src/hud.ts`
- `packages/app/src/config.ts`
- `packages/app/src/input.ts`
- `packages/app/src/browser.ts`
- `packages/app/src/worker.ts`
- `packages/app/src/systems.ts`
- `packages/cli/src/devtools-client.ts`
- `test/app/developer-api.test.ts`
- `test/e2e/cli-ai-tools.spec.ts`

### IWSDK

- `immersive-web-sdk/packages/core/src/input/stateful-keyboard.ts`
- `immersive-web-sdk/packages/core/src/input/stateful-browser-gamepad.ts`
- `immersive-web-sdk/packages/xr-input/src/gamepad/stateful-button-axes-device.ts`
- `immersive-web-sdk/packages/core/src/input/input-actions.ts`
- `immersive-web-sdk/packages/core/src/input/input-manager.ts`

### Bevy

- `references/bevy/crates/bevy_input/src/button_input.rs`
- `references/bevy/crates/bevy_input/src/axis.rs`
- `references/bevy/crates/bevy_input/src/gamepad.rs`
- `references/bevy/examples/input/keyboard_input.rs`
- `references/bevy/examples/input/gamepad_input.rs`

### Engine Reference

- `references/engine/src/platform/input/keyboard.js`
- `references/engine/src/platform/input/game-pads.js`
- `references/engine/src/platform/input/controller.js`
- `references/engine/src/extras/input/sources/keyboard-mouse-source.js`
- `references/engine/src/extras/input/sources/gamepad-source.js`

## Lessons To Carry Forward

### From IWSDK

IWSDK has the right app-authoring ergonomics:

- `StatefulKeyboard` separates pressed state from current-frame down/up state.
- Browser gamepads use a standard layout wrapper with named buttons and sticks.
- Button/axis device state uses double-buffered current/previous arrays.
- `InputActionManager` composes keyboard, browser gamepad, and XR bindings into
  button, axis1d, and axis2d actions.
- Default profiles such as browser-first-person are useful, but Aperture should
  start with explicit app config before adding opinionated presets.

The important idea to reuse is the shape, not the package dependency.

### From Bevy

Bevy has the right ECS mental model:

- Input state is a resource-like view of events, not a pile of DOM callbacks.
- `ButtonInput<T>` exposes `pressed`, `just_pressed`, and `just_released`.
- Transient edge state is cleared once per frame before new input is processed.
- Axes are separate from buttons, and gamepads carry both digital and analog
  state.
- Gamepad filtering includes button thresholds, axis deadzones, and change
  thresholds.
- Gamepads are represented as identifiable connected devices, not just one
  anonymous global pad.

The important Aperture translation is a worker-owned input resource that systems
read during simulation.

### From The Engine Reference

The engine reference has the right browser-side device discipline:

- Device wrappers attach/detach from DOM targets cleanly.
- Keyboard clears state on `visibilitychange` and window `blur`.
- Mouse/pointer handling uses capture, cancel, leave, and lost-capture paths to
  avoid stuck buttons.
- Device wrappers update current/previous state once per frame.
- Gamepads must be polled from `navigator.getGamepads()`, not treated as a pure
  event stream.
- Controller/action bindings compose keyboard, mouse, and gamepad sources.

The important Aperture translation is a main-thread collector that sends
JSON-safe input frames across the worker boundary.

## Design Constraints

1. System modules target the worker. They must not directly read DOM events or
   `navigator.getGamepads()`.
2. Browser-only APIs stay in `@aperture-engine/app/browser` and CLI tooling.
3. Worker-side input state is the canonical state systems read.
4. The worker boundary uses structured-clone-safe messages only.
5. Input must be deterministic under headless tests and MCP-driven stepping.
6. Pointer, keyboard, gamepad, touch UI, and agent input must all enter through
   the same resource/update path.
7. No renderer-owned scene graph or hidden interaction graph is introduced.
8. Text input, full UI focus/navigation, XR controllers, haptics, and gameplay
   physics are out of scope for the first input slice.

## Recommended Architecture

Use a two-part model:

```text
browser main thread
  -> DOM keyboard/pointer listeners
  -> navigator.getGamepads() polling
  -> touch/control UI helpers
  -> JSON-safe input frame messages

worker simulation
  -> input event queue
  -> StatefulKeyboardState
  -> StatefulGamepadState[]
  -> InputActionState map
  -> system-facing InputResource
  -> ECS systems
```

The browser side captures raw device samples. The worker side owns frame
advancement, edge detection, action resolution, and summaries. This keeps input
aligned with ECS simulation rather than browser callback timing.

## Target Public Shape

Final names can change during implementation, but the implemented contract
should support this kind of app config:

```ts
import { defineApertureConfig, input } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  input: {
    actions: {
      move: input.axis2d([
        input.keyboard2d({
          negativeX: ["KeyA", "ArrowLeft"],
          positiveX: ["KeyD", "ArrowRight"],
          negativeY: ["KeyW", "ArrowUp"],
          positiveY: ["KeyS", "ArrowDown"],
        }),
        input.gamepadStick("left"),
      ]),
      jump: input.button([
        input.key("Space"),
        input.key("ArrowUp"),
        input.gamepadButton("south"),
      ]),
      reset: input.button([input.key("KeyR")]),
    },
  },
});
```

Systems should be able to read input without private edge bookkeeping:

```ts
const moveX = this.actions.move.x.value;
const moveY = this.actions.move.y.value;
this.actions.move.read(this.#move);

if (this.actions.jump.down() && this.#grounded) {
  this.#velocityY = PLAYER.jumpSpeed;
}

if (this.actions.reset.down()) {
  this.#reset(player, "Reset run");
}
```

The lower-level device state should remain available for advanced systems:

```ts
if (this.keyboard.down("KeyP")) {
  // debug toggle
}

if (this.gamepads.primary?.down("south")) {
  // Xbox A / standard south button pressed this frame
}

this.gamepads.primary?.rightStick.read(this.#look);
```

The system-facing API should promote `this.actions`, `this.keyboard`, and
`this.gamepads`. `this.input` can remain as a lower-level grouped resource for
advanced or internal use, but common gameplay code should not need
`this.input.actions.jump...`.

Signals should remain available for current values that are meaningful to watch
over time. Frame-edge state should be exposed as methods, not signals.

## Input Resource Contract

Add a pure TypeScript input state layer in `@aperture-engine/app` with no DOM
dependency.

### Keyboard State

`StatefulKeyboardState` should support:

- `applyKey({ code, pressed, repeat, timestamp })`
- `advanceFrame()`
- `pressed(code)`
- `justPressed(code)`
- `justReleased(code)`
- `releaseAll(reason)`
- `pressedCodes()`
- JSON-safe summary output

Repeated browser `keydown` events should not retrigger `justPressed`. Blur or
visibility loss should release all keys and produce action releases.

### Gamepad State

`StatefulGamepadState` should support:

- Standard gamepad button names: `south`, `east`, `west`, `north`, bumpers,
  triggers, select/start, sticks, d-pad, home.
- Standard gamepad axes: `leftStick`, `rightStick`.
- Per-button `pressed`, `justPressed`, `justReleased`, `touched`, and `value`.
- Per-axis current/previous values.
- Deadzone and optional livezone/threshold filtering.
- Connect/disconnect metadata: index, id, mapping, connected.
- Full snapshot updates from plain data:

```ts
type BrowserGamepadSnapshot = {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly buttons: readonly {
    readonly pressed: boolean;
    readonly touched: boolean;
    readonly value: number;
  }[];
  readonly axes: readonly number[];
};
```

The first implementation should support the browser standard mapping. Custom
mapping can remain a later enhancement, but diagnostics should report when a
connected gamepad is ignored because the mapping is unsupported or incomplete.

### Action State

Actions should be typed by kind. The first supported kinds should be:

- `button`: binary held/current state.
- `axis1d`: one analog value, such as a trigger, throttle, scroll-like value,
  or keyboard-composed left/right axis.
- `axis2d`: two analog values, such as movement, look, a thumbstick, or
  WASD/arrow-key movement.

The public shape should be type-specific:

```ts
interface ButtonAction {
  readonly kind: "button";
  readonly value: Signal<boolean>;
  down(): boolean;
  up(): boolean;
  pressed(): boolean;
}

interface Axis1dAction {
  readonly kind: "axis1d";
  readonly value: Signal<number>;
  previous(): number;
  read(): number;
}

interface Axis2dAction {
  readonly kind: "axis2d";
  readonly x: Signal<number>;
  readonly y: Signal<number>;
  previous(out: Vec2Like): Vec2Like;
  read(out: Vec2Like): Vec2Like;
}
```

Do not model 2D axes as `Signal<{ x: number; y: number }>`. Mutating `x` or `y`
inside the object would not notify subscribers, and replacing the whole object
each frame creates avoidable allocation and signal churn. Use numeric signals
for each component plus allocation-free `read(out)` helpers.

Frame-edge state such as `down()` and `up()` should not be signals. It is
valid for one simulation frame and is meant for `update()` reads. Making it a
signal invites awkward reactive edge subscriptions and would recreate timing
problems the input layer is meant to solve.

Bindings should compose across sources:

- Keyboard buttons.
- Keyboard 1D/2D axis groups.
- Pointer buttons.
- Browser gamepad buttons.
- Browser gamepad sticks and axis components.
- Tool/virtual sources for MCP, tests, and touch HUD controls.

The action manager should resolve actions after device state advances and before
systems run. It should clamp composed axes to `[-1, 1]`, preserve previous
values, update numeric signals only when current values change, and make edge
state valid for exactly one simulation frame.

### Action Type Safety

The action model can be type-safe, but clean system authoring requires
app-specific action types generated from `aperture.config.ts`.

Without generated types, the library can only expose:

```ts
Record<string, ButtonAction | Axis1dAction | Axis2dAction>;
```

That is runtime-safe, but TypeScript cannot know that `this.actions.jump` is a
`ButtonAction` or that `this.actions.move` is an `Axis2dAction` without
narrowing.

The Vite plugin should generate an app-local type declaration, for example
`.aperture/generated/aperture-env.d.ts`, that augments
`@aperture-engine/app/systems` with the concrete action map:

```ts
declare module "@aperture-engine/app/systems" {
  interface ApertureGeneratedActionMap {
    jump: ButtonAction;
    reset: ButtonAction;
    throttle: Axis1dAction;
    move: Axis2dAction;
  }
}
```

With that declaration in scope, systems should get concrete types:

```ts
this.actions.jump.value; // Signal<boolean>
this.actions.jump.down(); // boolean
this.actions.throttle.value; // Signal<number>
this.actions.move.x; // Signal<number>
this.actions.move.y; // Signal<number>
```

The generated type file should be a development aid, not runtime state. Runtime
validation still needs to reject invalid action descriptors and report
diagnostics.

## Worker And Browser Protocol

Extend generated input messages from isolated pointer/keyboard events to
frame-aware input messages.

Recommended message kinds:

- `keyboard`: code, pressed, repeat, modifiers, timestamp.
- `pointer`: pointer id/name, normalized position, pressed buttons, cancel
  state, timestamp.
- `gamepad`: full browser gamepad snapshot.
- `virtualAction`: action name, kind, pressed/value/axis value, source id.
- `reset`: release all transient input for blur, visibility loss, teardown, and
  MCP reset.
- `frame`: optional batch wrapper with sequence number and timestamp.

The browser collector should:

- Keep the canvas focus behavior currently installed by generated apps.
- Send keyboard events from the real browser event stream.
- Send reset on `window.blur` and hidden `visibilitychange`.
- Treat `pointerup`, `pointercancel`, `pointerleave`, and
  `lostpointercapture` as release paths.
- Poll `navigator.getGamepads()` once per animation frame when gamepad support
  is available or a gamepad action is configured.
- Send plain gamepad snapshots, not live browser `Gamepad` objects.

The worker should:

- Queue input messages instead of mutating action signals immediately from the
  message listener.
- At the start of each simulation frame, clear transient edge state, apply all
  pending input messages, poll the latest gamepad snapshots, resolve actions,
  and then run input effects and systems.
- Use the same advancement path for running, paused, and `ecs_step` frames.
- Include input frame id and summaries in worker diagnostics.

## Touch And Virtual Controls

The platformer HUD should stop synthesizing `KeyboardEvent`s. Add a public
generated-app helper or browser command path for virtual controls:

```ts
dispatchApertureInputAction("jump", { pressed: true, source: "hud.jump" });
dispatchApertureInputAction("jump", { pressed: false, source: "hud.jump" });
```

Virtual action state should enter the same worker action manager as keyboard and
gamepad input. This lets touch buttons, tests, MCP tools, and future UI controls
work without pretending to be physical keys.

## Implementation Tracks

### Track 1: Pure Input State Core

- Add DOM-free keyboard, gamepad, and action-state modules under
  `packages/app/src/input/` or an equivalent internal folder.
- Keep the first slice dependency-free.
- Add unit tests for button edge behavior, repeated keydown, release-all,
  gamepad buttons, gamepad axes, deadzones, and action composition.

### Track 2: Config Schema And Helpers

- Replace the current untyped binding array with a kinded action schema.
- Add config helpers from `@aperture-engine/app/config`, such as `input.key`,
  `input.button`, `input.keyboard2d`, `input.gamepadButton`, and
  `input.gamepadStick`.
- Generate app-local action types from `aperture.config.ts` so `.system.ts`
  files can infer that a named action is `button`, `axis1d`, or `axis2d`.
- Include the generated type declaration in the Vite-created app type surface,
  and make scaffolded apps include it in `tsconfig.json`.
- Decide during implementation whether to keep the old shorthand parser. Since
  Aperture has not launched, the recommended path is to migrate examples to the
  new schema immediately and only retain shorthand if it materially simplifies
  tests or scaffolding.
- Validate invalid action kinds, empty bindings, unsupported gamepad controls,
  and duplicate action names with actionable diagnostics.

### Track 3: Worker-Owned Input Resource

- Expand `InputSignals` or replace it with an `InputResource` that exposes
  typed actions, direct keyboard/gamepad readers, current-value signals, and
  frame-edge helper methods.
- Add system-context shortcuts for `this.actions`, `this.keyboard`, and
  `this.gamepads`, while keeping `this.input` as the lower-level grouped
  resource if needed.
- Add `advanceInputFrame(...)` to process queued input before `input` effects
  and ECS systems run.
- Update `createInputSummary(...)` to report action button/axis state,
  keyboard state, gamepad state, pointer state, and input diagnostics.
- Ensure headless apps and worker tests can inject input without a browser.

### Track 4: Browser Collector

- Refactor `installGeneratedInputForwarding(...)` into a collector with
  attach/detach lifecycle.
- Add keyboard reset on blur/visibility loss.
- Add pointer cancel/release handling.
- Add gamepad polling and snapshot serialization.
- Add virtual-action dispatch helpers for HUDs and custom controls.
- Keep status counters useful: forwarded events, forwarded frames, last input
  frame, connected gamepads, and reset reason.

### Track 5: CLI And MCP Input Tools

- Keep existing `input_key`, `input_pointer_move`, `input_pointer_click`,
  `input_drag`, `input_action_set`, and `input_reset` behavior.
- Add `input_gamepad_set` for standard buttons and axes.
- Add `input_get_state` to inspect the worker-side input summary.
- Route `input_action_set` through the same virtual-action source used by HUDs.
- Ensure all tools behave correctly while paused and after `ecs_step`.

### Track 6: Playground Migration

- Migrate the platformer config from `moveLeft` / `moveRight` to one `move`
  axis2d action.
- Replace `#wasJumpPressed` and `#wasResetPressed` with action
  `down()`.
- The platformer reads actions through `this.actions`, not
  `this.input.actions`.
- Add gamepad bindings for left stick movement and south-button jump.
- Replace HUD synthetic keyboard events with virtual action dispatch.
- Add a small on-screen or diagnostic indication that gamepad input is detected
  only if it can be done without cluttering the gameplay UI.

### Track 7: Docs And Examples

- Document the action schema in `docs/AUTHORING.md`.
- Add a focused input section to the developer API example or a dedicated input
  example.
- Document keyboard codes, standard gamepad button names, axis direction
  conventions, deadzone defaults, blur/reset behavior, and virtual controls.
- Update scaffolding templates once `aperture create` owns example generation.

## Acceptance Criteria

### Keyboard

- A held key reports `pressed: true` across frames.
- The initial press reports `justPressed: true` for exactly one simulation
  frame.
- Release reports `justReleased: true` for exactly one simulation frame.
- Repeated browser `keydown` events do not create repeated `justPressed`
  states.
- Window blur and hidden visibility release all pressed keys and actions.
- Keyboard state can be driven in headless tests without DOM APIs.

### Gamepad

- Browser standard gamepads are represented by stable device index, id, mapping,
  connected state, buttons, and axes.
- Standard buttons expose `pressed`, `justPressed`, `justReleased`, `touched`,
  and analog `value`.
- Left and right sticks expose x/y axis values with documented orientation.
- Deadzone defaults suppress small stick drift and can be configured.
- Gamepad disconnect releases pressed gamepad-backed actions.
- Unsupported gamepad mappings report diagnostics instead of silently producing
  misleading action state.
- Gamepad state can be injected through tests and MCP without a physical
  controller.

### Actions

- Actions support `button`, `axis1d`, and `axis2d` kinds.
- Multiple bindings can drive one action.
- Keyboard and gamepad bindings compose into one axis without exceeding
  `[-1, 1]`.
- Button actions expose `value: Signal<boolean>`, `pressed()`, `down()`, and
  `up()`.
- Button edge state is exposed through methods, not signals.
- Axis1d actions expose `value: Signal<number>`, current reads, and previous
  reads.
- Axis2d actions expose `x: Signal<number>`, `y: Signal<number>`, current
  reads, and previous reads.
- Axis2d actions do not expose `Signal<{ x: number; y: number }>` or allocate a
  new vector/object every frame.
- Edge state is valid for one simulation frame and is stable when multiple
  systems read it.
- The worker summary includes JSON-safe action state for CLI/MCP inspection.

### Type Safety

- The Vite plugin generates app-local action map types from
  `aperture.config.ts`.
- A system can read `this.actions.jump.value` as `Signal<boolean>` when `jump`
  is configured with `input.button(...)`.
- A system can read `this.actions.throttle.value` as `Signal<number>` when
  `throttle` is configured with `input.axis1d(...)`.
- A system can read `this.actions.move.x` and `this.actions.move.y` as
  `Signal<number>` when `move` is configured with `input.axis2d(...)`.
- Type tests fail if a button action is used like an axis action, or an axis2d
  action is used like a button action.
- If generated types are unavailable, the fallback public type is an explicit
  action union that requires narrowing before kind-specific access.

### Worker And Browser Boundary

- Systems never read browser DOM APIs directly.
- Browser input messages are structured-clone-safe.
- Worker input state advances before input effects and system updates.
- Running, paused, and `ecs_step` flows use the same input advancement path.
- Input reset works for blur, visibility loss, MCP reset, and app teardown.
- Existing pointer and keyboard input tests continue to pass after migration.

### Playground

- The platformer player cannot require private `#wasJumpPressed` or
  `#wasResetPressed` fields for input edge detection.
- Movement is driven by one `move` axis2d action.
- Jump and reset use action `down()`.
- The platformer reads actions through `this.actions`, not
  `this.input.actions`.
- Keyboard, touch HUD, MCP action input, and injected gamepad input can all move
  or control the platformer through the same action resource.
- The HUD no longer dispatches synthetic `KeyboardEvent`s.

### CLI And MCP

- `input_get_state` reports keyboard, pointer, gamepad, and action summaries.
- `input_gamepad_set` can press/release a standard button and set a stick axis.
- Existing input tools remain covered by end-to-end tests.
- A CLI/MCP test can pause the app, inject jump/gamepad movement, step the ECS,
  and observe changed worker input state.
- Tool failures for unknown actions, unsupported gamepad controls, or missing
  sessions return actionable diagnostics.

### Validation

- Unit tests cover keyboard state, gamepad state, action state, and config
  validation.
- App tests cover worker input advancement and summaries.
- Browser tests cover keyboard forwarding, blur reset, pointer cancel, and
  gamepad snapshot forwarding with mocked `navigator.getGamepads()`.
- E2E CLI/MCP tests cover all input tools against a generated app.
- The platformer playground passes typecheck/build and a browser smoke test
  using keyboard plus virtual action input.
- Relevant commands pass, at minimum:
  - `pnpm --filter @aperture-engine/app test`
  - `pnpm --filter @aperture-engine/cli test`
  - `pnpm run typecheck`
  - targeted Playwright coverage for generated app input tooling

## Suggested Order

1. Land pure input state classes and unit tests.
2. Add the kinded config schema and action resolver.
3. Add generated action-map types for `.system.ts` authoring.
4. Move worker input handling to frame advancement.
5. Replace browser forwarding with a collector that handles reset and gamepads.
6. Add virtual action dispatch and migrate the platformer HUD.
7. Add gamepad and state-inspection CLI/MCP tools.
8. Migrate playground and developer examples.
9. Update docs and create-template scaffolding.

## Open Design Questions

- Should old action binding arrays remain accepted? Because the library is
  pre-launch, the recommended answer is to migrate examples to the new schema
  and avoid carrying compatibility unless it keeps scaffolds materially simpler.
- Should generated action types be emitted as `.aperture/generated` files,
  virtual TypeScript declarations, or both? The recommended first path is a real
  generated declaration file because it is easier for editors and agents to
  inspect.
- Should gamepads appear as ECS entities? Not in the first slice. A worker input
  resource is enough for app systems, and ECS entities can be added later if
  gamepad metadata needs queryable gameplay representation.
- Should pointer/touch become part of the same stateful action layer? Pointer
  buttons should, but spatial picking and UI focus should remain separate
  interaction layers built on top of ECS data.
