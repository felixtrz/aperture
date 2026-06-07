import { describe, expect, it } from "vitest";

import { resolveUseFrameGraph } from "../../packages/app/src/browser/frame-graph-route.js";

describe("resolveUseFrameGraph", () => {
  it("defaults to off with no config and no query string", () => {
    expect(resolveUseFrameGraph(undefined, null)).toBe(false);
    expect(resolveUseFrameGraph({}, null)).toBe(false);
  });

  it("enables via the render.frameGraph config option", () => {
    expect(resolveUseFrameGraph({ frameGraph: true }, null)).toBe(true);
    expect(resolveUseFrameGraph({ frameGraph: false }, null)).toBe(false);
  });

  it("still honors the legacy ?graph=1 URL override", () => {
    expect(
      resolveUseFrameGraph(undefined, new URLSearchParams("graph=1")),
    ).toBe(true);
    expect(
      resolveUseFrameGraph(
        { frameGraph: false },
        new URLSearchParams("graph=1"),
      ),
    ).toBe(true);
  });

  it("treats any non-1 graph value as off", () => {
    expect(resolveUseFrameGraph({}, new URLSearchParams("graph=0"))).toBe(
      false,
    );
    expect(resolveUseFrameGraph({}, new URLSearchParams(""))).toBe(false);
  });
});
