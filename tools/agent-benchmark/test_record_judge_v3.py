"""Actual recorder subprocess regression; simulated PNG metadata is CPU-only."""
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib


def chunk(kind,data):
    return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data))


class JudgeRecorderV3Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="judge-v3-unit-")
        self.root=Path(self.temp.name)
        self.bundle=self.root/"inputs"
        self.bundle.mkdir()
        source=Path(__file__).parent
        for name in ("record-judge-v3.py","live-image-response-v3.mjs","judge_image_v3.py"):
            shutil.copyfile(source/name,self.root/name)
            (self.root/name).chmod(0o444)
        self.png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",2,1,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(b"\0\xff\0\0\0\xff\0"))+chunk(b"IEND",b"")
        cases=["case-amber","case-blue"]
        inputs=[]
        for asset in ["reference"]+[case+"-"+view for case in cases for view in ("canonical","left-orbit","rear-orbit")]+[case+"-facts" for case in cases]:
            kind="facts" if asset.endswith("-facts") else "image"
            path=self.bundle/(asset+(".json" if kind=="facts" else ".png"))
            path.write_bytes(b'{"unitOnly":true}' if kind=="facts" else self.png)
            path.chmod(0o444)
            inputs.append({"id":asset,"kind":kind,**self.pin(path)})
        spec={"schema":"aperture.blind-judge-operation-spec.v2","judgeId":"unit-judge",
            "bundleRoot":str(self.bundle),"outputRoot":str(self.root/"journal"),"caseIds":cases,"inputs":inputs,
            "recorderSha256":self.pin(self.root/"record-judge-v3.py")["sha256"],
            "liveHelperSha256":self.pin(self.root/"live-image-response-v3.mjs")["sha256"],
            "validatorSha256":self.pin(self.root/"judge_image_v3.py")["sha256"],"responseMetadataSchema":"aperture.live-image-transport.v3"}
        self.spec=self.root/"spec.json"
        self.spec.write_text(json.dumps(spec))
        self.spec.chmod(0o444)
        self.spec_hash=self.pin(self.spec)["sha256"]
        self.inputs=inputs

    def tearDown(self):self.temp.cleanup()

    @staticmethod
    def pin(path):
        raw=path.read_bytes()
        return {"path":str(path),"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()}

    def command(self,*argv,code=0):
        result=subprocess.run([sys.executable,"-B",str(self.root/"record-judge-v3.py"),"--spec",str(self.spec),"--spec-sha256",self.spec_hash,*argv],cwd=self.root,capture_output=True,check=False)
        self.assertEqual(result.returncode,code,result.stderr.decode())
        return result

    def response(self,request,mime="application/octet-stream"):
        return {"tool":"tools.view_image","toolArguments":request["toolArguments"],"response":{
            "detail":"original","dataUrlMime":mime,"dataUrlCharacters":len("data:"+mime+";base64,")+4*((len(self.png)+2)//3),
            "displayedVia":"image(result.image_url, original)","decodedBytes":len(self.png),
            "decodedSha256":hashlib.sha256(self.png).hexdigest(),"pngDimensions":{"width":2,"height":1}}}

    def test_real_cli_seals_exact_original_json_after_all_seven_cpu_response_witnesses(self):
        self.command("start")
        helper=self.command("helper")
        self.assertEqual(helper.stdout,(self.root/"live-image-response-v3.mjs").read_bytes())
        for item in self.inputs:
            if item["kind"]=="facts":self.command("facts",item["id"])
            else:
                request=json.loads(self.command("image-request",item["id"]).stdout)
                self.command("image-response",request["requestId"],"--metadata-json",json.dumps(self.response(request)))
        original='{ "judgeId" : "unit-judge", "cases" : [{"case":"case-amber"},{"case":"case-blue"}] }'
        self.command("finish","--json-text",original)
        self.assertEqual((self.root/"journal/original-final.json").read_bytes(),original.encode())
        state=json.loads((self.root/"journal/state.json").read_bytes())
        self.assertTrue(state["finished"])
        self.assertEqual(len(state["responses"]),7)
        self.assertEqual(state["sequence"],19)
        result=subprocess.run([sys.executable,"-B",str(self.root/"record-judge-v3.py"),"--spec",str(self.spec),"--spec-sha256",self.spec_hash,"helper"],capture_output=True,check=False)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(json.loads((self.root/"journal/state.json").read_bytes())["sequence"],19)

    def test_inconsistent_transport_is_retained_as_failure_and_cannot_finish(self):
        self.command("start");self.command("helper")
        request=json.loads(self.command("image-request","reference").stdout)
        metadata=self.response(request)
        metadata["response"]["decodedSha256"]="0"*64
        self.command("image-response",request["requestId"],"--metadata-json",json.dumps(metadata),code=2)
        self.command("finish","--json-text",'{"judgeId":"unit-judge","cases":[]}',code=2)
        state=json.loads((self.root/"journal/state.json").read_bytes())
        self.assertFalse(state["finished"])
        self.assertEqual(state["responses"],{})
        self.assertFalse((self.root/"journal/original-final.json").exists())
        failure=json.loads((self.root/"journal/operations/0004/result.json").read_bytes())
        self.assertTrue(failure["detail"]["failedActionPreserved"])


if __name__=="__main__":unittest.main()
