"""Generate a source-pinned public v3 task; never launch a model or judge."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex


def render_task(spec_path, spec_sha, spec, helper, rubric):
    prefix = ["python3", "-B", str(spec_path.with_name("record-judge-v3.py")), "--spec", str(spec_path), "--spec-sha256", spec_sha]
    shell = shlex.join(prefix)
    inline = re.sub(r"^export (?=function )", "", helper, flags=re.MULTILINE)
    images = [item["id"] for item in spec["inputs"] if item["kind"] == "image"]
    facts = [item["id"] for item in spec["inputs"] if item["kind"] == "facts"]
    calls = []
    for asset in images:
        calls.append(r"""```javascript
const quote = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
const prefix = """ + json.dumps(prefix) + """;
const command = prefix.map(quote).join(" ");
const requested = await tools.exec_command({cmd:command+" image-request "+quote(""" + json.dumps(asset) + """), max_output_tokens:2000});
if (requested.exit_code !== 0) throw new Error(requested.output);
const request = JSON.parse(requested.output);
const result = await tools.view_image(request.toolArguments);
image(result.image_url, "original");
let response;
try { response = inspectLivePngDataUrl(result); }
catch (error) {
  response = {detail:result.detail, dataUrlMime:/^data:([^;,]+)/.exec(result.image_url)?.[1]??"unknown",
    dataUrlCharacters:result.image_url.length, displayedVia:"image(result.image_url, original)", transportError:String(error.message)};
}
const metadata = {tool:"tools.view_image", toolArguments:request.toolArguments, response};
text(await tools.exec_command({cmd:command+" image-response "+quote(request.requestId)+" --metadata-json "+quote(JSON.stringify(metadata)), max_output_tokens:2000}));
```""")
    return "\n\n".join([
        "Record only public operations. You may bootstrap by reading this own task file once. Then use only the own recorder commands and actual tools.view_image calls below. No provider/session/private reasoning access, other scene/source/peer/history/performance reads, or model contact. Never repair failed journals or invent metadata. The exact frozen rubric and neutral input facts govern your returned assessment; do not infer engine identity. Your actual identity is " + spec["judgeId"] + ".",
        "Exact reviewed rubric:\n\n" + rubric,
        "Start:\n`"+shell+" start`\n\nRead the exact helper through the recorded action:\n`"+shell+" helper`",
        "Read both exact neutral fact files:\n"+"\n".join("`"+shell+" facts "+shlex.quote(asset)+"`" for asset in facts),
        "Prepend the following exact pure helper definitions to EACH of the seven separate functions.exec cells below. Each cell is a fresh isolate. The helper is embedded from reviewed source after only removing export keywords. It needs no atob, crypto, TextEncoder, Buffer, imports or browser globals. It inspects the actual returned data URL without logging its contents.\n\n```javascript\n" + inline + "\n```",
        *calls,
        "Return your assessment as exact original UTF8 JSON with judgeId and the two case IDs. Record those same exact bytes using " + shell + " finish --json-text YOUR_SHELL_QUOTED_EXACT_ORIGINAL_JSON. Then return exactly that same JSON. A finish failure remains failed; do not relabel MIME, backfill, fabricate completion, or repeatedly try to override failures.",
        "This journal documents cooperative public operations and independently checks pinned source bytes; it is not a platform-signed attestation of comprehension."
    ]) + "\n"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec",required=True,type=Path)
    parser.add_argument("--spec-sha256",required=True)
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args()
    raw=args.spec.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=args.spec_sha256 or args.spec.stat().st_mode & 0o222:
        raise ValueError("Exact readonly spec required")
    spec=json.loads(raw)
    if spec.get("schema")!="aperture.blind-judge-operation-spec.v2" or not isinstance(spec.get("judgeId"),str) or not spec["judgeId"]:
        raise ValueError("Actual final v3 identity/spec required")
    helper_path=args.spec.with_name("live-image-response-v3.mjs")
    helper=helper_path.read_bytes()
    if hashlib.sha256(helper).hexdigest()!=spec["liveHelperSha256"] or helper_path.stat().st_mode & 0o222:
        raise ValueError("Exact readonly live helper required")
    rubric_pin=spec["rubric"]
    rubric_path=Path(rubric_pin["path"])
    rubric=rubric_path.read_bytes()
    if len(rubric)>16*1024 or len(rubric)!=rubric_pin["bytes"] or hashlib.sha256(rubric).hexdigest()!=rubric_pin["sha256"] or rubric_path.stat().st_mode & 0o222:
        raise ValueError("Exact readonly frozen rubric required")
    task=render_task(args.spec,args.spec_sha256,spec,helper.decode(),rubric.decode())
    with args.output.open("x") as stream:stream.write(task)
    args.output.chmod(0o444)


if __name__=="__main__":main()
