# Platformer

A 3D platformer built with [Aperture](https://github.com/felixtrz/aperture).

Run, jump, and collect coins across floating platforms while avoiding hazards
and breakable bricks. It shows off a Rapier character controller, an orbiting
follow camera with zoom, collectible and hazard logic, falling platforms,
blob-shadow sprites, a skybox, positional jump/land/coin audio, ACES tonemapping
with bloom, and a reactive coin-counter HUD. This is the app the engine docs and
recipes draw their examples from.

Controls: `WASD` to move, arrow keys (or right stick) to orbit the camera,
`Space` to jump, `Q`/`E` to zoom, `R` to reset. Gamepad is also supported.

## Running

From the repository root:

```bash
pnpm install
pnpm --dir showcase/platformer dev
```

Then open the printed local URL in a WebGPU-capable browser.
