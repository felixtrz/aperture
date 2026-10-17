@group(0) @binding(0) var warm:texture_2d<f32>;
@group(0) @binding(1) var cool:texture_2d<f32>;
@fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f {return mix(textureLoad(warm,vec2i(p.xy),0),textureLoad(cool,vec2i(p.xy),0),0.5);}
