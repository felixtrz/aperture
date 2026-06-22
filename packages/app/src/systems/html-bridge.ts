import type { CommandAccess } from "./commands.js";
import { defineResource, resource, type ResourceStore } from "./resources.js";

export const APERTURE_HTML_BRIDGE_COMMAND_CHANNEL = "aperture.html.bridge";
export const APERTURE_HTML_EVENT_CHANNEL_PREFIX = "aperture.html.event.";

export interface HtmlBridgeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface HtmlBridgeViewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly rect?: HtmlBridgeRect;
}

export interface HtmlSlotSnapshot {
  readonly slot: string;
  readonly rect: HtmlBridgeRect;
  readonly viewport: HtmlBridgeViewport;
  readonly visible: boolean;
  readonly sequence: number;
  readonly time: number;
  readonly reason?: string;
}

export type HtmlBridgeCommand =
  | {
      readonly kind: "slot";
      readonly slot: string;
      readonly rect: HtmlBridgeRect;
      readonly viewport: HtmlBridgeViewport;
      readonly visible: boolean;
      readonly sequence?: number;
      readonly time?: number;
      readonly reason?: string;
    }
  | {
      readonly kind: "remove-slot";
      readonly slot: string;
      readonly sequence?: number;
      readonly time?: number;
      readonly reason?: string;
    };

export interface HtmlBridgeState {
  readonly slots: Record<string, HtmlSlotSnapshot>;
}

export interface HtmlBridgeAccess {
  slot(slot: string): HtmlSlotSnapshot | null;
  slots(): readonly HtmlSlotSnapshot[];
  eventChannel(name: string): string;
}

export const HtmlBridgeStateResource = defineResource("aperture.html.bridge", {
  slots: resource.value<Record<string, HtmlSlotSnapshot>>(() => ({}), {
    kind: "htmlSlots",
    summarize: (slots) => ({
      count: Object.keys(slots).length,
      slots: Object.fromEntries(
        Object.entries(slots).map(([slot, snapshot]) => [
          slot,
          {
            visible: snapshot.visible,
            rect: snapshot.rect,
            viewport: snapshot.viewport,
            sequence: snapshot.sequence,
          },
        ]),
      ),
    }),
  }),
});

export function createHtmlBridgeAccess(
  resources: ResourceStore,
): HtmlBridgeAccess {
  return {
    slot(slot) {
      const trimmed = slot.trim();
      if (trimmed.length === 0) return null;
      return resources.read(HtmlBridgeStateResource).slots[trimmed] ?? null;
    },
    slots() {
      return Object.values(resources.read(HtmlBridgeStateResource).slots).sort(
        (a, b) => a.slot.localeCompare(b.slot),
      );
    },
    eventChannel: htmlEventChannel,
  };
}

export function htmlEventChannel(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith(APERTURE_HTML_EVENT_CHANNEL_PREFIX)
    ? trimmed
    : `${APERTURE_HTML_EVENT_CHANNEL_PREFIX}${trimmed}`;
}

export function runHtmlBridgeFrame(input: {
  readonly commands: CommandAccess;
  readonly resources: ResourceStore;
}): boolean {
  const commands = input.commands.drain<HtmlBridgeCommand>(
    APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
  );
  if (commands.length === 0) {
    return false;
  }

  input.resources.write(HtmlBridgeStateResource, (state) => {
    for (const command of commands) {
      const slot = slotName(command.slot);
      if (slot === null) {
        continue;
      }

      if (command.kind === "remove-slot") {
        delete state.slots[slot];
        continue;
      }

      if (command.kind !== "slot" || !isFiniteRect(command.rect)) {
        continue;
      }

      state.slots[slot] = {
        slot,
        rect: command.rect,
        viewport: finiteViewport(command.viewport),
        visible:
          command.visible &&
          command.rect.width > 0 &&
          command.rect.height > 0 &&
          command.viewport.width > 0 &&
          command.viewport.height > 0,
        sequence: finiteInteger(command.sequence, 0),
        time: finiteNumber(command.time, 0),
        ...(command.reason === undefined || command.reason.length === 0
          ? {}
          : { reason: command.reason }),
      };
    }
  });

  return true;
}

function slotName(slot: string): string | null {
  if (typeof slot !== "string") {
    return null;
  }
  const trimmed = slot.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isFiniteRect(rect: HtmlBridgeRect): boolean {
  return (
    isFiniteNumber(rect.x) &&
    isFiniteNumber(rect.y) &&
    isFiniteNumber(rect.width) &&
    isFiniteNumber(rect.height) &&
    isFiniteNumber(rect.top) &&
    isFiniteNumber(rect.right) &&
    isFiniteNumber(rect.bottom) &&
    isFiniteNumber(rect.left)
  );
}

function finiteViewport(viewport: HtmlBridgeViewport): HtmlBridgeViewport {
  const width = Math.max(0, finiteNumber(viewport.width, 0));
  const height = Math.max(0, finiteNumber(viewport.height, 0));
  const fallbackRect: HtmlBridgeRect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
  };
  return {
    width,
    height,
    devicePixelRatio: Math.max(0, finiteNumber(viewport.devicePixelRatio, 1)),
    scrollX: finiteNumber(viewport.scrollX, 0),
    scrollY: finiteNumber(viewport.scrollY, 0),
    rect:
      viewport.rect !== undefined && isFiniteRect(viewport.rect)
        ? viewport.rect
        : fallbackRect,
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finiteInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
