from pathlib import Path
import json,hashlib,base64,tarfile,io,re,subprocess,datetime,fcntl,os
repo=Path('/workspace/aperture');base=repo/'benchmarks/agent-house-race-20261011/round-005';setup=base/'setup';private=repo/'.aperture-env/agent-house-race';sdk=private/'sdk/round-005';c=json.loads((private/'control/lanes-r005.pending.json').read_bytes());p=json.loads((setup/'preparation.json').read_bytes());s=json.loads((setup/'sdk-snapshot.json').read_bytes());r=json.loads((private/'control/r005-preparation-operation-001/result.json').read_bytes());assert r['exitCode']==0 and p['status']=='prepared-not-activated' and p['baseGitHead']=='e9cde5afb83f12d2444aac53fe9a2a2a99fcf218'
def pin(path):
 data=path.read_bytes();return {'path':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
def match(path,item):
 actual=pin(path);assert actual['bytes']==item['bytes'] and actual['sha256']==item['sha256'],str(path)
for item in p['repositoryInputs']:match(repo/item['path'],item)
for item in p['setupFiles']:match(setup/item['path'],item)
for item in s['files']:
 match(sdk/item['path'],item);assert (sdk/item['path']).stat().st_mode&0o222==0
 assert not any(v in Path(item['path']).parts for v in ['benchmarks','__tests__','test','tests']) and 'AGENT_ARCHITECTURE_AUDIT' not in item['path']
versions={json.loads((repo/'packages'/pack['package'].split('/')[-1]/'package.json').read_bytes())['name']:json.loads((repo/'packages'/pack['package'].split('/')[-1]/'package.json').read_bytes())['version'] for pack in s['packs']}
work=Path(c['lanes']['aperture-r005']['workspace']);lock=(work/'pnpm-lock.yaml').read_text();packed=[];installed_count=0
for pack in s['packs']:
 path=sdk/pack['path'];match(path,pack);raw=path.read_bytes();integrity='sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()
 assert re.search(r'resolution: \{integrity: '+re.escape(integrity)+r', tarball: file:\.\./sdk/packages/'+re.escape(path.name)+r'\}',lock)
 name=pack['package'].split('/')[-1];installed=(work/'node_modules/@aperture-engine'/name).resolve(strict=True);assert installed.is_relative_to(work)
 entries={}
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as t:
  for m in t.getmembers():
   if m.isdir():continue
   assert m.isfile() and m.name.startswith('package/') and '..' not in Path(m.name).parts and m.name not in entries
   rel=m.name[len('package/'):];data=t.extractfile(m).read();assert (installed/rel).read_bytes()==data,(name,rel)
   source=repo/'packages'/name/rel
   if source.is_file():
    if rel=='package.json':
     expected=json.loads(source.read_bytes())
     for category in ['dependencies','devDependencies','peerDependencies','optionalDependencies']:
      for dependency,value in expected.get(category,{}).items():
       if value.startswith('workspace:'):
        suffix=value[len('workspace:'):];assert dependency in versions and suffix in ['^','~','*']
        expected[category][dependency]=('' if suffix=='*' else suffix)+versions[dependency]
     expected.get('scripts',{}).pop('prepare',None)
     assert expected==json.loads(data),(name,'published manifest differs beyond exact workspace version substitution')
    else:assert source.read_bytes()==data,(name,rel)
   entries[m.name]=len(data);installed_count+=1
 assert json.loads((installed/'package.json').read_bytes())['name']==pack['package'];packed.append({'package':pack['package'],'archiveSha256':pack['sha256'],'lockSha512Matches':True,'installedAndCurrentPackageFilesExact':len(entries),'publishedManifestOnlyWorkspaceVersionSubstitutionAndPrepareRemoval':True})
for engine in ['three','aperture']:
 lane=c['lanes'][engine+'-r005'];workspace=Path(lane['workspace']);assert (workspace/'src/main.js').read_bytes()==(setup/'starters'/engine/'src/main.js').read_bytes()==b'// Build the assigned scene and register the benchmark adapter here.\n'
 assert Path(lane['promptPath']).read_bytes()==(setup/'prompts'/f'{engine}.txt').read_bytes();assert Path(lane['referencePath']).read_bytes()==(setup/'reference.png').read_bytes()
 assert (workspace/'pnpm-lock.yaml').read_bytes()==(setup/'starters'/engine/'pnpm-lock.yaml').read_bytes()
assert p['trialOrder']==['three','aperture','aperture','three','three','aperture'] and p['authorBudgetSeconds']==1800 and p['previewAllowance']==3
safe='{"Id":{{json .Id}},"Image":{{json .Image}},"Name":{{json .Name}},"Path":{{json .Path}},"Args":{{json .Args}},"State":{{json .State}},"ExecIDs":{{json .ExecIDs}},"Mounts":{{json .Mounts}},"NanoCpus":{{json .HostConfig.NanoCpus}},"Memory":{{json .HostConfig.Memory}},"PidsLimit":{{json .HostConfig.PidsLimit}}}'
ops=[]
for container in p['containers']:
 lane=c['lanes'][container['lane']]
 argv=['docker','--host=unix:///var/run/docker.sock','inspect','--type','container','--format',safe,container['id']];q=subprocess.run(argv,capture_output=True,check=True);row=json.loads(q.stdout)
 assert row['Id']==container['id'] and row['Image']==container['imageId'] and row['Name']=='/'+lane['container'] and row['Args']==['sleep','infinity'] and row['State']['Running'] and row['ExecIDs'] in (None,[])
 assert row['NanoCpus']==2000000000 and row['Memory']==5368709120 and row['PidsLimit']==128
 expected={(str(Path(lane['workspace'])),'/work',True)}|{(m['source'],m['target'],False) for m in lane['readOnlyMounts']};assert {(m['Source'],m['Destination'],m['RW']) for m in row['Mounts']}==expected
 top=subprocess.run(['docker','--host=unix:///var/run/docker.sock','top',container['id'],'-eo','pid,ppid,comm'],capture_output=True,check=True);lines=top.stdout.decode().splitlines();assert len(lines)==2 and lines[1].split()[-1]=='sleep' and int(lines[1].split()[0])==row['State']['Pid'];ops.append({'inspectArgv':argv,'inspectStdout':q.stdout.decode(),'topStdout':top.stdout.decode(),'exitCodes':[0,0]})
fd=os.open('/workspace/scratch/0190a8c72f8a/aperture-tmp/.lifecycle.lock',os.O_RDONLY);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);free=os.statvfs('/workspace/scratch/0190a8c72f8a/aperture-tmp');actualfree=free.f_bavail*free.f_frsize;fcntl.flock(fd,fcntl.LOCK_UN);os.close(fd);assert actualfree>=3631578335
admission=json.loads(Path(c['capacityAdmission']['path']).read_bytes());assert admission['status']=='admissible-under-declared-reserves' and admission['requiredFreeBytes']==3631578335
result={'schema':'aperture.root-reviewed-round-inputs.v1','round':'round-005','status':'passed','reviewedBy':'/root','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'blockingFindings':[],'preparation':pin(setup/'preparation.json'),'repositoryInputsActualHashChecks':len(p['repositoryInputs']),'sdkFileHashChecks':len(s['files']),'setupFileHashChecks':len(p['setupFiles']),'packedArchiveCount':len(packed),'installedPackageFilesExactChecked':installed_count,'packChecks':packed,'blankStartersAndSameCommonPromptVerified':True,'actualContainerInspectAndTop':ops,'noHistoryPeerSceneOrBenchmarkOutcomesInSdk':True,'currentSourceAndDistInputsExact':True,'actualSetupExitCode':0,'setupOperation':pin(private/'control/r005-preparation-operation-001/result.json'),'actualFreeBytesAfterSetup':actualfree,'requiredBeforeEitherAuthorBytes':3631578335,'capacityAdmission':c['capacityAdmission'],'inputSealPerformed':False,'authorDispatchPerformed':False,'exclusiveLifecycleLockAcquiredAndReleased':True,'checkerSource':pin(Path(__file__).resolve()),'priorRootReviewAttempt':{'exitCode':1,'stage':'first packed package.json source comparison','cause':'pnpm correctly rewrites workspace dependency ranges to published versions; second attempt also confirmed prepare script removal','secondUnlaunchedReviewFailureExitCode':1,'sdkOrInstalledByteMismatch':False,'noInputReviewOrAuthorDispatchCreated':True}}
out=base/'input-review.json';out.write_text(json.dumps(result,indent=2)+'\n');out.chmod(0o444);print(json.dumps({'path':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sdkFiles':len(s['files']),'installedFileChecks':installed_count,'actualFreeBytes':actualfree}))
