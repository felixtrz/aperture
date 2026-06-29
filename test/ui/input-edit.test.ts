import { describe, expect, it } from "vitest";
import {
  caretOffset,
  createInputState,
  editText,
  hasSelection,
  maskValue,
  monospaceAdvance,
  selectedText,
  selectionRange,
  selectionRect,
  type InputState,
} from "@aperture-engine/ui";

const start = (
  value: string,
  caret = value.length,
  anchor = caret,
): InputState => ({
  value,
  caret,
  anchor,
});

describe("text editing reducer", () => {
  it("inserts at the caret", () => {
    const s = editText(start("ac", 1), { type: "insert", text: "b" });
    expect(s.value).toBe("abc");
    expect(s.caret).toBe(2);
    expect(hasSelection(s)).toBe(false);
  });

  it("insert replaces the selection", () => {
    const s = editText(start("hello", 1, 4), { type: "insert", text: "X" });
    expect(s.value).toBe("hXo");
    expect(s.caret).toBe(2);
  });

  it("deletes backward", () => {
    expect(editText(start("abc", 2), { type: "deleteBackward" }).value).toBe(
      "ac",
    );
    expect(editText(start("abc", 0), { type: "deleteBackward" }).value).toBe(
      "abc",
    );
  });

  it("deletes a selection on backspace", () => {
    const s = editText(start("abcdef", 1, 4), { type: "deleteBackward" });
    expect(s.value).toBe("aef");
    expect(s.caret).toBe(1);
  });

  it("deletes forward", () => {
    expect(editText(start("abc", 1), { type: "deleteForward" }).value).toBe(
      "ac",
    );
  });

  it("moves the caret and extends selection", () => {
    expect(editText(start("abc", 1), { type: "moveLeft" }).caret).toBe(0);
    expect(editText(start("abc", 1), { type: "moveRight" }).caret).toBe(2);
    const sel = editText(start("abc", 1), { type: "moveRight", select: true });
    expect(sel.caret).toBe(2);
    expect(sel.anchor).toBe(1);
    expect(selectedText(sel)).toBe("b");
  });

  it("collapses a selection toward the arrow direction", () => {
    expect(editText(start("abcdef", 1, 4), { type: "moveLeft" }).caret).toBe(1);
    expect(editText(start("abcdef", 1, 4), { type: "moveRight" }).caret).toBe(
      4,
    );
  });

  it("supports home/end and select-all", () => {
    expect(editText(start("abc", 1), { type: "home" }).caret).toBe(0);
    expect(editText(start("abc", 1), { type: "end" }).caret).toBe(3);
    const all = editText(start("abc", 1), { type: "selectAll" });
    expect(selectionRange(all)).toEqual({ start: 0, end: 3 });
  });

  it("setValue clamps the caret", () => {
    const s = editText(start("abcdef", 5), { type: "setValue", value: "ab" });
    expect(s).toEqual({ value: "ab", caret: 2, anchor: 2 });
  });

  it("createInputState places caret at end", () => {
    expect(createInputState("hi")).toEqual({
      value: "hi",
      caret: 2,
      anchor: 2,
    });
  });

  it("masks a value", () => {
    expect(maskValue("abc")).toBe("•••");
  });
});

describe("caret geometry", () => {
  const advance = monospaceAdvance(8);

  it("computes caret offset by accumulated advance", () => {
    expect(caretOffset("hello", 0, advance)).toBe(0);
    expect(caretOffset("hello", 3, advance)).toBe(24);
    expect(caretOffset("hello", 99, advance)).toBe(40);
  });

  it("computes a selection rect", () => {
    expect(selectionRect("hello", 1, 4, { advance, fontSize: 16 })).toEqual({
      x: 8,
      width: 24,
      height: 16,
    });
    expect(selectionRect("hello", 2, 2, { advance, fontSize: 16 })).toBeNull();
  });
});
