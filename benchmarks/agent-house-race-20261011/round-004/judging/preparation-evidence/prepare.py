"""Prepare-only opaque trial01 judge inputs; never launches judges or scoring."""
from pathlib import Path
import datetime
import hashlib
import json
import secrets
import struct

ROOT=Path('/workspace/aperture')
PRIVATE=Path(__file__).resolve().parent
ROUND=ROOT/'benchmarks/agent-house-race-20261011/round-004'
RACE=ROUND.parent
RECORDER_SOURCE=ROOT/'.aperture-env/agent-house-race/control/judge-tool-recorder-r003-draft-001/record-judge-v2.py'
RECORDER_SHA='edc3c44538ddd084e4bdf091a030f84ca7b957fdf071ae8e6c72c66bf2cdb477'
VIEWS=('canonical','left-orbit','rear-orbit')
EXPECTED_REFERENCE='0f28db644bd9bb627495272fd4102b45c5e2f3ffecf8a71ef169daf8096999fa'

def sha(raw):return hashlib.sha256(raw).hexdigest()
def pin(path):
 raw=path.read_bytes();return {'path':str(path),'bytes':len(raw),'sha256':sha(raw)}
def new(path,raw):
 with path.open('xb') as f:f.write(raw)
 path.chmod(0o444)
def new_json(path,value):new(path,(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode())
def read(path,maximum=64*1024*1024):
 assert path.is_absolute() and path.resolve(strict=True)==path and not path.is_symlink() and path.is_file()
 raw=path.read_bytes();assert len(raw)<=maximum
 return raw

def png_dimensions(raw):
 assert raw[:8]==b'\x89PNG\r\n\x1a\n' and raw[12:16]==b'IHDR'
 return struct.unpack('>II',raw[16:24])

summary_raw=read(ROUND/'official-summary.json')
summary=json.loads(summary_raw)
recorder=read(RECORDER_SOURCE,64*1024);assert len(recorder)==12542 and sha(recorder)==RECORDER_SHA
reference=read(RACE/'reference.png',32*1024*1024);assert sha(reference)==EXPECTED_REFERENCE
method_raw=read(ROUND/'setup/method.json',64*1024)
method=json.loads(method_raw)
assert method['weights']=={'visual':.4,'geometry':.2,'runtime':.25,'authoringTime':.15}
assert method_raw==read(RACE/'method.json',64*1024)
rubric_source=RACE/'round-001/blind-input/rubric.txt'
rubric=read(rubric_source,8*1024).decode()
root_reviews=[
 (ROUND/'root-review-evidence/root-r004-geometry-reconstruction-001.json','fd6cc9473ee56fe30e7a8145cff07b038ec27fcadf150d83682d1c53dad0a292'),
 (ROUND/'semantic-source-review.json','afe3b139b028b80401e6d37dc5b2c6412b1fb1530ba9a8818adce9d2a9202963'),
 (ROOT/'.aperture-env/agent-house-race/control/root-r004-native-review-002.json','f6c7f9614a45cba3c83bb4d2708d3c91f8a8522ff37384ebd0dd75b94b2bec65'),
]
for path,expected in root_reviews:assert sha(read(path))==expected

order=['three','aperture'];secrets.SystemRandom().shuffle(order)
case_ids=['case-'+secrets.token_hex(6) for _ in order]
case_map=[];assets={};facts={}
for case,engine in zip(case_ids,order):
 trial=next(t for t in summary['engines'][engine]['trials'] if t['trial']==1)
 assert trial['status']=='validated'
 trial_root=Path(trial['path']);assert trial_root==ROUND/'trials'/engine/'trial-01'
 receipts_raw=read(trial_root/'receipts.json');assert sha(receipts_raw)==trial['hashes']['receipts']
 manifest_raw=read(trial_root/'geometry-manifest-v2.json');assert sha(manifest_raw)==trial['hashes']['geometry']
 views=[]
 for view in VIEWS:
  capture=next(c for c in trial['captures'] if c['camera']['id']==view)
  source=trial_root/(view+'.png');raw=read(source,32*1024*1024)
  assert capture['screenshot']['path']==view+'.png' and capture['screenshot']['bytes']==len(raw) and capture['screenshot']['sha256']==sha(raw)
  assert png_dimensions(raw)==(1024,768)
  assets[case+'-'+view]={'raw':raw,'filename':case+'-'+view+'.png','source':pin(source)}
  views.append({'id':view,'source':pin(source),'frozenCamera':capture['camera']})
 geometry=trial['geometry']
 allowed=('meshEntries','renderInstances','uniqueGeometryCount','uniqueAuthoredVertices','uniqueAuthoredTriangles','instancedAuthoredTriangles','degenerateInstancedTriangles','missingNormalMeshEntries','bounds','confidence')
 factual={key:geometry[key] for key in allowed}
 facts[case]={
  'schema':'neutral.scene-geometry-facts.v1','case':case,
  'geometry':factual,
  'countDefinitions':{
   'meshEntries':'Captured mesh records; this is not a GPU draw count.',
   'renderInstances':'Sum of retained world/instance placements in the captured source geometry.',
   'uniqueGeometryCount':'Identical captured positions, indices and normals are deduplicated; this counts distinct source streams.',
   'uniqueAuthoredVertices':'Vertices summed once per deduplicated source geometry, before repeated placements.',
   'uniqueAuthoredTriangles':'Triangles summed once per deduplicated source geometry, before repeated placements.',
   'instancedAuthoredTriangles':'Captured triangles multiplied by each retained placement. This excludes shadow/postprocess pass repetition and is not a native workload measurement.',
   'degenerateInstancedTriangles':'Geometric zero-area triangle test multiplied by retained placements; this does not by itself establish invalid construction.',
   'missingNormalMeshEntries':'Captured mesh records without a supplied normal stream. Presence is not a test of normal orientation, smoothness or lighting quality.',
   'bounds':'Axis-aligned bounds over retained transformed source geometry; bounds alone do not establish solid volume or reference fidelity.',
  },
  'evidencedConstructionScope':'Independent source review examined procedural primitive/baked mesh positions, indices, normals and world/instance construction. Mechanical reconstruction retained source geometry and all placements. No source paths, APIs or implementation labels are provided here.',
  'limitations':[
   'Exact position-stream matches correlate captured source streams with successful writes in native vertex buffers that were submitted. They do not by themselves prove index, shader or world-transform parity or final visibility.',
   'No watertightness, self-intersection, normal-direction or interior-volume test is claimed by these aggregate counts.',
   'Geometry density, deduplicated counts and repeated placement alone are not visual quality ratings. Use the unchanged rubric and all supplied views; disclose uncertainty.',
  ],
 }
 assert len((json.dumps(facts[case],ensure_ascii=False,indent=2)+'\n').encode())<8*1024
 case_map.append({'case':case,'engine':engine,'captureTrial':1,'views':views,'geometrySummary':factual,'geometryManifest':pin(trial_root/'geometry-manifest-v2.json'),'receipt':pin(trial_root/'receipts.json')})

COMMON='''You are an independent scene visual and geometry reviewer, with no inherited task context. Evaluate each supplied opaque case against the shared reference using only its three fixed camera images and neutral geometry facts. Do not inspect source, repository files, other workspaces, other agents, network results, author transcripts, timings, identities, history or private/provider sessions. Do not infer or speculate about the underlying engine or a desired winner. Only the allowlisted recorder operations and their actual returned tools.view_image calls are permitted. This is cooperative input routing, not an OS sandbox or a claim about private cognition.

Read the two fact files and actually view all seven supplied images: reference plus canonical, left-orbit and rear-orbit for each case. All source PNGs are unchanged. Do not crop, alter or substitute them. The facts distinguish distinct source geometry from repeated placements; they are not scores, and their stated limits apply.

Frozen rubric (verbatim):
{rubric}

Required reference features: house, roof, chimney, windows, porch, path, boundary, garden, mailbox, curved road, curbs, markings, blue car and four wheels. Missing or uncertain required features must be listed honestly in missingRequiredFeatures, with concise reasons. Do not assume presence from a label or count.

For each case return visualDimensions with exactly house, car, composition, materialsLighting, alternateViews (each finite 0..2), and visualScore equal to their sum in 0..10. Return geometryDimensions with exactly proportions (0..4), volume (0..3), normalsTopology (0..2), efficiency (0..1), and geometryScore equal to their sum in 0..10. Fractional scores are allowed. Include case and missingRequiredFeatures (unique nonempty strings); optional notes give brief public observations and uncertainty. Optional preferredVisualCase must be a supplied case. Use your root-assigned actual judgeId. Return only these visual/geometry records, never an overall/combined score, engine preference or implementation advice.

All public operations and your exact final JSON are retained. Do not record hidden reasoning or inspect provider/private sessions. Complete the recorder finish once with your exact original JSON text; your final answer must be that exact same text, without Markdown fences or edits. Preserve failed operations; never fabricate image response metadata or backfill a journal.
'''.format(rubric=rubric.strip())

LIVE='''Use these constants exactly after root supplies your finalized readonly SPEC path, its SHA and actual judgeId:
const RECORDER = RECORDER_LITERAL;
const SPEC = FINAL_SPEC_LITERAL;
const SPEC_SHA = FINAL_SPEC_SHA_LITERAL;
const quote = (s) => "'" + String(s).replace(/'/g, "'\\\\''") + "'";
const prefix = ["python3", "-B", RECORDER, "--spec", SPEC, "--spec-sha256", SPEC_SHA];

Start via tools.exec_command with prefix.map(quote).join(" ") + " start"; max_output_tokens: 10000. Read each supplied FACT_ID through prefix + " facts " + quote(FACT_ID), with max_output_tokens: 10000. No direct host file reads are allowed.

For EACH supplied image ASSET_ID exactly once, use this actual live orchestration in functions.exec. It must execute tools.view_image and forward its actual returned image before recording the response:
const requested = await tools.exec_command({cmd: prefix.map(quote).join(" ") + " image-request " + quote(ASSET_ID), max_output_tokens: 2000});
if (requested.exit_code !== 0) throw new Error(requested.output);
const request = JSON.parse(requested.output);
const result = await tools.view_image(request.toolArguments);
image(result.image_url, "original");
const metadata = {tool: "tools.view_image", toolArguments: request.toolArguments,
  response: {detail: result.detail, dataUrlMime: /^data:([^;,]+)/.exec(result.image_url)?.[1] ?? "unknown",
    dataUrlCharacters: result.image_url.length, displayedVia: "image(result.image_url, original)"}};
text(await tools.exec_command({cmd: prefix.map(quote).join(" ") + " image-response " + quote(request.requestId) + " --metadata-json " + quote(JSON.stringify(metadata)), max_output_tokens: 2000}));

The seven IMAGE_IDS and two FACT_IDS below are the entire allowed input set. Record only actual live metadata; do not log full data URLs. A failed image tool must remain failed/unresolved, never invented as delivered. Finalize after both facts and all seven real request/response pairs:
const finalText = YOUR_EXACT_ORIGINAL_JSON_TEXT;
text(await tools.exec_command({cmd: prefix.map(quote).join(" ") + " finish --json-text " + quote(finalText), max_output_tokens: 2000}));
Return finalText unchanged as your final answer.
'''

new(PRIVATE/'common-task.txt',COMMON.encode())
new(PRIVATE/'frozen-rubric.txt',rubric.encode())
new(PRIVATE/'record-judge-v2.py',recorder)
roots=[]
for _ in range(2):
 base=Path('/workspace')/('scene-review-'+secrets.token_hex(12));base.mkdir(mode=0o700)
 bundle=base/'inputs';bundle.mkdir(mode=0o700)
 new(bundle/'reference.png',reference)
 inputs=[{'id':'reference','kind':'image',**pin(bundle/'reference.png')}]
 for case in case_ids:
  for view in VIEWS:
   asset=assets[case+'-'+view];path=bundle/asset['filename'];new(path,asset['raw'])
   inputs.append({'id':case+'-'+view,'kind':'image',**pin(path)})
 for case in case_ids:
  path=bundle/(case+'-facts.json');new_json(path,facts[case])
  inputs.append({'id':case+'-facts','kind':'facts',**pin(path)})
 recorder_path=base/'recorder.py';new(recorder_path,recorder)
 spec={'schema':'aperture.blind-judge-operation-spec.v1','status':'unresolved-actual-judge-id-awaiting-root-dispatch','judgeId':None,'caseIds':case_ids,'bundleRoot':str(bundle),'outputRoot':str(base/'journal'),'recorderSha256':RECORDER_SHA,'inputs':inputs}
 new_json(base/'input-spec-template.json',spec)
 image_ids=[v['id'] for v in inputs if v['kind']=='image'];fact_ids=[v['id'] for v in inputs if v['kind']=='facts']
 operations=LIVE.replace('RECORDER_LITERAL',json.dumps(str(recorder_path)))
 operations += '\nIMAGE_IDS = '+json.dumps(image_ids)+'\nFACT_IDS = '+json.dumps(fact_ids)+'\nOpaque cases = '+json.dumps(case_ids)+'\n'
 new(base/'task-template.txt',(COMMON+'\n'+operations).encode())
 new(base/'frozen-rubric.txt',rubric.encode())
 bundle.chmod(0o555)
 roots.append({'root':str(base),'inputSpecTemplate':pin(base/'input-spec-template.json'),'taskTemplate':pin(base/'task-template.txt'),'recorder':pin(recorder_path),'rubric':pin(base/'frozen-rubric.txt'),'assets':inputs,'futureJournal':str(base/'journal')})

private_map={'schema':'aperture.house-race-case-map.v1','roundId':'round-004','summarySha256':sha(summary_raw),'methodSha256':sha(method_raw),'referenceSha256':EXPECTED_REFERENCE,'cases':case_map,'judgeBundles':roots,'scope':'Root-only opaque delivery map; never supplied to reviewers.'}
new_json(PRIVATE/'private-case-map.json',private_map)
policy={'schema':'aperture.quality-diagnostic-policy.v1','roundId':'round-004','status':'quality-component-diagnostics-only-combined-pre-excluded','formalCombinedScores':{'three':None,'aperture':None},'formalWinner':None,'stableBenchmarkLead':False,'qualityDiagnosticsPermitted':True,'formalCombinedScoringPermitted':False,'reason':'Unequal successful preview feedback: two for one lane, three for the other; a before-native low-disk infrastructure failure is retained. Do not disclose this incident/history to blind reviewers.','officialSummaryOriginal':pin(ROUND/'official-summary.json'),'failedPreviewNotRetried':True,'authorBudgetAndPreviewCountUnchanged':True}
new_json(PRIVATE/'diagnostic-policy.json',policy)
new_json(PRIVATE/'provenance.json',{'schema':'aperture.private-quality-delivery-provenance.v1','summary':pin(ROUND/'official-summary.json'),'method':pin(ROUND/'setup/method.json'),'reference':pin(RACE/'reference.png'),'originalRubric':pin(rubric_source),'recorderSource':pin(RECORDER_SOURCE),'rootReviewPins':[pin(p) for p,_ in root_reviews],'caseMap':pin(PRIVATE/'private-case-map.json'),'diagnosticPolicy':pin(PRIVATE/'diagnostic-policy.json'),'fixedCaptureTrial':1,'allSevenImagesPerBundleCopiedByteIdentically':True,'twoBundleSameInputBytes':True,'noJudgeInvoked':True,'noRecorderExecutedImportedOrTested':True,'noScorerOrNativeOrBuildLaunched':True,'noOriginalSourceDistOrSummaryChanged':True,'unresolvedActualJudgeIdentities':True})
for root in roots:
 assert len(root['assets'])==9 and sum(v['kind']=='image' for v in root['assets'])==7
 assert sum(v['kind']=='facts' for v in root['assets'])==2
for left,right in zip(roots[0]['assets'],roots[1]['assets']):assert (left['id'],left['bytes'],left['sha256'])==(right['id'],right['bytes'],right['sha256'])
assert sha(read(ROUND/'official-summary.json'))==sha(summary_raw)
new_json(PRIVATE/'preparation-receipt.json',{'schema':'aperture.private-quality-package-preparation.v1','status':'prepared-not-dispatched','preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'privateRoot':str(PRIVATE),'opaqueRoots':[v['root'] for v in roots],'sourceSummaryUnchanged':True,'caseMap':pin(PRIVATE/'private-case-map.json'),'provenance':pin(PRIVATE/'provenance.json'),'diagnosticPolicy':pin(PRIVATE/'diagnostic-policy.json'),'imageCountsPerJudge':[7,7],'factCountsPerJudge':[2,2],'actualJudgeViewsSoFar':0,'judgesInvoked':0,'formalCombinedScores':{'three':None,'aperture':None}})
print(json.dumps({'privateRoot':str(PRIVATE),'opaqueRoots':[v['root'] for v in roots],'preparationReceipt':pin(PRIVATE/'preparation-receipt.json'),'provenance':pin(PRIVATE/'provenance.json'),'formalCombinedScores':None,'judgesInvoked':0},indent=2))
