import { createSystem, material, mesh, hexColor } from '@aperture-engine/app/systems';
type V=[number,number,number];
const C={cream:0xe7cba4,trim:0xf2dabb,stone:0xc2ac90,roof:0x8a8076,green:0x9ca77b,darkGreen:0x324d39,frame:0x1e4843,glass:0x294441,wood:0xb87738,road:0x55524e,paving:0xd4c6ad,curb:0xdacdb9,red:0xb75440,ivory:0xffe4b8,metal:0x283633,soil:0x584a2e};
const glyphs:Record<string,string[]>={C:['01111','11000','10000','10000','10000','11000','01111'],A:['01110','11011','10001','10001','11111','10001','10001'],F:['11111','10000','10000','11110','10000','10000','10000'],E:['11111','10000','10000','11110','10000','10000','11111'],B:['11110','10001','10001','11110','10001','10001','11110'],O:['01110','10001','10001','10001','10001','10001','01110'],K:['10001','10010','10100','11000','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110']};
export default class SceneSystem extends createSystem({priority:0}){
  n=0; mats=new Map<number,any>();
  mat(c:number){if(!this.mats.has(c))this.mats.set(c,material.standard({baseColor:hexColor(c),roughness:.87}));return this.mats.get(c);}
  obj(m:any,c:number,p:V,s:V=[1,1,1],r:V=[0,0,0],cast=true){return this.spawn.mesh({key:`part-${this.n++}`,mesh:m,material:this.mat(c),transform:{translation:p,scale:s,rotationEulerDegrees:r},castShadow:cast,receiveShadow:true});}
  box(p:V,s:V,c:number,r:V=[0,0,0],cast=true){return this.obj(mesh.box(),c,p,s,r,cast);}
  cyl(p:V,radius:number,depth:number,c:number,r:V=[0,0,0],segments=10){return this.obj(mesh.cylinder({radius,depth,segments}),c,p,[1,1,1],r);}
  beam(a:V,b:V,r:number,c:number){const mid:V=a.map((v,i)=>(v+b[i])/2) as V;const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz);this.obj(mesh.cylinder({radius:r,depth:len,segments:7}),c,mid,[1,1,1],[Math.atan2(dz,dy)*180/Math.PI,0,-Math.atan2(dx,Math.hypot(dy,dz))*180/Math.PI]);}
  // Facade local axes: width u, height y, outward depth d.
  face(side:'front'|'side',u:number,y:number,d:number,size:V,c:number){return side==='front'?this.box([u,y,2.83+d],size,c):this.box([-.27+d,y,u],[size[2],size[1],size[0]],c);}
  sign(word:string,side:'front'|'side',center:number,y:number,d:number,unit:number){const width=(word.length*6-1)*unit;for(let k=0;k<word.length;k++){const rows=glyphs[word[k]];for(let j=0;j<7;j++){let run=-1;for(let i=0;i<=5;i++){if(i<5&&rows[j][i]==='1'&&run<0)run=i;if((i===5||rows[j][i]==='0')&&run>=0){const w=i-run;this.face(side,center-width/2+(k*6+run+w/2)*unit,y+(3-j)*unit,d,[w*unit,unit,.045],C.ivory);run=-1;}}}}}
  window(side:'front'|'side',u:number,y:number,book=false){const w=book?.75:.83,h=1.38;
    this.face(side,u,y,.015,[w+.25,h+.25,.09],book?C.green:C.cream);
    this.face(side,u,y,.075,[w,h,.08],C.glass);
    // warm reflected panes and inset sill
    this.face(side,u-.18,y,.121,[.15,h-.12,.025],0x706d45);
    for(const q of [-1,1])this.face(side,u+q*(w/2+.045),y,.14,[.075,h+.13,.12],C.trim);
    for(const q of [-1,1])this.face(side,u,y+q*(h/2+.075),.14,[w+.25,.10,.16],C.trim);
    this.face(side,u,y,.16,[.055,h,.06],C.frame);this.face(side,u,y+.12,.16,[w,.065,.06],C.frame);
    if(book){for(let j=0;j<2;j++){this.face(side,u,y-.5+j*.57,.14,[w-.08,.045,.05],C.wood);for(let k=0;k<5;k++)this.face(side,u-.28+k*.12,y-.36+j*.57,.13,[.07,.24+((k*3)%4)*.04,.035],[0xa96132,0xc3a15d,0x74805f,0x6c503a][k%4]);}}
  }
  awning(side:'front'|'side',center:number,width:number){const stripes=10,sw=width/stripes;for(let i=0;i<stripes;i++){const u=center-width/2+(i+.5)*sw,c=i%2?C.ivory:C.red;const pos:V=side==='front'?[u,2.95,3.25]:[.15,2.95,u];const size:V=side==='front'?[sw,.09,1.02]:[1.02,.09,sw];this.box(pos,size,c,side==='front'?[27,0,0]:[0,0,-27]);this.face(side,u,2.69,.89,[sw,.28,.08],c);}}
  override init(){
    this.spawn.camera({key:'camera.main',transform:{translation:[18,16,22],lookAt:[-.5,2,.4]},camera:{projection:'orthographic',orthographicHeight:18.7,near:.1,far:160,clearColor:[.93,.87,.76,1]}});
    this.spawn.light({key:'sun',kind:'directional',color:hexColor(0xffecd3),intensity:2.7,transform:{rotationEulerDegrees:[-50,35,0]},shadow:{mapSize:2048,cascadeCount:1,shadowType:1,strength:.72,filterRadius:3,normalBias:.025}});
    this.box([0,-.7,0],[200,.12,200],0xefe4d1,[0,0,0],false);
    this.box([0,-.29,.25],[14,.65,14],0xb6a58e);
    this.box([0,.055,.25],[13.94,.06,13.94],C.road);
    this.box([-2.55,.18,-1.08],[8.9,.25,11.2],C.curb);
    this.box([-2.55,.32,-1.08],[8.76,.04,11.06],C.paving);
    // restrained square paving joints
    for(let x=-6.85;x<1.9;x+=.72)this.box([x,.345,-1.08],[.012,.009,11.01],0xb9ae9b,[0,0,0],false);
    for(let z=-6.5;z<4.43;z+=.72)this.box([-2.55,.345,z],[8.72,.009,.012],0xb9ae9b,[0,0,0],false);
    for(let x=-6.65;x<1.8;x+=.7)this.box([x,.25,4.53],[.66,.22,.19],C.curb);
    for(let z=-6.3;z<4.4;z+=.7)this.box([1.98,.25,z],[.18,.22,.66],C.curb);
    for(let x=-5.8;x<6.5;x+=2)this.box([x,.091,5.65],[.85,.014,.10],0xd3bd94,[0,0,0],false);
    for(let z=-5.6;z<5;z+=2.05)this.box([4.42,.091,z],[.10,.014,.85],0xd3bd94,[0,0,0],false);
    for(let z=1.2;z<4.5;z+=.67)this.box([3.40,.095,z],[2.5,.02,.37],0xeee0c5,[0,0,0],false);
    // Three-storey corner cafe and adjoining bookshop.
    this.box([-2.5,4.1,.65],[4.4,7.5,4.35],C.cream);
    this.box([-2.5,2.95,-3.55],[4.4,5.2,4.05],C.green);
    for(const y of [.53,3.38,5.52,7.74]){this.box([-2.5,y,.65],[4.58,.15,4.49],C.trim);}
    this.box([-2.5,7.89,.65],[4.69,.15,4.62],C.trim);
    this.box([-2.5,7.99,.65],[4.3,.08,4.18],C.roof);
    for(const x of [-4.67,-.33])this.box([x,8.12,.65],[.16,.27,4.44],C.trim);
    for(const z of [-1.52,2.82])this.box([-2.5,8.12,z],[4.50,.27,.16],C.trim);
    for(const y of [3.0,5.63])this.box([-2.5,y,-3.55],[4.52,.16,4.12],y===3?C.darkGreen:C.trim);
    this.box([-2.5,5.72,-3.55],[4.5,.13,4.17],C.trim);
    this.box([-2.5,5.82,-3.55],[4.28,.08,3.97],C.roof);
    for(const x of [-4.67,-.33])this.box([x,5.93,-3.55],[.15,.2,4.11],C.trim);
    for(const z of [-5.55,-1.55])this.box([-2.5,5.93,z],[4.48,.2,.15],C.trim);
    // Corners and shallow quoins on the cafe.
    for(let y=.65;y<7.65;y+=.42){const width=Math.round(y*10)%2?.25:.36;this.box([-.235,y,2.77],[.13,.27,width],0xd5b796);this.box([-4.66,y,2.87],[width,.27,.13],0xd5b796);}
    for(const y of [4.36,6.49])for(const u of [-3.55,-1.60])this.window('front',u,y);
    for(const y of [4.36,6.49])for(const u of [-.5,1.55])this.window('side',u,y);
    for(const u of [-4.8,-3.5,-2.2])this.window('side',u,4.41,true);
    // Ground-floor glazed storefronts, divisions and panels.
    for(const side of ['front','side'] as const){const cen=side==='front'?-2.5:.65;this.face(side,cen,1.6,.065,[3.55,2.4,.12],C.frame);this.face(side,cen,1.67,.14,[3.36,2.1,.07],0x806238);
      for(let i=0;i<4;i++){const u=cen-1.275+i*.85;this.face(side,u,1.65,.185,[.76,1.75,.035],0x4a5b43);this.face(side,u,.68,.24,[.76,.46,.065],C.frame);this.face(side,u,1.74,.23,[.045,1.75,.07],C.frame);}
      for(let i=0;i<5;i++)this.face(side,cen-1.7+i*.85,1.58,.25,[.085,2.25,.1],C.frame);
      this.face(side,cen,2.64,.24,[3.55,.12,.1],C.frame);
      this.awning(side,cen,4.1);
    }
    this.face('front',-2.5,3.15,.12,[3.8,.42,.14],C.cream);this.sign('CAFE','front',-2.5,3.15,.22,.047);
    // Warm pendant lights and table silhouettes visible in windows.
    for(const [side,u] of [['front',-3.35],['front',-1.65],['side',-.2],['side',1.45]] as const){this.face(side,u,2.28,.275,[.025,.42,.025],C.metal);this.face(side,u,2.01,.28,[.22,.18,.07],0xffcd6e);this.face(side,u,1.26,.27,[.56,.08,.05],C.wood);}
    // Bookshop glazing, panelled door and shop fascia.
    this.face('side',-3.54,1.55,.075,[3.8,2.45,.14],C.darkGreen);
    this.face('side',-4.09,1.63,.17,[2.4,1.9,.08],0x84703e);
    for(const z of [-5.3,-2.85,-1.72])this.face('side',z,1.65,.22,[.12,2.55,.14],C.darkGreen);
    this.face('side',-2.25,1.66,.18,[.85,2.15,.09],C.frame);this.face('side',-2.25,1.95,.24,[.59,1.15,.08],0x637052);this.face('side',-2.25,.84,.24,[.61,.58,.08],C.darkGreen);
    this.face('side',-3.54,2.95,.2,[4.10,.6,.18],C.darkGreen);this.sign('BOOKS','side',-3.54,2.98,.31,.053);
    for(let row=0;row<3;row++){const y=.91+row*.52;this.face('side',-4.08,y,.26,[2.3,.075,.08],C.wood);for(let i=0;i<17;i++){const h=.24+(i*7%4)*.045;this.face('side',-5.12+i*.13,y+h/2+.05,.24,[.085,h,.07],[0xb4773a,0xc6a35d,0x4c6756,0x81603e,0x997049][i%5]);}}
    this.face('side',-4.08,1.7,.3,[.075,1.9,.10],C.darkGreen);this.face('side',-4.08,.63,.3,[2.5,.22,.10],C.darkGreen);
    // Roof service boxes and chimney.
    this.box([-3.55,8.54,-.6],[.65,1,.65],0xc4ad91);this.box([-3.55,9.06,-.6],[.79,.12,.77],C.trim);this.cyl([-3.55,9.21,-.6],.11,.23,0x706961);
    this.box([-1.8,8.28,.7],[1.05,.5,.80],0xa89a86);this.box([-2.8,6.2,-4.30],[.87,.65,.85],0x9d9587);this.box([-2.8,6.55,-4.3],[.94,.08,.91],0xb1a799);this.cyl([-1.15,6.10,-4.6],.10,.5,0x6b6a61);this.cyl([-1.15,6.35,-4.6],.14,.08,0xb1a799);
    this.tree(-5.85,2.45,1.09);this.tree(.85,-5.0,.86);
    this.lamp(-4.88,4.0);this.lamp(1.2,-5.55);
    this.bench(.65,-2.9);
    this.cafeFurniture(-2.45,3.72);
    this.planter(.35,1.45,.28);this.planter(.35,-1.3,.23);
    // pavement menu board at the corner
    this.box([.38,.85,2.95],[.64,1.05,.09],C.wood,[0,0,-11]);this.box([.43,.88,2.99],[.51,.85,.06],0x233d35,[0,0,-11]);this.box([.0,.78,3.1],[.08,.95,.12],C.wood,[0,0,15]);
    this.car(-1.6,5.84,90,0x5c8ca7);this.car(4.52,-3.6,0,0xe6a632);
  }
  crown(p:V,s:V,c:number,seed:number){const pos:V[]=[],n=9,rings=5;const verts:V[][]=[];for(let j=0;j<=rings;j++){const a=Math.PI*j/rings,ring:V[]=[];for(let i=0;i<n;i++){const b=2*Math.PI*(i+(j%2)*.5)/n,irregular=1+.09*Math.sin(i*7+j*13+seed);ring.push([Math.sin(a)*Math.cos(b)*irregular,Math.cos(a),Math.sin(a)*Math.sin(b)*irregular]);}verts.push(ring);}for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=verts[j][i],b=verts[j][(i+1)%n],d=verts[j+1][i],e=verts[j+1][(i+1)%n];pos.push(a,b,d,b,e,d);}this.obj(mesh.triangleList({positions:pos}),c,p,s);}
  tree(x:number,z:number,k:number){this.box([x,.53,z],[1.05*k,.37,1.05*k],0xb6aa90);this.box([x,.735,z],[.88*k,.04,.88*k],C.soil);this.cyl([x,1.62*k,z],.105*k,2.0*k,0x715134);this.beam([x,1.7*k,z],[x-.45*k,2.8*k,z+.12],.055,0x715134);this.beam([x,1.9*k,z],[x+.36*k,2.95*k,z-.1],.055,0x715134);this.crown([x,3.22*k,z],[.92*k,1.30*k,.87*k],0x7e943b,3);this.crown([x-.49*k,2.96*k,z+.05],[.58*k,.86*k,.62*k],0x879b40,9);this.crown([x+.46*k,3.13*k,z-.05],[.58*k,.93*k,.57*k],0x84953a,14);}
  lamp(x:number,z:number){this.cyl([x,.41,z],.18,.14,C.metal);this.cyl([x,.67,z],.12,.48,C.metal);this.cyl([x,1.98,z],.055,2.55,C.metal);this.cyl([x,3.19,z],.11,.11,C.metal);this.box([x,3.46,z],[.28,.45,.28],0xffce79);for(const a of [-1,1])for(const b of [-1,1])this.beam([x+a*.11,3.21,z+b*.11],[x+a*.17,3.71,z+b*.17],.022,C.metal);this.obj(mesh.cone({radius:.29,depth:.20,segments:4}),C.metal,[x,3.80,z],[1,1,1],[0,45,0]);this.cyl([x,3.94,z],.045,.10,C.metal);}
  bench(x:number,z:number){for(let i=0;i<4;i++)this.box([x,.86,z-.70+i*.45],[.60,.09,.41],C.wood);for(let i=0;i<3;i++)this.box([x-.25,1.06+i*.16,z],[.09,.11,1.77],C.wood,[0,0,-8]);for(const a of [-.65,.65]){this.beam([x-.22,.37,z+a],[x-.22,1.4,z+a],.035,C.metal);this.beam([x+.23,.37,z+a],[x+.23,.95,z+a],.04,C.metal);this.box([x,.97,z+a],[.65,.055,.06],C.metal);}}
  cafeFurniture(x:number,z:number){this.cyl([x,.97,z],.38,.075,C.wood,[0,0,0],16);this.cyl([x,.65,z],.045,.58,C.metal);this.cyl([x,.38,z],.25,.05,C.metal);for(const dx of [-.69,.69]){this.box([x+dx,.72,z],[.41,.07,.40],C.wood);for(const a of [-1,1])for(const b of [-1,1])this.beam([x+dx+a*.16,.38,z+b*.15],[x+dx+a*.14,.72,z+b*.14],.022,C.metal);for(let j=0;j<3;j++)this.box([x+dx, .91+j*.1,z+.17],[.41,.075,.04],C.wood);}
    this.cyl([x,1.07,z],.09,.15,0xc4965f);this.crown([x,1.22,z],[.11,.16,.11],0x6b823e,8);
  }
  planter(x:number,z:number,r:number){this.cyl([x,.58,z],r,.45,0xc89d70);this.cyl([x,.81,z],r*1.1,.10,0xd6b086);this.cyl([x,.87,z],r*.88,.015,C.soil);for(let j=0;j<6;j++){const a=j*Math.PI/3;this.crown([x+Math.sin(a)*r*.62,1.02+j%2*.15,z+Math.cos(a)*r*.6],[.10,.26,.10],j%2?0x657d31:0x7e9438,j);}}
  car(x:number,z:number,angle:number,color:number){const rad=angle*Math.PI/180;const P=(p:V):V=>[x+Math.cos(rad)*p[0]+Math.sin(rad)*p[2],p[1]+.09,z-Math.sin(rad)*p[0]+Math.cos(rad)*p[2]];const B=(p:V,s:V,c:number,r:V=[0,0,0])=>this.box(P(p),s,c,[r[0],angle+r[1],r[2]]);
    B([0,.51,0],[1.23,.49,2.50],color);B([0,.77,.78],[1.21,.19,.88],color);B([0,.71,-1.02],[1.21,.16,.44],color);
    // Trapezoid cabin with sharply sloped windshield, made from a closed extrusion.
    const cabin=mesh.extrude({outline:[[-.78,.68],[.63,.68],[.39,1.34],[-.62,1.34]],depth:1.10});this.obj(cabin,color,P([-.55,0,0]),[1,1,1],[0,angle+90,0]);
    B([0,1.03,.53],[1.02,.49,.035],0x354342,[25,0,0]);B([0,1.03,-.70],[1.01,.44,.035],0x354342,[-15,0,0]);B([0,1.37,-.10],[1.13,.075,1.07],color);
    for(const side of [-1,1]){B([side*.565,1.03,-.1],[.035,.48,1.03],0x394947);B([side*.594,1.03,-.10],[.045,.49,.065],color);B([side*.61,.68,-.10],[.035,.035,.98],0x4f5350);B([side*.63,.82,.13],[.055,.05,.13],0xb8b6a6);B([side*.71,.9,.48],[.15,.12,.16],color);}
    for(const side of [-1,1])for(const zz of [-.78,.78]){this.cyl(P([side*.62,.36,zz]),.30,.16,0x272a28,[90,angle,90],12);this.cyl(P([side*.718,.36,zz]),.19,.02,0x929489,[90,angle,90],12);this.cyl(P([side*.733,.36,zz]),.12,.025,0x515652,[90,angle,90],12);}
    B([0,.33,1.28],[1.31,.12,.10],0xb5b2a2);B([0,.34,-1.28],[1.30,.11,.09],0xa9aaa0);B([0,.57,1.259],[.69,.24,.035],0x303d3a);for(let j=0;j<4;j++)B([0,.49+j*.045,1.283],[.67,.015,.018],0x9fa89d);for(const side of [-1,1]){B([side*.48,.58,1.27],[.19,.22,.055],0xffe2a3);B([side*.50,.59,-1.27],[.19,.17,.045],0xa84b33);}
  }
}
