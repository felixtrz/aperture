import { describe, expect, it } from "vitest";
import {
  activeBreakpoints,
  resolveStyle,
  type ConditionalStyle,
} from "@aperture-engine/ui";

interface Style {
  color?: string;
  size?: number;
  weight?: number;
}

describe("activeBreakpoints", () => {
  it("returns breakpoints whose threshold the width exceeds", () => {
    expect(activeBreakpoints(500)).toEqual([]);
    expect(activeBreakpoints(700)).toEqual(["sm"]);
    expect(activeBreakpoints(800)).toEqual(["sm", "md"]);
    expect(activeBreakpoints(2000)).toEqual(["sm", "md", "lg", "xl", "2xl"]);
  });
});

describe("resolveStyle — precedence", () => {
  it("returns the base style when no layers are active", () => {
    const style: ConditionalStyle<Style> = {
      color: "white",
      hover: { color: "blue" },
    };
    expect(resolveStyle(style, {})).toEqual({ color: "white" });
  });

  it("applies hover over base", () => {
    const style: ConditionalStyle<Style> = {
      color: "white",
      hover: { color: "blue" },
    };
    expect(resolveStyle(style, { hover: true })).toEqual({ color: "blue" });
  });

  it("orders focus > active > hover > dark", () => {
    const style: ConditionalStyle<Style> = {
      color: "base",
      dark: { color: "dark" },
      hover: { color: "hover" },
      active: { color: "active" },
      focus: { color: "focus" },
    };
    expect(
      resolveStyle(style, {
        dark: true,
        hover: true,
        active: true,
        focus: true,
      }).color,
    ).toBe("focus");
    expect(
      resolveStyle(style, { dark: true, hover: true, active: true }).color,
    ).toBe("active");
    expect(resolveStyle(style, { dark: true, hover: true }).color).toBe(
      "hover",
    );
    expect(resolveStyle(style, { dark: true }).color).toBe("dark");
  });

  it("lets important win over everything", () => {
    const style: ConditionalStyle<Style> = {
      color: "base",
      focus: { color: "focus" },
      important: { color: "important" },
    };
    expect(resolveStyle(style, { focus: true }).color).toBe("important");
  });

  it("cascades responsive layers with larger overriding smaller", () => {
    const style: ConditionalStyle<Style> = {
      size: 10,
      weight: 400,
      sm: { size: 12 },
      md: { size: 14, weight: 500 },
      lg: { size: 16 },
    };
    // 800 → sm + md active; lg not.
    expect(resolveStyle(style, { width: 800 })).toEqual({
      size: 14,
      weight: 500,
    });
    // 1100 → sm + md + lg active; lg size wins, md weight persists.
    expect(resolveStyle(style, { width: 1100 })).toEqual({
      size: 16,
      weight: 500,
    });
  });

  it("ranks interaction states above responsive layers", () => {
    const style: ConditionalStyle<Style> = {
      color: "base",
      lg: { color: "lg" },
      hover: { color: "hover" },
    };
    expect(resolveStyle(style, { width: 1100, hover: true }).color).toBe(
      "hover",
    );
    expect(resolveStyle(style, { width: 1100 }).color).toBe("lg");
  });

  it("does not leak layer keys into the resolved style", () => {
    const style: ConditionalStyle<Style> = {
      color: "white",
      hover: { color: "blue" },
      md: { size: 12 },
    };
    const resolved = resolveStyle(style, { hover: true, width: 800 });
    expect(resolved).not.toHaveProperty("hover");
    expect(resolved).not.toHaveProperty("md");
  });
});
