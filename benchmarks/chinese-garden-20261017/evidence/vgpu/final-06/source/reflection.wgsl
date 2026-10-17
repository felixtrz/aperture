struct Camera { vp:mat4x4f, lightVP:mat4x4f, eye:vec3f }
@group(0) @binding(0) var<uniform> camera:Camera;
@group(0) @binding(1) var shadowMap:texture_2d<f32>;
struct Out { @builtin(position) position:vec4f, @location(0) world:vec3f, @location(1) normal:vec3f, @location(2) color:vec4f, @location(3) lightPos:vec4f }
@vertex fn vs_main(@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f)->Out{
var o:Out;o.position=camera.vp*vec4f(position,1);o.world=position;o.normal=normal;o.color=color;o.lightPos=camera.lightVP*vec4f(position,1);return o;}
@fragment fn fs_main(i:Out)->@location(0) vec4f {
if(i.world.y<0.12){discard;}var n=normalize(i.normal);if(dot(n,camera.eye-i.world)<0.0){n=-n;}let sun=normalize(vec3f(-0.6,1.2,0.45));let lp=i.lightPos.xyz/i.lightPos.w;let uv=lp.xy*vec2f(0.5,-0.5)+0.5;var shade=0.0;
let px=vec2i(uv*2048.0);let bias=0.0012+0.002*(1.0-max(dot(n,sun),0.0));
for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let d=textureLoad(shadowMap,clamp(px+vec2i(x,y),vec2i(0),vec2i(2047)),0).r;shade+=select(0.0,1.0,lp.z-bias<=d);}}
shade/=25.0;var base=i.color.rgb;var lit=base*(vec3f(0.42,0.44,0.43)+vec3f(0.85,0.78,0.64)*max(dot(n,sun),0.0)*shade);lit*=0.88+0.12*max(n.y,0.0);
if(i.color.a>0.5){let w=sin(i.world.x*8.0+i.world.z*5.0)*sin(i.world.z*10.0-i.world.x*2.0);let waterTint=sin(i.world.x*2.4+i.world.z*1.1)*sin(i.world.z*2.2);let v=normalize(camera.eye-i.world);let h=normalize(v+sun);let wn=normalize(vec3f(w*0.045,1.0,cos(i.world.z*7.0+i.world.x*4.0)*0.04));let spec=pow(max(dot(wn,h),0.0),100.0);lit=base*(0.8+0.13*waterTint+0.07*w)*(0.65+0.35*shade)+vec3f(0.2,0.23,0.19)*spec;}
return vec4f(pow(max(lit,vec3f(0)),vec3f(1.0/2.2)),1);}
