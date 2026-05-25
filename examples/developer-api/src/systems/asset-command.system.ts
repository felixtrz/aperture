import { createSystem } from "@aperture-engine/app/systems";

export const schedule = { priority: 75 };

const ASSET_REQUEST_CHANNEL = "asset.request";

interface AssetRequestCommand {
  readonly assetId?: unknown;
}

export default class AssetCommandSystem extends createSystem() {
  override update(): void {
    for (const command of this.commands.drain<AssetRequestCommand>(
      ASSET_REQUEST_CHANNEL,
    )) {
      const assetId = typeof command.assetId === "string" ? command.assetId : "";

      if (assetId.length === 0) {
        this.diagnostics.warn("command.assetRequest.invalid", {
          channel: ASSET_REQUEST_CHANNEL,
          suggestedFix:
            "Send { assetId: 'decal' } on the asset.request command channel.",
        });
        continue;
      }

      void this.commands
        .requestAsset(assetId)
        .then(() => {
          this.diagnostics.info("command.assetRequest.ready", {
            channel: ASSET_REQUEST_CHANNEL,
            asset: assetId,
            ready: this.assets.readiness(assetId).value,
          });
        })
        .catch((error: unknown) => {
          this.diagnostics.error("command.assetRequest.failed", {
            channel: ASSET_REQUEST_CHANNEL,
            asset: assetId,
            reason: error instanceof Error ? error.message : String(error),
          });
        });
    }
  }
}
