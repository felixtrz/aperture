/** Inline AudioWorklet brickwall limiter — hard-clamps samples to ±0.99. */
const BRICKWALL_PROCESSOR = `
registerProcessor("aperture-brickwall-limiter", class extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output) return true;
    for (let c = 0; c < output.length; c++) {
      const oc = output[c];
      // When the upstream is mono (e.g. the accessibility mono-downmix), input
      // has one channel; fall back to channel 0 so every output channel carries
      // the signal instead of writing silence to the right channel.
      const ic = input ? input[c] || input[0] : undefined;
      if (!oc) continue;
      for (let i = 0; i < oc.length; i++) {
        const s = ic ? ic[i] : 0;
        oc[i] = s > 0.99 ? 0.99 : s < -0.99 ? -0.99 : s;
      }
    }
    return true;
  }
});
`;
/**
 * Wrap a real {@link AudioContext}. Only callable on the main thread of a
 * browser; the worker side of the engine never imports this.
 */
export function createWebAudioBackend(options = {}) {
    const context = options.context ?? createBrowserContext(options);
    // A given processor name can only be registered once per context; track it so
    // re-enabling the worklet limiter on a shared/reused context is idempotent
    // instead of throwing "already registered" and silently degrading.
    let workletModuleAdded = false;
    return {
        get currentTime() {
            return context.currentTime;
        },
        get state() {
            return context.state;
        },
        get sampleRate() {
            return context.sampleRate;
        },
        get baseLatency() {
            return context.baseLatency;
        },
        get outputLatency() {
            return context.outputLatency;
        },
        get listener() {
            return context.listener;
        },
        get destination() {
            return context.destination;
        },
        resume: () => context.resume(),
        suspend: () => context.suspend(),
        close: () => context.close(),
        // slice(0) so decodeAudioData (which detaches its input) cannot strand the
        // caller's encoded bytes — the same defensive copy three.js's AudioLoader makes.
        decode: (bytes) => context.decodeAudioData(bytes.slice(0)),
        createGain: () => context.createGain(),
        createSource: () => context.createBufferSource(),
        createMediaSource: (element) => context.createMediaElementSource(element),
        createStreamingSource: (url) => {
            const element = new Audio(url);
            element.crossOrigin = "anonymous";
            const node = context.createMediaElementSource(element);
            return {
                node,
                play: () => {
                    void element.play();
                },
                stop: () => {
                    // stop() is terminal here — the voice discards the stream right after —
                    // so release the network/media resource, not just pause it. Clearing
                    // `src` + load() lets the browser tear down the underlying HTMLMediaElement.
                    element.pause();
                    try {
                        element.currentTime = 0;
                    }
                    catch {
                        // Not seekable yet — ignore.
                    }
                    element.removeAttribute("src");
                    element.load();
                },
                setLoop: (loop) => {
                    element.loop = loop;
                },
            };
        },
        createPanner: () => context.createPanner(),
        createBiquad: () => context.createBiquadFilter(),
        createConvolver: () => context.createConvolver(),
        createAnalyser: () => context.createAnalyser(),
        createCompressor: () => context.createDynamicsCompressor(),
        createWorkletLimiter: async () => {
            const worklet = context.audioWorklet;
            if (worklet === undefined || typeof AudioWorkletNode === "undefined") {
                return null;
            }
            try {
                if (!workletModuleAdded) {
                    const blob = new Blob([BRICKWALL_PROCESSOR], {
                        type: "text/javascript",
                    });
                    const url = URL.createObjectURL(blob);
                    await worklet.addModule(url);
                    URL.revokeObjectURL(url);
                    workletModuleAdded = true;
                }
                return new AudioWorkletNode(context, "aperture-brickwall-limiter");
            }
            catch {
                return null;
            }
        },
    };
}
function createBrowserContext(options) {
    const Ctor = typeof AudioContext !== "undefined"
        ? AudioContext
        : globalThis.webkitAudioContext;
    if (Ctor === undefined) {
        throw new Error("Web Audio API is unavailable: no AudioContext in this environment.");
    }
    const contextOptions = {};
    if (options.latencyHint !== undefined) {
        contextOptions.latencyHint = options.latencyHint;
    }
    if (options.sampleRate !== undefined) {
        contextOptions.sampleRate = options.sampleRate;
    }
    return new Ctor(contextOptions);
}
//# sourceMappingURL=audio-backend.js.map