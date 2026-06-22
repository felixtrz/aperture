# Shadow Lab

An in-browser debug harness for [Aperture](https://github.com/felixtrz/aperture)
shadow rendering.

It loads a static glTF scene (track pieces, decorations, and parked trucks) lit
by a single directional shadow-casting sun, with orbit controls so you can
inspect cast shadows on real content from any angle. It is a development tool
for validating the WebGPU shadow pipeline (depth convention, back-face caster
rendering, caster-driven orthographic bounds), not a game.

Optional modes (URL query params):

- `?compare` (on by default) renders the same scene through three.js WebGPU in a
  side-by-side split so shadow, fog, and post differences can be checked against
  a reference. Use `?compare=0` to disable.
- `?debug` mounts a debug panel for live transform scrubbing, playback, and
  render readouts.

## Running

From the repository root:

```bash
pnpm install
pnpm --dir shadow-lab dev
```

Then open the printed local URL in a WebGPU-capable browser.
