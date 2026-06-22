import { describe, expect, it } from "vitest";

import { resolveUseFrameGraph } from "../../packages/app/src/browser/frame-graph-route.js";

// AI-25: the single-encoder FrameGraph route is the DEFAULT at parity. The
// render.frameGraph config option enables/forces it reproducibly (no query
// string) and the ?graph URL flag stays as a per-load override on top.

describe("resolveUseFrameGraph", () => {
  it("defaults to ON with no config and no query string (AI-25)", () => {
    expect(resolveUseFrameGraph(undefined, null)).toBe(true);
    expect(resolveUseFrameGraph({}, null)).toBe(true);
    expect(resolveUseFrameGraph({}, new URLSearchParams(""))).toBe(true);
  });

  it("render.frameGraph: true enables and false forces legacy, reproducibly", () => {
    expect(resolveUseFrameGraph({ frameGraph: true }, null)).toBe(true);
    expect(resolveUseFrameGraph({ frameGraph: false }, null)).toBe(false);
    // no query string involved — the config alone decides
    expect(
      resolveUseFrameGraph({ frameGraph: false }, new URLSearchParams("")),
    ).toBe(false);
  });

  it("still honors the legacy ?graph=1 URL override (wins over config)", () => {
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

  it("?graph=0 is the per-load legacy escape hatch (wins over config)", () => {
    expect(resolveUseFrameGraph({}, new URLSearchParams("graph=0"))).toBe(
      false,
    );
    expect(
      resolveUseFrameGraph(
        { frameGraph: true },
        new URLSearchParams("graph=0"),
      ),
    ).toBe(false);
  });

  it("ignores unrecognized graph values and falls back to config/default", () => {
    expect(resolveUseFrameGraph({}, new URLSearchParams("graph=yes"))).toBe(
      true,
    );
    expect(
      resolveUseFrameGraph(
        { frameGraph: false },
        new URLSearchParams("graph=yes"),
      ),
    ).toBe(false);
  });
});
