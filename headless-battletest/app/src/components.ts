import { EcsType, defineComponent } from "@aperture-engine/app/systems";

// Per-star gameplay state. defineComponent(id, schema) — the id must be a stable
// namespaced string (same shape as defineResource). Auto-registered on the world
// the first time a query references it or addComponent attaches it (elics).
// Keeping dynamic state in a real ECS component (not a side Map) verifies that
// custom components round-trip through the headless runner and ECS tools.
export const Star = defineComponent("starfall.star", {
  // Vertical fall speed in world units/second.
  fallSpeed: { type: EcsType.Float32, default: 2 },
  // Horizontal sway amplitude and phase for a little motion.
  swayAmplitude: { type: EcsType.Float32, default: 0 },
  swayPhase: { type: EcsType.Float32, default: 0 },
  // Base x the sway oscillates around.
  baseX: { type: EcsType.Float32, default: 0 },
});

// The catcher. One instance, tagged so systems can find it without a key scan.
export const Basket = defineComponent("starfall.basket", {
  speed: { type: EcsType.Float32, default: 6 },
  halfWidth: { type: EcsType.Float32, default: 0.9 },
});
