import { describe, expect, it } from "vitest";
import {
  ApertureCliError,
  parseApertureGpuMode,
  resolveApertureGpu,
  swiftShaderArgs,
} from "@aperture-engine/cli";

describe("Aperture managed-browser GPU mode resolution", () => {
  it("emits the SwiftShader Vulkan flags used for software WebGPU", () => {
    const args = swiftShaderArgs();
    expect(args).toContain("--enable-unsafe-webgpu");
    expect(args).toContain("--enable-unsafe-swiftshader");
    expect(args).toContain("--use-vulkan=swiftshader");
    expect(args).toContain("--enable-features=Vulkan");
  });

  it("normalizes flag and env aliases, ignoring empty values", () => {
    expect(parseApertureGpuMode("auto", "flag")).toBe("auto");
    expect(parseApertureGpuMode("HARDWARE", "flag")).toBe("hardware");
    expect(parseApertureGpuMode("gpu", "flag")).toBe("hardware");
    expect(parseApertureGpuMode("swiftshader", "env")).toBe("software");
    expect(parseApertureGpuMode("cpu", "env")).toBe("software");
    expect(parseApertureGpuMode("  ", "env")).toBeUndefined();
    expect(parseApertureGpuMode(undefined, "env")).toBeUndefined();
  });

  it("rejects unknown mode values with a helpful error", () => {
    expect(() => parseApertureGpuMode("metal", "flag")).toThrow(
      ApertureCliError,
    );
    expect(() => parseApertureGpuMode("metal", "env")).toThrow(/APERTURE_GPU/);
  });

  it("honors an explicit hardware request over env and platform", () => {
    const resolved = resolveApertureGpu({
      mode: "hardware",
      env: { APERTURE_GPU: "software" },
      platform: "linux",
    });
    expect(resolved.software).toBe(false);
    expect(resolved.source).toBe("flag");
  });

  it("honors an explicit software request", () => {
    const resolved = resolveApertureGpu({
      mode: "software",
      platform: "darwin",
    });
    expect(resolved.software).toBe(true);
    expect(resolved.source).toBe("flag");
  });

  it("falls back to the APERTURE_GPU env var when no flag is given", () => {
    const resolved = resolveApertureGpu({
      env: { APERTURE_GPU: "software" },
      platform: "darwin",
    });
    expect(resolved.software).toBe(true);
    expect(resolved.source).toBe("env");
  });

  it("assumes a hardware GPU on non-Linux hosts in auto mode", () => {
    for (const platform of ["darwin", "win32"] as const) {
      const resolved = resolveApertureGpu({ env: {}, platform });
      expect(resolved.mode).toBe("auto");
      expect(resolved.source).toBe("default");
      expect(resolved.software).toBe(false);
    }
  });

  it("auto-detects the GPU from /dev/dri on Linux", () => {
    const resolved = resolveApertureGpu({ env: {}, platform: "linux" });
    expect(resolved.mode).toBe("auto");
    expect(resolved.source).toBe("default");
    // The boolean depends on the host (GPU desktop vs GPU-less container), but
    // the decision must come from the DRI device-node probe either way.
    expect(resolved.reason).toContain("/dev/dri");
    expect(typeof resolved.software).toBe("boolean");
  });
});
