import type {
  RenderEntityRef,
  UiHitRegionPacket,
  UiNodePacket,
  UiRectPacket,
} from "./snapshot.js";

export interface UiHitTestPoint {
  readonly x: number;
  readonly y: number;
}

export interface UiHitTestResult {
  readonly region: UiHitRegionPacket;
  readonly entity: RenderEntityRef;
  readonly point: UiHitTestPoint;
  readonly blocksInput: boolean;
  readonly cursor: string;
}

export interface UiHitTestRegionsOptions {
  readonly layerMask?: number | null;
}

export interface UiHitTestLayoutOptions extends UiHitTestRegionsOptions {
  /**
   * Normalized pointer coordinates in [0, 1]. They are mapped into each
   * extracted UiScreen rect before testing that screen's hit regions.
   */
  readonly position: readonly [number, number];
  readonly nodes: readonly UiNodePacket[];
  readonly hitRegions: readonly UiHitRegionPacket[];
}

export function hitTestUiRegions(
  hitRegions: readonly UiHitRegionPacket[],
  point: UiHitTestPoint,
  options: UiHitTestRegionsOptions = {},
): UiHitTestResult | null {
  let best: UiHitRegionPacket | null = null;

  for (const region of hitRegions) {
    if (!regionMatchesLayer(region, options.layerMask ?? null)) {
      continue;
    }
    if (!pointInRect(point, region.rect) || !pointInRect(point, region.clip)) {
      continue;
    }
    if (best === null || compareUiHitRegions(region, best) > 0) {
      best = region;
    }
  }

  return best === null
    ? null
    : {
        region: best,
        entity: best.entity,
        point,
        blocksInput: best.blocksInput,
        cursor: best.cursor,
      };
}

export function hitTestUiLayout(
  options: UiHitTestLayoutOptions,
): UiHitTestResult | null {
  const screens = new Map<number, UiNodePacket>();

  for (const node of options.nodes) {
    if (node.kind === "screen") {
      screens.set(node.screenId, node);
    }
  }

  let best: UiHitTestResult | null = null;

  for (const region of options.hitRegions) {
    const screen = screens.get(region.screenId);

    if (screen === undefined) {
      continue;
    }

    const point = {
      x: screen.rect.x + options.position[0] * screen.rect.width,
      y: screen.rect.y + options.position[1] * screen.rect.height,
    };
    const result = hitTestUiRegions([region], point, {
      layerMask: options.layerMask ?? null,
    });

    if (
      result !== null &&
      (best === null || compareUiHitRegions(result.region, best.region) > 0)
    ) {
      best = result;
    }
  }

  return best;
}

function pointInRect(point: UiHitTestPoint, rect: UiRectPacket): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

function regionMatchesLayer(
  region: UiHitRegionPacket,
  layerMask: number | null,
): boolean {
  return layerMask === null || (region.layerMask & layerMask) !== 0;
}

function compareUiHitRegions(
  a: UiHitRegionPacket,
  b: UiHitRegionPacket,
): number {
  return (
    a.priority - b.priority || a.stackIndex - b.stackIndex || a.uiId - b.uiId
  );
}
