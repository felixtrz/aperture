# Recipe: HUD from App Signals

**Status:** reference

## Goal

Declare app signals in `aperture.config.ts`, write them from worker systems,
and render a DOM HUD on the main thread by subscribing to the generated signal
summary — no custom worker messaging. Main-thread input handlers feed back into
the same configured input-action path.

## Code

### 1. Declare the signals in config

```ts
signals: {
  health: signal.number(100),
  weaponIndex: signal.number(0),
  weaponName: signal.string("Blaster"),
  crosshair: signal.string(assetUrl("sprites/crosshair.png")),
  enemiesRemaining: signal.number(4),
  destroyedEnemies: signal.number(0),
  enemyDestroyedPulse: signal.number(0),
  lastDestroyedEnemy: signal.string(""),
  gameStatus: signal.string("active"),
  shotsFired: signal.number(0),
  hits: signal.number(0),
  grounded: signal.boolean(false),
  damagePulse: signal.number(0),
  playerX: signal.number(0),
  playerY: signal.number(1.5),
  playerZ: signal.number(0),
  lastShotFrame: signal.number(-1),
},
```

Source: `showcase/fps/aperture.config.ts` (`signals` block).

### 2. Write signals from worker systems

Systems hold the typed signals on `this.signals`; a small helper guards the
write so an undeclared name is a no-op:

```ts
function setSignal(
  signal: { value: unknown } | undefined,
  value: unknown,
): void {
  if (signal !== undefined) signal.value = value;
}
```

Source: `showcase/fps/src/systems/player.system.ts` (module-level `setSignal`).

The gameplay system publishes HUD state every update:

```ts
#writeSignals(input: {
  readonly health: number;
  readonly weaponIndex: number;
  readonly weapon: WeaponSpec;
  readonly enemiesRemaining: number;
  readonly destroyedEnemies: number;
  readonly enemyDestroyedPulse: number;
  readonly lastDestroyedEnemy: string;
  readonly shotsFired: number;
  readonly hits: number;
  readonly grounded: boolean;
  readonly position: Vec3;
  readonly damagePulse: number;
  readonly gameStatus: "active" | "cleared";
}): void {
  setSignal(this.signals.health, Math.round(input.health));
  setSignal(this.signals.weaponIndex, input.weaponIndex);
  setSignal(this.signals.weaponName, input.weapon.name);
  setSignal(this.signals.crosshair, input.weapon.crosshairUrl);
  setSignal(this.signals.enemiesRemaining, input.enemiesRemaining);
  setSignal(this.signals.destroyedEnemies, input.destroyedEnemies);
  setSignal(this.signals.enemyDestroyedPulse, input.enemyDestroyedPulse);
  setSignal(this.signals.lastDestroyedEnemy, input.lastDestroyedEnemy);
  setSignal(this.signals.gameStatus, input.gameStatus);
  setSignal(this.signals.shotsFired, input.shotsFired);
  setSignal(this.signals.hits, input.hits);
  setSignal(this.signals.grounded, input.grounded);
  setSignal(this.signals.damagePulse, input.damagePulse);
  setSignal(this.signals.playerX, Number(input.position[0].toFixed(2)));
  setSignal(this.signals.playerY, Number(input.position[1].toFixed(2)));
  setSignal(this.signals.playerZ, Number(input.position[2].toFixed(2)));
  setSignal(this.signals.lastShotFrame, input.shotsFired);
}
```

Source: `showcase/fps/src/systems/player.system.ts` (`#writeSignals`).

### 3. Read signals in the DOM HUD

The main thread subscribes to the generated signal summary; the callback runs
with the latest `GeneratedSignalSummary` whenever the worker republishes:

```ts
function render(signals: GeneratedSignalSummary | null): void {
  const crosshair =
    typeof signals?.crosshair === "string" && signals.crosshair.length > 0
      ? signals.crosshair
      : fallbackCrosshairUrl;

  writeText(healthEl, sourceHealthText(readNumber(signals?.health, 100)));

  if (crosshairEl !== null && crosshairEl.getAttribute("src") !== crosshair) {
    crosshairEl.setAttribute("src", crosshair);
  }
}

writeSourceHudCssVariables(document.documentElement.style);
render(null);
subscribeGeneratedSignals(render);
```

Source: `showcase/fps/src/hud.ts` (`render` + `subscribeGeneratedSignals`). The
`readNumber` guard tolerates the `null` first paint before any signal arrives.

The HUD markup the callback targets:

```html
<div id="hud">
  <div id="health">100%</div>
</div>
```

Source: `showcase/fps/index.html` (HUD markup excerpt).

### 4. Feed main-thread input back into input actions

Main-thread input handlers dispatch the same configured input actions
(`move`/`shoot`/`jump`/`reset` in `showcase/fps/aperture.config.ts`). An axis
action carries `x`/`y`:

```ts
function dispatchKeyboardMove(): void {
  const [x, y] = sourceKeyboardMoveAxis(keyboardMoveKeys);
  dispatchApertureInputAction("move", {
    x,
    y,
    source: "fps-keyboard",
  });
  dispatchFpsInputCommand({ kind: "move", x, y });
}
```

Source: `showcase/fps/src/hud.ts` (`dispatchKeyboardMove`).

A button action carries `pressed`:

```ts
function pressKeyboardButtonAction(
  action: SourceKeyboardButtonAction,
  repeat: boolean,
): void {
  if (!sourceKeyboardButtonPressDispatches(repeat)) return;

  cancelKeyboardButtonRelease(action);
  keyboardButtonActions.add(action);
  dispatchApertureInputAction(action, {
    pressed: true,
    source: "fps-keyboard",
  });
  dispatchFpsInputCommand({ kind: "button", action, pressed: true });
}
```

Source: `showcase/fps/src/hud.ts` (`pressKeyboardButtonAction`). The paired
`dispatchFpsInputCommand` also forwards the same event over a command channel;
`dispatchApertureInputAction` alone is enough to drive the configured action.

## Verify

1. Committed e2e proof that config signals surface in
   `lastWorkerSummary.signals` (here the developer-api app's `selectedEntity`
   signal after a click):

```ts
expect(inputStatus?.lastWorkerSummary?.signals?.selectedEntity).toMatchObject({
  index: expect.any(Number),
  generation: expect.any(Number),
});
```

Source: `test/e2e/developer-api.spec.ts`.

2. For an end-to-end worked example of this whole pattern, see the
   `showcase/fps` app: `aperture.config.ts` declares the `signals` block,
   `src/systems/player.system.ts#writeSignals` publishes them each frame, and
   `src/hud.ts` reads them through `subscribeGeneratedSignals` (all quoted
   above). A scripted managed-browser run asserts on the same generated worker
   status the HUD subscribes to:

```js
async function fpsStateValuesFromBrowserStatus(mcpClient) {
  const response = await mcpClient.call("browser_status", {});
  const resources =
    response?.page?.status?.lastWorkerSummary?.resources?.entries ??
    response?.status?.lastWorkerSummary?.resources?.entries ??
    [];
  const entry = resources.find((resource) => resource.id === "fps.state");

  return entry?.values;
}
```

Source: `showcase/fps/scripts/mechanics-smoke.mjs`
(`fpsStateValuesFromBrowserStatus`, reading the generated worker summary the
HUD subscription is built on).

3. Drive the action path from tooling instead of touching the DOM:

```ts
const actionSet = await callMcpTool("input_action_set", {
  action: "select",
  pressed: true,
});
expect(actionSet.structuredContent).toMatchObject({
  ok: true,
  result: {
    action: "select",
    pressed: true,
    value: 1,
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` ("Aperture CLI manages a browser
session and exposes browser/ECS tools over MCP"). Against the `showcase/fps`
app use its configured actions, e.g.
`pnpm exec aperture tool input_action_set --json '{"action":"jump","pressed":true}'`.

## Revert / cleanup

Gameplay state resets through the app's own `reset` action
(`reset: input.button([input.key("KeyR")])` in
`showcase/fps/aperture.config.ts`; handled in `PlayerSystem.update` where
`this.#button("reset")?.down()` restores the player and enemy state). After
tooling-driven input experiments, release transient input state:

```ts
const inputReset = await callMcpTool("input_reset", {});
expect(inputReset.structuredContent).toMatchObject({
  ok: true,
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test); see also
`docs/AI_TOOLING.md` ("Restoring State").
