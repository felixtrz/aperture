# AGENTS.md

<!-- aperture-managed:start aperture-ai-tools -->
You are working on an Aperture app.

## Runtime Model

- ECS is the source of truth.
- Systems live in `src/systems/**/*.system.ts` and run in the generated simulation worker.
- Rendering is derived from ECS state through Aperture render extraction.
- Do not introduce a mutable scene graph as app state.

## Useful Commands

- `pnpm run dev`: start the Vite app.
- `pnpm run typecheck`: type-check the app.
- `pnpm run build`: build the app.
- `pnpm exec aperture dev up --open`: start the managed Aperture browser once AI tooling is available.
- `pnpm exec aperture mcp stdio`: expose Aperture tools over MCP once AI tooling is available.
<!-- aperture-managed:end aperture-ai-tools -->
