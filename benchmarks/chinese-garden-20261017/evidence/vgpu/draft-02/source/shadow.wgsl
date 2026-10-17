struct Camera{vp:mat4x4f}
@group(0) @binding(0) var<uniform> camera:Camera;
@vertex fn vs_main(@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f)->@builtin(position) vec4f{return camera.vp*vec4f(position,1);}
@fragment fn fs_main(@builtin(position) p:vec4f)->@location(0) vec4f{return vec4f(p.z,p.z,p.z,1);}
