# FPS

A first-person shooter built with [Aperture](https://github.com/felixtrz/aperture).

Move through an arena platform, aim with the mouse, and clear out flying enemies
with two switchable blasters. It demonstrates a Rapier-backed character
controller, pointer-lock mouse look, hitscan shooting with muzzle and impact
sprite effects, enemy AI and health, a skybox, positional weapon/enemy audio,
ACES tonemapping with bloom, and a reactive health/crosshair HUD.

Controls: `WASD` to move, mouse to look, left-click to shoot, `E` (or middle
click) to switch weapons, `Space` to jump, `R` to reset. Gamepad is also
supported.

## Running

From the repository root:

```bash
pnpm install
pnpm --dir showcase/fps dev
```

Then open the printed local URL in a WebGPU-capable browser.
