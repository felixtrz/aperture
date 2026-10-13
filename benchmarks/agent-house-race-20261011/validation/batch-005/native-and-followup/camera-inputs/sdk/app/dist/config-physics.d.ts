import type { AperturePhysicsAppConfig } from "./config.js";
import type { AperturePhysicsConfig } from "./physics-facade.js";
/**
 * Translate a declarative `config.physics` block (the shared app-config form,
 * which may carry an `enabled` flag) into the imperative `createApertureApp`
 * physics option. Returns `undefined` when physics is absent or explicitly
 * disabled, `true` for the "enabled with defaults" shorthand, or the resolved
 * backend/gravity/collider options otherwise.
 *
 * This is the single translation shared by every entry point — the
 * worker/browser loop and `createApertureApp` itself — so a `physics` block in
 * a config behaves identically in the browser and in headless mode. Wiring it
 * only into the worker loop is what made headless silently drop `config.physics`
 * (finding F12): `fixedUpdate` never fired and physics games could not be
 * validated headlessly even though they ran in the browser.
 */
export declare function resolveConfigPhysicsOption(physics: boolean | AperturePhysicsAppConfig | undefined): boolean | AperturePhysicsConfig | undefined;
//# sourceMappingURL=config-physics.d.ts.map