// @import "./palette.wgsl"
struct Frame { resolution:vec2f, time:f32, delta:f32, frame:u32, pointer:vec4f };
@group(0) @binding(0) var previous:texture_2d<f32>;
@group(0) @binding(1) var<uniform> frame:Frame;
@fragment fn main(@builtin(position) pixel:vec4f)->@location(0) vec4f {
  let uv=pixel.xy/frame.resolution;
  let center=vec2f(0.5)+0.28*vec2f(cos(frame.time*1.5),sin(frame.time*2));
  let spot=exp(-length(uv-center)*70);
  return vec4f(textureLoad(previous,vec2i(pixel.xy),0).rgb*0.96+aperturePalette(frame.time*0.1)*spot,1);
}
