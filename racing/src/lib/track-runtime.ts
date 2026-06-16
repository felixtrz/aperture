import type { StartOptionsAccess } from "@aperture-engine/app/systems";
import { decodeCells } from "./track-codec.js";
import { TRACK_CELLS, type GridCell } from "./track-data.js";

/** Read the raw `?map=` codec string forwarded from the page URL, if any. */
export function readMapParam(startOptions: StartOptionsAccess): string | null {
  return startOptions.string("map");
}

/**
 * Resolve the active track cells for this run: decode the `?map=` codec string
 * forwarded from the page URL when present, else fall back to the built-in
 * TRACK_CELLS. `customMap` is true when a decoded map is in use.
 */
export function resolveTrackCells(startOptions: StartOptionsAccess): {
  readonly cells: readonly GridCell[];
  readonly customMap: boolean;
} {
  const mapParam = readMapParam(startOptions);
  if (mapParam !== null) {
    const decoded = decodeCells(mapParam);
    if (decoded.length > 0) {
      return { cells: decoded, customMap: true };
    }
  }
  return { cells: TRACK_CELLS, customMap: false };
}
