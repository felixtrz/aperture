@group(0) @binding(0) var<storage,read_write> vertices:array<vec2f>;
@group(0) @binding(1) var<storage,read_write> arguments:vec4u;
struct Step { time:f32 };
@group(0) @binding(2) var<uniform> step:Step;
@compute @workgroup_size(1) fn main(){
  let c=cos(step.time); let s=sin(step.time);
  let rotation=mat2x2f(c,s,-s,c);
  vertices[0]=rotation*vec2f(0,0.8);
  vertices[1]=rotation*vec2f(-0.7,-0.5);
  vertices[2]=rotation*vec2f(0.7,-0.5);
  arguments=vec4u(3,1,0,0);
}
