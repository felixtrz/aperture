import { afterEach, describe, expect, it, vi } from "vitest";
import type { SimulationWorker } from "@aperture-engine/runtime";
import {
  APERTURE_DEVTOOLS_PROTOCOL_VERSION,
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "@aperture-engine/app/commands";
import {
  APERTURE_MCP_MANAGED_GLOBAL,
  APERTURE_MCP_RUNTIME_GLOBAL,
  installGeneratedDevtoolsRuntime,
  type ApertureMcpRuntime,
} from "../../packages/app/src/browser/devtools/runtime.js";

function fixture(managed = true) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  vi.stubGlobal(APERTURE_MCP_MANAGED_GLOBAL, managed);
  vi.stubGlobal(APERTURE_MCP_RUNTIME_GLOBAL, undefined);
  const listeners = new Set<(message: unknown) => void>();
  const postMessage = vi.fn<(message: unknown) => void>();
  const onMessage = vi.fn((callback: (message: unknown) => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  });
  installGeneratedDevtoolsRuntime({
    worker: { postMessage, onMessage } as unknown as SimulationWorker,
    getWebGpuResult: () => null,
  });
  const runtime = (globalThis as Record<string, unknown>)[
    APERTURE_MCP_RUNTIME_GLOBAL
  ] as ApertureMcpRuntime | undefined;
  return {
    runtime,
    postMessage,
    onMessage,
    respond(message: unknown) {
      for (const callback of listeners) callback(message);
    },
    request(index: number): ApertureDevtoolsRequest {
      return postMessage.mock.calls[index]![0] as ApertureDevtoolsRequest;
    },
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("managed browser devtools runtime", () => {
  it("does not install or subscribe in an unmanaged browser", () => {
    const test = fixture(false);
    expect(test.runtime).toBeUndefined();
    expect(test.onMessage).not.toHaveBeenCalled();
    expect(test.postMessage).not.toHaveBeenCalled();
  });

  it("answers browser-local requests without forwarding them or creating timeout timers", async () => {
    const test = fixture();
    expect(test.runtime?.version).toBe(APERTURE_DEVTOOLS_PROTOCOL_VERSION);
    expect(
      await test.runtime!.callTool("render_set_post_effect_enabled", {
        effectId: "bloom",
        enabled: true,
      }),
    ).toMatchObject({
      version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
      requestId: expect.stringMatching(/^browser-\d+-1$/),
      ok: false,
      diagnostics: [{ code: "aperture.devtools.webgpuUnavailable" }],
    });
    expect(test.postMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("correlates concurrent worker replies out of order and ignores unrelated or duplicate messages", async () => {
    const test = fixture();
    const first = test.runtime!.callTool("ecs_query", { tags: ["editable"] });
    const second = test.runtime!.callTool("ecs_get_hierarchy");
    await Promise.resolve();
    expect(test.postMessage).toHaveBeenCalledTimes(2);
    const firstRequest = test.request(0);
    const secondRequest = test.request(1);
    expect(firstRequest).toMatchObject({
      version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
      tool: "ecs_query",
      payload: { tags: ["editable"] },
    });
    expect(secondRequest.tool).toBe("ecs_get_hierarchy");
    expect(firstRequest.requestId).not.toBe(secondRequest.requestId);
    expect(vi.getTimerCount()).toBe(2);

    test.respond({ type: "snapshot" });
    test.respond(
      createApertureDevtoolsResponse({ requestId: "unknown", ok: true }),
    );
    expect(vi.getTimerCount()).toBe(2);
    const secondResponse = createApertureDevtoolsResponse({
      requestId: secondRequest.requestId,
      ok: true,
      result: { roots: [] },
    });
    test.respond(secondResponse);
    expect(await second).toEqual(secondResponse);
    expect(vi.getTimerCount()).toBe(1);
    test.respond(secondResponse);
    expect(vi.getTimerCount()).toBe(1);
    const firstResponse = createApertureDevtoolsResponse({
      requestId: firstRequest.requestId,
      ok: false,
      diagnostics: [{ code: "invalid-query" }],
    });
    test.respond(firstResponse);
    expect(await first).toEqual(firstResponse);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects at the deadline, ignores the expired reply, and still serves the next request", async () => {
    const test = fixture();
    const expired = test.runtime!.callTool("ecs_query");
    const rejection = expect(expired).rejects.toThrow(
      "Aperture devtools request 'ecs_query' timed out.",
    );
    await Promise.resolve();
    const expiredRequest = test.request(0);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);

    const current = test.runtime!.callTool("ecs_query", { name: "current" });
    await Promise.resolve();
    const currentRequest = test.request(1);
    expect(currentRequest.requestId).not.toBe(expiredRequest.requestId);
    test.respond(
      createApertureDevtoolsResponse({
        requestId: expiredRequest.requestId,
        ok: true,
        result: { stale: true },
      }),
    );
    expect(vi.getTimerCount()).toBe(1);
    const currentResponse = createApertureDevtoolsResponse({
      requestId: currentRequest.requestId,
      ok: true,
      result: { current: true },
    });
    test.respond(currentResponse);
    expect(await current).toEqual(currentResponse);
    expect(vi.getTimerCount()).toBe(0);
  });
});
