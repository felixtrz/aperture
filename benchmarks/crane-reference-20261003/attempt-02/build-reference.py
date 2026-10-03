#!/usr/bin/env python3
"""Deterministic, engine-neutral crane courtyard. Run with Blender 4.3 background CPU.
Builder is withheld from independent authors; author-brief.md and manifest are shared.
"""
import bpy, math, json, sys, os, argparse, hashlib, shutil
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
BASE = dict(shoulder_deg=50.0, elbow_deg=-35.0, hoist_length=1.5,
            opening_width=1.6, pipe_bend_radius=0.8, top_tier_height=0.18,
            assembly_dx=0.0, assembly_dz=0.0, assembly_yaw_deg=0.0)
EDITS = {
 '01-shoulder': {'shoulder_deg':65.0},
 '02-elbow': {'elbow_deg':-60.0},
 '03-hoist': {'hoist_length':1.9},
 '04-opening': {'opening_width':2.1},
 '05-pipe-radius': {'pipe_bend_radius':1.1},
 '06-top-tier': {'top_tier_height':0.38},
 '07-assembly': {'assembly_dx':0.55,'assembly_dz':0.4,'assembly_yaw_deg':20.0},
}
CAMERAS = {
 'front-quarter': {'position':[8,6.5,10], 'target':[0,1.4,0], 'vertical_span':10.5},
 'rear-quarter': {'position':[-8,5,-9], 'target':[0,1.4,0], 'vertical_span':10.5},
 'high-oblique': {'position':[6,11,5], 'target':[0,1.4,0], 'vertical_span':10.5},
}
PALETTE = {
 'ground': ('#78868B',0.0,0.95), 'edge':('#56646D',0.0,0.88),
 'tier':('#405C70',0.05,0.72), 'tier-light':('#6D8694',0.05,0.72),
 'crane':('#E1A330',0.12,0.54), 'crane-light':('#F3C35C',0.08,0.58),
 'dark':('#263944',0.1,0.58), 'steel':('#A5B6C0',0.55,0.32),
 'pipe':('#367F82',0.12,0.58), 'pipe-inside':('#285458',0.05,0.73),
 'brick':('#B4775D',0.0,0.94), 'brick-alt':('#C78C6A',0.0,0.91),
 'cap':('#DBB18B',0.0,0.88), 'wood':('#AF7950',0.0,0.85),
 'wood-trim':('#E4BF85',0.0,0.85), 'lamp':('#FFE1A3',0.0,0.35),
}
P0=Vector((-2.15,1.25,0.15)); GROUND_PIVOT=Vector((-2.15,0,0.15))
MATS={}; PARAM={}; TAGS={}

def C(p): return Vector((p[0],-p[2],p[1]))
def I(p): return Vector((p[0],p[2],-p[1]))
def color(h):
 vals=[int(h[i:i+2],16)/255 for i in (1,3,5)]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)+(1,)
def group_point(p, group):
 p=Vector(p)
 if group=='crane': p.y+=PARAM['top_tier_height']-.18
 if group in ('crane','platform'):
  a=math.radians(PARAM['assembly_yaw_deg']); q=p-GROUND_PIVOT
  # Right-handed positive rotation about +Y: x'=cos(a)x+sin(a)z.
  p=GROUND_PIVOT+Vector((math.cos(a)*q.x+math.sin(a)*q.z,q.y,-math.sin(a)*q.x+math.cos(a)*q.z))
  p+=Vector((PARAM['assembly_dx'],0,PARAM['assembly_dz']))
 return p

def mesh(name,verts,faces,mat,group='static',meta=None,mi=None):
 me=bpy.data.meshes.new(name+'.mesh'); me.from_pydata([C(group_point(v,group)) for v in verts],[],faces); me.update()
 import bmesh
 bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 if bm.calc_volume(signed=True)<0: bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 bm.to_mesh(me); bm.free(); me.update()
 ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
 mats=mat if isinstance(mat,list) else [mat]
 for m in mats: me.materials.append(MATS[m])
 if mi:
  for f,idx in zip(me.polygons,mi): f.material_index=idx
 ob['semantic_group']=group
 TAGS[name]={'group':group, **(meta or {})}
 return ob

def box(name,center,size,mat,group='static'):
 c=Vector(center); x,y,z=[d/2 for d in size]
 v=[c+Vector((sx*x,sy*y,sz*z)) for sx,sy,sz in [(-1,-1,-1),(-1,-1,1),(-1,1,1),(-1,1,-1),(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)]]
 return mesh(name,v,[(0,1,2,3),(4,5,6,7),(0,4,7,1),(3,2,6,5),(0,3,5,4),(1,7,6,2)],mat,group)

def beam(name,a,b,width,depth,mat,group='crane'):
 a,b=Vector(a),Vector(b); u=(b-a).normalized(); v=Vector((-u.y,u.x,0)); w=Vector((0,0,1))
 vs=[p+v*s*width/2+w*t*depth/2 for p in (a,b) for s,t in [(-1,-1),(-1,1),(1,1),(1,-1)]]
 return mesh(name,vs,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,group,{'rings':4})

def basis(u):
 w=Vector((0,0,1))
 if abs(u.dot(w))>.95: w=Vector((0,1,0))
 v=u.cross(w).normalized(); w=u.cross(v).normalized(); return v,w

def cylinder(name,a,b,r,mat,group='static',n=12):
 a,b=Vector(a),Vector(b); u=(b-a).normalized(); v,w=basis(u)
 vs=[p+r*(math.cos(2*math.pi*i/n)*v+math.sin(2*math.pi*i/n)*w) for p in (a,b) for i in range(n)]
 fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return mesh(name,vs,fs,mat,group,{'rings':n})

def arc_tube(name,centers,normals,r,mat,group='crane',sides=8):
 vs=[]; fs=[]; bn=Vector((0,0,1))
 for c,n in zip(centers,normals):
  for j in range(sides): vs.append(Vector(c)+r*(math.cos(2*math.pi*j/sides)*Vector(n)+math.sin(2*math.pi*j/sides)*bn))
 for k in range(len(centers)-1):
  for j in range(sides): fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
 fs.extend([tuple(reversed(range(sides))),tuple((len(centers)-1)*sides+j for j in range(sides))])
 return mesh(name,vs,fs,mat,group,{'rings':sides,'ring_count':len(centers)})

def extrude(name,poly,z0,z1,mat):
 vs=[(x,y,z) for z in (z0,z1) for x,y in poly]; n=len(poly)
 fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return mesh(name,vs,fs,mat)

def crate(name,center,size,group='static'):
 c=Vector(center); x,y,z=size
 box(name+'.body',c,size,'wood',group)
 for i,xx in enumerate((c.x-x*.39,c.x+x*.39)):
  box(name+'.strap-front.'+str(i),(xx,c.y,c.z+z/2+.014),(x*.085,y+.035,.034),'wood-trim',group)
  box(name+'.strap-back.'+str(i),(xx,c.y,c.z-z/2-.014),(x*.085,y+.035,.034),'wood-trim',group)
  box(name+'.strap-top.'+str(i),(xx,c.y+y/2+.018,c.z),(x*.085,.035,z+.065),'wood-trim',group)


def build(params):
 global PARAM,TAGS,MATS
 PARAM=dict(params); TAGS={}
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
 for me in list(bpy.data.meshes):
  if me.users==0: bpy.data.meshes.remove(me)
 for ma in list(bpy.data.materials): bpy.data.materials.remove(ma)
 MATS={}
 for name,(h,metal,rough) in PALETTE.items():
  m=bpy.data.materials.new(name); m.diffuse_color=color(h); m.use_nodes=True
  bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=color(h); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
  if name=='lamp': bs.inputs['Emission Color'].default_value=color(h); bs.inputs['Emission Strength'].default_value=2
  MATS[name]=m
 box('courtyard.slab',(0,-.11,0),(7.9,.22,6),'ground')
 # Tier 1 top=.16, tier 2 top=.32, tier 3 top=.32+h.
 for name,bottom,h,sx,sz,ma in [('lower',0,.16,3.05,2.35,'edge'),('middle',.16,.16,2.72,2.02,'tier-light'),('upper',.32,PARAM['top_tier_height'],2.36,1.65,'tier')]:
  box('platform.'+name,(-2.15,bottom+h/2,.15),(sx,h,sz),ma,'platform')
 # Entire crane is attached to the top tier; base coordinates assume its baseline top=.5.
 box('crane.foot',(-2.15,.56,.15),(.86,.12,.8),'dark','crane')
 cylinder('crane.turntable',(-2.15,.62,.15),(-2.15,.77,.15),.36,'steel','crane',16)
 box('crane.pedestal',(-2.15,.98,.15),(.46,.46,.46),'crane','crane')
 box('crane.counterweight',(-2.52,1.02,.15),(.46,.34,.64),'dark','crane')
 theta=math.radians(PARAM['shoulder_deg']); phi=math.radians(PARAM['elbow_deg'])
 u=Vector((math.cos(theta),math.sin(theta),0)); v=Vector((math.cos(theta+phi),math.sin(theta+phi),0))
 P=P0.copy(); E=P+2.6*u; T=E+1.7*v
 beam('crane.boom.lower',P,E,.30,.36,'crane')
 beam('crane.boom.upper',E,T,.24,.29,'crane-light')
 for name,q,rr,ll in [('shoulder',P,.225,.68),('elbow',E,.175,.57),('tip',T,.135,.46)]:
  cylinder('crane.pin.'+name,q+Vector((0,0,-ll/2)),q+Vector((0,0,ll/2)),rr,'dark','crane')
  cylinder('crane.pin-cap.'+name,q+Vector((0,0,ll/2)),q+Vector((0,0,ll/2+.045)),rr*.54,'steel','crane')
 A=P+Vector((.50,-.35,.30)); B=P+.90*u+Vector((0,0,.30)); axis=(B-A).normalized(); body_end=A+.64*axis
 box('crane.hydraulic-mount',A,(.25,.20,.20),'crane','crane')
 cylinder('crane.hydraulic.body',A,body_end,.090,'dark','crane')
 cylinder('crane.hydraulic.rod',body_end-.12*axis,B,.043,'steel','crane')
 for name,q in [('base',A),('boom',B)]: cylinder('crane.hydraulic.eye.'+name,q+Vector((0,0,-.12)),q+Vector((0,0,.12)),.113,'crane-light','crane')
 H=T-Vector((0,PARAM['hoist_length'],0))
 cylinder('crane.hoist.cable',T,H,.025,'dark','crane',8)
 angles=[math.radians(90+270*i/18) for i in range(19)]
 center=H-Vector((0,.17,0)); ns=[Vector((math.cos(a),math.sin(a),0)) for a in angles]
 arc_tube('crane.hook',[center+.17*n for n in ns],ns,.045,'steel')
 sling=H-Vector((0,.30,0)); load_center=H-Vector((0,.83,0))
 crate('crane.load',load_center,(1.0,.5,.72),'crane')
 for i,(dx,dz) in enumerate([(-.39,-.27),(-.39,.27),(.39,-.27),(.39,.27)]):
  cylinder('crane.sling.'+str(i),sling,H+Vector((dx,-.562,dz)),.018,'dark','crane',8)
 # An explicit semicircular void through the full wall thickness: piers, voussoirs, spandrel strips.
 cx=1.20; spring=1.1; r=PARAM['opening_width']/2; ro=r+.20; left=-.60; right=3.0; top=2.6; z0=-2.20; z1=-1.90
 for side,lo,hi in [('left',left,cx-r),('right',cx+r,right)]:
  box('wall.pier.'+side,((lo+hi)/2,spring/2,(z0+z1)/2),(hi-lo,spring,z1-z0),'brick')
 for side,lo,hi in [('left',left,cx-ro),('right',cx+ro,right)]:
  box('wall.upper-side.'+side,((lo+hi)/2,(spring+top)/2,(z0+z1)/2),(hi-lo,top-spring,z1-z0),'brick')
 for i in range(12):
  a=math.pi-i*math.pi/12; b=math.pi-(i+1)*math.pi/12
  inn=[(cx+r*math.cos(t),spring+r*math.sin(t)) for t in (a,b)]
  outer=[(cx+ro*math.cos(t),spring+ro*math.sin(t)) for t in (a,b)]
  extrude('wall.arch.%02d'%i,[inn[0],inn[1],outer[1],outer[0]],z0-.012,z1+.012,'brick-alt' if i%2 else 'cap')
  extrude('wall.spandrel.%02d'%i,[outer[0],outer[1],(outer[1][0],top),(outer[0][0],top)],z0,z1,'brick')
 box('wall.cap',(1.2,2.66,-2.05),(3.78,.12,.42),'cap')
 box('wall.lamp.backplate',(2.61,1.76,-1.85),(.22,.30,.06),'dark')
 box('wall.lamp.diffuser',(2.61,1.76,-1.795),(.14,.20,.055),'lamp')
 # Hollow pipe, explicit separate inner and outer shells, only annular end rims.
 O=Vector((.85,.24,1.72)); R=PARAM['pipe_bend_radius']; nr=13; ns=12; rout=.24; rin=.175
 vs=[]
 for rad in (rout,rin):
  for i in range(nr):
   t=math.pi*.5*i/(nr-1); c=O+Vector((R*math.sin(t),R*(1-math.cos(t)),0)); n=Vector((-math.sin(t),math.cos(t),0)); w=Vector((0,0,1))
   for j in range(ns): vs.append(c+rad*(math.cos(2*math.pi*j/ns)*n+math.sin(2*math.pi*j/ns)*w))
 faces=[]; indices=[]; off=nr*ns
 for layer in (0,1):
  for i in range(nr-1):
   for j in range(ns):
    a=layer*off+i*ns+j; b=layer*off+i*ns+(j+1)%ns; f=(a,b,b+ns,a+ns)
    faces.append(f if layer==0 else tuple(reversed(f))); indices.append(layer)
 for k in (0,nr-1):
  for j in range(ns):
   a=k*ns+j; b=k*ns+(j+1)%ns; faces.append((a,a+off,b+off,b) if k==0 else (a,b,b+off,a+off)); indices.append(0)
 mesh('pipe.hollow-elbow',vs,faces,['pipe','pipe-inside'],meta={'rings':ns,'ring_count':nr,'outer_vertex_count':off},mi=indices)
 crate('prop.crate',(2.92,.32,.58),(.66,.64,.64))
 cylinder('prop.drum.body',(-3.16,0,2.05),(-3.16,.69,2.05),.29,'pipe',12)
 for k,y in enumerate((.10,.59)): cylinder('prop.drum.band.'+str(k),(-3.16,y-.025,2.05),(-3.16,y+.025,2.05),.307,'steel',12)
 cylinder('prop.bollard',(3.24,0,-1.12),(3.24,.65,-1.12),.105,'crane',8)
 cylinder('prop.bollard.cap',(3.24,.55,-1.12),(3.24,.64,-1.12),.113,'dark',8)
 configure_scene()
 bpy.context.view_layer.update()
 return dict(P=group_point(P,'crane'),E=group_point(E,'crane'),T=group_point(T,'crane'),H=group_point(H,'crane'),A=group_point(A,'crane'),B=group_point(B,'crane'))

def configure_scene():
 scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=64; scene.cycles.use_denoising=False; scene.cycles.seed=314159; scene.cycles.use_animated_seed=False
 scene.cycles.max_bounces=6; scene.cycles.diffuse_bounces=3; scene.cycles.glossy_bounces=3; scene.cycles.transmission_bounces=2
 scene.render.resolution_x=1024; scene.render.resolution_y=1024; scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'; scene.render.image_settings.color_depth='8'; scene.render.film_transparent=False
 scene.render.threads_mode='FIXED'; scene.render.threads=8
 scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'; scene.view_settings.exposure=0; scene.view_settings.gamma=1
 scene.world=bpy.data.worlds.new('Courtyard world'); scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.42,.54,.66,1); scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
 def light(name,kind,pos,target,energy,rgb,size):
  d=bpy.data.lights.new(name,kind); ob=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(ob); ob.location=C(pos); d.energy=energy; d.color=rgb
  if kind=='SUN': d.angle=size
  elif kind=='AREA': d.shape='DISK'; d.size=size
  else: d.shadow_soft_size=size
  ob.rotation_euler=(C(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 light('lighting.sun','SUN',(-4,7,5),(0,0,0),2.2,(1,.89,.72),.09)
 light('lighting.fill','AREA',(3,6,-4),(0,1,0),350,(.67,.80,1),7)
 light('lighting.arch-lamp','POINT',(2.61,1.76,-1.69),(0,0,0),18,(1,.55,.22),.12)
 for name,spec in CAMERAS.items():
  d=bpy.data.cameras.new('camera.'+name); ob=bpy.data.objects.new('camera.'+name,d); bpy.context.collection.objects.link(ob); ob.location=C(spec['position']); ob.rotation_euler=(C(spec['target'])-ob.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=spec['vertical_span']; d.clip_start=.1; d.clip_end=100
 scene.camera=bpy.data.objects['camera.front-quarter']


def coords(name):
 ob=bpy.data.objects[name]
 return [I(ob.matrix_world@v.co) for v in ob.data.vertices]
def avg(vs): return sum(vs,Vector())/len(vs)
def ends(name):
 vs=coords(name); n=TAGS[name]['rings']; return avg(vs[:n]),avg(vs[n:n*2])
def bounds(name):
 vs=coords(name); return [min(v[i] for v in vs) for i in range(3)],[max(v[i] for v in vs) for i in range(3)]
def arr(v): return [round(float(x),9) for x in v]
def measured():
 p,e=ends('crane.boom.lower'); e2,t=ends('crane.boom.upper'); cable_t,h=ends('crane.hoist.cable'); a,be=ends('crane.hydraulic.body'); rs,b=ends('crane.hydraulic.rod')
 pipe=coords('pipe.hollow-elbow'); tag=TAGS['pipe.hollow-elbow']; n=tag['rings']; count=tag['ring_count']; off=tag['outer_vertex_count']; centers=[avg(pipe[i*n:(i+1)*n]) for i in range(count)]
 arch=[coords('wall.arch.%02d'%i) for i in range(12)]
 return dict(shoulder=arr(p),elbow=arr(e),upper_start=arr(e2),tip=arr(t),cable_top=arr(cable_t),hook_top=arr(h),hydraulic_base=arr(a),hydraulic_body_end=arr(be),hydraulic_rod_start=arr(rs),hydraulic_rod_end=arr(b),pipe_centers=[arr(c) for c in centers],pipe_outer_radius=max((v-centers[0]).length for v in pipe[:n]),pipe_inner_radius=max((v-centers[0]).length for v in pipe[off:off+n]),opening_left=arch[0][0].x,opening_right=arch[-1][1].x,opening_spring=arch[0][0].y,opening_apex=max(v[0].y for v in arch),load_bounds=bounds('crane.load.body'),tier_bounds={name:bounds('platform.'+name) for name in ('lower','middle','upper')},object_bounds={n:bounds(n) for n in sorted(TAGS)},objects={n:[arr(v) for v in coords(n)] for n in sorted(TAGS)})

def verify(name,p,base=None):
 m=measured(); checks=[]
 def chk(label,error,tol=2e-5):
  error=float(error); checks.append(dict(name=label,error=error,tolerance=tol,passed=error<=tol))
 def vec(k): return Vector(m[k])
 P,E,T,H,A,B=[vec(k) for k in ('shoulder','elbow','tip','hook_top','hydraulic_base','hydraulic_rod_end')]
 chk('lower boom length from end-face centroids',abs((E-P).length-2.6)); chk('upper boom length from end-face centroids',abs((T-E).length-1.7)); chk('articulated joint coincidence',(E-vec('upper_start')).length); chk('hoist tip attachment',(T-vec('cable_top')).length)
 chk('world vertical cable',math.hypot(T.x-H.x,T.z-H.z)); chk('hoist length',abs((T-H).length-p['hoist_length']))
 chk('hydraulic base mount', (A-group_point(P0+Vector((.5,-.35,.3)),'crane')).length)
 u=(E-P).normalized(); yaw=math.radians(p['assembly_yaw_deg']); side=Vector((math.sin(yaw)*.3,0,math.cos(yaw)*.3))
 chk('hydraulic rod attached to lower boom', (B-(P+.9*u+side)).length)
 axis=(B-A).normalized(); be=vec('hydraulic_body_end'); rs=vec('hydraulic_rod_start')
 chk('hydraulic coaxiality',(be-A).cross(axis).length+(rs-A).cross(axis).length); chk('hydraulic body length',abs((be-A).length-.64)); chk('hydraulic overlap',abs((be-rs).dot(axis)-.12))
 chk('opening width from actual inner jamb vertices',abs(m['opening_right']-m['opening_left']-p['opening_width'])); chk('opening apex from actual arch vertices',abs(m['opening_apex']-(1.1+p['opening_width']/2)))
 centers=[Vector(v) for v in m['pipe_centers']]; delta=centers[-1]-centers[0]
 chk('pipe end center relation',(delta-Vector((p['pipe_bend_radius'],p['pipe_bend_radius'],0))).length); chk('pipe outer radius',abs(m['pipe_outer_radius']-.24)); chk('pipe wall thickness',abs(m['pipe_outer_radius']-m['pipe_inner_radius']-.065))
 # A ray through the open bore and a ray through the arch must hit no relevant geometry.
 from mathutils.bvhtree import BVHTree
 wall=[ob for ob in bpy.context.scene.objects if ob.type=='MESH' and ob.name.startswith('wall.') and not ob.name.startswith('wall.lamp')]
 wall_hits=[]
 for ob in wall:
  tree=BVHTree.FromObject(ob,bpy.context.evaluated_depsgraph_get()); origin=C((1.2,.55,-3)); direction=C((0,0,1)); hit=tree.ray_cast(origin,direction,2)
  if hit[0] is not None: wall_hits.append(ob.name)
 chk('arch through-opening ray clear',len(wall_hits),0)
 ob=bpy.data.objects['pipe.hollow-elbow']; tree=BVHTree.FromObject(ob,bpy.context.evaluated_depsgraph_get())
 hit=tree.ray_cast(C(centers[0]-Vector((.1,0,0))),C((1,0,0)),.18)
 chk('pipe inlet bore ray clear',int(hit[0] is not None),0)
 # Every mesh is closed, consistently outward-oriented, and has nonzero polygons.
 import bmesh
 boundary=0; degenerate=0; negative=0
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH': continue
  bm=bmesh.new(); bm.from_mesh(ob.data); boundary+=sum(not e.is_manifold for e in bm.edges); degenerate+=sum(f.calc_area()<1e-10 for f in bm.faces); negative+=int(bm.calc_volume(signed=True)<-1e-8); bm.free()
 chk('closed two-manifold mesh edges',boundary,0); chk('nondegenerate mesh faces',degenerate,0); chk('positive signed mesh volumes',negative,0)
 from bpy_extras.object_utils import world_to_camera_view
 crop=0
 for cam_name in CAMERAS:
  cam=bpy.data.objects['camera.'+cam_name]
  for ob in bpy.context.scene.objects:
   if ob.type!='MESH': continue
   for v in ob.data.vertices:
    q=world_to_camera_view(bpy.context.scene,cam,ob.matrix_world@v.co)
    crop+=int(q.x<.025 or q.x>.975 or q.y<.025 or q.y>.975)
 chk('all scene vertices inside all cameras with 2.5 percent border',crop,0)
 if base:
  b=base; changing=set()
  if name in ('01-shoulder','02-elbow','03-hoist','06-top-tier','07-assembly'): changing|={n for n in TAGS if TAGS[n]['group']=='crane'}
  if name=='07-assembly': changing|={n for n in TAGS if TAGS[n]['group']=='platform'}
  if name=='06-top-tier': changing.add('platform.upper')
  if name=='04-opening': changing|={n for n in TAGS if n.startswith('wall.') and n!='wall.cap' and not n.startswith('wall.lamp')}
  if name=='05-pipe-radius': changing.add('pipe.hollow-elbow')
  frozen=[n for n in TAGS if n not in changing]; error=max((Vector(v)-Vector(w)).length for n in frozen for v,w in zip(m['objects'][n],b['objects'][n]))
  chk('unaffected geometry preserved vertex for vertex',error)
  if name=='01-shoulder':
   angle=math.degrees(math.atan2(E.y-P.y,E.x-P.x)); chk('actual lower boom angle',abs(angle-65))
  elif name=='02-elbow':
   delta_angle=math.degrees(math.atan2(T.y-E.y,T.x-E.x)-math.atan2(E.y-P.y,E.x-P.x)); chk('actual relative elbow angle',abs(delta_angle+60)); chk('shoulder pivot unmoved',(P-Vector(b['shoulder'])).length); chk('first elbow unmoved',(E-Vector(b['elbow'])).length)
  elif name=='03-hoist':
   for key in ('hook_top',): chk('hook translates exactly down 0.4',(vec(key)-Vector(b[key])-Vector((0,-.4,0))).length)
   chk('load translates exactly down 0.4',max((Vector(v)-Vector(w)-Vector((0,-.4,0))).length for v,w in zip(m['objects']['crane.load.body'],b['objects']['crane.load.body'])))
  elif name=='04-opening':
   chk('jambs move symmetrically',abs((m['opening_left']+m['opening_right'])/2-1.2)); chk('spring height held',abs(m['opening_spring']-1.1))
  elif name=='05-pipe-radius': chk('pipe origin held',(centers[0]-Vector(b['pipe_centers'][0])).length)
  elif name=='06-top-tier':
   err=max((Vector(v)-Vector(w)-Vector((0,.2,0))).length for n in TAGS if TAGS[n]['group']=='crane' for v,w in zip(m['objects'][n],b['objects'][n])); chk('entire crane follows top by 0.2',err); chk('tier underside held',abs(m['tier_bounds']['upper'][0][1]-.32))
  elif name=='07-assembly':
   err=max((Vector(v)-group_point(w,'platform')).length for n in TAGS if TAGS[n]['group'] in ('crane','platform') for v,w in zip(m['objects'][n],b['objects'][n])); chk('every assembly vertex follows one rigid transform',err)
 return {'case':name,'parameters':p,'passed':all(c['passed'] for c in checks),'checks':checks,'measurements':{k:v for k,v in m.items() if k!='objects'}},m

def manifest(m):
 scene=bpy.context.scene; meshes=[ob for ob in scene.objects if ob.type=='MESH']; parts=[]
 for ob in meshes:
  ob.data.calc_loop_triangles(); parts.append(dict(name=ob.name,group=TAGS[ob.name]['group'],vertices=len(ob.data.vertices),triangles=len(ob.data.loop_triangles),bounds=m['object_bounds'][ob.name]))
 return {'schema':'aperture.crane-reference.v1','status':'local reference, not a scored benchmark','units':'metres','canonical_axes':{'up':'+Y','front':'+Z','right':'+X','handedness':'right','blender_conversion':'(x,y,z) -> (x,-z,y)'},'seed':314159,'blender_version':bpy.app.version_string,'renderer':{'engine':'Cycles','device':'CPU','samples':64,'denoise':False,'size':[1024,1024],'view_transform':'AgX','look':'AgX - Medium High Contrast'},'parameters':BASE,'edits':EDITS,'cameras':CAMERAS,'palette':{k:{'srgb':v[0],'metallic':v[1],'roughness':v[2]} for k,v in PALETTE.items()},'lighting':{'world':{'linear_rgb':[.42,.54,.66],'strength':.35},'sun':{'position':[-4,7,5],'target':[0,0,0],'energy':2.2,'linear_rgb':[1,.89,.72],'angular_diameter_radians':.09},'area_fill':{'position':[3,6,-4],'target':[0,1,0],'power_watts':350,'size_metres':7,'linear_rgb':[.67,.80,1]},'arch_point':{'position':[2.61,1.76,-1.69],'power_watts':18,'radius':.12,'linear_rgb':[1,.55,.22]},'note':'Blender energy units are reference metadata; authors should preserve light direction, relative warmth and visible relationships rather than assume cross-engine photometric identity.'},'parts':sorted(parts,key=lambda x:x['name']),'mesh_count':len(meshes),'triangles':sum(x['triangles'] for x in parts),'base_measurements':{k:v for k,v in m.items() if k not in ('objects','object_bounds')},'author_boundary':{'share':['author-brief.md','scene-manifest.json','reference-front-quarter.png','reference-rear-quarter.png','reference-high-oblique.png'],'withhold':['build-reference.py'],'policy':'Authors independently reconstruct geometry; no supplied constructor replay. Real scene/GLB are retained reference evidence, not author starting assets.'},'limitations':['Kinematic construction only; no structural engineering, load, collision, rigging or physical-simulation claim.','Procedural palette only; no textures or downloaded assets.','GLB retains mesh/material/cameras/punctual lights; Blender world, area light and AgX look are not fully represented by core glTF.','Render files are deterministic settings, not a cross-machine byte-identical pixel guarantee.']}

def dump(name,obj): (OUT/name).write_text(json.dumps(obj,indent=2,sort_keys=True)+'\n')
def run():
 parser=argparse.ArgumentParser(); parser.add_argument('--mode',choices=['full','audit','import-check'],default='full'); parser.add_argument('--only-camera'); args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 if shutil.disk_usage(OUT).free<2*1024**3: raise RuntimeError('Refuse large writes below 2 GiB free')
 if not os.environ.get('APERTURE_TMP_RUN'): raise RuntimeError('Run through reviewed cleanup.py run lifecycle')
 bpy.context.preferences.filepaths.temporary_directory=os.environ['APERTURE_TMP_RUN']; bpy.context.preferences.filepaths.save_version=0
 if args.mode=='import-check':
  bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.ops.import_scene.gltf(filepath=str(OUT/'crane-courtyard.glb'))
  manifest_data=json.loads((OUT/'scene-manifest.json').read_text()); names={ob.name for ob in bpy.context.scene.objects if ob.type=='MESH'}; expected={p['name'] for p in manifest_data['parts']}
  report={'blender_version':bpy.app.version_string,'mesh_count':len(names),'missing_meshes':sorted(expected-names),'extra_meshes':sorted(names-expected),'bounds_errors':{}}
  for part in manifest_data['parts']:
   if part['name'] not in names: continue
   lo,hi=bounds(part['name']); exp=part['bounds']; report['bounds_errors'][part['name']]=max(abs(lo[i]-exp[0][i]) for i in range(3))+max(abs(hi[i]-exp[1][i]) for i in range(3))
  report['passed']=not report['missing_meshes'] and not report['extra_meshes'] and max(report['bounds_errors'].values())<1e-5; dump('glb-import-audit.json',report); print('GLB_IMPORT_AUDIT',json.dumps(report),flush=True); return
 build(BASE); report,base=verify('baseline',BASE); dump('baseline-audit.json',report); dump('scene-manifest.json',manifest(base))
 if args.mode=='full':
  bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'crane-courtyard.blend'))
  bpy.ops.export_scene.gltf(filepath=str(OUT/'crane-courtyard.glb'),export_format='GLB',export_cameras=True,export_lights=True,export_extras=True,export_yup=True)
  for camera in ([args.only_camera] if args.only_camera else CAMERAS):
   bpy.context.scene.camera=bpy.data.objects['camera.'+camera]; bpy.context.scene.render.filepath=str(OUT/('reference-'+camera+'.png')); bpy.ops.render.render(write_still=True); print('REFERENCE_RENDER_READY',camera,flush=True)
 audits=[report]
 for name,edit in EDITS.items():
  p={**BASE,**edit}; build(p); r,m=verify(name,p,base); audits.append(r); print('GEOMETRY_AUDIT',name,r['passed'],flush=True)
 dump('edit-audits.json',{'passed':all(a['passed'] for a in audits),'cases':audits})
 print('REFERENCE_COMPLETE',json.dumps({'all_geometry_passed':all(a['passed'] for a in audits),'output':str(OUT)}),flush=True)
 if not all(a['passed'] for a in audits):
  print('FAILED_CHECKS',json.dumps([{ 'case':a['case'],'checks':[c for c in a['checks'] if not c['passed']]} for a in audits if not a['passed']]),flush=True)
  raise RuntimeError('Geometry checks failed; inspect retained audits')
if __name__=='__main__': run()
