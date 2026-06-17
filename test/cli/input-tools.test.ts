import { describe, expect, it } from "vitest";
import { pointerButtonFromArgs } from "../../packages/cli/src/tools/input.js";

describe("CLI input tools", () => {
  it("maps pointer button arguments to Playwright mouse buttons", () => {
    expect(pointerButtonFromArgs({})).toBe("left");
    expect(pointerButtonFromArgs({ button: "left" })).toBe("left");
    expect(pointerButtonFromArgs({ button: "primary" })).toBe("left");
    expect(pointerButtonFromArgs({ button: "middle" })).toBe("middle");
    expect(pointerButtonFromArgs({ button: "auxiliary" })).toBe("middle");
    expect(pointerButtonFromArgs({ button: "right" })).toBe("right");
    expect(pointerButtonFromArgs({ button: "secondary" })).toBe("right");
    expect(pointerButtonFromArgs({ button: "unsupported" })).toBe("left");
  });
});
