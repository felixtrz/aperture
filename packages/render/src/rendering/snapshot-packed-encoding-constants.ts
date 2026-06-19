export const SNAPSHOT_PACKET_ENCODING_MAGIC = 0x4150_5350; // "APSP"
export const SNAPSHOT_PACKET_ENCODING_VERSION = 14;

export const SNAPSHOT_PACKET_HEADER_WORDS = 14;
export const VIEW_PACKET_WORDS = 36;
export const MESH_DRAW_PACKET_WORDS = 34;
export const LIGHT_PACKET_WORDS = 31;
export const ENVIRONMENT_PACKET_WORDS = 13;
export const FOG_PACKET_WORDS = 19;
export const PARTICLE_EMITTER_PACKET_WORDS = 60;
export const AUDIO_EMITTER_PACKET_WORDS = 54;
export const AUDIO_LISTENER_PACKET_WORDS = 6;
// 0-5: ids/kind/masks/cascadeCount; 6: shadowType; 7-9: strength/filterRadius/
// slopeBias (M4-T3); 10-11: depthBias/normalBias (float32) (M4-T5); 12: mapSize
// (authored shadow-map resolution, uint32); 13-17: fixed directional shadow
// camera center.xyz/orthographicSize/near (float32); 18-19: fixed far/lightDistance.
export const SHADOW_REQUEST_PACKET_WORDS = 20;
export const BOUNDS_PACKET_WORDS = 43;
export const QUAD_BATCH_PACKET_WORDS = 24;

export const SNAPSHOT_PACKET_WORD_STRIDES = Object.freeze({
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

export const SNAPSHOT_PACKET_BYTE_STRIDES = Object.freeze({
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
  audioListener: AUDIO_LISTENER_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  shadowRequest: SHADOW_REQUEST_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  bounds: BOUNDS_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  quadBatch: QUAD_BATCH_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
});

export const SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE =
  "RenderSnapshot diagnostics stay outside the SAB packet area; diagnostic strings are rare and remain transferable structured-clone payloads.";

export const SNAPSHOT_PACKET_HEADER_WORD_INDEX = Object.freeze({
  Magic: 0,
  Version: 1,
  Views: 2,
  MeshDraws: 3,
  ShadowCasterDraws: 4,
  Lights: 5,
  Environments: 6,
  ShadowRequests: 7,
  Bounds: 8,
  QuadBatches: 9,
  Fogs: 10,
  ParticleEmitters: 11,
  AudioEmitters: 12,
  AudioListeners: 13,
});
