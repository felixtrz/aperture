struct Colors { @location(0) warm:vec4f, @location(1) cool:vec4f };
@fragment fn main(@location(0) uv:vec2f)->Colors {var out:Colors;out.warm=vec4f(uv.x,uv.y*0.5,0.1,1);out.cool=vec4f(0.1,uv.x*0.6,uv.y,1);return out;}
