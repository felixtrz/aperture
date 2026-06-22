import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadHdrFromUri, parseHdrRgbe } from "@aperture-engine/render";

const HDR_FIXTURE = new URL(
  "../../examples/assets/pisa-studio-rgbe-cube.hdr",
  import.meta.url,
);

describe("Radiance RGBE HDR loader", () => {
  it("parses a committed RGBE .hdr fixture into linear float pixels", () => {
    const bytes = readFileSync(HDR_FIXTURE);
    const report = parseHdrRgbe(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );

    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.image).toMatchObject({
      kind: "hdr-rgbe",
      width: 48,
      height: 8,
      gamma: 1,
      exposure: 1,
      colorSpace: "linear",
      format: "rgba32float",
    });

    const image = required(report.image);

    expect(image.rgbe.slice(0, 4)).toEqual(
      new Uint8Array([0x8a, 0xb8, 0xe4, 0x83]),
    );
    expect(image.data[0]).toBeCloseTo(0x8a * (8 / 255), 6);
    expect(image.data[1]).toBeCloseTo(0xb8 * (8 / 255), 6);
    expect(image.data[2]).toBeCloseTo(0xe4 * (8 / 255), 6);
    expect(image.data[3]).toBe(1);
  });

  it("loads .hdr bytes from a URI with an injected fetch implementation", async () => {
    const bytes = readFileSync(HDR_FIXTURE);
    const fetched: string[] = [];
    const report = await loadHdrFromUri("https://example.test/studio.hdr", {
      fetch: async (url) => {
        fetched.push(url);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          arrayBuffer: async () =>
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength,
            ),
        };
      },
    });

    expect(fetched).toEqual(["https://example.test/studio.hdr"]);
    expect(report.ok).toBe(true);
    expect(report.byteLength).toBe(bytes.byteLength);
    expect(report.image?.width).toBe(48);
    expect(report.image?.height).toBe(8);
    expect(report.diagnostics).toEqual([]);
  });

  it("reports typed parser diagnostics for invalid Radiance data", () => {
    const report = parseHdrRgbe(new TextEncoder().encode("not an hdr"));

    expect(report).toEqual({
      ok: false,
      image: null,
      diagnostics: [
        {
          code: "hdrRgbe.invalidHeader",
          severity: "error",
          message: "Radiance HDR data must start with a '#?' magic header.",
        },
      ],
    });
  });
});

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected value to exist.");
  }

  return value;
}
