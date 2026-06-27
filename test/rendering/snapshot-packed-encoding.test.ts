import { describe, expect, it } from "vitest";
import {
  AUDIO_EMITTER_PACKET_WORDS,
  AUDIO_LISTENER_PACKET_WORDS,
  BOUNDS_PACKET_WORDS,
  ENVIRONMENT_PACKET_WORDS,
  FOG_PACKET_WORDS,
  FogMode,
  LIGHT_PACKET_WORDS,
  MESH_DRAW_PACKET_WORDS,
  PARTICLE_EMITTER_PACKET_WORDS,
  QUAD_BATCH_PACKET_WORDS,
  SHADOW_REQUEST_PACKET_WORDS,
  SNAPSHOT_PACKET_BYTE_STRIDES,
  SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE,
  SNAPSHOT_PACKET_HEADER_WORDS,
  SNAPSHOT_PACKET_WORD_STRIDES,
  VIEW_PACKET_WORDS,
  createSnapshotPacketRegistry,
  decodePackets,
  decodeSnapshotPackets,
  encodePackets,
  encodeSnapshotPackets,
  snapshotPacketWordLength,
  type SnapshotPacketBundle,
} from "@aperture-engine/render";
import {
  createEnvironmentMapHandle,
  createAudioClipHandle,
  createMaterialHandle,
  createMeshHandle,
  createParticleEffectHandle,
  createRenderTargetHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

describe("snapshot packed packet encoding", () => {
  it("round-trips a deterministic random snapshot packet bundle", () => {
    const packets = randomPacketBundle();
    const encoded = encodeSnapshotPackets(packets);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);

    expect(decoded).toEqual(packets);
    expect(encoded.counts).toEqual({
      views: packets.views.length,
      meshDraws: packets.meshDraws.length,
      shadowCasterDraws: 0,
      lights: packets.lights.length,
      environments: packets.environments.length,
      fogs: packets.fogs?.length ?? 0,
      particleEmitters: packets.particleEmitters?.length ?? 0,
      audioEmitters: packets.audioEmitters?.length ?? 0,
      audioListeners: packets.audioListener === undefined ? 0 : 1,
      shadowRequests: packets.shadowRequests.length,
      bounds: packets.bounds.length,
      quadBatches: 0,
    });
  });

  it("round-trips quad batch packets through the packed snapshot registry", () => {
    const texture = createTextureHandle("sprite-atlas");
    const sampler = createSamplerHandle("linear-clamp");
    const bundle: SnapshotPacketBundle = {
      views: [],
      meshDraws: [],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
      quadBatches: [
        {
          batchId: 7,
          kind: "sprite",
          texture,
          sampler,
          materialKey: "quad-material:sprite",
          pipelineVariant: "sprite",
          coordinateMode: "world",
          billboardMode: "spherical",
          sizeMode: "world-units",
          blendMode: "alpha",
          depthMode: "disabled",
          firstInstance: 4,
          instanceCount: 2,
          layerMask: 3,
          sortKey: {
            queue: "transparent",
            viewId: 1,
            layer: 0,
            order: 12,
            pipelineKey: "quad-pipeline:sprite",
            materialKey: "quad-material:sprite",
            meshKey: "quad-unit",
            depth: 5.25,
            stableId: 9001,
          },
        },
      ],
    };

    const encoded = encodeSnapshotPackets(bundle);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);

    expect(decoded.quadBatches).toEqual(bundle.quadBatches);
    expect(encoded.counts.quadBatches).toBe(1);
    expect(encoded.registry.snapshot().handles).toContainEqual({
      kind: "texture",
      id: "sprite-atlas",
    });
    expect(encoded.registry.snapshot().handles).toContainEqual({
      kind: "sampler",
      id: "linear-clamp",
    });
    expect(encoded.registry.snapshot().strings).toContain(
      "quad-pipeline:sprite",
    );
  });

  it("round-trips shadow caster draws independently from visible mesh draws", () => {
    const mesh = createMeshHandle("off-camera-caster");
    const material = createMaterialHandle("caster-material");
    const bundle: SnapshotPacketBundle = {
      views: [],
      meshDraws: [],
      shadowCasterDraws: [
        meshDraw({
          seed: 5,
          random: createRandom(0x505),
          mesh,
          material,
          queue: "opaque",
          topology: "triangle-list",
          instanceTintOffset: undefined,
          castsShadow: true,
          receivesShadow: false,
          occlusionQuery: false,
        }),
      ],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [boundsPacket(5, createRandom(0x606))],
    };

    const encoded = encodeSnapshotPackets(bundle);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);

    expect(encoded.counts).toMatchObject({
      meshDraws: 0,
      shadowCasterDraws: 1,
    });
    expect(decoded.meshDraws).toEqual([]);
    expect(decoded.shadowCasterDraws).toEqual(bundle.shadowCasterDraws);
  });

  it("round-trips authored shadow params through the worker codec", () => {
    const bundle: SnapshotPacketBundle = {
      views: [],
      meshDraws: [],
      lights: [],
      environments: [],
      shadowRequests: [
        {
          shadowId: 1,
          lightId: 1,
          lightKind: "directional",
          cascadeCount: 4,
          casterLayerMask: 1,
          receiverLayerMask: 1,
          shadowType: 2,
          strength: 0.7,
          filterRadius: 4,
          slopeBias: 2,
          center: [1, 2, 3],
          orthographicSize: 16,
          near: 0.5,
          far: 60,
          lightDistance: 25,
        },
      ],
      bounds: [],
    };

    const encoded = encodeSnapshotPackets(bundle);
    const decoded = decodeSnapshotPackets(encoded.words, encoded.registry);
    const request = decoded.shadowRequests[0]!;

    expect(request.shadowType).toBe(2);
    expect(request.strength).toBeCloseTo(0.7, 5);
    expect(request.filterRadius).toBe(4);
    expect(request.slopeBias).toBe(2);
    expect(request.cascadeCount).toBe(4);
    expect(request.center).toEqual([1, 2, 3]);
    expect(request.orthographicSize).toBe(16);
    expect(request.near).toBe(0.5);
    expect(request.far).toBe(60);
    expect(request.lightDistance).toBe(25);
  });

  it("documents fixed packet strides in words and bytes", () => {
    expect(SNAPSHOT_PACKET_WORD_STRIDES).toEqual({
      header: SNAPSHOT_PACKET_HEADER_WORDS,
      view: VIEW_PACKET_WORDS,
      meshDraw: MESH_DRAW_PACKET_WORDS,
      shadowCasterDraw: MESH_DRAW_PACKET_WORDS,
      light: LIGHT_PACKET_WORDS,
      environment: ENVIRONMENT_PACKET_WORDS,
      fog: FOG_PACKET_WORDS,
      particleEmitter: PARTICLE_EMITTER_PACKET_WORDS,
      audioEmitter: AUDIO_EMITTER_PACKET_WORDS,
      audioListener: AUDIO_LISTENER_PACKET_WORDS,
      shadowRequest: SHADOW_REQUEST_PACKET_WORDS,
      bounds: BOUNDS_PACKET_WORDS,
      quadBatch: QUAD_BATCH_PACKET_WORDS,
    });
    expect(SNAPSHOT_PACKET_BYTE_STRIDES).toEqual({
      header: SNAPSHOT_PACKET_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      view: VIEW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      meshDraw: MESH_DRAW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      shadowCasterDraw: MESH_DRAW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      light: LIGHT_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      environment: ENVIRONMENT_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      fog: FOG_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      particleEmitter:
        PARTICLE_EMITTER_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      audioEmitter: AUDIO_EMITTER_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      audioListener:
        AUDIO_LISTENER_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      shadowRequest:
        SHADOW_REQUEST_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      bounds: BOUNDS_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
      quadBatch: QUAD_BATCH_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
    });
  });

  it("reuses caller-provided Uint32Array storage", () => {
    const packets = randomPacketBundle();
    const expectedWords = snapshotPacketWordLength(packets);
    const buffer = new Uint32Array(expectedWords + 16);
    const encoded = encodePackets(packets, buffer);

    expect(encoded.words.buffer).toBe(buffer.buffer);
    expect(encoded.words.byteOffset).toBe(0);
    expect(encoded.words.length).toBe(expectedWords);
    expect(decodePackets(encoded.words, encoded.registry)).toEqual(packets);
  });

  it("keeps packet registry tables out of the per-frame encoded buffer", () => {
    const packets = randomPacketBundle();
    const registry = createSnapshotPacketRegistry();
    const encoded = encodeSnapshotPackets(packets, { registry });
    const snapshot = encoded.registry.snapshot();

    expect(snapshot.handles).toContainEqual({
      kind: "mesh",
      id: "mesh-0",
    });
    expect(snapshot.handles).toContainEqual({
      kind: "material",
      id: "material-1",
    });
    expect(snapshot.handles).toContainEqual({
      kind: "environment-map",
      id: "environment-0",
    });
    expect(snapshot.handles).toContainEqual({
      kind: "particle-effect",
      id: "smoke",
    });
    expect(snapshot.handles).toContainEqual({
      kind: "audio-clip",
      id: "engine",
    });
    expect(snapshot.strings).toContain("pipeline-0");
    expect(snapshot.strings).toContain("layout-1");
    expect(snapshot.strings).toContain("sfx");
    expect(encoded.words).toBeInstanceOf(Uint32Array);
  });

  it("rejects undersized or malformed packet buffers", () => {
    const packets = randomPacketBundle();
    const tooSmall = new Uint32Array(snapshotPacketWordLength(packets) - 1);

    expect(() => encodeSnapshotPackets(packets, { buffer: tooSmall })).toThrow(
      /too small/,
    );
    expect(() =>
      decodeSnapshotPackets(new Uint32Array(SNAPSHOT_PACKET_HEADER_WORDS), {
        ...createSnapshotPacketRegistry(),
      }),
    ).toThrow(/unsupported magic/);
  });

  it("keeps diagnostic strings out of the SAB packet layout", () => {
    expect(SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE).toContain(
      "outside the SAB packet area",
    );
    expect(SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE).toContain(
      "structured-clone",
    );
  });
});

function randomPacketBundle(): SnapshotPacketBundle {
  const random = createRandom(0x3038);
  const mesh0 = createMeshHandle("mesh-0");
  const mesh1 = createMeshHandle("mesh-1");
  const material0 = createMaterialHandle("material-0");
  const material1 = createMaterialHandle("material-1");
  const renderTarget = createRenderTargetHandle("offscreen-0");
  const environment = createEnvironmentMapHandle("environment-0");
  const particleEffect = createParticleEffectHandle("smoke");
  const audioClip = createAudioClipHandle("engine");

  return {
    views: [
      {
        viewId: 10,
        camera: entity(2, 3),
        priority: -2,
        layerMask: 0xff,
        viewMatrixOffset: 16,
        projectionMatrixOffset: 32,
        viewProjectionMatrixOffset: 48,
        viewport: vec4(random),
        scissor: vec4(random),
        clearColor: vec4(random),
        clearDepth: scalar(random),
        clearStencil: 7,
        renderTarget,
      },
      {
        viewId: 11,
        camera: entity(4, 5),
        priority: 1,
        layerMask: 0x0f,
        viewMatrixOffset: 64,
        projectionMatrixOffset: 80,
        viewProjectionMatrixOffset: 96,
        viewport: vec4(random),
        scissor: vec4(random),
        clearColor: vec4(random),
        clearDepth: scalar(random),
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    meshDraws: [
      meshDraw({
        seed: 0,
        random,
        mesh: mesh0,
        material: material0,
        queue: "opaque",
        topology: "triangle-list",
        instanceTintOffset: 12,
        castsShadow: true,
        receivesShadow: false,
        occlusionQuery: true,
      }),
      meshDraw({
        seed: 1,
        random,
        mesh: mesh1,
        material: material1,
        queue: "transparent",
        topology: "line-strip",
        instanceTintOffset: undefined,
        castsShadow: false,
        receivesShadow: true,
        occlusionQuery: false,
      }),
    ],
    lights: [
      {
        lightId: 20,
        entity: entity(20, 1),
        kind: "directional",
        shape: "rect",
        color: vec4(random),
        intensity: scalar(random),
        range: scalar(random),
        innerConeAngle: scalar(random),
        outerConeAngle: scalar(random),
        width: 2,
        height: 2,
        worldTransformOffset: 112,
        layerMask: 0xff,
      },
      {
        lightId: 21,
        entity: entity(21, 1),
        kind: "rect-area",
        shape: "disk",
        color: vec4(random),
        intensity: scalar(random),
        range: scalar(random),
        innerConeAngle: scalar(random),
        outerConeAngle: scalar(random),
        width: scalar(random),
        height: scalar(random),
        worldTransformOffset: 128,
        layerMask: 0x0f,
      },
    ],
    environments: [
      {
        environmentId: 30,
        handle: environment,
        color: vec4(random),
        intensity: scalar(random),
        layerMask: 0xff,
      },
      {
        environmentId: 31,
        handle: null,
        color: vec4(random),
        intensity: scalar(random),
        layerMask: 0x0f,
      },
    ],
    fogs: [
      {
        fogId: 35,
        entity: entity(35, 6),
        mode: FogMode.Exp2,
        color: vec4(random),
        density: scalar(random),
        start: scalar(random),
        end: scalar(random),
        layerMask: 0xff,
      },
    ],
    particleEmitters: [
      {
        emitterId: 36,
        entity: entity(-1, 0),
        effect: particleEffect,
        effectVersion: 3,
        capacity: 12,
        seed: -17,
        resetEpoch: 9,
        timeScale: 0.75,
        simulationSpace: "world",
        worldTransformOffset: 160,
        boundsIndex: 1,
        layerMask: 0xff,
        sortKey: {
          queue: "transparent",
          viewId: 10,
          layer: -1,
          order: -4,
          pipelineKey: "gpu-particles",
          materialKey: "particle-effect:smoke",
          meshKey: "particle-quad",
          depth: scalar(random),
          stableId: 36,
        },
        mode: "burst",
        burst: {
          burstId: 12,
          startFrame: 8,
          startTime: 123.456,
          count: 12,
          position: vec3(random),
          positionJitterMin: vec3(random),
          positionJitterMax: vec3(random),
          velocityMin: vec3(random),
          velocityMax: vec3(random),
        },
      },
      {
        emitterId: 41,
        entity: entity(5, 2),
        effect: particleEffect,
        effectVersion: 1,
        capacity: 64,
        seed: 7,
        resetEpoch: 0,
        timeScale: 1,
        delay: 0.25,
        duration: 1.5,
        simulationSpace: "local",
        worldTransformOffset: 176,
        boundsIndex: 2,
        layerMask: 1,
        sortKey: {
          queue: "transparent",
          viewId: 3,
          layer: 1,
          order: 0,
          pipelineKey: "gpu-particles",
          materialKey: "particle-effect:smoke",
          meshKey: "particle-quad",
          depth: scalar(random),
          stableId: 41,
        },
      },
    ],
    audioEmitters: [
      {
        key: { kind: "oneshot", seq: -3 },
        entity: entity(37, 6),
        clip: audioClip,
        clipVersion: 4,
        busId: "sfx",
        gain: scalar(random),
        loop: false,
        autoplay: true,
        playEpoch: -2,
        stopEpoch: 5,
        timeScale: 0.9,
        priority: -7,
        panningModel: "HRTF",
        simulationSpace: "world",
        distanceModel: "linear",
        refDistance: 2,
        maxDistance: 80,
        rolloffFactor: 0.5,
        coneInnerAngle: 120,
        coneOuterAngle: 220,
        coneOuterGain: 0.25,
        occlusion: 0.3,
        lowpassFrequency: 12000,
        lowpassQ: 0.9,
        offsetSec: 0.125,
        loopStart: 0.25,
        loopEnd: 1.5,
        seed: -11,
        boundsCenter: vec3(random),
        audibilityRadius: 40,
        audibility: "audible",
        muted: true,
        worldTransformOffset: 176,
        layerMask: 0xff,
      },
    ],
    audioListener: {
      listenerId: 38,
      entity: entity(38, 6),
      worldTransformOffset: 192,
      masterGain: 0.8,
    },
    shadowRequests: [
      {
        shadowId: 40,
        lightId: 20,
        lightKind: "directional",
        cascadeCount: 3,
        casterLayerMask: 0xff,
        receiverLayerMask: 0x0f,
      },
      {
        shadowId: 41,
        lightId: 21,
        casterLayerMask: 0x0f,
        receiverLayerMask: 0xff,
      },
    ],
    bounds: [boundsPacket(0, random), boundsPacket(1, random)],
  };
}

function meshDraw(options: {
  readonly seed: number;
  readonly random: () => number;
  readonly mesh: ReturnType<typeof createMeshHandle>;
  readonly material: ReturnType<typeof createMaterialHandle>;
  readonly queue: "opaque" | "alpha-test" | "transparent";
  readonly topology: "triangle-list" | "line-strip";
  readonly instanceTintOffset: number | undefined;
  readonly castsShadow: boolean;
  readonly receivesShadow: boolean;
  readonly occlusionQuery: boolean;
}): SnapshotPacketBundle["meshDraws"][number] {
  const seed = options.seed;
  const packet: SnapshotPacketBundle["meshDraws"][number] = {
    renderId: 100 + seed,
    entity: entity(100 + seed, 2),
    mesh: options.mesh,
    material: options.material,
    submesh: seed,
    materialSlot: seed + 1,
    vertexStart: seed * 4,
    vertexCount: 4 + seed,
    indexStart: seed * 6,
    indexCount: 6 + seed,
    worldTransformOffset: 144 + seed * 16,
    boundsIndex: seed,
    layerMask: seed === 0 ? 0xff : 0x0f,
    castsShadow: options.castsShadow,
    receivesShadow: options.receivesShadow,
    sortKey: {
      queue: options.queue,
      viewId: 10 + seed,
      layer: -(seed + 1),
      order: (seed + 1) * -3,
      pipelineKey: `pipeline-${seed}`,
      materialKey: `material-key-${seed}`,
      meshKey: `mesh-key-${seed}`,
      depth: scalar(options.random),
      stableId: 200 + seed,
    },
    batchKey: {
      pipelineKey: `pipeline-${seed}`,
      materialKey: `material-key-${seed}`,
      meshLayoutKey: `layout-${seed}`,
      topology: options.topology,
      instanced: seed === 0,
      skinned: seed === 1,
      morphed: false,
    },
    ...(options.occlusionQuery ? { occlusionQuery: true } : {}),
  };

  return {
    ...packet,
    ...(options.instanceTintOffset === undefined
      ? {}
      : { instanceTintOffset: options.instanceTintOffset }),
  };
}

function boundsPacket(
  seed: number,
  random: () => number,
): SnapshotPacketBundle["bounds"][number] {
  return {
    boundsId: 50 + seed,
    entity: entity(50 + seed, 4),
    localAabb: {
      min: vec3(random),
      max: vec3(random),
    },
    worldAabb: {
      min: vec3(random),
      max: vec3(random),
    },
    localSphere: {
      center: vec3(random),
      radius: scalar(random),
    },
    worldSphere: {
      center: vec3(random),
      radius: scalar(random),
    },
  };
}

function entity(index: number, generation: number) {
  return { index, generation };
}

function vec3(random: () => number): readonly [number, number, number] {
  return [scalar(random), scalar(random), scalar(random)];
}

function vec4(random: () => number): readonly [number, number, number, number] {
  return [scalar(random), scalar(random), scalar(random), scalar(random)];
}

function scalar(random: () => number): number {
  return Math.round((random() * 20 - 10) * 1_000_000) / 1_000_000;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;

    return state / 0x1_0000_0000;
  };
}
