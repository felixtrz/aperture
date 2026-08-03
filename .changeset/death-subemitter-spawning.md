---
"@aperture-engine/webgpu": minor
"@aperture-engine/particles": minor
---

Implement death-trigger subemitter spawning and extend subemitter support to
burst parent emitters. When a parent particle's age crosses its lifetime on the
CPU simulation path, the frame now records a per-frame death event log (slot,
spawn generation, simulation-space position — including collision
lifetime-loss kills at the collision point) and death subemitter units seed the
child effect's emission there: the child's rate-over-time and authored bursts
play out anchored at the death position, reusing the birth subemitter tracker
machinery with the anchor held fixed because the parent slot is dead.

Burst parents now support both birth and death subemitters: a burst emitter
whose effect declares them leaves the shared GPU-analytic batch and takes the
existing per-emitter CPU burst path (the one local-space bursts already use),
where per-slot spawn data and deterministic seeded lifetimes make births and
deaths observable frame-by-frame with no GPU readback. This was chosen over
computing a CPU-side death schedule against the batched analytic shader
because death positions there would require duplicating the shader's full
module integral stack on the CPU and keeping the two in lockstep; the CPU
burst path already reproduces quarks stepping for spawn and death alike.

The child's authored t=0 burst now fires exactly once through a tracker
first-advance flag, fixing a double-fire when a tracker was seeded on a
zero-delta child frame (previously every birth subemitter on a burst parent's
init frame would have emitted its t=0 burst twice).

Validation: birth and death subemitters are no longer flagged — only
collision subemitters remain unsupported. Death children spawn seeded at the
dying particle's position; the schema carries no velocity-inheritance flag
(three.quarks `useVelocityAsBasis` has no schema field yet), so parent
velocity is not inherited.
