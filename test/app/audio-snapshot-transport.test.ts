import { describe, expect, it } from "vitest";

import type {
  AudioEmitterPacket,
  AudioListenerPacket,
  RenderSnapshot,
} from "@aperture-engine/render";
import { hasUnsupportedSharedSnapshotPayload } from "../../packages/app/src/worker/snapshot.js";

function baseSnapshot(extra: Partial<RenderSnapshot> = {}): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
    ...extra,
  };
}

describe("audio snapshot transport fallback (AU-2)", () => {
  it("keeps a pure mesh+light frame eligible for the SharedArrayBuffer path", () => {
    expect(hasUnsupportedSharedSnapshotPayload(baseSnapshot())).toBe(false);
  });

  it("forces the transferable path when a frame carries audio emitters", () => {
    const snapshot = baseSnapshot({
      audioEmitters: [{} as AudioEmitterPacket],
    });

    // True => createSharedSnapshotMessage returns null => the full snapshot is
    // posted on the transferable path, so no audio packet is dropped on a
    // cross-origin-isolated page.
    expect(hasUnsupportedSharedSnapshotPayload(snapshot)).toBe(true);
  });

  it("forces the transferable path when a frame carries an audio listener", () => {
    const snapshot = baseSnapshot({
      audioListener: {} as AudioListenerPacket,
    });

    expect(hasUnsupportedSharedSnapshotPayload(snapshot)).toBe(true);
  });
});
