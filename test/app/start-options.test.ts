import { describe, expect, it } from "vitest";
import {
  createApertureSystemContext,
  createStartOptionsAccess,
  filterSystemStartOptions,
} from "@aperture-engine/app/systems";
import { AssetRegistry, createWorld } from "@aperture-engine/simulation";

describe("Aperture system start options", () => {
  it("filters engine-reserved worker options out of the public system view", () => {
    expect(
      filterSystemStartOptions({
        type: "start",
        transport: { shared: true },
        sharedSnapshotMessageRateHz: "0",
        audioSnapshotMessageRateHz: "30",
        sourceAssetsMessageRateHz: "30",
        workerFullSummaryIntervalMilliseconds: "1000",
        fixedStep: { timestep: 1 / 60 },
        entityCapacity: 1024,
        map: "abc123",
        laps: "3",
      }),
    ).toEqual({
      map: "abc123",
      laps: "3",
    });
  });

  it("reads app-level string, number, and boolean start options", () => {
    const startOptions = createStartOptionsAccess({
      map: "abc123",
      laps: "3",
      debug: "true",
      empty: "",
      badNumber: "three",
    });

    expect(startOptions.has("map")).toBe(true);
    expect(startOptions.get("map")).toBe("abc123");
    expect(startOptions.string("map")).toBe("abc123");
    expect(startOptions.string("empty")).toBeNull();
    expect(startOptions.number("laps")).toBe(3);
    expect(startOptions.number("badNumber")).toBeNull();
    expect(startOptions.boolean("debug")).toBe(true);
    expect(startOptions.summary()).toEqual({
      count: 5,
      values: {
        map: "abc123",
        laps: "3",
        debug: "true",
        empty: "",
        badNumber: "three",
      },
    });
  });

  it("installs filtered start options on the system context", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
      startOptions: {
        map: "abc123",
        transport: { shared: true },
      },
    });

    expect(context.startOptions.string("map")).toBe("abc123");
    expect(context.startOptions.has("transport")).toBe(false);
  });
});
