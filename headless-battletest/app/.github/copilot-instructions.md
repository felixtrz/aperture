# Copilot Instructions

<!-- aperture-managed:start aperture-ai-tools -->
This project is an Aperture app. Keep changes ECS-first:

- Add behavior in `*.system.ts` files.
- Use `@aperture-engine/app/config` for app config.
- Use `@aperture-engine/app/systems` for system authoring.
- Preserve the worker-friendly ECS/render boundary.
- Prefer the Aperture MCP warm headless workflow for agent iteration:
  start `aperture.headless.config.ts`, inspect/step/mutate with shared MCP
  tools, and use `frame_capture` only when pixels are needed. Use the headed
  browser path for browser-specific or final validation.
<!-- aperture-managed:end aperture-ai-tools -->
