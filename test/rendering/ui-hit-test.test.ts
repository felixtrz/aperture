import { describe, expect, it } from "vitest";
import {
  hitTestUiLayout,
  hitTestUiRegions,
  type UiHitRegionPacket,
  type UiNodePacket,
} from "@aperture-engine/render";

const entity = (index: number) => ({ index, generation: 0 });

describe("UI hit testing", () => {
  it("selects the topmost clipped region by priority then stack", () => {
    const regions: UiHitRegionPacket[] = [
      region({ uiId: 1, stackIndex: 4, priority: 0 }),
      region({ uiId: 2, stackIndex: 5, priority: 0 }),
      region({ uiId: 3, stackIndex: 1, priority: 10 }),
    ];

    expect(hitTestUiRegions(regions, { x: 40, y: 40 })?.region.uiId).toBe(3);

    regions[2] = region({
      uiId: 3,
      stackIndex: 1,
      priority: 10,
      clip: { x: 0, y: 0, width: 20, height: 20 },
    });

    expect(hitTestUiRegions(regions, { x: 40, y: 40 })?.region.uiId).toBe(2);
  });

  it("maps normalized pointer coordinates through extracted UI screen rects", () => {
    const nodes: UiNodePacket[] = [
      {
        uiId: 100,
        screenId: 100,
        entity: entity(100),
        parentUiId: null,
        kind: "screen",
        rect: { x: 0, y: 0, width: 400, height: 200 },
        clip: { x: 0, y: 0, width: 400, height: 200 },
        layoutMode: "absolute",
        stackIndex: 0,
        zIndex: 0,
        layerMask: 1,
        opacity: 1,
        clipsChildren: true,
        scrollOffset: [0, 0],
      },
    ];
    const hit = hitTestUiLayout({
      nodes,
      hitRegions: [
        region({
          uiId: 4,
          screenId: 100,
          rect: { x: 200, y: 50, width: 120, height: 70 },
          clip: { x: 200, y: 50, width: 80, height: 70 },
        }),
      ],
      position: [0.55, 0.5],
    });

    expect(hit?.entity).toEqual(entity(4));
    expect(hit?.point.x).toBeCloseTo(220);
    expect(hit?.point.y).toBeCloseTo(100);
    expect(
      hitTestUiLayout({
        nodes,
        hitRegions: [
          region({
            uiId: 4,
            screenId: 100,
            rect: { x: 200, y: 50, width: 120, height: 70 },
            clip: { x: 200, y: 50, width: 40, height: 70 },
          }),
        ],
        position: [0.7, 0.5],
      }),
    ).toBeNull();
  });
});

function region(
  input: Partial<UiHitRegionPacket> & { readonly uiId: number },
): UiHitRegionPacket {
  return {
    screenId: input.screenId ?? 1,
    entity: input.entity ?? entity(input.uiId),
    rect: input.rect ?? { x: 10, y: 10, width: 100, height: 100 },
    clip: input.clip ?? { x: 10, y: 10, width: 100, height: 100 },
    stackIndex: input.stackIndex ?? 0,
    layerMask: input.layerMask ?? 1,
    blocksInput: input.blocksInput ?? true,
    cursor: input.cursor ?? "pointer",
    priority: input.priority ?? 0,
    uiId: input.uiId,
  };
}
