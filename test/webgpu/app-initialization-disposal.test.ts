import { describe, expect, it, vi } from "vitest";
import { initializeWebGpu } from "@aperture-engine/webgpu";

describe("failed GPU initialization ownership", () => {
  it.each(["missing", "lookup throws", "configure throws"])(
    "releases the newly requested device when context %s",
    async (mode) => {
      const destroy = vi.fn();
      const device = { destroy };
      const result = await initializeWebGpu({
        environment: {
          navigator: {
            gpu: {
              requestAdapter: async () => ({
                requestDevice: async () => device,
              }),
            },
          },
        },
        canvas: {
          getContext() {
            if (mode === "lookup throws")
              throw new Error("Canvas lookup failed");
            if (mode === "missing") return null;
            return {
              configure() {
                throw new Error("Canvas configure failed");
              },
            };
          },
        },
      });
      expect(result).toMatchObject({
        ok: false,
        reason:
          mode === "configure throws"
            ? "context-configure-failed"
            : "context-unavailable",
      });
      expect(destroy).toHaveBeenCalledTimes(1);
    },
  );
});
