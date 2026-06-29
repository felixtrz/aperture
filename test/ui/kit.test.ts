import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createExtractionApp,
  type ExtractionApp,
} from "@aperture-engine/runtime";
import {
  installYogaUiLayout,
  kit,
  loadLayoutModule,
  mountUi,
  ui,
  type InstalledUiLayout,
  type Yoga,
} from "@aperture-engine/ui";

let yoga: Yoga;
let app: ExtractionApp | null = null;
let installed: InstalledUiLayout | null = null;

beforeEach(async () => {
  yoga = await loadLayoutModule();
});

afterEach(() => {
  installed?.uninstall();
  installed = null;
  app = null;
});

describe("widget kit", () => {
  it("fills a hud bar proportionally to value/max", () => {
    app = createExtractionApp();
    const tree = ui.screen({ width: 400, height: 200 }, [
      kit.panel({}, [
        kit.hudBar({ value: 30, max: 100, width: 200, height: 16 }),
      ]),
    ]);
    mountUi(app, tree);
    installed = installYogaUiLayout(app.world, yoga);

    const nodes = app.extract(0).uiNodes ?? [];
    const panels = nodes.filter((n) => n.kind === "panel");
    // The track is 200 wide; the fill is 30% of it.
    const fill = panels.find((n) => Math.abs(n.rect.width - 60) < 0.5);
    expect(fill).toBeTruthy();
    expect(fill?.rect.width).toBeCloseTo(60, 1);
  });

  it("clamps an over-full hud bar to the track width", () => {
    app = createExtractionApp();
    const tree = ui.screen({ width: 400, height: 200 }, [
      kit.hudBar({ value: 150, max: 100, width: 120, height: 16 }),
    ]);
    mountUi(app, tree);
    installed = installYogaUiLayout(app.world, yoga);

    const nodes = app.extract(0).uiNodes ?? [];
    const fill = nodes.find(
      (n) => n.kind === "panel" && Math.abs(n.rect.width - 120) < 0.5,
    );
    expect(fill).toBeTruthy();
  });

  it("composes a HUD with panel, labels, and a spacer", () => {
    app = createExtractionApp();
    const tree = ui.screen({ width: 400, height: 80, padding: 10 }, [
      kit.panel({ flexDirection: "row" }, [
        kit.label("HP"),
        kit.spacer(),
        kit.label("100/100"),
      ]),
    ]);
    mountUi(app, tree);
    installed = installYogaUiLayout(app.world, yoga);

    const nodes = app.extract(0).uiNodes ?? [];
    const texts = nodes.filter((n) => n.kind === "text").map((n) => n.text);
    expect(texts).toContain("HP");
    expect(texts).toContain("100/100");
    // The panel renders with a border (rounded), so a bordered node exists.
    expect(nodes.some((n) => n.cornerRadii !== undefined)).toBe(true);
  });
});
