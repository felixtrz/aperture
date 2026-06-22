# City Builder

A grid-based city builder built with [Aperture](https://github.com/felixtrz/aperture).

Place roads and buildings on a tile grid, demolish what you no longer want, and
watch your cash balance. It demonstrates an orbiting/panning camera with zoom,
pointer ray-picking onto a grid, structure placement and rotation, demolition,
a catalog of glTF structure assets, placement/removal/ambience audio, ACES
tonemapping with bloom, and a reactive cash/selection HUD.

Controls: `WASD` to pan, left-click to build, right-click to rotate the selected
piece, `Q`/`E` to cycle pieces, `Del` to demolish, mouse wheel or `+`/`-` to
zoom, `F` to recenter, `R` to clear the city.

## Running

From the repository root:

```bash
pnpm install
pnpm --dir showcase/city-builder dev
```

Then open the printed local URL in a WebGPU-capable browser.
