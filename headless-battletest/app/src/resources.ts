import { defineResource, resource } from "@aperture-engine/app/systems";

// Non-entity director state. Spawn cadence is deterministic: after each spawn we
// pick the next interval from context.random, so a fixed seed reproduces the
// exact spawn schedule.
export const DirectorState = defineResource("starfall.director", {
  nextStarId: resource.number(0),
  // Seconds until the next star spawns.
  spawnCountdown: resource.number(0.4),
});
