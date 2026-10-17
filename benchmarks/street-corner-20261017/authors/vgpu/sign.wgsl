@group(0) @binding(0) var<uniform> cameraVP:mat4x4f;
@group(0) @binding(1) var signTex:texture_2d<f32>;
@group(0) @binding(2) var signSampler:sampler;
struct Out { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn vs_main(@location(0) position:vec3f,@location(1) uv:vec2f)->Out {var o:Out;o.position=cameraVP*vec4f(position,1);o.uv=uv;return o;}
@fragment fn fs_main(i:Out)->@location(0) vec4f {let c=textureSample(signTex,signSampler,i.uv);if(c.a<.05){discard;}return c;}
