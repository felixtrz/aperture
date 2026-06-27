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
  UiNode,
  UiPanel,
  UiScreen,
  UiScroll,
  UiText,
  Visibility,
  createStableRenderId,
  entityRef,
  parseSamplerHandle,
  parseTextureHandle,
  type InjectedUiLayoutExtractor,
  type RenderDiagnostic,
  type UiHitRegionPacket,
  type UiLayoutExtractionResult,
  type UiLayoutModePacket,
  type UiNodeKind,
  type UiNodePacket,
  type UiRectPacket,
} from "@aperture-engine/render";
import type { LayoutEngine } from "../layout/engine.js";
import type { LayoutStyle, MeasureFn } from "../layout/types.js";
import { UiLayoutTree, type UiLayoutNodeInput } from "../layout/tree.js";
import { UiFlex, UI_FLEX_UNSET } from "../components/ui-flex.js";
import { isUiLayoutFrozen } from "../components/ui-freeze.js";
import { UiBox } from "../components/ui-box.js";

const MAX_UI_LAYOUT_DEPTH = 2048;

/** Options for {@link createEcsUiLayoutExtractor}. */
export interface EcsUiLayoutExtractorOptions {
  /**
   * Optional provider of a measure function for a text/leaf entity, used for
   * content-driven sizing (e.g. MSDF text). Returning `null` falls back to the
   * entity's explicit `UiNode` width/height.
   */
  readonly measureText?: (entity: Entity) => MeasureFn | null;
  /**
   * Optional content token for a measured entity. When it changes between
   * frames, the leaf is re-measured. Defaults to a hash of the text content.
   */
  readonly measureKey?: (entity: Entity) => string | number;
  /** Whether an entity's subtree is frozen (layout preserved). */
  readonly isFrozen?: (entity: Entity) => boolean;
}

/** A UI layout extractor plus the retained-tree resources it owns. */
export interface EcsUiLayoutExtractor extends InjectedUiLayoutExtractor {
  /** Free the retained layout tree (not the engine). */
  dispose(): void;
}

/**
 * Create a Yoga-backed UI layout extractor over the existing render UI
 * components. It maintains a retained {@link UiLayoutTree} keyed by entity, so
 * unchanged frames re-use computed layout, and emits the same
 * `UiNodePacket`/`UiHitRegionPacket` contract the renderer and interaction read.
 *
 * Register it on a world with `setUiLayoutExtractor` (from
 * `@aperture-engine/render`) to replace the built-in absolute/row/column pass.
 */
export function createEcsUiLayoutExtractor(
  engine: LayoutEngine,
  options: EcsUiLayoutExtractorOptions = {},
): EcsUiLayoutExtractor {
  const tree = new UiLayoutTree<Entity>(engine);
  return {
    extract(world, diagnostics, cameraLayerMask): UiLayoutExtractionResult {
      return runExtraction(
        tree,
        engine,
        world,
        diagnostics,
        cameraLayerMask,
        options,
      );
    },
    dispose(): void {
      tree.dispose();
    },
  };
}

interface EmitState {
  readonly nodes: UiNodePacket[];
  readonly hitRegions: UiHitRegionPacket[];
  stackIndex: number;
}

function runExtraction(
  tree: UiLayoutTree<Entity>,
  engine: LayoutEngine,
  world: EcsWorld,
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  options: EcsUiLayoutExtractorOptions,
): UiLayoutExtractionResult {
  const screenQuery = world.queryManager.registerQuery({
    required: [UiScreen],
  });
  const allQuery = world.queryManager.registerQuery({ required: [] });
  const childrenByParent = createChildrenMap(allQuery.entities);

  const screens = sortedEntities(screenQuery.entities).filter((screen) =>
    isScreenEligible(screen, cameraLayerMask),
  );

  const forest = buildForest(screens, childrenByParent, diagnostics);

  const resolve = (entity: Entity): UiLayoutNodeInput<Entity> => {
    const children = forest.get(entity) ?? [];
    if (entity.hasComponent(UiScreen) && !entity.hasComponent(UiNode)) {
      return {
        style: {
          width: finitePositive(entity.getValue(UiScreen, "width"), 960),
          height: finitePositive(entity.getValue(UiScreen, "height"), 540),
        },
        children,
      };
    }
    return buildNodeInput(entity, parentLayoutMode(entity), children, options);
  };

  tree.reconcile(screens, resolve);

  const state: EmitState = { nodes: [], hitRegions: [], stackIndex: 0 };
  for (const screen of screens) {
    const width = finitePositive(entityValue(screen, UiScreen, "width"), 960);
    const height = finitePositive(entityValue(screen, UiScreen, "height"), 540);
    tree.calculate(screen, width, height);
    emitScreen(tree, screen, forest, state, options);
  }

  return { nodes: state.nodes, hitRegions: state.hitRegions };
}

function buildNodeInput(
  entity: Entity,
  parentMode: UiLayoutModePacket,
  children: readonly Entity[],
  options: EcsUiLayoutExtractorOptions,
): UiLayoutNodeInput<Entity> {
  const style = nodeStyle(entity, parentMode);
  const input: {
    style: LayoutStyle;
    children: readonly Entity[];
    measure?: MeasureFn | null;
    measureKey?: string | number;
    frozen?: boolean;
  } = { style, children };

  if (entity.hasComponent(UiText)) {
    const measure = options.measureText?.(entity) ?? null;
    input.measure = measure;
    input.measureKey =
      options.measureKey?.(entity) ?? defaultMeasureKey(entity);
  }

  const frozen = options.isFrozen?.(entity) ?? isUiLayoutFrozen(entity);
  if (frozen) {
    input.frozen = true;
  }

  return input;
}

type MutableLayoutStyle = {
  -readonly [K in keyof LayoutStyle]: LayoutStyle[K];
};

function nodeStyle(
  entity: Entity,
  parentMode: UiLayoutModePacket,
): LayoutStyle {
  const style: MutableLayoutStyle = {};

  if (entity.hasComponent(UiNode)) {
    const width = finiteNumber(entity.getValue(UiNode, "width"), 0);
    const height = finiteNumber(entity.getValue(UiNode, "height"), 0);
    if (width > 0) {
      style.width = width;
    }
    if (height > 0) {
      style.height = height;
    }
    const padding = entity.getVectorView(UiNode, "padding");
    style.paddingTop = nonNegative(padding[0]);
    style.paddingRight = nonNegative(padding[1]);
    style.paddingBottom = nonNegative(padding[2]);
    style.paddingLeft = nonNegative(padding[3]);
    style.gap = nonNegative(entity.getValue(UiNode, "gap"));

    const mode = readLayoutMode(entity);
    if (mode === "row") {
      style.flexDirection = "row";
    } else if (mode === "column") {
      style.flexDirection = "column";
    }

    if (clipsChildren(entity)) {
      style.overflow = "hidden";
    }
  }

  if (parentMode === "absolute") {
    style.positionType = "absolute";
    style.left = entity.hasComponent(UiNode)
      ? finiteNumber(entity.getValue(UiNode, "x"), 0)
      : 0;
    style.top = entity.hasComponent(UiNode)
      ? finiteNumber(entity.getValue(UiNode, "y"), 0)
      : 0;
  }

  if (entity.hasComponent(UiFlex)) {
    applyFlexComponent(entity, style);
  }

  if (entity.hasComponent(UiBox)) {
    // Border width insets content (CSS-like): children offset by the border.
    const border = entity.getVectorView(UiBox, "borderWidth");
    style.borderTop = nonNegative(border[0]);
    style.borderRight = nonNegative(border[1]);
    style.borderBottom = nonNegative(border[2]);
    style.borderLeft = nonNegative(border[3]);
  }

  return style;
}

/** Border/radius packet fields from a {@link UiBox} component, if present. */
function boxFields(entity: Entity): Partial<UiNodePacket> {
  if (!entity.hasComponent(UiBox)) {
    return {};
  }
  const radius = entity.getVectorView(UiBox, "borderRadius");
  const width = entity.getVectorView(UiBox, "borderWidth");
  const cornerRadii: [number, number, number, number] = [
    nonNegative(radius[0]),
    nonNegative(radius[1]),
    nonNegative(radius[2]),
    nonNegative(radius[3]),
  ];
  const borderWidths: [number, number, number, number] = [
    nonNegative(width[0]),
    nonNegative(width[1]),
    nonNegative(width[2]),
    nonNegative(width[3]),
  ];
  const hasRadius = cornerRadii.some((value) => value > 0);
  const hasBorder = borderWidths.some((value) => value > 0);
  return {
    ...(hasRadius ? { cornerRadii } : {}),
    ...(hasBorder
      ? {
          borderWidths,
          borderColor: vec4(entity.getVectorView(UiBox, "borderColor")),
        }
      : {}),
  };
}

/** Merge the full-flex {@link UiFlex} component over the legacy-derived style. */
function applyFlexComponent(entity: Entity, style: MutableLayoutStyle): void {
  style.flexDirection = entity.getValue(UiFlex, "flexDirection") as NonNullable<
    LayoutStyle["flexDirection"]
  >;
  style.flexWrap = entity.getValue(UiFlex, "flexWrap") as NonNullable<
    LayoutStyle["flexWrap"]
  >;
  style.justifyContent = entity.getValue(
    UiFlex,
    "justifyContent",
  ) as NonNullable<LayoutStyle["justifyContent"]>;
  style.alignItems = entity.getValue(UiFlex, "alignItems") as NonNullable<
    LayoutStyle["alignItems"]
  >;
  style.alignSelf = entity.getValue(UiFlex, "alignSelf") as NonNullable<
    LayoutStyle["alignSelf"]
  >;
  style.alignContent = entity.getValue(UiFlex, "alignContent") as NonNullable<
    LayoutStyle["alignContent"]
  >;
  style.flexGrow = nonNegative(entity.getValue(UiFlex, "flexGrow"));
  style.flexShrink = nonNegative(entity.getValue(UiFlex, "flexShrink"));
  style.gap = nonNegative(entity.getValue(UiFlex, "gap"));

  const rowGap = finiteNumber(entity.getValue(UiFlex, "rowGap"), UI_FLEX_UNSET);
  if (rowGap >= 0) {
    style.rowGap = rowGap;
  }
  const columnGap = finiteNumber(
    entity.getValue(UiFlex, "columnGap"),
    UI_FLEX_UNSET,
  );
  if (columnGap >= 0) {
    style.columnGap = columnGap;
  }

  assignLength(style, "minWidth", entity.getValue(UiFlex, "minWidth"));
  assignLength(style, "minHeight", entity.getValue(UiFlex, "minHeight"));
  assignLength(style, "maxWidth", entity.getValue(UiFlex, "maxWidth"));
  assignLength(style, "maxHeight", entity.getValue(UiFlex, "maxHeight"));

  const widthPercent = finiteNumber(
    entity.getValue(UiFlex, "widthPercent"),
    UI_FLEX_UNSET,
  );
  if (widthPercent >= 0) {
    style.width = `${widthPercent}%`;
  }
  const heightPercent = finiteNumber(
    entity.getValue(UiFlex, "heightPercent"),
    UI_FLEX_UNSET,
  );
  if (heightPercent >= 0) {
    style.height = `${heightPercent}%`;
  }

  const aspect = finiteNumber(entity.getValue(UiFlex, "aspectRatio"), 0);
  if (aspect > 0) {
    style.aspectRatio = aspect;
  }

  if (entity.getValue(UiFlex, "positionType") === "absolute") {
    style.positionType = "absolute";
  }

  const margin = entity.getVectorView(UiFlex, "margin");
  style.marginTop = finiteNumber(margin[0], 0);
  style.marginRight = finiteNumber(margin[1], 0);
  style.marginBottom = finiteNumber(margin[2], 0);
  style.marginLeft = finiteNumber(margin[3], 0);
}

function assignLength(
  style: MutableLayoutStyle,
  key: "minWidth" | "minHeight" | "maxWidth" | "maxHeight",
  raw: unknown,
): void {
  const value = finiteNumber(raw, UI_FLEX_UNSET);
  if (value >= 0) {
    style[key] = value;
  }
}

function emitScreen(
  tree: UiLayoutTree<Entity>,
  screen: Entity,
  forest: Map<Entity, Entity[]>,
  state: EmitState,
  options: EcsUiLayoutExtractorOptions,
): void {
  const rectInfo = tree.absoluteRect(screen);
  const rect = rectPacket(0, 0, rectInfo.width, rectInfo.height);
  const screenId = createStableRenderId(entityRef(screen));
  const layerMask = screenLayerMask(screen);

  state.nodes.push({
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
  });
  state.stackIndex += 1;

  for (const child of forest.get(screen) ?? []) {
    emitNode(tree, child, {
      screenId,
      layerMask,
      parentUiId: screenId,
      parentMode: "absolute",
      parentOpacity: 1,
      parentClip: rect,
      offsetX: 0,
      offsetY: 0,
      forest,
      state,
      options,
    });
  }
}

interface EmitContext {
  readonly screenId: number;
  readonly layerMask: number;
  readonly parentUiId: number;
  readonly parentMode: UiLayoutModePacket;
  readonly parentOpacity: number;
  readonly parentClip: UiRectPacket;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly forest: Map<Entity, Entity[]>;
  readonly state: EmitState;
  readonly options: EcsUiLayoutExtractorOptions;
}

function emitNode(
  tree: UiLayoutTree<Entity>,
  entity: Entity,
  ctx: EmitContext,
): void {
  const layout = tree.absoluteRect(entity);
  const rect = rectPacket(
    layout.left + ctx.offsetX,
    layout.top + ctx.offsetY,
    layout.width,
    layout.height,
  );
  const clip = intersectRect(ctx.parentClip, rect);
  const opacity = ctx.parentOpacity * nodeOpacity(entity);
  const kind = nodeKind(entity);
  const uiId = createStableRenderId(entityRef(entity));
  const scroll = scrollOffset(entity);

  const packet: UiNodePacket = {
    uiId,
    screenId: ctx.screenId,
    entity: entityRef(entity),
    parentUiId: ctx.parentUiId,
    kind,
    rect,
    clip,
    layoutMode: readLayoutMode(entity),
    stackIndex: ctx.state.stackIndex,
    zIndex: readZIndex(entity),
    layerMask: ctx.layerMask,
    opacity,
    clipsChildren: clipsChildren(entity),
    scrollOffset: scroll,
    ...boxFields(entity),
    ...visualFields(entity, kind),
  };
  ctx.state.nodes.push(packet);
  writeHitRegion(entity, packet, ctx.state);
  ctx.state.stackIndex += 1;

  const childrenClip = clipsChildren(entity) ? clip : ctx.parentClip;
  const childOffsetX = ctx.offsetX - scroll[0];
  const childOffsetY = ctx.offsetY - scroll[1];
  const mode = readLayoutMode(entity);

  for (const child of ctx.forest.get(entity) ?? []) {
    emitNode(tree, child, {
      screenId: ctx.screenId,
      layerMask: ctx.layerMask,
      parentUiId: uiId,
      parentMode: mode,
      parentOpacity: opacity,
      parentClip: childrenClip,
      offsetX: childOffsetX,
      offsetY: childOffsetY,
      forest: ctx.forest,
      state: ctx.state,
      options: ctx.options,
    });
  }
}

function visualFields(entity: Entity, kind: UiNodeKind): Partial<UiNodePacket> {
  if (kind === "panel") {
    return { color: vec4(entity.getVectorView(UiPanel, "color")) };
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
      color: vec4(entity.getVectorView(UiImage, "color")),
      uvRect: vec4(entity.getVectorView(UiImage, "uvRect")),
    };
  }
  if (kind === "text") {
    const text = entity.getValue(UiText, "text") ?? "";
    return {
      text,
      fontAtlasId: entity.getValue(UiText, "fontAtlasId") ?? "",
      fontSize: finitePositive(entity.getValue(UiText, "fontSize"), 16),
      lineHeight: nonNegative(entity.getValue(UiText, "lineHeight")),
      maxWidth: nonNegative(entity.getValue(UiText, "maxWidth")),
      textAlign: (entity.getValue(UiText, "align") ?? "left") as
        | "left"
        | "center"
        | "right",
      color: vec4(entity.getVectorView(UiText, "color")),
      glyphCount: Array.from(text).filter(
        (char) =>
          char !== " " && char !== "\n" && char !== "\r" && char !== "\t",
      ).length,
    };
  }
  return {};
}

function writeHitRegion(
  entity: Entity,
  packet: UiNodePacket,
  state: EmitState,
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

function buildForest(
  screens: readonly Entity[],
  childrenByParent: Map<Entity, Entity[]>,
  diagnostics: RenderDiagnostic[],
): Map<Entity, Entity[]> {
  const ordered = new Map<Entity, Entity[]>();

  const visit = (
    entity: Entity,
    ancestors: Set<Entity>,
    depth: number,
  ): void => {
    if (depth > MAX_UI_LAYOUT_DEPTH) {
      diagnostics.push({
        code: "ui.layout.depthExceeded",
        severity: "warning",
        entity: entityRef(entity),
        message: "UI layout exceeded the maximum retained tree depth.",
      });
      ordered.set(entity, []);
      return;
    }
    const valid: Entity[] = [];
    for (const child of sortedUiChildren(childrenByParent.get(entity) ?? [])) {
      if (!isUiLayoutEntity(child) || !isUiEntityVisible(child)) {
        continue;
      }
      if (ancestors.has(child)) {
        diagnostics.push({
          code: "ui.layout.parentCycle",
          severity: "warning",
          entity: entityRef(child),
          message: "UI parent cycle detected; subtree skipped.",
        });
        continue;
      }
      valid.push(child);
      ancestors.add(child);
      visit(child, ancestors, depth + 1);
      ancestors.delete(child);
    }
    ordered.set(entity, valid);
  };

  for (const screen of screens) {
    visit(screen, new Set([screen]), 0);
  }
  return ordered;
}

// --- ECS read helpers -------------------------------------------------------

function createChildrenMap(entities: Iterable<Entity>): Map<Entity, Entity[]> {
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

function sortedEntities(entities: Iterable<Entity>): Entity[] {
  return [...entities].sort(
    (a, b) => a.index - b.index || a.generation - b.generation,
  );
}

function sortedUiChildren(children: readonly Entity[]): Entity[] {
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

function isScreenEligible(screen: Entity, cameraLayerMask: number): boolean {
  if (!isUiEntityVisible(screen)) {
    return false;
  }
  const layerMask = screenLayerMask(screen);
  if (layerMask === 0) {
    return false;
  }
  return cameraLayerMask === 0 || (layerMask & cameraLayerMask) !== 0;
}

function screenLayerMask(screen: Entity): number {
  return screen.hasComponent(RenderLayer)
    ? finiteNumber(screen.getValue(RenderLayer, "mask"), 1)
    : finiteNumber(entityValue(screen, UiScreen, "layerMask"), 1);
}

function parentLayoutMode(entity: Entity): UiLayoutModePacket {
  if (!entity.hasComponent(Parent)) {
    return "absolute";
  }
  const parent = entity.getValue(Parent, "entity");
  if (parent === null || parent === undefined) {
    return "absolute";
  }
  // A parent carrying UiFlex is a flex container, so its children flow (they are
  // not absolutely positioned) regardless of the legacy UiNode.layoutMode.
  if (parent.hasComponent(UiFlex)) {
    const direction = parent.getValue(UiFlex, "flexDirection");
    return direction === "row" || direction === "row-reverse"
      ? "row"
      : "column";
  }
  return parent.hasComponent(UiNode) ? readLayoutMode(parent) : "absolute";
}

function readLayoutMode(entity: Entity): UiLayoutModePacket {
  if (!entity.hasComponent(UiNode)) {
    return "absolute";
  }
  const mode = entity.getValue(UiNode, "layoutMode");
  return mode === "row" || mode === "column" ? mode : "absolute";
}

function clipsChildren(entity: Entity): boolean {
  return (
    (entity.hasComponent(UiNode) && entity.getValue(UiNode, "clip") === true) ||
    (entity.hasComponent(UiScroll) &&
      entity.getValue(UiScroll, "enabled") !== false)
  );
}

function scrollOffset(entity: Entity): [number, number] {
  if (
    !entity.hasComponent(UiScroll) ||
    entity.getValue(UiScroll, "enabled") === false
  ) {
    return [0, 0];
  }
  const value = entity.getVectorView(UiScroll, "offset");
  return [finiteNumber(value[0], 0), finiteNumber(value[1], 0)];
}

function nodeOpacity(entity: Entity): number {
  return entity.hasComponent(UiNode)
    ? clamp01(finiteNumber(entity.getValue(UiNode, "opacity"), 1))
    : 1;
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

function defaultMeasureKey(entity: Entity): string {
  const text = entity.getValue(UiText, "text") ?? "";
  const size = finitePositive(entity.getValue(UiText, "fontSize"), 16);
  const maxWidth = nonNegative(entity.getValue(UiText, "maxWidth"));
  return `${text} ${size} ${maxWidth}`;
}

function entityValue<T>(
  entity: Entity,
  component: Parameters<Entity["getValue"]>[0],
  key: string,
): T {
  return entity.getValue(component, key) as T;
}

// --- math helpers -----------------------------------------------------------

function vec4(view: ArrayLike<number>): [number, number, number, number] {
  return [
    finiteNumber(view[0], 0),
    finiteNumber(view[1], 0),
    finiteNumber(view[2], 0),
    finiteNumber(view[3], 0),
  ];
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finitePositive(value: unknown, fallback: number): number {
  const n = finiteNumber(value, fallback);
  return n > 0 ? n : fallback;
}

function nonNegative(value: unknown): number {
  return Math.max(0, finiteNumber(value, 0));
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
