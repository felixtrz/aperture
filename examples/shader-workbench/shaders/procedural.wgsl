// @import "./palette.wgsl"
struct Frame { resolution:vec2f, time:f32, delta:f32, frame:u32, pointer:vec4f };
struct Parameters { tint:vec4f, controls:vec4f };
@group(0) @binding(0) var<uniform> parameters:Parameters;
@group(0) @binding(1) var<uniform> frame:Frame;
@group(0) @binding(2) var image:texture_2d<f32>;
fn distanceField(p:vec3f)->f32 {
  let wave=0.08*sin(p.x*7+frame.time)*sin(p.y*7-frame.time)*sin(p.z*7);
  return length(p)-0.85-wave*parameters.controls.x;
}
@fragment fn main(@builtin(position) pixel:vec4f)->@location(0) vec4f {
  let uv=(2*pixel.xy-frame.resolution)/frame.resolution.y;
  let origin=vec3f(0,0,3);
  let direction=normalize(vec3f(uv.x,-uv.y,-2.5));
  var travel=0.0;
  for(var i=0;i<64;i++) {
    let distance=distanceField(origin+direction*travel);
    if(distance<0.001 || travel>6){break;}
    travel+=distance;
  }
  var color=vec3f(0.018,0.03,0.06)+vec3f(0.025,0.035,0.05)*(1-length(uv)*0.25);
  if(travel<6) {
    let p=origin+direction*travel;
    let e=0.002;
    let normal=normalize(vec3f(distanceField(p+vec3f(e,0,0))-distanceField(p-vec3f(e,0,0)),distanceField(p+vec3f(0,e,0))-distanceField(p-vec3f(0,e,0)),distanceField(p+vec3f(0,0,e))-distanceField(p-vec3f(0,0,e))));
    let lighting=0.2+0.8*max(0,dot(normal,normalize(vec3f(-1,2,3))));
    let grain=textureLoad(image,vec2i(i32(pixel.x)%2,i32(pixel.y)%2),0).rgb;
    color=aperturePalette(p.y*0.3+frame.time*0.04)*lighting*parameters.tint.rgb*(0.9+grain*0.1);
    color+=pow(1-max(0,dot(normal,-direction)),3)*vec3f(0.2,0.5,0.8);
  }
  return vec4f(pow(color*parameters.controls.y,vec3f(1.0/2.2)),1);
}
