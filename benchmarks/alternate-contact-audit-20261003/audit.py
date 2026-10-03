"""Offline world-space audit of retained native mesh bytes. No renderer or source edits."""
import collections, copy, hashlib, json, math, pathlib, sys, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
TOL=2e-5

def world(mesh):
    m=mesh.get('worldMatrix',mesh.get('matrix'));assert len(m)==16
    p=mesh['positions'];assert len(p)%3==0
    return [[sum(m[i+4*j]*p[k+j] for j in range(3))+m[12+i] for i in range(3)] for k in range(0,len(p),3)]
def bounds(points):return [(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)]
def unyaw(points,p):
    a=math.radians(p['assembly_yaw_deg']);c,s=math.cos(a),math.sin(a)
    return [[-2.15+c*(v[0]+2.15-p['assembly_dx'])-s*(v[2]-.15-p['assembly_dz']),v[1],.15+s*(v[0]+2.15-p['assembly_dx'])+c*(v[2]-.15-p['assembly_dz'])] for v in points]
def box_topology(mesh,p):
    ps=unyaw(world(mesh),p);b=bounds(ps);ids=mesh['indices'] or list(range(len(ps)));assert len(ids)%3==0
    weld=[tuple(round(v,5) for v in x) for x in ps];edges=collections.Counter();face_area=collections.defaultdict(float)
    for k in range(0,len(ids),3):
        tri=[ps[i] for i in ids[k:k+3]];keys=[weld[i] for i in ids[k:k+3]]
        for i in range(3):edges[tuple(sorted((keys[i],keys[(i+1)%3])))]+=1
        u=[tri[1][i]-tri[0][i] for i in range(3)];v=[tri[2][i]-tri[0][i] for i in range(3)];area=math.sqrt(sum(x*x for x in [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]))/2
        planes=[(axis,side) for axis in range(3) for side in range(2) if all(abs(q[axis]-b[axis][side])<TOL for q in tri)]
        if len(planes)!=1 or area<=TOL:return {'ok':False,'reason':'non-box or degenerate triangle'}
        face_area[planes[0]]+=area
    expected={(axis,side):math.prod(b[j][1]-b[j][0] for j in range(3) if j!=axis) for axis in range(3) for side in range(2)}
    return {'ok':len(set(weld))==8 and all(n==2 for n in edges.values()) and all(abs(face_area[k]-a)<TOL for k,a in expected.items()),'uniqueCorners':len(set(weld)),'closedWeldedEdges':all(n==2 for n in edges.values()),'faceAreaErrors':{str(k):abs(face_area[k]-a) for k,a in expected.items()},'assemblyLocalBounds':b}
def tier_contact(lower,upper,p):
    a=bounds(unyaw(world(lower),p));b=bounds(unyaw(world(upper),p));gap=b[1][0]-a[1][1];ledges=[b[i][0]-a[i][0] for i in (0,2)]+[a[i][1]-b[i][1] for i in (0,2)]
    return {'ok':abs(gap)<TOL and min(ledges)>TOL,'verticalGap':gap,'exposedLedges':ledges}
def separation(first,second):
    a,b=bounds(first),bounds(second);gaps=[max(b[i][0]-a[i][1],a[i][0]-b[i][1]) for i in range(3)];return {'provenDisjoint':max(gaps)>TOL,'worldAxisGaps':gaps,'clearanceLowerBound':max(0,*gaps),'scope':'Positive projection gap proves disjoint surfaces/volumes; lower bound, not exact closest-point distance'}
def inspect(record):
    e=record['evidence'];p=e['parameters'];meshes={m['name']:m for m in e['nativeGeometry']['meshes']};tiers=[meshes['platform.'+n] for n in ('lower','middle','upper')];pipe=[v for name,m in meshes.items() if name.startswith('pipe.hollow-elbow') for v in world(m)];platform=[v for m in tiers for v in world(m)]
    return {'engine':record['engine'],'state':record['state'],'tiers':{m['name']:box_topology(m,p) for m in tiers},'contacts':[tier_contact(a,b,p) for a,b in zip(tiers,tiers[1:])],'pipePlatform':separation(pipe,platform),'limits':['Only eight retained endpoint captures; no temporal or global collision claim','Hook and hidden hydraulic-contact topology remain outside this audit','No engine performance, score or image-quality claim']}
class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records=[json.loads(f.read_text()) for f in sorted((ROOT/'benchmarks/crane-alternate-views-20261003/renders').glob('*/*/attempt-001/states/*.json'))]
    def test_eight_native_captures(self):self.assertEqual(len(self.records),8)
    def test_actual_tiers_closed_and_touching(self):
        for r in self.records:
            with self.subTest(engine=r['engine'],state=r['state']['id']):
                j=inspect(r);self.assertTrue(all(x['ok'] for x in j['tiers'].values()));self.assertTrue(all(x['ok'] for x in j['contacts']))
    def test_pipe_separation(self):
        for r in self.records:self.assertTrue(inspect(r)['pipePlatform']['provenDisjoint'])
    def test_injected_gap_fails(self):
        for original in self.records:
            r=copy.deepcopy(original);m=next(x for x in r['evidence']['nativeGeometry']['meshes'] if x['name']=='platform.upper');m['worldMatrix'][13]+=.02;self.assertFalse(inspect(r)['contacts'][1]['ok'])
    def test_missing_face_fails(self):
        for original in self.records:
            r=copy.deepcopy(original);m=next(x for x in r['evidence']['nativeGeometry']['meshes'] if x['name']=='platform.upper')
            if m['indices']:m['indices']=m['indices'][6:]
            else:m['positions']=m['positions'][18:]
            self.assertFalse(inspect(r)['tiers']['platform.upper']['ok'])
    def test_overlapping_boxes_not_declared_separate(self):self.assertFalse(separation([[0,0,0],[1,1,1]],[[.5,.5,.5],[2,2,2]])['provenDisjoint'])
    def test_known_axis_clearance(self):self.assertEqual(separation([[0,0,0],[1,1,1]],[[3,0,0],[4,1,1]])['clearanceLowerBound'],2)
if __name__=='__main__':
    if '--test' in sys.argv:unittest.main(argv=[sys.argv[0]],verbosity=2)
    else:
        files=sorted((ROOT/'benchmarks/crane-alternate-views-20261003/renders').glob('*/*/attempt-001/states/*.json'));out={'scope':'Offline geometry audit from actual native submitted mesh positions, indices and world transforms','tolerance':TOL,'cases':[{'path':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),**inspect(json.loads(f.read_text()))} for f in files]};out['status']='passed' if len(out['cases'])==8 and all(all(t['ok'] for t in x['tiers'].values()) and all(t['ok'] for t in x['contacts']) and x['pipePlatform']['provenDisjoint'] for x in out['cases']) else 'failed';pathlib.Path(__file__).with_name('RESULT.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':out['status'],'cases':len(out['cases']),'pipeLowerBounds':[x['pipePlatform']['clearanceLowerBound'] for x in out['cases']]}));sys.exit(out['status']!='passed')
