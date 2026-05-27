# Playground Platformer Plan

## AI Tooling Notes

This app was regenerated with `aperture create playground` and then replanned
against the warmed Aperture RAG corpus.

Reference queries used:

- `createSystem spawn gltf input camera platformer systems`
- `aperture config assets gltf signals input actions`
- `generated browser status signals hud readGeneratedBrowserAppStatus`
- `material standard mesh box capsule gltf spawn camera light`

The useful API conclusions were:

- Put gameplay systems under `src/systems/**/*.system.ts`.
- Use `createSystem({ priority, queries })` for deterministic scheduling.
- Use `aperture.config.ts` for GLB assets, signals, input actions, render
  defaults, and system discovery.
- Use `this.spawn.gltf`, `this.spawn.mesh`, `this.spawn.camera`, and
  `this.spawn.light` from systems.
- Use generated browser status plus app signals for the DOM HUD.

## Game Shape

Make the playground a compact 2.5D collect-and-finish platformer:

- A side-view level built from Kenney Platformer Kit GLB assets.
- Keyboard and touch controls.
- Player movement with gravity, jumping, platform landing, hazard reset, gem
  collection, and a finish gate.
- Camera follow that keeps the player centered in view.
- DOM HUD with gems, time, state, and controls.
- JSON-safe status hooks for automated verification.

## Acceptance Criteria

- `playground` is generated from the Aperture CLI scaffold.
- Kenney GLB assets are served from `playground/public/assets/kenney`.
- `pnpm --dir playground run typecheck` passes.
- `pnpm --dir playground run build` passes.
- The app reaches generated WebGPU running status in a browser.
- Runtime diagnostics report nonzero WebGPU draw calls with no render errors.
- Input changes gameplay state, including player position and gem count.
- The camera follows the player rather than allowing the player to run out of
  view.
- A scripted managed-browser playthrough reaches `runState: "clear"` with
  `gems === totalGems`.
