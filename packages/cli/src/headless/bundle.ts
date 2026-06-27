import { serializeSourceAssetRegistry } from "@aperture-engine/app/asset-mirror";
import {
  encodeTypedArrayTree,
  renderSnapshotToJsonValue,
  type RenderSnapshot,
} from "@aperture-engine/render";

// Derive the registry type from the serializer instead of taking a direct
// dependency on @aperture-engine/simulation.
type SourceAssetRegistry = Parameters<typeof serializeSourceAssetRegistry>[0];

export const APERTURE_SNAPSHOT_BUNDLE_FORMAT = "aperture-render-snapshot";
export const APERTURE_SNAPSHOT_BUNDLE_VERSION = 1;

// A self-contained, renderable bundle: the extracted RenderSnapshot plus the
// serialized source-asset registry it references. A RenderSnapshot carries only
// `{ kind, id }` asset handles, not bytes, so the render command (Track 2) must
// rehydrate `sourceAssets` before drawing — otherwise every mesh resolves to
// null and the frame is blank.
export interface ApertureAssetProvenance {
  /** Assets fulfilled with real loaded bytes. */
  readonly real: number;
  /** Assets fulfilled with a structural placeholder (stubbed pixels). */
  readonly placeholderCount: number;
  readonly placeholderIds: readonly string[];
}

export interface ApertureSnapshotBundle {
  readonly format: typeof APERTURE_SNAPSHOT_BUNDLE_FORMAT;
  readonly version: typeof APERTURE_SNAPSHOT_BUNDLE_VERSION;
  readonly frame: number;
  /** Whether the assets behind this snapshot are real or stubbed placeholders. */
  readonly assetProvenance: ApertureAssetProvenance;
  readonly snapshot: unknown;
  readonly sourceAssets: unknown;
}

export function createApertureSnapshotBundle(args: {
  readonly snapshot: RenderSnapshot;
  readonly assets: SourceAssetRegistry;
}): ApertureSnapshotBundle {
  const manifest = args.assets.createManifestReport();

  return {
    format: APERTURE_SNAPSHOT_BUNDLE_FORMAT,
    version: APERTURE_SNAPSHOT_BUNDLE_VERSION,
    frame: args.snapshot.frame,
    assetProvenance: {
      real: manifest.total - manifest.placeholders.count,
      placeholderCount: manifest.placeholders.count,
      placeholderIds: manifest.placeholders.ids,
    },
    snapshot: renderSnapshotToJsonValue(args.snapshot),
    // The serialized registry holds Uint8Array mesh bytes, so it must also pass
    // through the typed-array codec to become JSON-safe.
    sourceAssets: encodeTypedArrayTree(serializeSourceAssetRegistry(args.assets)),
  };
}
