
@group(0) @binding(0) var<uniform> lightVP: mat4x4f;
struct Out { @builtin(position) position:vec4f };
@vertex fn vs_main(@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec3f)->Out { var o:Out;o.position=lightVP*vec4f(position,1);return o; }
@fragment fn fs_main(@builtin(position) p:vec4f)->@location(0) vec4f {return vec4f(p.z,0,0,1);}