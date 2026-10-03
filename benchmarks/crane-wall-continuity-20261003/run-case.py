"""Seven-attempt extension. No launch except lifecycle-wrapped runVerifiedScene."""
from pathlib import Path
import sys,json,hashlib,shutil,subprocess,os,datetime
base=Path(__file__).resolve().parent;repo=base.parents[1]
cases=json.loads((base/'cases.json').read_text());cid=sys.argv[1];case=next(c for c in cases if c['id']==cid)
runtime=json.loads((base/'runtime-pins.json').read_text());protected=json.loads((base/'protected-pins.json').read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pins():return {'runtime':{p:digest(repo/p) for p in runtime},'protected':{p:digest(repo/p) for p in protected},'case':{p.name:digest(p) for p in sorted((base/'sources'/cid).iterdir()) if p.is_file()},'driver':{p.name:digest(p) for p in [base/'run.mjs',base/'run-case.py',base/'geometry-guards.py',base/'export-cpu.mjs',base/'cpu'/f'{cid}.json']}}
free=shutil.disk_usage(repo).free
if free<2147483648:raise RuntimeError('Below 2 GiB; no new writes')
before=pins();assert before['runtime']==runtime and before['protected']==protected,'Protected or runtime drift';assert before['case']==case['source_sha256']
preflight=json.loads((base/'cpu-geometry-guards.json').read_text());assert len(preflight)==7 and any(c['case']==cid for c in preflight)
existing=sorted(base.glob('attempt-*-before.json'));assert len(existing)<7,'Seven-attempt cap exhausted';attempt=f'attempt-{len(existing)+1:03}'
(base/f'{attempt}-before.json').write_text(json.dumps({'attempt':attempt,'case':cid,'case_spec':case,'free_bytes':free,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':before},indent=2)+'\n')
for p in [base/'run.mjs',*(base/'sources'/cid).glob('*.mjs')]:subprocess.run(['node','--check',str(p)],check=True,cwd=repo)
env=os.environ.copy();env['APERTURE_WEBGPU_RUNTIME']=str(repo/'.aperture-env/render-runtime')
cmd=[sys.executable,'-B',str(repo/'tools/recovery/runtime_pressure.py'),'--root','/workspace/scratch/0190a8c72f8a/aperture-tmp','--audit-dir',str(base/'lifecycle-audits'),'run','--job',f'crane-continuity-{attempt}-{cid}','--recreation','Regenerate disposable pinned browser only; retained continuity source and evidence outside disposable root','--','node',str(base/'run.mjs'),cid,attempt]
print(json.dumps({'attempt':attempt,'case':cid,'free_before':free}),flush=True)
with (base/f'{attempt}.log').open('x') as out:rc=subprocess.run(cmd,cwd=repo,env=env,stdout=out,stderr=subprocess.STDOUT).returncode
free_after=shutil.disk_usage(repo).free
if free_after<2147483648:raise RuntimeError('Below 2 GiB after render; no new writes')
after=pins();rp=base/'renders'/attempt/'result.json';report=json.loads(rp.read_text()) if rp.exists() else {};png=base/'renders'/attempt/'render.png'
summary={'attempt':attempt,'case':cid,'exitcode':rc,'status':report.get('status'),'proof':report.get('proof'),'free_before':free,'free_after':free_after,'pins_unchanged':before==after,'png_sha256':digest(png) if png.exists() else None}
(base/f'{attempt}-after.json').write_text(json.dumps({'summary':summary,'pins':after},indent=2)+'\n');(base/f'{attempt}-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary),flush=True)
assert before==after and rc==0 and report.get('status')=='passed','Preserve failed attempt and reconcile'
with (base/f'{attempt}-geometry.log').open('x') as out:guard=subprocess.run([sys.executable,'-B',str(base/'geometry-guards.py'),cid,attempt],cwd=repo,stdout=out,stderr=subprocess.STDOUT)
assert guard.returncode==0,'Native equivalence guard failed; stop and reconcile'
print(json.dumps({'attempt':attempt,'native_equivalence':'passed'}),flush=True)
