@group(0) @binding(0) var sceneColor:texture_2d<f32>;
@group(0) @binding(1) var sceneNormals:texture_2d<f32>;
@group(0) @binding(2) var sceneDepth:texture_depth_multisampled_2d;
fn viewPosition(p:vec2i)->vec3f{let d=textureLoad(sceneDepth,clamp(p,vec2i(0),vec2i(1199,899)),0);return vec3f((f32(p.x)/1200.0-0.5)*16.9,(0.5-f32(p.y)/900.0)*12.675,-0.1-d*99.9);}
@fragment fn fs_main(@builtin(position) frag:vec4f)->@location(0) vec4f{
let p=vec2i(frag.xy);let c=textureLoad(sceneColor,p,0);let encoded=textureLoad(sceneNormals,p,0);let n=normalize(encoded.xyz*2.0-1.0);let pos=viewPosition(p);var occ=0.0;
for(var j=0;j<3;j++){let radius=7.0+f32(j)*11.0;for(var k=0;k<8;k++){let angle=f32(k)*0.785398+f32(j)*0.39;let q=clamp(p+vec2i(vec2f(cos(angle),sin(angle))*radius),vec2i(0),vec2i(1199,899));let delta=viewPosition(q)-pos;let dist=length(delta);occ+=max(0.0,dot(n,delta/max(dist,0.001))-0.075)*max(0.0,1.0-dist/0.75);}}
let ao=1.0-min(0.32,occ/24.0*1.25);return vec4f(c.rgb*ao,1);}
