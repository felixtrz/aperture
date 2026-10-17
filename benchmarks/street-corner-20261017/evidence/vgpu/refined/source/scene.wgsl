
@group(0) @binding(0) var<uniform> cameraVP:mat4x4f;
@group(0) @binding(1) var<uniform> lightVP:mat4x4f;
@group(0) @binding(2) var shadowTex:texture_2d<f32>;
struct Out { @builtin(position) position:vec4f, @location(0) normal:vec3f, @location(1) color:vec3f, @location(2) light:vec4f, @location(3) world:vec3f };
@vertex fn vs_main(@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec3f)->Out {var o:Out;o.position=cameraVP*vec4f(position,1);o.normal=normal;o.color=color;o.light=lightVP*vec4f(position,1);o.world=position;return o;}
@fragment fn fs_main(i:Out)->@location(0) vec4f {
 let l=i.light.xyz/i.light.w;let uv=vec2f(l.x*.5+.5,.5-l.y*.5);let dim=vec2i(textureDimensions(shadowTex));let coord=vec2i(uv*vec2f(dim));var shade=0.;
 for(var x=-2;x<=2;x++){for(var y=-2;y<=2;y++){let dep=textureLoad(shadowTex,clamp(coord+vec2i(x,y)*3,vec2i(0),dim-vec2i(1)),0).r;shade+=select(0.,1.,l.z-.0011>dep);}}
 shade=shade/25.;let sun=normalize(vec3f(.60,1.,.47));let diffuse=max(0.,dot(normalize(i.normal),sun));let light=.76+diffuse*.30-shade*.17;
 let warm=vec3f(1.01,1.0,.98);var c=i.color*light*warm;
 // Very fine deterministic asphalt grain, purely procedural.
 if(i.color.r<.36 && i.color.r>.31 && i.world.y<.5){let grain=fract(sin(dot(i.world.xz*640.,vec2f(12.9898,78.233)))*43758.5453);c*=.96+grain*.08;}
 return vec4f(clamp(c,vec3f(0),vec3f(1)),1);}