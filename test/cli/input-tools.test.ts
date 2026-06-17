import { describe, expect, it } from "vitest";
import {
  domButtonFromPointerButton,
  mouseButtonsMaskFromDomButton,
  pointerButtonFromArgs,
} from "../../packages/cli/src/tools/input.js";

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

  it("maps pointer buttons to DOM button codes and pressed masks", () => {
    expect(domButtonFromPointerButton("left")).toBe(0);
    expect(domButtonFromPointerButton("middle")).toBe(1);
    expect(domButtonFromPointerButton("right")).toBe(2);

    expect(mouseButtonsMaskFromDomButton(0)).toBe(1);
    expect(mouseButtonsMaskFromDomButton(1)).toBe(4);
    expect(mouseButtonsMaskFromDomButton(2)).toBe(2);
  });
});
