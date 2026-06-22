import {
  assetHandleKey,
  toVec4Tuple,
  type ComponentInitialData,
} from "@aperture-engine/simulation";
import {
  UiLayoutMode,
  UiScreenScaleMode,
  UiTextAlign,
  type UiHitTargetInput,
  type UiImageInput,
  type UiNodeInput,
  type UiPanelInput,
  type UiScreenInput,
  type UiScrollInput,
  type UiTextInput,
} from "./authoring-types.js";
import type {
  UiHitTarget,
  UiImage,
  UiNode,
  UiPanel,
  UiScreen,
  UiScroll,
  UiText,
} from "./authoring-components.js";

export function createUiScreen(
  input: UiScreenInput = {},
): ComponentInitialData<typeof UiScreen> {
  return {
    width: input.width ?? 960,
    height: input.height ?? 540,
    scaleMode: input.scaleMode ?? UiScreenScaleMode.Fixed,
    layerMask: input.layerMask ?? 1,
  };
}

export function createUiNode(
  input: UiNodeInput = {},
): ComponentInitialData<typeof UiNode> {
  return {
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 0,
    height: input.height ?? 0,
    padding: toVec4Tuple(input.padding ?? [0, 0, 0, 0]),
    gap: input.gap ?? 0,
    layoutMode: input.layoutMode ?? UiLayoutMode.Absolute,
    zIndex: input.zIndex ?? 0,
    opacity: input.opacity ?? 1,
    clip: input.clip ?? false,
    visible: input.visible ?? true,
  };
}

export function createUiPanel(
  input: UiPanelInput = {},
): ComponentInitialData<typeof UiPanel> {
  return {
    color: toVec4Tuple(input.color ?? [0, 0, 0, 0.75]),
  };
}

export function createUiImage(
  input: UiImageInput,
): ComponentInitialData<typeof UiImage> {
  return {
    textureId: assetHandleKey(input.texture),
    samplerId:
      input.sampler === undefined || input.sampler === null
        ? ""
        : assetHandleKey(input.sampler),
    color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
    uvRect: toVec4Tuple(input.uvRect ?? [0, 0, 1, 1]),
  };
}

export function createUiText(
  input: UiTextInput,
): ComponentInitialData<typeof UiText> {
  return {
    text: input.text,
    fontAtlasId:
      input.fontAtlas === undefined || input.fontAtlas === null
        ? ""
        : assetHandleKey(input.fontAtlas),
    fontSize: input.fontSize ?? 16,
    lineHeight: input.lineHeight ?? 0,
    maxWidth: input.maxWidth ?? 0,
    align: input.align ?? UiTextAlign.Left,
    color: toVec4Tuple(input.color ?? [1, 1, 1, 1]),
  };
}

export function createUiHitTarget(
  input: UiHitTargetInput = {},
): ComponentInitialData<typeof UiHitTarget> {
  return {
    enabled: input.enabled ?? true,
    blocksInput: input.blocksInput ?? true,
    cursor: input.cursor ?? "",
    priority: input.priority ?? 0,
  };
}

export function createUiScroll(
  input: UiScrollInput = {},
): ComponentInitialData<typeof UiScroll> {
  return {
    enabled: input.enabled ?? true,
    offset: [input.offset?.[0] ?? 0, input.offset?.[1] ?? 0],
  };
}
