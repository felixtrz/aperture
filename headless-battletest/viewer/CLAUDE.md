# Claude Instructions

<!-- aperture-managed:start aperture-ai-tools -->
This is an Aperture app. Prefer ECS systems, components, typed assets, and
structured diagnostics. Keep browser/WebGPU-specific logic out of simulation
systems unless an Aperture API explicitly provides it.

## Default Tooling Loop

Use the Aperture MCP server as the default inspection loop. This is a
simulation-first app, not a browser-first web page.

1. Start the warm headless slot:
   `app_start({ target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" })`.
2. Iterate with shared tools: `ecs_step`, `ecs_find_entities`,
   `ecs_get_entity`, `resource_get`, `asset_list`, `input_inject`,
   `input_get_state`, and `camera_*`.
3. Use `frame_capture({ target: "headless", width, height, samples })` when
   pixels are needed. It renders from a bundle on demand.
4. Use `app_reset` for rebuild/reset and `logs_read` for recent diagnostics.
5. Start the headed browser slot only for browser-specific behavior,
   DOM/page integration, pointer-lock/native browser input, exact live WebGPU
   canvas behavior, or final parity checks.

After the headless slot is running, shared state/model/presentation tools
default to headless, so repeated calls do not need `target`. Pass `target`
explicitly for lifecycle operations and parity comparisons.

Do not default to browser screenshot/reload/canvas-status/WebGPU-wait/readback
mechanics. Use `frame_capture`, `app_reset`, `app_status`, and
`logs_read` instead. Keep `aperture.config.ts` and
`aperture.headless.config.ts` in sync through `aperture.shared-config.ts`.
<!-- aperture-managed:end aperture-ai-tools -->
