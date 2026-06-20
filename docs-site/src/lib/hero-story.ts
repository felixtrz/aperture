export const HERO_STORY_COMMAND_CHANNEL = "landing-scene.story";

export const HERO_STORY_START_PHASE = 0.14;
export const HERO_STORY_PHASE_STEP = 1 / 4;

function storyPhase(index: number): number {
  return Number(
    ((HERO_STORY_START_PHASE + HERO_STORY_PHASE_STEP * index) % 1).toFixed(4),
  );
}

export const HERO_STORY_MOMENTS = [
  {
    id: "ecs-native",
    phase: storyPhase(0),
    label: "ECS",
    time: "Morning",
    title: "ECS-native, not scene-graph",
    body: "Your game state is pure data the renderer reads, not a mutable object tree you mutate. Entities and components are authoritative; rendering is a derived snapshot. The same bet that makes Aperture fast, parallel, and agent-friendly, and that scene-graph engines can't retrofit.",
  },
  {
    id: "agent-first",
    phase: storyPhase(1),
    label: "Agents",
    time: "Noon",
    title: "Agent-first, human-readable",
    body: "Built for how you build now: describing intent to an agent, not hand-writing every line. Regular, local, explicit systems are easy for an agent to generate and a human to trust, backed by 1,200+ structured diagnostics and built-in MCP inspection tools so an agent's work is verifiable, not guesswork.",
  },
  {
    id: "multithreaded",
    phase: storyPhase(2),
    label: "Worker",
    time: "Dusk",
    title: "Multithreaded by default",
    body: "On the web you've always coded on the main thread. Here you code in the worker; the main thread belongs to the renderer. Simulation runs off the main thread out of the box, with the snapshot boundary already solved. Your game logic can't jank your frame rate.",
  },
  {
    id: "webgpu-rendering",
    phase: storyPhase(3),
    label: "WebGPU",
    time: "Night",
    title: "State-of-the-art WebGPU rendering",
    body: "No WebGL-era compromises in anything it draws. Physically-based materials, real area lights, clustered lighting, cascaded shadows, image-based lighting, and a modern post stack: TAA, bloom, SSAO, SSR, built on WebGPU from day one.",
  },
] as const;

export type HeroStoryMoment = (typeof HERO_STORY_MOMENTS)[number];
export type HeroStoryMomentId = HeroStoryMoment["id"];

export interface HeroStorySetMomentCommand {
  readonly kind: "set-moment";
  readonly moment: HeroStoryMomentId;
}

export interface HeroStorySetPhaseCommand {
  readonly kind: "set-phase";
  readonly moment: HeroStoryMomentId;
  readonly phase: number;
}

export type HeroStoryCommand =
  | HeroStorySetMomentCommand
  | HeroStorySetPhaseCommand;

export function heroStoryMomentById(id: string): HeroStoryMoment | undefined {
  return HERO_STORY_MOMENTS.find((moment) => moment.id === id);
}
