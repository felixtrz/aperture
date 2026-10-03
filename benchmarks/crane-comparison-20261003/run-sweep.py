import sys,pathlib,os,json,subprocess,shutil,hashlib
repo=pathlib.Path(__file__).resolve().parents[2];base=pathlib.Path(__file__).resolve().parent
e=sys.argv[1];assert e in ('a','b');env=os.environ.copy();env['APERTURE_WEBGPU_RUNTIME']=str(repo/'.aperture-env/render-runtime')
cases=[('front-quarter','baseline'),('rear-quarter','baseline'),('high-oblique','baseline')]+[('front-quarter',x) for x in ['shoulder','elbow','hoist','arch','pipe','tier','assembly']]
summary=[]
for i,(view,edit) in enumerate(cases,2):
 free=shutil.disk_usage(repo).free
 if free<2147483648:raise RuntimeError('Low storage; preserve all files')
 attempt=f'attempt-{i:03}';log=base/f'{e}-{attempt}.log';assert not log.exists()
 cmd=[sys.executable,'-B',str(repo/'tools/recovery/runtime_pressure.py'),'--root','/workspace/scratch/0190a8c72f8a/aperture-tmp','--audit-dir',str(base/'lifecycle-audits'),'run','--job',f'crane-{e}-{attempt}','--recreation','Regenerate disposable pinned browser only; unique benchmark evidence outside disposable root','--','node',str(base/'run.mjs'),e,attempt,view,edit,'v2']
 with log.open('x') as out: rc=subprocess.run(cmd,cwd=repo,env=env,stdout=out,stderr=subprocess.STDOUT).returncode
 report=base/f'renders/{e}/{attempt}/result.json';data=json.loads(report.read_text()) if report.exists() else {}
 item={'attempt':attempt,'view':view,'edit':edit,'exitcode':rc,'status':data.get('status'),'proof':data.get('proof'),'free_before':free,'free_after':shutil.disk_usage(repo).free};summary.append(item)
 (base/f'{e}-sweep-progress.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(item),flush=True)
 if rc or data.get('status')!='passed':raise RuntimeError('Capture failed; preserve attempt and reconcile before proceeding')
