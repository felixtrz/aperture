import {
  postDepthTextureBindingWgsl,
  postDepthLoadFunctionWgsl,
} from "../post/post-depth-sampling.js";

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
struct Out { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> Out {
  let p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  var o: Out; o.position=vec4f(p[i],0,1); o.uv=vec2f(p[i].x*.5+.5,.5-p[i].y*.5); return o;
}
fn clampCoord(c: vec2i, d: vec2u) -> vec2i { return clamp(c,vec2i(0),vec2i(d)-1); }
${postDepthLoadFunctionWgsl(samples, "nearest")}
@fragment fn fs(input: Out) -> @location(0) vec4f {
  let source = textureSampleLevel(sceneTexture,linearSampler,input.uv,0);
  let dims=textureDimensions(depthTexture);
  let depth=loadDepth(vec2i(input.uv*vec2f(dims)),dims);
  if(depth>=1.0 || params.plane.y<=0.0){return source;}
  let worldH=params.inverseViewProjection*vec4f(input.uv.x*2-1,1-input.uv.y*2,depth,1);
  let world=worldH.xyz/worldH.w;
  if(abs(world.y-params.plane.x)>params.plane.z){return source;}
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
