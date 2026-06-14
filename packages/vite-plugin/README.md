# @aperture-engine/vite-plugin

Vite integration for the Aperture engine: loads your `aperture.config.ts`, discovers worker systems, and generates the browser bootstrap.

## Install

```sh
pnpm add @aperture-engine/vite-plugin
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture) WebGPU game engine and is normally used together with the other `@aperture-engine/*` packages (it has `@aperture-engine/app` as a peer dependency).

## What it does

Add the `aperture()` plugin to your Vite config and it wires up an Aperture app end to end. On `configResolved` it generates ambient action types from your config into `.aperture/generated/aperture-env.d.ts`. It resolves and loads a set of `virtual:aperture/*` modules (config, system manifest, worker systems, worker entry, browser entry), discovers your `*.system.ts` modules and orders them by `createSystem` descriptor priority, and injects the generated browser entry `<script>` into your HTML. In dev mode it also registers an AI devtools bridge over the dev server (opt out with `ai: { mode: "off" }`).

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [
    aperture({
      // configFile: "aperture.config.ts", // optional, defaults to project root
      // ai: { mode: "off" },              // optional, disables the dev devtools bridge
    }),
  ],
});
```

The plugin reads `aperture.config.ts` from the project root by default. No further setup is required; the browser entry script is injected into your `index.html` automatically.

The package also exports building blocks used by the plugin, in case you want to drive discovery or codegen yourself:

- `createApertureSystemManifest` / `ApertureSystemManifest` — discover and order `*.system.ts` modules.
- `createApertureGeneratedActionTypes` / `writeApertureGeneratedActionTypes` — generate ambient input-action types from a config.
- `APERTURE_VITE_DEVTOOLS_WS_CHANNEL` / `ApertureViteDevServer` — the dev devtools bridge channel and server type.

## Entry points

| Subpath                        | Description                                                   |
| ------------------------------ | ------------------------------------------------------------- |
| `@aperture-engine/vite-plugin` | The `aperture()` plugin factory and supporting types/helpers. |

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT licensed.
