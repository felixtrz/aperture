@group(0) @binding(0) var image:texture_2d<f32>;
@fragment fn main(@builtin(position) pixel:vec4f)->@location(0) vec4f{return textureLoad(image,vec2i(pixel.xy),0);}
