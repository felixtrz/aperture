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
    /** Optional caption/subtitle track key surfaced on clip start/end events. */
    readonly captionTrackId?: string;
}
export interface AudioClipAsset {
    readonly kind: "audio-clip";
    readonly label: string;
    readonly url?: string;
    readonly bytes?: ArrayBuffer;
    readonly streaming: boolean;
    readonly durationHint: number;
    readonly channels: number;
    readonly captionTrackId?: string;
}
export type AudioClipDiagnosticCode = "audioClip.invalidDuration" | "audioClip.invalidChannels" | "audioClip.missingSource";
export interface AudioClipDiagnostic {
    readonly code: AudioClipDiagnosticCode;
    readonly field: string;
    readonly message: string;
}
export interface AudioClipValidationReport {
    readonly valid: boolean;
    readonly diagnostics: readonly AudioClipDiagnostic[];
}
export declare function createAudioClipAsset(input?: AudioClipAssetInput): AudioClipAsset;
export declare function validateAudioClipAsset(asset: AudioClipAsset): AudioClipValidationReport;
/** Audio clips are leaf assets — they reference no other handles (yet). */
export declare function audioClipDependencies(_asset: AudioClipAsset): readonly AssetHandle[];
//# sourceMappingURL=audio-clip.d.ts.map