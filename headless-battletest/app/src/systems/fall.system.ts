import { LocalTransform, createSystem } from "@aperture-engine/app/systems";
import { Star } from "../components.ts";

// Advances each star downward and applies a horizontal sway. All motion is a
// pure function of delta and context.time (this.time.elapsed), so replay is
// deterministic. When the magnet is held the stars are nudged toward the
// basket's x, coupling the button action into simulation state.
export default class FallSystem extends createSystem({
  priority: 20,
  queries: {
    stars: { required: [Star, LocalTransform] },
  },
}) {
  override update(delta: number): void {
    const elapsed = this.time.elapsed;
    const magnet = this.actions.magnet;
    const magnetHeld =
      magnet?.kind === "button" && magnet.pressed.value === true;

    const magnetSignal = this.signals.magnetActive;
    if (magnetSignal !== undefined) {
      magnetSignal.value = magnetHeld;
    }
    const basketX = Number(this.signals.basketX?.value ?? 0);

    for (const star of this.queries.stars.entities) {
      const translation = star.getVectorView(LocalTransform, "translation");
      const fallSpeed = star.getValue(Star, "fallSpeed") ?? 2;
      const swayAmplitude = star.getValue(Star, "swayAmplitude") ?? 0;
      const swayPhase = star.getValue(Star, "swayPhase") ?? 0;
      const baseX = star.getValue(Star, "baseX") ?? 0;

      translation[1] = (translation[1] ?? 0) - fallSpeed * delta;

      let x = baseX + swayAmplitude * Math.sin(elapsed * 1.5 + swayPhase);
      if (magnetHeld) {
        // Ease the resting x toward the basket while the magnet is active.
        const pulled = baseX + (basketX - baseX) * 0.08;
        star.setValue(Star, "baseX", pulled);
        x = pulled + swayAmplitude * Math.sin(elapsed * 1.5 + swayPhase);
      }
      translation[0] = x;
    }
  }
}
