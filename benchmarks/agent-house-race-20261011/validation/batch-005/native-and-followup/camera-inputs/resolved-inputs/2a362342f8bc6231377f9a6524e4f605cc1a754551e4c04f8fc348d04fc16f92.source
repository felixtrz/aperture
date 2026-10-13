export function createAudioClipAsset(input = {}) {
    const asset = {
        kind: "audio-clip",
        label: input.label ?? "AudioClip",
        streaming: input.streaming ?? false,
        durationHint: input.durationHint ?? 0,
        channels: Math.trunc(input.channels ?? 2),
        ...(input.url === undefined ? {} : { url: input.url }),
        ...(input.bytes === undefined ? {} : { bytes: input.bytes }),
        ...(input.captionTrackId === undefined
            ? {}
            : { captionTrackId: input.captionTrackId }),
    };
    return Object.freeze(asset);
}
export function validateAudioClipAsset(asset) {
    const diagnostics = [];
    if (!(Number.isFinite(asset.durationHint) && asset.durationHint >= 0)) {
        diagnostics.push(diagnostic("audioClip.invalidDuration", "durationHint"));
    }
    if (!(Number.isInteger(asset.channels) && asset.channels > 0)) {
        diagnostics.push(diagnostic("audioClip.invalidChannels", "channels"));
    }
    if ((asset.url === undefined || asset.url.trim().length === 0) &&
        asset.bytes === undefined) {
        diagnostics.push(diagnostic("audioClip.missingSource", "url"));
    }
    return { valid: diagnostics.length === 0, diagnostics };
}
/** Audio clips are leaf assets — they reference no other handles (yet). */
export function audioClipDependencies(_asset) {
    return [];
}
function diagnostic(code, field) {
    return { code, field, message: `${field} is not valid for an audio clip.` };
}
//# sourceMappingURL=audio-clip.js.map