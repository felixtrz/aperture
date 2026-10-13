import type { EcsWorld } from "@aperture-engine/simulation";
import { UiFlex } from "./ui-flex.js";
import { UiFreezeLayout } from "./ui-freeze.js";
import { UiBox } from "./ui-box.js";
import { UiScrollbar } from "./ui-scrollbar.js";
import { UiInput } from "../input/ui-input.js";

/**
 * Register all `@aperture-engine/ui` authoring components on a world
 * (idempotent). Called by the layout installer so the extractor can safely test
 * for these components.
 */
export function registerUiComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(UiFlex);
  world.registerComponent(UiFreezeLayout);
  world.registerComponent(UiBox);
  world.registerComponent(UiScrollbar);
  world.registerComponent(UiInput);
  return world;
}
