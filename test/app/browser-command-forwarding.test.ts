import { afterEach, describe, expect, it, vi } from "vitest";
import type { SimulationWorker } from "@aperture-engine/runtime";
import {
  APERTURE_GENERATED_COMMAND_EVENT,
  APERTURE_GENERATED_COMMAND_MESSAGE,
} from "../../packages/app/src/commands.js";
import { installGeneratedCommandForwarding } from "../../packages/app/src/browser/commands.js";
import {
  APERTURE_GENERATED_STATUS_GLOBAL,
  installGeneratedStatus,
} from "../../packages/app/src/browser/status.js";

function setup() {
  const target = new EventTarget();
  const postMessage = vi.fn();
  vi.stubGlobal("window", target);
  vi.stubGlobal(APERTURE_GENERATED_STATUS_GLOBAL, undefined);
  const status = installGeneratedStatus();
  return {
    target,
    postMessage,
    status,
    worker: { postMessage } as unknown as SimulationWorker,
    dispatch(detail: unknown) {
      target.dispatchEvent(
        new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, { detail }),
      );
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generated browser command forwarding", () => {
  it("forwards each event once and updates status before notifying the caller", () => {
    const fixture = setup();
    const payload = { entity: "player", position: [1, 2, 3] };
    const observed: unknown[] = [];
    const afterForward = vi.fn(() => {
      observed.push({
        count: fixture.status.forwardedCommandEvents,
        command: fixture.status.lastCommandEvent,
        posted: fixture.postMessage.mock.calls.length,
      });
    });
    installGeneratedCommandForwarding(fixture.worker, fixture.status, {
      afterForward,
    });

    fixture.dispatch({ channel: "player.move", payload, ignored: true });
    fixture.dispatch({ channel: "player.move", payload });
    fixture.dispatch({ channel: "game.pause" });
    fixture.target.dispatchEvent(new CustomEvent("unrelated", { detail: {} }));

    expect(fixture.postMessage.mock.calls).toEqual([
      [
        {
          type: APERTURE_GENERATED_COMMAND_MESSAGE,
          command: { channel: "player.move", payload },
        },
      ],
      [
        {
          type: APERTURE_GENERATED_COMMAND_MESSAGE,
          command: { channel: "player.move", payload },
        },
      ],
      [
        {
          type: APERTURE_GENERATED_COMMAND_MESSAGE,
          command: { channel: "game.pause" },
        },
      ],
    ]);
    expect(fixture.postMessage.mock.calls[0]?.[0].command.payload).toBe(
      payload,
    );
    expect(observed).toEqual([
      { count: 1, command: { channel: "player.move", payload }, posted: 1 },
      { count: 2, command: { channel: "player.move", payload }, posted: 2 },
      { count: 3, command: { channel: "game.pause" }, posted: 3 },
    ]);
    expect(afterForward).toHaveBeenCalledTimes(3);
    expect(fixture.status.lastError).toBeNull();
    expect(fixture.status.lastFailure).toBeNull();
  });

  it.each([
    ["null", null, null],
    ["missing detail", undefined, null],
    ["primitive", 17, 17],
    ["missing channel", { payload: "orphan" }, { payload: "orphan" }],
    ["empty channel", { channel: "" }, { channel: "" }],
    ["non-string channel", { channel: 42 }, { channel: 42 }],
  ])(
    "reports %s without forwarding or incrementing the count",
    (_label, detail, safeDetail) => {
      const fixture = setup();
      const afterForward = vi.fn();
      installGeneratedCommandForwarding(fixture.worker, fixture.status, {
        afterForward,
      });

      fixture.dispatch(detail);

      expect(fixture.postMessage).not.toHaveBeenCalled();
      expect(afterForward).not.toHaveBeenCalled();
      expect(fixture.status.forwardedCommandEvents).toBe(0);
      expect(fixture.status.lastCommandEvent).toEqual({
        code: "aperture.command.invalid",
        severity: "error",
        message:
          "Generated Aperture command events require a non-empty channel.",
        data: { event: APERTURE_GENERATED_COMMAND_EVENT, detail: safeDetail },
        suggestedFix:
          "Dispatch aperture:command with detail { channel: 'your.channel', payload: { ... } }.",
      });
      expect(fixture.status.lastFailure).toMatchObject({
        status: "failed",
        diagnostics: [{ code: "aperture.command.invalid", severity: "error" }],
      });
      expect(fixture.status.lastError).toBe(fixture.status.lastFailure);
    },
  );

  it("keeps malformed circular details JSON-safe and still accepts the next valid command", () => {
    const fixture = setup();
    installGeneratedCommandForwarding(fixture.worker, fixture.status);
    const circular: Record<string, unknown> = { channel: null };
    circular["self"] = circular;

    fixture.dispatch(circular);
    const failure = fixture.status.lastFailure;
    expect(fixture.status.lastCommandEvent).toMatchObject({
      data: { detail: "[object Object]" },
    });
    expect(() => JSON.stringify(failure)).not.toThrow();

    fixture.dispatch({ channel: "game.resume", payload: null });
    fixture.dispatch({ channel: "game.resume", payload: undefined });

    expect(fixture.status.forwardedCommandEvents).toBe(2);
    expect(fixture.postMessage).toHaveBeenNthCalledWith(1, {
      type: APERTURE_GENERATED_COMMAND_MESSAGE,
      command: { channel: "game.resume", payload: null },
    });
    expect(fixture.status.lastCommandEvent).toEqual({
      channel: "game.resume",
      payload: undefined,
    });
    expect(fixture.status.lastCommandEvent).toHaveProperty("payload");
    // The latest successful command does not erase the recorded failure history.
    expect(fixture.status.lastFailure).toBe(failure);
  });

  it("does not count or notify a command whose worker post fails", () => {
    const fixture = setup();
    const addListener = vi.spyOn(fixture.target, "addEventListener");
    const afterForward = vi.fn();
    installGeneratedCommandForwarding(fixture.worker, fixture.status, {
      afterForward,
    });
    fixture.postMessage.mockImplementationOnce(() => {
      throw new Error("worker is terminated");
    });
    const listener = addListener.mock.calls[0]?.[1] as EventListener;
    const event = new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
      detail: { channel: "game.pause" },
    });

    // Invoke the installed listener directly so host-level exception reporting
    // does not turn this synchronous worker failure into an unhandled event.
    expect(() => listener(event)).toThrow("worker is terminated");
    expect(fixture.status.forwardedCommandEvents).toBe(0);
    expect(fixture.status.lastCommandEvent).toBeNull();
    expect(afterForward).not.toHaveBeenCalled();

    listener(event);
    expect(fixture.status.forwardedCommandEvents).toBe(1);
    expect(afterForward).toHaveBeenCalledOnce();
  });
});
