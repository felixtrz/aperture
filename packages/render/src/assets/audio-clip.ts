import type { AssetHandle } from "@aperture-engine/simulation";

/**
 * Source descriptor for an `audio-clip` asset.
 *
 * An audio clip carries ENCODED bytes (or a `url` to fetch them) plus playback
 * metadata — never a decoded `AudioBuffer`. Decoding happens once on the main
 * thread in the audio engine's clip cache, mirroring how mesh/material source
 * assets stay free of GPU-resident data. `streaming` clips (long music) are
 * realized through a `MediaElementAudioSourceNode` rather than a fully decoded
 * buffer, so their PCM is never held in memory.
 */
export interface AudioClipAssetInput {
  readonly label?: string;
  /** URL to fetch the encoded audio from (alternative to inline `bytes`). */
  readonly url?: string;
  /** Inline encoded bytes (mp3/ogg/wav/…). */
  readonly bytes?: ArrayBuffer;
  /** Stream via a media element instead of a decoded buffer (long music). */
  readonly streaming?: boolean;
  /**
   * Nominal duration in seconds. Drives the worker-side deterministic
   * completion timer for one-shots; the engine never reports actual playback
   * position back into the simulation.
   */
  readonly durationHint?: number;
  readonly channels?: number;
}

export interface AudioClipAsset {
  readonly kind: "audio-clip";
  readonly label: string;
  readonly url?: string;
  readonly bytes?: ArrayBuffer;
  readonly streaming: boolean;
  readonly durationHint: number;
  readonly channels: number;
}

export type AudioClipDiagnosticCode =
  | "audioClip.invalidDuration"
  | "audioClip.invalidChannels"
  | "audioClip.missingSource";

export interface AudioClipDiagnostic {
  readonly code: AudioClipDiagnosticCode;
  readonly field: string;
  readonly message: string;
}

export interface AudioClipValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly AudioClipDiagnostic[];
}

export function createAudioClipAsset(
  input: AudioClipAssetInput = {},
): AudioClipAsset {
  const asset: AudioClipAsset = {
    kind: "audio-clip",
    label: input.label ?? "AudioClip",
    streaming: input.streaming ?? false,
    durationHint: input.durationHint ?? 0,
    channels: Math.trunc(input.channels ?? 2),
    ...(input.url === undefined ? {} : { url: input.url }),
    ...(input.bytes === undefined ? {} : { bytes: input.bytes }),
  };

  return Object.freeze(asset);
}

export function validateAudioClipAsset(
  asset: AudioClipAsset,
): AudioClipValidationReport {
  const diagnostics: AudioClipDiagnostic[] = [];

  if (!(Number.isFinite(asset.durationHint) && asset.durationHint >= 0)) {
    diagnostics.push(diagnostic("audioClip.invalidDuration", "durationHint"));
  }
  if (!(Number.isInteger(asset.channels) && asset.channels > 0)) {
    diagnostics.push(diagnostic("audioClip.invalidChannels", "channels"));
  }
  if (
    (asset.url === undefined || asset.url.trim().length === 0) &&
    asset.bytes === undefined
  ) {
    diagnostics.push(diagnostic("audioClip.missingSource", "url"));
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/** Audio clips are leaf assets — they reference no other handles (yet). */
export function audioClipDependencies(
  _asset: AudioClipAsset,
): readonly AssetHandle[] {
  return [];
}

function diagnostic(
  code: AudioClipDiagnosticCode,
  field: string,
): AudioClipDiagnostic {
  return { code, field, message: `${field} is not valid for an audio clip.` };
}
