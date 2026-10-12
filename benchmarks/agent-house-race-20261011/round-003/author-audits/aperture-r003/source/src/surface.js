import {createTextureAsset,createSamplerAsset,createStandardMaterialAsset} from '@aperture-engine/render';
import {createTextureHandle,createSamplerHandle,createMaterialHandle} from '@aperture-engine/simulation';
import {color} from '@aperture-engine/app/systems';
export function surfaceMaterials(registry){
 const sampler=createSamplerHandle('surface.repeat');
 registry.register(sampler);registry.markReady(sampler,createSamplerAsset({label:'Repeating grain',maxAnisotropy:4}));
 const textures={};
 for(const [name,contrast] of [['stucco',.15],['stone',.30],['asphalt',.40],['tile',.18],['grass',.21]]){
  let state=1321;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const size=256,bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   let grain=random(),broad=(Math.sin(x*.034)+Math.sin(y*.023)+Math.sin((x+y)*.018))*.04;
   let value=Math.round(255*(1-contrast*(.7-grain*.65)+broad*.3));
   if(name==='asphalt'&&grain>.985)value=Math.min(255,value+25);
   for(let j=0;j<3;j++)bytes[(y*size+x)*4+j]=Math.max(0,Math.min(255,value));
   bytes[(y*size+x)*4+3]=255;
  }
  const texture=createTextureHandle('surface.'+name);
  registry.register(texture);registry.markReady(texture,createTextureAsset({label:'Seeded '+name+' grain',dimension:'2d',width:size,height:size,format:'rgba8unorm-srgb',colorSpace:'srgb',semantic:'base-color',sourceData:{bytes,bytesPerRow:size*4}}));
  textures[name]=texture;
 }
 return (key,b)=>{
  const type=key.startsWith('stucco')?'stucco':key.startsWith('stone')||key==='curb'||key==='sill'?'stone':key==='asphalt'?'asphalt':key.startsWith('tile')||key==='ridge'?'tile':key==='ground'||key.startsWith('grass')?'grass':null;
  const handle=createMaterialHandle('surface.material.'+key);
  registry.register(handle,{dependencies:type?[textures[type],sampler]:[]});
  registry.markReady(handle,createStandardMaterialAsset({label:key,baseColorFactor:color.srgbHex(b.color),roughnessFactor:b.roughness,metallicFactor:b.metallic??0,baseColorTexture:type?{texture:textures[type],sampler}:null}));
  return handle;
 };
}
