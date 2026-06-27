import { describe, expect, it } from "vitest";
import {
  createHiddenInputBridge,
  type HiddenInputElementLike,
  type InputState,
} from "@aperture-engine/ui";

class FakeInput implements HiddenInputElementLike {
  value = "";
  selectionStart: number | null = 0;
  selectionEnd: number | null = 0;
  type = "text";
  disabled = false;
  focused = false;
  private readonly listeners = new Map<string, Set<() => void>>();

  focus(): void {
    this.focused = true;
  }
  blur(): void {
    this.focused = false;
  }
  setSelectionRange(start: number, end: number): void {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string): void {
    this.listeners.get(type)?.forEach((l) => l());
  }
  listenerCount(): number {
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }
}

describe("hidden input DOM bridge", () => {
  it("emits state on input events mapped from value + selection", () => {
    const el = new FakeInput();
    const states: InputState[] = [];
    const bridge = createHiddenInputBridge(el, (s) => states.push(s));

    el.value = "abc";
    el.selectionStart = 1;
    el.selectionEnd = 3;
    el.fire("input");

    expect(states.at(-1)).toEqual({ value: "abc", caret: 3, anchor: 1 });
    bridge.dispose();
  });

  it("syncs a model state into the element", () => {
    const el = new FakeInput();
    const bridge = createHiddenInputBridge(el, () => {});
    bridge.sync({ value: "hello", caret: 4, anchor: 1 });
    expect(el.value).toBe("hello");
    expect(el.selectionStart).toBe(1);
    expect(el.selectionEnd).toBe(4);
    bridge.dispose();
  });

  it("focuses and places the selection", () => {
    const el = new FakeInput();
    el.value = "hello";
    const bridge = createHiddenInputBridge(el, () => {});
    bridge.focus(2, 5);
    expect(el.focused).toBe(true);
    expect(el.selectionStart).toBe(2);
    expect(el.selectionEnd).toBe(5);
    bridge.blur();
    expect(el.focused).toBe(false);
    bridge.dispose();
  });

  it("removes all listeners on dispose", () => {
    const el = new FakeInput();
    const bridge = createHiddenInputBridge(el, () => {});
    expect(el.listenerCount()).toBeGreaterThan(0);
    bridge.dispose();
    expect(el.listenerCount()).toBe(0);
  });
});
