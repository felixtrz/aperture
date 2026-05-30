export const SNAPSHOT_PACKET_ENCODING_MAGIC = 0x4150_5350; // "APSP"
export const SNAPSHOT_PACKET_ENCODING_VERSION = 6;

export const SNAPSHOT_PACKET_HEADER_WORDS = 8;
export const VIEW_PACKET_WORDS = 36;
export const MESH_DRAW_PACKET_WORDS = 34;
export const LIGHT_PACKET_WORDS = 31;
export const ENVIRONMENT_PACKET_WORDS = 13;
// 0-5: ids/kind/masks/cascadeCount; 6: shadowType; 7-9: strength/filterRadius/
// slopeBias (M4-T3); 10-11: depthBias/normalBias (float32) (M4-T5).
export const SHADOW_REQUEST_PACKET_WORDS = 12;
export const BOUNDS_PACKET_WORDS = 43;

export const SNAPSHOT_PACKET_WORD_STRIDES = Object.freeze({
  header: SNAPSHOT_PACKET_HEADER_WORDS,
  view: VIEW_PACKET_WORDS,
  meshDraw: MESH_DRAW_PACKET_WORDS,
  light: LIGHT_PACKET_WORDS,
  environment: ENVIRONMENT_PACKET_WORDS,
  shadowRequest: SHADOW_REQUEST_PACKET_WORDS,
  bounds: BOUNDS_PACKET_WORDS,
});

export const SNAPSHOT_PACKET_BYTE_STRIDES = Object.freeze({
  header: SNAPSHOT_PACKET_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  view: VIEW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  meshDraw: MESH_DRAW_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  light: LIGHT_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  environment: ENVIRONMENT_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  shadowRequest: SHADOW_REQUEST_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
  bounds: BOUNDS_PACKET_WORDS * Uint32Array.BYTES_PER_ELEMENT,
});

export const SNAPSHOT_PACKET_DIAGNOSTIC_TRANSPORT_NOTE =
  "RenderSnapshot diagnostics stay outside the SAB packet area; diagnostic strings are rare and remain transferable structured-clone payloads.";

export const SNAPSHOT_PACKET_HEADER_WORD_INDEX = Object.freeze({
  Magic: 0,
  Version: 1,
  Views: 2,
  MeshDraws: 3,
  Lights: 4,
  Environments: 5,
  ShadowRequests: 6,
  Bounds: 7,
});
