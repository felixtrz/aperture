#!/usr/bin/env python3
"""Independent CPU reconstruction. Does not import the fixture validators."""
import hashlib, json, os, struct, subprocess, sys
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SOURCE = REPO / 'benchmarks/shared-mesh-fanout-v2-20261003'
FROZEN = '31e06f7c7ca0ca53b12bc42b0a759a668ade6bb7'
def sha(b): return hashlib.sha256(b).hexdigest()
def blob(b): return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def read(p): return json.loads(p.read_text())
def check(ok, message):
    if not ok: raise AssertionError(message)
def git(*args): return subprocess.check_output(['git', *args], cwd=REPO)
def filecheck(path, expected):
    data=path.read_bytes()
    check(len(data)==expected['bytes'] and sha(data)==expected['sha256'], 'hash '+str(path))
    if 'gitBlob' in expected: check(blob(data)==expected['gitBlob'], 'blob '+str(path))
    return len(data)
def proof(p):
    check(p['native'] is True and p['canvasWebGPU']==1 and p['webglAttempts']==0, 'native/WebGL proof')
    check(p['submissions']>0 and p['draws']>0 and not p['errors'] and not p['deviceLost'], 'GPU error/loss proof')
    check(p['adapters'] and all(a['architecture']=='swiftshader' for a in p['adapters']), 'adapter')
    check(len(p['devices'])==1 and p['devices'][0]['adapter']['architecture']=='swiftshader', 'device')
def uploaded(scope, draw, buffer_id, offset, size):
    key=f"{draw['submissionSerial']}:{buffer_id}"
    check(key in draw['uploadSnapshotIds'], 'snapshot referenced at exact submit')
    u=scope['bufferSnapshots'][key]
    check(u['id']==buffer_id and u['submissionSerial']==draw['submissionSerial'], 'snapshot identity')
    check(not u['destroyed'] and u['contentVersion']>0 and u['writeCalls']>0, 'live initialized buffer')
    b=bytes(u['fullUploadBytes'])
    check(len(b)==u['allocationBytes'] and 0<=offset<=offset+size<=len(b), 'buffer allocation range')
    check(any(a<=offset and z>=offset+size for a,z in u['writtenRanges']), 'fully initialized range')
    check(all(z<=offset or a>=offset+size for a,z in u['uncertainRanges']), 'mutation-free range')
    return b[offset:offset+size],u
def coverage(scope, draws, commands, meshes, kind, shared):
    covered=defaultdict(list); rows=[]; relevant=0
    for d in draws:
        selected=[m for m in meshes if any(v['label']==m['assetLabel']+'/vertex:'+s['id'] for v in d['vertices'] for s in m['streams'])]
        if not selected: continue
        relevant+=1
        p=scope['pipelineSnapshots'][d['pipelineId']]
        check(str(p['id'])==d['pipelineId'], 'pipeline identity')
        if kind=='main':
            check(d['pass']['colors'] and p['targets'] and 'worldTransforms' in p['vertex']['code'], 'main descriptor/shader')
        else:
            check(not d['pass']['colors'] and not p['targets'] and d['pass']['depth'], 'shadow descriptor')
        check({'id':d['commandBufferId'],'encoderId':d['commandEncoderId'],'submissionSerial':d['submissionSerial']} in commands, 'submitted owning command')
        check(d['index'] is None, 'fixture nonindexed')
        indirect=d['method']=='drawIndirect'; extra={}
        if indirect:
            check(all(k not in d for k in ['count','instances','start','firstInstance']), 'no fabricated direct fields')
            ib=d['indirect']['buffer']; off=d['indirect']['offset'];check(off%4==0,'indirect aligned')
            raw,u=uploaded(scope,d,ib['id'],off,16)
            check(ib['allocationBytes']==u['allocationBytes'] and u['usage']==264, 'actual INDIRECT|COPY_DST identity')
            count,instances,start,first=struct.unpack('<4I',raw)
            check(first==0 or u['indirectFirstInstanceSupported'], 'actual first-instance feature')
            extra={'argumentBufferId':ib['id'],'argumentOffset':off,'argumentBytes':list(raw),'argumentContentVersion':u['contentVersion']}
        else:
            check(d['method']=='draw','unexpected draw method')
            count,instances,start,first=(d[k] for k in ['count','instances','start','firstInstance'])
        m=selected[0];check(start==0 and count==len(m['positions'])//3,'active native vertex count')
        check(len(d['vertices'])==len(m['streams']), 'stream count')
        for s in m['streams']:
            binds=[v for v in d['vertices'] if v['label']==m['assetLabel']+'/vertex:'+s['id']]
            check(len(binds)==1,'stream binding'); v=binds[0]
            check(v['offset']==0 and v['size']>=s['byteLength'],'active bound range')
            raw,u=uploaded(scope,d,v['id'],0,s['byteLength'])
            check(raw==bytes(s['rawBytes']),'exact submitted geometry bytes')
        gi,bi=(1,0) if kind=='main' else (0,1)
        groups=[g for g in d['groups'] if g['index']==gi];check(len(groups)==1 and not groups[0]['dynamicOffsets'],'transform group')
        b=next(e['buffer'] for e in groups[0]['entries'] if e['binding']==bi)
        at=b['offset']+64*first; check(at+64*instances<=b['offset']+b['size'],'packed transform range')
        raw,u=uploaded(scope,d,b['id'],at,64*instances)
        mats=[list(struct.unpack_from('<16f',raw,64*i)) for i in range(instances)]
        check(all(mat in [m['worldMatrix'] for m in selected] for mat in mats),'exact actual packed transforms')
        covered[m['meshId']].extend(mats)
        if kind=='main' and shared and m['instance'] is not None: check(indirect and instances==3,'three-instance genuine drawIndirect')
        rows.append({'meshId':m['meshId'],'method':d['method'],'viaBundle':d.get('viaBundle',False),'count':count,'instances':instances,'firstInstance':first,'submissionSerial':d['submissionSerial'],'commandBufferId':d['commandBufferId'],'commandEncoderId':d['commandEncoderId'],'vertexBufferIds':[v['id'] for v in d['vertices']],'transformBufferId':b['id'],'transforms':mats,**extra})
    for m in meshes: check(covered[m['meshId']].count(m['worldMatrix'])==1, 'unique complete instance coverage')
    check(relevant==(5 if shared else 11), 'native geometry draw cardinality')
    return rows

def audit(output):
    pins=read(SOURCE/'source-pins.json'); inventory=read(SOURCE/'NATIVE_MANIFEST.json')
    pinbytes=sum(filecheck(REPO/p,e) for p,e in pins['files'].items())
    for p,target in pins['runtimeSymlinks'].items(): check(os.readlink(REPO/p)==target,'frozen symlink')
    manifestbytes=sum(filecheck(SOURCE/e['path'],e) for e in inventory['files'])
    check(manifestbytes==inventory['totalBytes'],'native manifest total')
    frozenrows=git('ls-tree','-r','-z',FROZEN,'--',str(SOURCE.relative_to(REPO))).split(b'\0'); frozenfiles=0
    for row in filter(None,frozenrows):
        meta,name=row.split(b'\t'); oid=meta.split()[2].decode();check(blob((REPO/name.decode()).read_bytes())==oid,'frozen source tree'); frozenfiles+=1
    archives={}
    for key,a in read(SOURCE/'PRESERVATION.json').items():
        total=0
        for p,e in a['files'].items():
            total+=filecheck(REPO/p,e)
            check(git('cat-file','blob',e['gitBlob'])==(REPO/p).read_bytes(),'preserved actual Git bytes')
        check(total==a['totalBytes'] and len(a['files'])==a['filesExact'],'archive inventory')
        if 'publication' in a:
            cp=a['publication']['checkpoint'];original=git('show',a['commit']+':'+cp['path'])
            check(len(original)==cp['bytes'] and sha(original)==cp['sha256'] and blob(original)==cp['gitBlob'],'archived checkpoint')
        archives[key]={'commit':a['commit'],'files':len(a['files']),'bytes':total}
    derivation=read(SOURCE/'derivation.json')
    for f in derivation['files']:
        check(sha((REPO/f['source']).read_bytes())==f['sourceSha256'],'V1 derivation input')
        check(sha((REPO/f['destination']).read_bytes())==f['derivedSha256'],'V2 derivation output')
        if f['unchanged']: check(f['sourceSha256']==f['derivedSha256'],'unchanged derivation')
    records={}; images={}; rows=[]; sessionrows=[]
    for session,states in pins['sessions'].items():
        attempt=SOURCE/'renders/aperture'/session/'attempt-001'
        check(list((attempt.parent).iterdir())==[attempt],'one retained attempt')
        outcome=read(attempt/'outcome.json');check(outcome['status']=='passed' and outcome['sourcePinsUnchanged'] and outcome['serverClosed'],'session completion')
        runner=read(attempt/'verified-runner.json');check(runner['status']=='passed' and not runner['errors'],'runner status'); proof(runner['proof'])
        launch=runner['launch']; check(launch['sandboxLaunchEnabled'] and launch['requested']['chromiumSandbox'] and launch['requested']['ignoreDefaultArgs'],'sandbox path')
        check(launch['actualArgv'][1:]==launch['requested']['args'],'actual launch exact args')
        expected=['--headless','--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--disable-background-networking','--use-webgpu-adapter=swiftshader','--use-vulkan=swiftshader','--use-gl=angle','--use-angle=swiftshader','--enable-features=Vulkan','--enable-logging=stderr','--enable-unsafe-webgpu']
        check([x for x in launch['actualArgv'][1:] if not x.startswith('--user-data-dir=')]==expected,'approved flags')
        check(read(attempt/'inputs.json')['sourcePinsSha256']==sha((SOURCE/'source-pins.json').read_bytes()),'session pin identity')
        loaded=read(attempt/'loaded-inputs.json')
        for info in loaded.values(): check(info['inputSha256']==sha((REPO/info['name']).read_bytes()),'loaded actual input')
        complete=read(attempt/'complete.json');proof(complete['proof']);check(complete['states']==len(states),'completion states')
        for artifact in complete['artifacts']: filecheck(attempt/artifact['path'],artifact)
        check(len(list((attempt/'states').glob('*.json')))==len(states),'state inventory')
        previous=None
        for state in states:
            path=attempt/'states'/(state['id']+'.json');r=read(path);check(r['state']==state,'state order');proof(r['proof'])
            check(r['capture']['gpuFenceCompleted'] and r['capture']['presentationFrames']>=2,'capture fence')
            check(path.stat().st_size<=16*1024*1024 and path.with_suffix('.png').stat().st_size<=8*1024*1024,'size gates')
            e=r['evidence'];ng=e['nativeGeometry'];s=ng['submittedDraws'];meshes=ng['meshes'];shared=e['shared']; nr=e['resources']['nativeRenderer'];worker=e['resources']['worker']
            frame=r['receipt']['nativeFrame'];check(s['frame']==frame==ng['actualSubmittedSnapshot']['frame']==e['nativeSubmission']['nativeReportFrame'],'frame joins')
            check(len(meshes)==11 and len({m['entityId'] for m in meshes})==11,'entity inventory')
            expected_version=[1,1,2,2,3,4,5,6][state['index']] if session=='live' else 1
            for m in meshes:
                check(m['assetVersion']==(expected_version if m['instance'] is not None else 1),'source versions')
                mirror=next(a for a in ng['mirroredAssets'] if a['meshId']==m['meshId'])
                check(mirror['assetVersion']==m['assetVersion'] and mirror['streams']==m['streams'],'actual mirror bytes/version')
                prepared=next(a for a in nr['preparedMeshFacade']['entries'] if a['assetKey']=='mesh:'+m['meshId'])
                check(prepared['sourceVersion']==m['assetVersion'],'prepared cache version')
            check(worker['meshAssetReplacements']==3*(expected_version-1) and len(worker['publications'])==3*(expected_version-1),'once-per-handle publish cardinality')
            check(len({(p['revision'],p['meshId']) for p in worker['publications']})==len(worker['publications']),'no duplicate publish')
            check(nr['preparedMeshFacade']['totalEntries']==(5 if shared else 11),'current facade size')
            geometrylabels={m['assetLabel']+'/vertex:'+v['id'] for m in meshes for v in m['streams']}
            relevant=[d for d in s['draws'] if any(v['label'] in geometrylabels for v in d['vertices'])]
            main=[d for d in relevant if d['pass']['colors']]
            mainrows=coverage(s,main,s['commands'],meshes,'main',shared)
            textures={v['textureId'] for d in main for v in d['sampledTextureVersions']}
            histories=[h for h in s['shadowHistory'] if h['textureId'] in textures];check(len(histories)==1,'exact sampled shadow history')
            h=histories[0]
            check(all(any(v['textureId']==h['textureId'] and v['contentRevision']==h['contentRevision'] for v in d['sampledTextureVersions']) for d in main),'current sampled shadow revision')
            check(not any(i['textureId']==h['textureId'] and i['contentRevision']>h['contentRevision'] for i in s['textureInvalidations']),'not invalidated shadow')
            shadowrows=coverage(s,h['draws'],h['commands'],meshes,'shadow',shared)
            if previous:
                for m,old in zip(meshes,previous['nativeGeometry']['meshes']):
                    check(all(m[k]==old[k] for k in ['name','entityId','meshId','materialId','worldMatrix']),'persistent identity')
                    if state['noop'] or m['instance'] is None: check(m['streams']==old['streams'] and m['assetVersion']==old['assetVersion'],'noop/sentinel unchanged')
            if state['noop']:
                check(not worker['changedMeshes'] and nr['meshBuffersCreated']==0 and nr['preparedMeshBuffersCreated']==0,'noop no geometry upload allocation')
                check(nr['autoShadowFrameCache']['status']=='hit' and nr['autoShadowFramesCreated']==0 and nr['autoShadowFramesReused']==1,'noop shadow cache hit')
                check(not any(not d['pass']['colors'] for d in relevant),'noop did not rerender shadow')
            previous=e
            image=Image.open(path.with_suffix('.png'));image.load(); check(image.size==(1024,1024),'image resolution')
            if image.mode=='RGBA': check(image.getchannel('A').getextrema()==(255,255),'opaque capture')
            image=image.convert('RGB');check(any(a!=b for a,b in image.getextrema()),'nonblank')
            key=(session,state['index']);records[key]=r;images[key]=image
            rows.append({'session':session,'state':state['id'],'jsonSha256':sha(path.read_bytes()),'pngSha256':sha(path.with_suffix('.png').read_bytes()),'rgbSha256':sha(image.tobytes()),'assetVersion':expected_version,'publications':len(worker['publications']),'main':mainrows,'shadow':shadowrows,'shadowOriginalSubmission':h['submissionSerial'],'shadowCache':nr['autoShadowFrameCache'],'preparedCacheEntries':nr['preparedMeshCache']['totalEntries'],'preparedBuffersCreated':nr['preparedMeshBuffersCreated']})
        sessionrows.append({'session':session,'captures':len(states),'loadedInputs':len(loaded),'nativeDraws':runner['proof']['draws'],'nativeSubmissions':runner['proof']['submissions'],'runnerSha256':sha((attempt/'verified-runner.json').read_bytes())})
    def geom(r):return [{k:m.get(k) for k in ['name','positions','indices','worldMatrix','streams','submeshes']} for m in r['evidence']['nativeGeometry']['meshes']]
    controls=[]
    for i in range(8):controls.append((('live',i),('shared-'+records[('live',i)]['state']['edit'],0)))
    for edit in ['baseline','grow','shrink']:controls.append((('shared-'+edit,0),('unshared-'+edit,0)))
    for a,b in controls:check(images[a].tobytes()==images[b].tobytes() and geom(records[a])==geom(records[b]),'exact RGB/raw geometry control')
    mutations=[]
    for edit in ['grow','shrink']:
        diff=ImageChops.difference(images[('shared-baseline',0)],images[('shared-'+edit,0)])
        count=sum(px!=(0,0,0) for px in diff.getdata());check(count>0,'visible mutation');mutations.append({'edit':edit,'changedPixels':count,'maxChannelDifference':max(x[1] for x in diff.getextrema())})
    report={'status':'passed','method':'Independent Python decoder and raw joins; no imported fixture validators','sourceCommit':FROZEN,'sourcePinsSha256':sha((SOURCE/'source-pins.json').read_bytes()),'nativeManifestSha256':sha((SOURCE/'NATIVE_MANIFEST.json').read_bytes()),'pins':len(pins['files']),'pinBytes':pinbytes,'runtimeSymlinks':len(pins['runtimeSymlinks']),'frozenFiles':frozenfiles,'nativeManifestFiles':len(inventory['files']),'nativeManifestBytes':manifestbytes,'preservedArchives':archives,'sessions':sessionrows,'states':rows,'exactControls':[{'a':a,'b':b,'differentPixels':0,'rawGeometryEqual':True} for a,b in controls],'visibleMutations':mutations,'nativeRunsByAuditor':0,'newBrowsers':0,'limitations':['CPU-upload observation at successful native submission, not GPU readback','Indexed indirect route has CPU tests only','No independently rebuilt source-to-dist provenance','No performance or GPU-memory measurement','No author scoring or transcript/model-parity claims','Remote bulk publication not reverified by this local audit']}
    with output.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
    print(json.dumps({k:report[k] for k in ['status','pins','frozenFiles','nativeManifestFiles','nativeManifestBytes','preservedArchives','visibleMutations']}))
    print(json.dumps({'captures':len(rows),'exactControls':len(controls),'output':str(output.relative_to(REPO))}))

if __name__=='__main__':
    out=HERE/(sys.argv[1] if len(sys.argv)>1 else 'independent-001.json')
    check(out.parent==HERE,'output scope')
    audit(out)
