import {
  Enabled,
  Parent,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  RenderLayer,
  RenderOrder,
  UiHitTarget,
  UiImage,
  UiLayoutMode,
  UiNode,
  UiPanel,
  UiScreen,
  UiScroll,
  UiText,
  Visibility,
} from "./authoring.js";
import {
  createStableRenderId,
  type RenderDiagnostic,
  type UiHitRegionPacket,
  type UiLayoutModePacket,
  type UiNodeKind,
  type UiNodePacket,
  type UiRectPacket,
} from "./snapshot.js";
import { entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { parseSamplerHandle, parseTextureHandle } from "./extraction-inputs.js";

interface UiExtractionState {
  readonly childrenByParent: Map<Entity, Entity[]>;
  readonly nodes: UiNodePacket[];
  readonly hitRegions: UiHitRegionPacket[];
  readonly diagnostics: RenderDiagnostic[];
  stackIndex: number;
}

interface UiLayoutContext {
  readonly screenId: number;
  readonly layerMask: number;
  readonly parentUiId: number | null;
  readonly parentRect: UiRectPacket;
  readonly parentContentRect: UiRectPacket;
  readonly parentClip: UiRectPacket;
  readonly parentOpacity: number;
  readonly depth: number;
}

interface UiNodeMetrics {
  readonly rect: UiRectPacket;
  readonly contentRect: UiRectPacket;
  readonly clip: UiRectPacket;
  readonly childrenClip: UiRectPacket;
  readonly opacity: number;
  readonly scrollOffset: readonly [number, number];
  readonly layoutMode: UiLayoutModePacket;
  readonly clipsChildren: boolean;
  readonly zIndex: number;
}

const MAX_UI_LAYOUT_DEPTH = 2048;
const DEFAULT_UI_CHILD_HEIGHT = 32;

export function extractUiLayout(
  world: EcsWorld,
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
): {
  readonly nodes: readonly UiNodePacket[];
  readonly hitRegions: readonly UiHitRegionPacket[];
} {
  const screenQuery = world.queryManager.registerQuery({
    required: [UiScreen],
  });
  const allQuery = world.queryManager.registerQuery({ required: [] });
  const state: UiExtractionState = {
    childrenByParent: createUiChildrenMap(allQuery.entities),
    nodes: [],
    hitRegions: [],
    diagnostics,
    stackIndex: 0,
  };

  for (const screen of sortedEntities(screenQuery.entities)) {
    if (!isUiEntityVisible(screen)) {
      continue;
    }

    const layerMask = screen.hasComponent(RenderLayer)
      ? (screen.getValue(RenderLayer, "mask") ?? 1)
      : (screen.getValue(UiScreen, "layerMask") ?? 1);

    if (layerMask === 0) {
      continue;
    }

    if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
      continue;
    }

    const width = finitePositive(screen.getValue(UiScreen, "width"), 960);
    const height = finitePositive(screen.getValue(UiScreen, "height"), 540);
    const screenId = createStableRenderId(entityRef(screen));
    const rect = rectPacket(0, 0, width, height);
    const screenPacket: UiNodePacket = {
      uiId: screenId,
      screenId,
      entity: entityRef(screen),
      parentUiId: null,
      kind: "screen",
      rect,
      clip: rect,
      layoutMode: "absolute",
      stackIndex: state.stackIndex,
      zIndex: 0,
      layerMask,
      opacity: 1,
      clipsChildren: true,
      scrollOffset: [0, 0],
    };

    state.stackIndex += 1;
    state.nodes.push(screenPacket);
    layoutChildren(
      state,
      screen,
      {
        screenId,
        layerMask,
        parentUiId: screenId,
        parentRect: rect,
        parentContentRect: rect,
        parentClip: rect,
        parentOpacity: 1,
        depth: 0,
      },
      new Set([screen]),
    );
  }

  return {
    nodes: state.nodes,
    hitRegions: state.hitRegions,
  };
}

function layoutChildren(
  state: UiExtractionState,
  parent: Entity,
  context: UiLayoutContext,
  ancestors: Set<Entity>,
): void {
  if (context.depth > MAX_UI_LAYOUT_DEPTH) {
    state.diagnostics.push({
      code: "render.ui.layoutDepthExceeded",
      severity: "warning",
      entity: entityRef(parent),
      message: "UI layout exceeded the maximum retained tree depth.",
    });
    return;
  }

  const children = sortedUiChildren(state.childrenByParent.get(parent) ?? []);
  const parentMode = parent.hasComponent(UiNode)
    ? readLayoutMode(parent)
    : UiLayoutMode.Absolute;
  let cursorX = context.parentContentRect.x;
  let cursorY = context.parentContentRect.y;

  for (const child of children) {
    if (!isUiLayoutEntity(child) || !isUiEntityVisible(child)) {
      continue;
    }

    if (ancestors.has(child)) {
      state.diagnostics.push({
        code: "render.ui.parentCycle",
        severity: "warning",
        entity: entityRef(child),
        message: "UI parent cycle detected; subtree skipped.",
      });
      continue;
    }

    const metrics = computeUiNodeMetrics(child, context, parentMode, {
      cursorX,
      cursorY,
    });
    const uiId = createStableRenderId(entityRef(child));
    const packet = createUiNodePacket(
      child,
      uiId,
      context,
      metrics,
      state.stackIndex,
    );

    state.nodes.push(packet);
    writeUiHitRegion(child, packet, state);
    state.stackIndex += 1;

    if (parentMode === UiLayoutMode.Column) {
      cursorY += metrics.rect.height + readParentGap(parent);
    } else if (parentMode === UiLayoutMode.Row) {
      cursorX += metrics.rect.width + readParentGap(parent);
    }

    ancestors.add(child);
    layoutChildren(
      state,
      child,
      {
        screenId: context.screenId,
        layerMask: context.layerMask,
        parentUiId: uiId,
        parentRect: metrics.rect,
        parentContentRect: metrics.contentRect,
        parentClip: metrics.childrenClip,
        parentOpacity: metrics.opacity,
        depth: context.depth + 1,
      },
      ancestors,
    );
    ancestors.delete(child);
  }
}

function computeUiNodeMetrics(
  entity: Entity,
  context: UiLayoutContext,
  parentMode: UiLayoutMode,
  flow: { readonly cursorX: number; readonly cursorY: number },
): UiNodeMetrics {
  const fallbackWidth =
    parentMode === UiLayoutMode.Row
      ? DEFAULT_UI_CHILD_HEIGHT
      : context.parentContentRect.width;
  const fallbackHeight =
    parentMode === UiLayoutMode.Row
      ? context.parentContentRect.height
      : DEFAULT_UI_CHILD_HEIGHT;
  const width = finiteDimension(
    entity.hasComponent(UiNode) ? entity.getValue(UiNode, "width") : 0,
    fallbackWidth,
  );
  const height = finiteDimension(
    entity.hasComponent(UiNode) ? entity.getValue(UiNode, "height") : 0,
    fallbackHeight,
  );
  const offsetX = entity.hasComponent(UiNode)
    ? finiteNumber(entity.getValue(UiNode, "x"), 0)
    : 0;
  const offsetY = entity.hasComponent(UiNode)
    ? finiteNumber(entity.getValue(UiNode, "y"), 0)
    : 0;
  const x =
    parentMode === UiLayoutMode.Row
      ? flow.cursorX + offsetX
      : context.parentContentRect.x + offsetX;
  const y =
    parentMode === UiLayoutMode.Column
      ? flow.cursorY + offsetY
      : context.parentContentRect.y + offsetY;
  const rect = rectPacket(x, y, width, height);
  const clip = intersectRect(context.parentClip, rect);
  const padding = readPadding(entity);
  const scroll = readScrollOffset(entity);
  const clipsChildren =
    (entity.hasComponent(UiNode) && entity.getValue(UiNode, "clip") === true) ||
    (entity.hasComponent(UiScroll) &&
      entity.getValue(UiScroll, "enabled") !== false);
  const childrenClip = clipsChildren ? clip : context.parentClip;
  const contentRect = rectPacket(
    rect.x + padding[3] - scroll[0],
    rect.y + padding[0] - scroll[1],
    Math.max(0, rect.width - padding[1] - padding[3]),
    Math.max(0, rect.height - padding[0] - padding[2]),
  );
  const opacity =
    context.parentOpacity *
    clamp01(
      entity.hasComponent(UiNode)
        ? finiteNumber(entity.getValue(UiNode, "opacity"), 1)
        : 1,
    );

  return {
    rect,
    contentRect,
    clip,
    childrenClip,
    opacity,
    scrollOffset: scroll,
    layoutMode: readLayoutMode(entity),
    clipsChildren,
    zIndex: entity.hasComponent(UiNode)
      ? Math.trunc(finiteNumber(entity.getValue(UiNode, "zIndex"), 0))
      : 0,
  };
}

function createUiNodePacket(
  entity: Entity,
  uiId: number,
  context: UiLayoutContext,
  metrics: UiNodeMetrics,
  stackIndex: number,
): UiNodePacket {
  const kind = nodeKind(entity);
  const base: Omit<UiNodePacket, "stackIndex"> = {
    uiId,
    screenId: context.screenId,
    entity: entityRef(entity),
    parentUiId: context.parentUiId,
    kind,
    rect: metrics.rect,
    clip: metrics.clip,
    layoutMode: metrics.layoutMode,
    zIndex: metrics.zIndex,
    layerMask: context.layerMask,
    opacity: metrics.opacity,
    clipsChildren: metrics.clipsChildren,
    scrollOffset: metrics.scrollOffset,
  };
  const packet: UiNodePacket = {
    ...base,
    stackIndex,
    ...visualFields(entity, kind),
  };

  return packet;
}

function visualFields(entity: Entity, kind: UiNodeKind): Partial<UiNodePacket> {
  if (kind === "panel") {
    return {
      color: Array.from(entity.getVectorView(UiPanel, "color")) as [
        number,
        number,
        number,
        number,
      ],
    };
  }

  if (kind === "image") {
    const texture = parseTextureHandle(
      entity.getValue(UiImage, "textureId") ?? "",
    );
    const samplerId = entity.getValue(UiImage, "samplerId") ?? "";
    const sampler = samplerId === "" ? null : parseSamplerHandle(samplerId);

    return {
      ...(texture === null ? {} : { texture }),
      ...(sampler === null ? {} : { sampler }),
      color: Array.from(entity.getVectorView(UiImage, "color")) as [
        number,
        number,
        number,
        number,
      ],
      uvRect: Array.from(entity.getVectorView(UiImage, "uvRect")) as [
        number,
        number,
        number,
        number,
      ],
    };
  }

  if (kind === "text") {
    const text = entity.getValue(UiText, "text") ?? "";

    return {
      text,
      fontAtlasId: entity.getValue(UiText, "fontAtlasId") ?? "",
      fontSize: finitePositive(entity.getValue(UiText, "fontSize"), 16),
      lineHeight: Math.max(
        0,
        finiteNumber(entity.getValue(UiText, "lineHeight"), 0),
      ),
      maxWidth: Math.max(
        0,
        finiteNumber(entity.getValue(UiText, "maxWidth"), 0),
      ),
      textAlign: (entity.getValue(UiText, "align") ?? "left") as
        | "left"
        | "center"
        | "right",
      color: Array.from(entity.getVectorView(UiText, "color")) as [
        number,
        number,
        number,
        number,
      ],
      glyphCount: Array.from(text).filter(
        (char) =>
          char !== " " && char !== "\n" && char !== "\r" && char !== "\t",
      ).length,
    };
  }

  return {};
}

function writeUiHitRegion(
  entity: Entity,
  packet: UiNodePacket,
  state: UiExtractionState,
): void {
  if (
    !entity.hasComponent(UiHitTarget) ||
    entity.getValue(UiHitTarget, "enabled") === false
  ) {
    return;
  }

  state.hitRegions.push({
    uiId: packet.uiId,
    screenId: packet.screenId,
    entity: packet.entity,
    rect: packet.rect,
    clip: packet.clip,
    stackIndex: packet.stackIndex,
    layerMask: packet.layerMask,
    blocksInput: entity.getValue(UiHitTarget, "blocksInput") !== false,
    cursor: entity.getValue(UiHitTarget, "cursor") ?? "",
    priority: Math.trunc(
      finiteNumber(entity.getValue(UiHitTarget, "priority"), 0),
    ),
  });
}

function createUiChildrenMap(
  entities: Iterable<Entity>,
): Map<Entity, Entity[]> {
  const map = new Map<Entity, Entity[]>();

  for (const entity of entities) {
    if (!entity.hasComponent(Parent)) {
      continue;
    }

    const parent = entity.getValue(Parent, "entity");

    if (parent === null || parent === undefined) {
      continue;
    }

    const children = map.get(parent) ?? [];

    children.push(entity);
    map.set(parent, children);
  }

  return map;
}

function sortedUiChildren(children: readonly Entity[]): readonly Entity[] {
  return [...children].sort((a, b) => {
    const z = readZIndex(a) - readZIndex(b);

    if (z !== 0) {
      return z;
    }

    const order = readRenderOrder(a) - readRenderOrder(b);

    if (order !== 0) {
      return order;
    }

    return a.index - b.index || a.generation - b.generation;
  });
}

function isUiLayoutEntity(entity: Entity): boolean {
  return (
    entity.hasComponent(UiNode) ||
    entity.hasComponent(UiPanel) ||
    entity.hasComponent(UiImage) ||
    entity.hasComponent(UiText) ||
    entity.hasComponent(UiHitTarget) ||
    entity.hasComponent(UiScroll)
  );
}

function isUiEntityVisible(entity: Entity): boolean {
  if (
    entity.hasComponent(Enabled) &&
    entity.getValue(Enabled, "value") === false
  ) {
    return false;
  }

  if (
    entity.hasComponent(Visibility) &&
    entity.getValue(Visibility, "visible") === false
  ) {
    return false;
  }

  return !(
    entity.hasComponent(UiNode) && entity.getValue(UiNode, "visible") === false
  );
}

function nodeKind(entity: Entity): UiNodeKind {
  if (entity.hasComponent(UiText)) {
    return "text";
  }

  if (entity.hasComponent(UiImage)) {
    return "image";
  }

  if (entity.hasComponent(UiPanel)) {
    return "panel";
  }

  return "node";
}

function readLayoutMode(entity: Entity): UiLayoutModePacket {
  if (!entity.hasComponent(UiNode)) {
    return "absolute";
  }

  const mode = entity.getValue(UiNode, "layoutMode");

  return mode === UiLayoutMode.Row || mode === UiLayoutMode.Column
    ? mode
    : UiLayoutMode.Absolute;
}

function readPadding(
  entity: Entity,
): readonly [number, number, number, number] {
  if (!entity.hasComponent(UiNode)) {
    return [0, 0, 0, 0];
  }

  const value = Array.from(entity.getVectorView(UiNode, "padding"));

  return [
    Math.max(0, finiteNumber(value[0], 0)),
    Math.max(0, finiteNumber(value[1], 0)),
    Math.max(0, finiteNumber(value[2], 0)),
    Math.max(0, finiteNumber(value[3], 0)),
  ];
}

function readScrollOffset(entity: Entity): readonly [number, number] {
  if (
    !entity.hasComponent(UiScroll) ||
    entity.getValue(UiScroll, "enabled") === false
  ) {
    return [0, 0];
  }

  const value = Array.from(entity.getVectorView(UiScroll, "offset"));

  return [finiteNumber(value[0], 0), finiteNumber(value[1], 0)];
}

function readParentGap(entity: Entity): number {
  return entity.hasComponent(UiNode)
    ? Math.max(0, finiteNumber(entity.getValue(UiNode, "gap"), 0))
    : 0;
}

function readZIndex(entity: Entity): number {
  return entity.hasComponent(UiNode)
    ? Math.trunc(finiteNumber(entity.getValue(UiNode, "zIndex"), 0))
    : 0;
}

function readRenderOrder(entity: Entity): number {
  return entity.hasComponent(RenderOrder)
    ? Math.trunc(finiteNumber(entity.getValue(RenderOrder, "value"), 0))
    : 0;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finitePositive(value: unknown, fallback: number): number {
  const number = finiteNumber(value, fallback);

  return number > 0 ? number : fallback;
}

function finiteDimension(value: unknown, fallback: number): number {
  const number = finiteNumber(value, 0);

  return number > 0 ? number : Math.max(0, fallback);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rectPacket(
  x: number,
  y: number,
  width: number,
  height: number,
): UiRectPacket {
  return { x, y, width, height };
}

function intersectRect(a: UiRectPacket, b: UiRectPacket): UiRectPacket {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  return rectPacket(x1, y1, Math.max(0, x2 - x1), Math.max(0, y2 - y1));
}
