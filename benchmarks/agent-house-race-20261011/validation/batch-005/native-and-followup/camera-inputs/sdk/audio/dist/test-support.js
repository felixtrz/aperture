export class FakeAudioParam {
    value;
    events = [];
    constructor(value = 0) {
        this.value = value;
    }
    setValueAtTime(value, time) {
        this.value = value;
        this.events.push({ method: "setValueAtTime", value, time });
        return this;
    }
    linearRampToValueAtTime(value, time) {
        this.value = value;
        this.events.push({ method: "linearRampToValueAtTime", value, time });
        return this;
    }
    exponentialRampToValueAtTime(value, time) {
        this.value = value;
        this.events.push({ method: "exponentialRampToValueAtTime", value, time });
        return this;
    }
    setTargetAtTime(value, time, timeConstant) {
        this.value = value;
        this.events.push({ method: "setTargetAtTime", value, time, timeConstant });
        return this;
    }
    cancelScheduledValues(time) {
        this.events.push({ method: "cancelScheduledValues", time });
        return this;
    }
    /** The most recent automation event, for terse assertions. */
    lastEvent() {
        return this.events.at(-1);
    }
}
export class FakeAudioNode {
    connections = [];
    connect(target) {
        this.connections.push(target);
        return target;
    }
    disconnect() {
        this.connections.length = 0;
    }
}
export class FakeGainNode extends FakeAudioNode {
    gain = new FakeAudioParam(1);
    channelCount = 2;
    channelCountMode = "max";
    channelInterpretation = "speakers";
}
export class FakeAnalyserNode extends FakeAudioNode {
    fftSize = 2048;
    minDecibels = -100;
    maxDecibels = -30;
    smoothingTimeConstant = 0.8;
    get frequencyBinCount() {
        return this.fftSize >> 1;
    }
    getByteFrequencyData(array) {
        array.fill(0);
    }
    getFloatFrequencyData(array) {
        array.fill(-Infinity);
    }
    getByteTimeDomainData(array) {
        array.fill(128);
    }
    getFloatTimeDomainData(array) {
        array.fill(0);
    }
}
export class FakeDynamicsCompressorNode extends FakeAudioNode {
    threshold = new FakeAudioParam(-24);
    knee = new FakeAudioParam(30);
    ratio = new FakeAudioParam(12);
    attack = new FakeAudioParam(0.003);
    release = new FakeAudioParam(0.25);
    reduction = 0;
}
export class FakeAudioBufferSourceNode extends FakeAudioNode {
    buffer = null;
    playbackRate = new FakeAudioParam(1);
    detune = new FakeAudioParam(0);
    loop = false;
    loopStart = 0;
    loopEnd = 0;
    onended = null;
    started = false;
    stopped = false;
    startArgs = null;
    stopArg = null;
    start(when, offset, duration) {
        this.started = true;
        this.startArgs = [when, offset, duration];
    }
    stop(when) {
        this.stopped = true;
        this.stopArg = when ?? null;
    }
}
export class FakePannerNode extends FakeAudioNode {
    panningModel = "equalpower";
    distanceModel = "inverse";
    refDistance = 1;
    maxDistance = 10000;
    rolloffFactor = 1;
    coneInnerAngle = 360;
    coneOuterAngle = 360;
    coneOuterGain = 0;
    positionX = new FakeAudioParam(0);
    positionY = new FakeAudioParam(0);
    positionZ = new FakeAudioParam(0);
    orientationX = new FakeAudioParam(1);
    orientationY = new FakeAudioParam(0);
    orientationZ = new FakeAudioParam(0);
}
export class FakeBiquadFilterNode extends FakeAudioNode {
    type = "lowpass";
    frequency = new FakeAudioParam(350);
    detune = new FakeAudioParam(0);
    Q = new FakeAudioParam(1);
    gain = new FakeAudioParam(0);
}
export class FakeConvolverNode extends FakeAudioNode {
    buffer = null;
    normalize = true;
}
export class FakeMediaElementAudioSourceNode extends FakeAudioNode {
    mediaElement;
    constructor(mediaElement) {
        super();
        this.mediaElement = mediaElement;
    }
}
export class FakeStreamingSource {
    url;
    node = new FakeAudioNode();
    played = false;
    stopped = false;
    loop = false;
    constructor(url) {
        this.url = url;
    }
    play() {
        this.played = true;
    }
    stop() {
        this.stopped = true;
    }
    setLoop(loop) {
        this.loop = loop;
    }
}
export class FakeAudioListener {
    positionX = new FakeAudioParam(0);
    positionY = new FakeAudioParam(0);
    positionZ = new FakeAudioParam(0);
    forwardX = new FakeAudioParam(0);
    forwardY = new FakeAudioParam(0);
    forwardZ = new FakeAudioParam(-1);
    upX = new FakeAudioParam(0);
    upY = new FakeAudioParam(1);
    upZ = new FakeAudioParam(0);
}
export class FakeAudioBuffer {
    duration;
    sampleRate;
    numberOfChannels;
    constructor(duration, sampleRate, numberOfChannels = 2) {
        this.duration = duration;
        this.sampleRate = sampleRate;
        this.numberOfChannels = numberOfChannels;
    }
    get length() {
        return Math.max(0, Math.round(this.duration * this.sampleRate));
    }
    getChannelData() {
        return new Float32Array(this.length);
    }
}
export class FakeAudioBackend {
    currentTime = 0;
    state;
    sampleRate;
    baseLatency = 0.005;
    outputLatency = 0.02;
    fakeListener = new FakeAudioListener();
    fakeDestination = new FakeAudioNode();
    decodeCalls = 0;
    decodeDuration;
    created = {
        gains: [],
        analysers: [],
        compressors: [],
        sources: [],
        panners: [],
        biquads: [],
        convolvers: [],
        mediaSources: [],
        streams: [],
    };
    constructor(options = {}) {
        this.sampleRate = options.sampleRate ?? 48000;
        this.state = options.state ?? "suspended";
        this.decodeDuration = options.decodeDuration ?? 1;
    }
    /** Advance the fake audio clock (no real time passes in tests). */
    advanceTime(seconds) {
        this.currentTime += seconds;
    }
    get listener() {
        return this.fakeListener;
    }
    get destination() {
        return this.fakeDestination;
    }
    async resume() {
        if (this.state !== "closed") {
            this.state = "running";
        }
    }
    async suspend() {
        if (this.state !== "closed") {
            this.state = "suspended";
        }
    }
    async close() {
        this.state = "closed";
    }
    async decode() {
        this.decodeCalls += 1;
        return new FakeAudioBuffer(this.decodeDuration, this.sampleRate);
    }
    createGain() {
        const node = new FakeGainNode();
        this.created.gains.push(node);
        return node;
    }
    createSource() {
        const node = new FakeAudioBufferSourceNode();
        this.created.sources.push(node);
        return node;
    }
    createMediaSource(element) {
        const node = new FakeMediaElementAudioSourceNode(element);
        this.created.mediaSources.push(node);
        return node;
    }
    createStreamingSource(url) {
        const source = new FakeStreamingSource(url);
        this.created.streams.push(source);
        return source;
    }
    createPanner() {
        const node = new FakePannerNode();
        this.created.panners.push(node);
        return node;
    }
    createBiquad() {
        const node = new FakeBiquadFilterNode();
        this.created.biquads.push(node);
        return node;
    }
    createConvolver() {
        const node = new FakeConvolverNode();
        this.created.convolvers.push(node);
        return node;
    }
    createAnalyser() {
        const node = new FakeAnalyserNode();
        this.created.analysers.push(node);
        return node;
    }
    createCompressor() {
        const node = new FakeDynamicsCompressorNode();
        this.created.compressors.push(node);
        return node;
    }
    async createWorkletLimiter() {
        // No AudioWorklet in the fake — exercises the degrade-to-compressor path.
        return null;
    }
}
//# sourceMappingURL=test-support.js.map