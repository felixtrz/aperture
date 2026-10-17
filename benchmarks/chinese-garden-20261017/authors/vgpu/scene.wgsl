struct Camera { vp:mat4x4f, lightVP:mat4x4f, eye:vec3f }
@group(0) @binding(0) var<uniform> camera:Camera;
@group(0) @binding(1) var shadowMap:texture_2d<f32>;
@group(0) @binding(2) var reflectionMap:texture_2d<f32>;
struct Out { @builtin(position) position:vec4f, @location(0) world:vec3f, @location(1) normal:vec3f, @location(2) color:vec4f, @location(3) lightPos:vec4f }
@vertex fn vs_main(@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f)->Out{
var o:Out;o.position=camera.vp*vec4f(position,1);o.world=position;o.normal=normal;o.color=color;o.lightPos=camera.lightVP*vec4f(position,1);return o;}
struct FragOut{ @location(0) color:vec4f, @location(1) normal:vec4f }
@fragment fn fs_main(i:Out)->FragOut {
var n=normalize(i.normal);if(dot(n,camera.eye-i.world)<0.0){n=-n;}let sun=normalize(vec3f(-0.6,1.2,0.45));let lp=i.lightPos.xyz/i.lightPos.w;let uv=lp.xy*vec2f(0.5,-0.5)+0.5;var shade=0.0;
let px=vec2i(uv*2048.0);let bias=0.0012+0.002*(1.0-max(dot(n,sun),0.0));
for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let d=textureLoad(shadowMap,clamp(px+vec2i(x*2,y*2),vec2i(0),vec2i(2047)),0).r;shade+=select(0.0,1.0,lp.z-bias<=d);}}
shade/=25.0;var base=i.color.rgb;var lit=base*(vec3f(0.42,0.44,0.43)+vec3f(0.80,0.77,0.70)*max(dot(n,sun),0.0)*shade);lit*=0.88+0.12*max(n.y,0.0);
if(i.color.a>0.5){let w=sin(i.world.x*8.0+i.world.z*5.0)*sin(i.world.z*10.0-i.world.x*2.0);let waterTint=sin(i.world.x*2.4+i.world.z*1.1)*sin(i.world.z*2.2);let v=normalize(camera.eye-i.world);let h=normalize(v+sun);let wn=normalize(vec3f(w*0.045,1.0,cos(i.world.z*7.0+i.world.x*4.0)*0.04));let spec=pow(max(dot(wn,h),0.0),100.0);let rp=clamp(vec2i(i.position.xy+vec2f(w*2.0,cos(i.world.x*15.0+i.world.z*12.0)*1.4)),vec2i(0),vec2i(1199,899));let reflected=pow(textureLoad(reflectionMap,rp,0).rgb,vec3f(2.2));lit=mix(base*(0.84+0.09*waterTint+0.02*w)*(0.75+0.25*shade),reflected,0.22)+vec3f(0.2,0.23,0.19)*spec;}
let grain=fract(sin(dot(i.world,vec3f(143.7,197.3,167.1)))*43758.5453);lit*=0.985+0.03*grain;var out:FragOut;out.color=vec4f(pow(max(lit,vec3f(0)),vec3f(1.0/2.2)),1);let vn=vec3f(dot(n,vec3f(0.5767,0.0,-0.8170)),dot(n,vec3f(-0.4259,0.8524,-0.3006)),dot(n,vec3f(0.6964,0.5212,0.4917)));out.normal=vec4f(vn*0.5+0.5,i.position.z);return out;}
