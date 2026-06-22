export interface ShowcaseEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly href: string;
  readonly sourceHref: string;
  readonly status: "active" | "prototype";
  readonly capabilities: readonly string[];
}

export const showcases: readonly ShowcaseEntry[] = [
  {
    id: "city-builder",
    name: "City Builder",
    description:
      "A tool-like scene for ECS-authored placement, selection, and city-scale composition.",
    href: "/showcase/city-builder/",
    sourceHref:
      "https://github.com/felixtrz/aperture/tree/main/showcase/city-builder",
    status: "active",
    capabilities: ["ECS authoring", "layout tools", "3D editing"],
  },
  {
    id: "fps",
    name: "FPS",
    description:
      "A first-person starter that exercises input, physics, camera control, and WebGPU rendering.",
    href: "/showcase/fps/",
    sourceHref: "https://github.com/felixtrz/aperture/tree/main/showcase/fps",
    status: "active",
    capabilities: ["physics", "input", "camera", "game loop"],
  },
  {
    id: "platformer",
    name: "Platformer",
    description:
      "A compact character/action showcase focused on movement, collision, and readable systems.",
    href: "/showcase/platformer/",
    sourceHref:
      "https://github.com/felixtrz/aperture/tree/main/showcase/platformer",
    status: "active",
    capabilities: ["character control", "physics", "worker systems"],
  },
  {
    id: "racing",
    name: "Racing",
    description:
      "A performance-heavy driving scene for render pacing, dynamic meshes, particles, shadows, and audio.",
    href: "/showcase/racing/",
    sourceHref:
      "https://github.com/felixtrz/aperture/tree/main/showcase/racing",
    status: "active",
    capabilities: ["render pacing", "particles", "shadows", "audio"],
  },
];
