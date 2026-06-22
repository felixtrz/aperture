# Racing

An arcade racing game built with [Aperture](https://github.com/felixtrz/aperture).

Drive a truck around a closed circuit of glTF track pieces, chasing your best
lap time. It exercises a broad slice of the engine: vehicle physics with drift,
a chase camera, GPU particle smoke and tire skid marks, positional engine/skid/
impact audio, post-processing (ACES tonemapping + bloom), and a live lap-timer
HUD driven by reactive signals.

Controls: arrow keys or `WASD` to steer and throttle (gamepad left stick also
works).

## Running

From the repository root:

```bash
pnpm install
pnpm --dir showcase/racing dev
```

Then open the printed local URL in a WebGPU-capable browser.
