# Recipe: HUD from App Signals

**Status:** reference

## Goal

Declare app signals in `aperture.config.ts`, write them from worker systems,
and render a DOM HUD on the main thread by reading the generated browser
status — no custom worker messaging. Touch buttons feed back into the same
input-action path the keyboard uses.

## Code

### 1. Declare the signals in config

```ts
signals: {
  gems: signal.number(0),
  totalGems: signal.number(TOTAL_GEMS),
  runState: signal.string("run"),
  time: signal.number(0),
  playerX: signal.number(0),
  playerY: signal.number(0),
  deaths: signal.number(0),
  message: signal.string("Collect every gem and reach the flag"),
},
```

Source: `playground/aperture.config.ts` (`signals` block).

### 2. Write signals from worker systems

Systems access the typed signals through `this.signals`:

```ts
#setSignal(name: string, value: number | string): void {
  const signal = this.signals[name];

  if (signal !== undefined) {
    signal.value = value;
  }
}
```

Source: `playground/src/systems/setup.system.ts` (`#setSignal`; the same
helper appears in `playground/src/systems/player.system.ts`).

The gameplay system publishes HUD state every update:

```ts
#writeSignals(state: "run" | "clear", message: string): void {
  const playerTranslation = this.#findNamedEntity("player")?.getVectorView(
    LocalTransform,
    "translation",
  );

  this.#setSignal("gems", this.#collected.size);
  this.#setSignal("totalGems", TOTAL_GEMS);
  this.#setSignal("runState", state);
  this.#setSignal("time", Number(this.#elapsed.toFixed(1)));
  this.#setSignal(
    "playerX",
    Number((playerTranslation?.[0] ?? PLAYER.start[0]).toFixed(2)),
  );
  this.#setSignal(
    "playerY",
    Number((playerTranslation?.[1] ?? PLAYER.start[1]).toFixed(2)),
  );
  this.#setSignal("deaths", this.#deaths);
  this.#setSignal("message", message);
}
```

Source: `playground/src/systems/player.system.ts` (`#writeSignals`).

### 3. Read signals in the DOM HUD

The main thread polls the generated browser status; signal values arrive in
`lastWorkerSummary.signals`:

```ts
function renderHud(): void {
  const status = readGeneratedBrowserAppStatus();
  const worker = readRecord(status?.lastWorkerSummary);
  const signals = readRecord(worker?.signals);
  const gems = readNumber(signals?.gems, 0);
  const totalGems = readNumber(signals?.totalGems, 0);
  const runTime = readNumber(signals?.time, 0);
  const runState = readString(signals?.runState, "run");
  const deaths = readNumber(signals?.deaths, 0);
  const message = readString(
    signals?.message,
    "Collect every gem and reach the flag",
  );

  writeText(gemsEl, String(gems));
  writeText(totalGemsEl, String(totalGems));
  writeText(timeEl, runTime.toFixed(1));
  writeText(stateEl, runState === "clear" ? "Clear" : "Run");
  writeText(deathsEl, String(deaths));
  writeText(messageEl, message);

  document.body.dataset.apertureStatus = status?.status ?? "starting";
  document.body.dataset.apertureSnapshots = String(status?.snapshots ?? 0);
  document.body.dataset.gameState = runState;
  document.body.dataset.gems = String(gems);
  document.body.dataset.webgpuOk = String(status?.webgpuOk ?? false);

  requestAnimationFrame(renderHud);
}
```

Source: `playground/src/hud.ts` (`renderHud`). The `data-*` attributes exist so
scripted runs can assert game state without scraping styled text.

The HUD markup the script targets:

```html
<div class="hud" aria-live="polite">
  <div class="stats">
    <span class="pill"
      >Gems <span id="gems">0</span>/<span id="total-gems">0</span></span
    >
    <span class="pill">Time <span id="run-time">0.0</span>s</span>
    <span class="pill">Falls <span id="deaths">0</span></span>
    <span class="pill">State <span id="run-state">Run</span></span>
  </div>
  <div class="pill message" id="message">
    Collect every gem and reach the flag
  </div>
</div>
```

Source: `playground/index.html` (HUD markup excerpt).

### 4. Touch controls back into input actions

HUD buttons dispatch the same configured input actions
(`move`/`jump`/`reset` in `playground/aperture.config.ts`):

```ts
function dispatchTouchAction(
  button: HTMLButtonElement,
  action: string,
  pressed: boolean,
): void {
  const x = readNumberAttribute(button.dataset.x);
  const y = readNumberAttribute(button.dataset.y);

  if (x !== null || y !== null) {
    dispatchApertureInputAction(action, {
      source: "touch-hud",
      x: pressed ? (x ?? 0) : 0,
      y: pressed ? (y ?? 0) : 0,
    });
    return;
  }

  dispatchApertureInputAction(action, {
    source: "touch-hud",
    pressed,
  });
}
```

Source: `playground/src/hud.ts` (`dispatchTouchAction`).

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

2. In the playground, assert via the HUD's own data attributes
   (`document.body.dataset.gameState`, `.gems`, `.webgpuOk`,
   `.apertureStatus`, `.apertureSnapshots` — written by `renderHud` above).
   The acceptance bar for the worked example:

> - The app reaches generated WebGPU running status in a browser.
> - Input changes gameplay state, including player position and gem count.
> - A scripted managed-browser playthrough reaches `runState: "clear"` with
>   `gems === totalGems`.

Source: `playground/GAME_PLAN.md` (Acceptance Criteria excerpt).

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
session and exposes browser/ECS tools over MCP"). Against the playground use
its configured actions, e.g.
`pnpm exec aperture tool input_action_set --json '{"action":"jump","pressed":true}'`.

## Revert / cleanup

Gameplay state resets through the app's own `reset` action
(`reset: input.button([input.key("KeyR")])` in `playground/aperture.config.ts`;
handled by `PlayerSystem.#reset`). After tooling-driven input experiments,
release transient input state:

```ts
const inputReset = await callMcpTool("input_reset", {});
expect(inputReset.structuredContent).toMatchObject({
  ok: true,
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` (same test); see also
`docs/AI_TOOLING.md` ("Restoring State").
