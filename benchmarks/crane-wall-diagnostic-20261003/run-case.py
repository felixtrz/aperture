"""Bounded, fail-closed driver. The browser route is exclusively wrapped runVerifiedScene."""
import sys,pathlib,json,hashlib,shutil,subprocess,os,datetime
base=pathlib.Path(__file__).resolve().parent;repo=base.parents[1];original=repo/'benchmarks/crane-comparison-20261003'
case_id=sys.argv[1];cases=json.loads((base/'cases.json').read_text());case=next(c for c in cases if c['id']==case_id)
expected=json.loads((base/'runtime-pins.json').read_text());frozen=json.loads((base/'frozen-source-pins.json').read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pins():
 return {'runtime':{p:digest(repo/p) for p in expected},'frozen':{e:{p.name:digest(p) for p in sorted((original/f'author-{e}/v2').iterdir()) if p.is_file()} for e in frozen},'case':{p.name:digest(p) for p in sorted((base/'sources'/case_id).iterdir()) if p.is_file()},'driver':{p.name:digest(p) for p in [base/'run-case.py',base/'run.mjs']}}
free=shutil.disk_usage(repo).free
if free<2147483648:raise RuntimeError('Free storage below 2 GiB; no new writes')
before=pins();assert before['runtime']==expected,'Runtime dependency drift';assert before['frozen']==frozen,'Frozen original drift';assert before['case']==case['source_sha256'],'Case source drift'
existing=sorted(base.glob('attempt-*-before.json'));assert len(existing)<8,'Eight-attempt cap reached'
number=len(existing)+1;attempt=f'attempt-{number:03}'
record={'case':case_id,'attempt':attempt,'case_spec':case,'free_bytes':free,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':before}
(base/f'{attempt}-before.json').write_text(json.dumps(record,indent=2)+'\n')
# Syntax-only checks do not launch a browser. A failure still consumes this reserved attempt.
for p in [base/'run.mjs',*(base/'sources'/case_id).glob('*.mjs')]:subprocess.run(['node','--check',str(p)],check=True,cwd=repo)
env=os.environ.copy();env['APERTURE_WEBGPU_RUNTIME']=str(repo/'.aperture-env/render-runtime')
cmd=[sys.executable,'-B',str(repo/'tools/recovery/runtime_pressure.py'),'--root','/workspace/scratch/0190a8c72f8a/aperture-tmp','--audit-dir',str(base/'lifecycle-audits'),'run','--job',f'crane-wall-{attempt}-{case_id}','--recreation','Regenerate disposable pinned browser only; retain immutable crane diagnostic evidence outside disposable root','--','node',str(base/'run.mjs'),case_id,attempt]
print(json.dumps({'attempt':attempt,'case':case_id,'free_before':free}),flush=True)
with (base/f'{attempt}.log').open('x') as out:rc=subprocess.run(cmd,cwd=repo,env=env,stdout=out,stderr=subprocess.STDOUT).returncode
free_after=shutil.disk_usage(repo).free
if free_after<2147483648:raise RuntimeError('Free storage below 2 GiB after lifecycle; files preserved, no new writes')
after=pins();result_path=base/f'renders/{attempt}/result.json';result=json.loads(result_path.read_text()) if result_path.exists() else {};png=base/f'renders/{attempt}/render.png'
summary={'attempt':attempt,'case':case_id,'exitcode':rc,'status':result.get('status'),'proof':result.get('proof'),'free_before':free,'free_after':free_after,'pins_unchanged':before==after,'png_sha256':digest(png) if png.exists() else None}
if case['variable']=='none':
 retained=original/f'renders/{case["engine"]}/attempt-002/render.png';summary['retained_png_sha256']=digest(retained);summary['exact_retained_png_bytes']=png.exists() and png.read_bytes()==retained.read_bytes()
(base/f'{attempt}-after.json').write_text(json.dumps({'summary':summary,'pins':after},indent=2)+'\n')
(base/f'{attempt}-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary),flush=True)
assert before==after,'Inputs changed during render'
assert rc==0 and result.get('status')=='passed','Native render failed; preserve and reconcile'
if case['variable']=='none':assert summary['exact_retained_png_bytes'],'Baseline PNG mismatch; stop and reconcile'
