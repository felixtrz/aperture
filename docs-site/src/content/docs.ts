export interface DocsSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly bullets: readonly string[];
}

export const docsSections: readonly DocsSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary:
      "Start from the CLI path, run the generated Vite app, and keep the engine in the default worker/main-thread shape.",
    bullets: [
      "Scaffold with npx @aperture-engine/cli create my-app.",
      "Use aperture.config.ts for canvas, systems, assets, render defaults, input, and diagnostics.",
      "Run the generated app through Vite so the Aperture plugin can discover systems and build worker entrypoints.",
    ],
  },
  {
    id: "core-concepts",
    title: "Core Concepts",
    summary:
      "Aperture's game state is data in ECS; rendering is derived from extracted snapshots.",
    bullets: [
      "ECS is authoritative for entities, transforms, resources, commands, and gameplay state.",
      "Rendering consumes a snapshot; the renderer does not own a mutable scene graph.",
      "Systems run in the simulation context and communicate with the renderer through structured data.",
    ],
  },
  {
    id: "authoring",
    title: "Authoring",
    summary:
      "Apps author entities with focused components and stable handles instead of renderer-owned object trees.",
    bullets: [
      "Meshes, materials, cameras, lights, visibility, and physics are components or data assets.",
      "GLB assets are loaded through typed asset handles and instanced by systems.",
      "Transforms and hierarchy stay in ECS, then resolve into render-facing matrices.",
    ],
  },
  {
    id: "rendering",
    title: "Rendering",
    summary:
      "The WebGPU backend owns GPU resources, frame orchestration, materials, shadows, post effects, and diagnostics.",
    bullets: [
      "StandardMaterial, IBL, HDR tonemapping, bloom, shadows, UI, text, and particles are built on WebGPU only.",
      "Renderer-owned preparation turns source assets into buffers, textures, bind groups, and draw queues.",
      "Performance settings live in app config and can adapt by device profile.",
    ],
  },
  {
    id: "agent-tooling",
    title: "Agent Tooling",
    summary:
      "Structured diagnostics and MCP inspection make generated work verifiable rather than guesswork.",
    bullets: [
      "Use pause, snapshot, ecs_step, ecs_diff, and render status when validating behavior.",
      "Diagnostics should explain why an entity did not render or why a backend feature is unsupported.",
      "Examples and showcases should double as reproducible verification routes.",
    ],
  },
  {
    id: "deployment",
    title: "Deployment",
    summary:
      "Static output is the target: build the docs site, preserve asset base paths, and keep examples runnable.",
    bullets: [
      "Use pnpm run docs:build to create the static site output.",
      "Use pnpm run check:docs before publishing to catch missing examples, API pages, or base-path issues.",
      "Keep the published manifest aligned so removed routes are deleted from GitHub Pages.",
    ],
  },
];
