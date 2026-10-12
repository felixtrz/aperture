"""Private proposed v3 validator; no recorder/journal modification or execution.

Decoded transport facts must come from the actual returned data URL, using the
frozen live helper. Source pins remain independently checked by the recorder.
This cooperative witness is not a platform-signed proof of image comprehension.
"""
import hashlib
import struct
import zlib

MAX_PNG_BYTES = 32 * 1024 * 1024
MIMES = frozenset(("image/png", "application/octet-stream"))


def require(ok, message):
    if not ok:
        raise ValueError(message)


def png_dimensions(raw):
    require(type(raw) is bytes and 33 <= len(raw) <= MAX_PNG_BYTES, "Bounded source PNG required")
    require(raw[:8] == b"\x89PNG\r\n\x1a\n" and raw[8:16] == b"\x00\x00\x00\rIHDR", "Exact PNG signature/IHDR required")
    require(zlib.crc32(raw[12:29]) == struct.unpack(">I", raw[29:33])[0], "PNG IHDR CRC differs")
    width, height = struct.unpack(">II", raw[16:24])
    require(0 < width <= 16384 and 0 < height <= 16384, "Bounded positive PNG dimensions required")
    return {"width": width, "height": height}


def validate(request, metadata, source_png):
    dimensions = png_dimensions(source_png)
    require(isinstance(metadata, dict) and set(metadata) == {"tool", "toolArguments", "response"}, "Exact live tool metadata shape required")
    require(metadata["tool"] == request["tool"] == "tools.view_image" and metadata["toolArguments"] == request["toolArguments"], "Live image tool arguments differ from recorded request")
    require(request["toolArguments"].get("detail") == "original", "Original detail required")
    response = metadata["response"]
    fields = {"detail", "dataUrlMime", "dataUrlCharacters", "displayedVia", "decodedBytes", "decodedSha256", "pngDimensions"}
    require(isinstance(response, dict) and set(response) == fields, "Exact bounded live response fields required")
    require(response["detail"] == "original" and response["displayedVia"] == "image(result.image_url, original)", "Actual original image display required")
    mime = response["dataUrlMime"]
    require(type(mime) is str and mime in MIMES, "Only PNG or observed octet-stream PNG transport is accepted")
    require(type(response["decodedBytes"]) is int and response["decodedBytes"] == len(source_png), "Original transport byte length differs/truncated")
    require(type(response["dataUrlCharacters"]) is int and response["dataUrlCharacters"] == len("data:" + mime + ";base64,") + 4 * ((len(source_png) + 2) // 3), "Original data URL length differs/truncated")
    require(response["decodedSha256"] == hashlib.sha256(source_png).hexdigest(), "Original transport bytes differ from pinned source PNG")
    require(response["pngDimensions"] == dimensions == request["pngDimensions"], "Live transport/source/request PNG dimensions differ")
    return {"mimeAccepted": mime, "decodedBytes": len(source_png), "decodedSha256": response["decodedSha256"], "pngDimensions": dimensions,
            "scope": "Reported actual live data-URL decoding; unchanged source independently pinned. No signed provider/viewing attestation."}
