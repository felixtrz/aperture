// @import "./palette.wgsl"
struct Vertex { @builtin(position) position:vec4f, @location(0) color:vec3f };
@vertex fn vs(@location(0) position:vec2f)->Vertex {var out:Vertex;out.position=vec4f(position,0,1);out.color=aperturePalette(position.y);return out;}
@fragment fn fs(input:Vertex)->@location(0) vec4f{return vec4f(input.color,1);}
