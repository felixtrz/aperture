import { postDepthTextureBindingWgsl } from "../post/post-depth-sampling.js";

export function planarReflectionWgsl(samples: number): string {
  return `
struct Params {
  inverseViewProjection: mat4x4f,
  reflectionViewProjection: mat4x4f,
  plane: vec4f,
  detail: vec4f,
  tint: vec4f,
};
@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
${postDepthTextureBindingWgsl(samples)}
@group(0) @binding(3) var reflectionTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> params: Params;
struct Out {
  @builtin(position) position: vec4f,
  @location(0) ${samples > 1 ? "@interpolate(linear, sample)" : ""} uv: vec2f,
};
@vertex fn vs(@builtin(vertex_index) i: u32) -> Out {
  let p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  var o: Out; o.position=vec4f(p[i],0,1); o.uv=vec2f(p[i].x*.5+.5,.5-p[i].y*.5); return o;
}
fn receiverNeighbor(coord: vec2i, offset: vec2i, dims: vec2u, uv: vec2f, world: vec3f, sample: u32) -> vec4f {
  let neighborCoord=clamp(coord+offset,vec2i(0),vec2i(dims)-1);
  if(all(neighborCoord==coord)){return vec4f(0);}
  let depth=textureLoad(depthTexture,neighborCoord,${samples > 1 ? "sample" : "0"});
  if(depth>=1.0){return vec4f(0);}
  // Preserve this hardware sample's offset, including at clamped image edges.
  let neighborUv=uv+vec2f(neighborCoord-coord)/vec2f(dims);
  let worldH=params.inverseViewProjection*vec4f(neighborUv.x*2-1,1-neighborUv.y*2,depth,1);
  if(worldH.w==0.0){return vec4f(0);}
  let delta=worldH.xyz/worldH.w-world;
  if(dot(delta,delta)==0.0){return vec4f(0);}
  return vec4f(delta,1);
}
fn receiverTangent(negative: vec4f, positive: vec4f) -> vec4f {
  if(negative.w==0.0){return positive;}
  if(positive.w==0.0){return negative;}
  // Prefer the local surface across depth discontinuities. World distance also
  // works for orthographic cameras and surfaces with the same camera depth.
  return select(positive,negative,dot(negative.xyz,negative.xyz)<dot(positive.xyz,positive.xyz));
}
@fragment fn fs(input: Out${samples > 1 ? ", @builtin(sample_index) sample: u32" : ""}) -> @location(0) vec4f {
  let dims=textureDimensions(depthTexture);
  let coord=clamp(vec2i(input.position.xy),vec2i(0),vec2i(dims)-1);
  // Source color is already resolved. Keep rejected samples at the pixel center;
  // only the matching depth and world position use hardware sample locations.
  let sourceUv=(vec2f(coord)+vec2f(.5))/vec2f(dims);
  let source=textureSampleLevel(sceneTexture,linearSampler,sourceUv,0);
  let depth=textureLoad(depthTexture,coord,${samples > 1 ? "sample" : "0"});
  if(depth>=1.0 || params.plane.y<=0.0){return source;}
  let worldH=params.inverseViewProjection*vec4f(input.uv.x*2-1,1-input.uv.y*2,depth,1);
  let world=worldH.xyz/worldH.w;
  if(abs(world.y-params.plane.x)>params.plane.z){return source;}
  // Height alone also admits a stripe on walls crossing the reflection plane.
  // Estimate orientation only for eligible samples, without quad derivatives.
  let dx=receiverTangent(
    receiverNeighbor(coord,vec2i(-1,0),dims,input.uv,world,${samples > 1 ? "sample" : "0u"}),
    receiverNeighbor(coord,vec2i(1,0),dims,input.uv,world,${samples > 1 ? "sample" : "0u"}));
  let dy=receiverTangent(
    receiverNeighbor(coord,vec2i(0,-1),dims,input.uv,world,${samples > 1 ? "sample" : "0u"}),
    receiverNeighbor(coord,vec2i(0,1),dims,input.uv,world,${samples > 1 ? "sample" : "0u"}));
  if(dx.w==0.0 || dy.w==0.0){return source;}
  // Normalize tangents first so degeneracy rejection is independent of scale.
  let normal=cross(normalize(dx.xyz),normalize(dy.xyz));
  let normalLength=length(normal);
  if(normalLength<=.000001 || abs(normal.y)<normalLength*.95){return source;}
  let reflected=params.reflectionViewProjection*vec4f(world,1);
  var uv=vec2f(reflected.x/reflected.w*.5+.5,.5-reflected.y/reflected.w*.5);
  uv+=vec2f(sin((world.z*4.7+world.x*.7)*params.detail.y+params.detail.z),sin((world.x*5.1-world.z*.6)*params.detail.y+params.detail.z))*params.plane.w;
  if(any(uv<vec2f(0)) || any(uv>vec2f(1))){return source;}
  let delta=vec2f(params.detail.x)/vec2f(textureDimensions(reflectionTexture));
  let reflectedColor=textureSampleLevel(reflectionTexture,linearSampler,uv,0).rgb*.4
    +(textureSampleLevel(reflectionTexture,linearSampler,uv+vec2f(delta.x,0),0).rgb
      +textureSampleLevel(reflectionTexture,linearSampler,uv-vec2f(delta.x,0),0).rgb
      +textureSampleLevel(reflectionTexture,linearSampler,uv+vec2f(0,delta.y),0).rgb
      +textureSampleLevel(reflectionTexture,linearSampler,uv-vec2f(0,delta.y),0).rgb)*.15;
  return vec4f(mix(source.rgb,reflectedColor*params.tint.rgb,params.plane.y),source.a);
}`;
}
