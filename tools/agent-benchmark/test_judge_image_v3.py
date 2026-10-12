"""CPU validation using real small PNG bytes and transport encodings."""
import base64
import copy
import hashlib
import struct
import unittest
import zlib
from judge_image_v3 import validate, png_dimensions


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def png():
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 2, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"\0\xff\0\0\0\xff\0")) + chunk(b"IEND", b"")


class LiveImageValidationTests(unittest.TestCase):
    def setUp(self):
        self.source = png()
        self.request = {"tool": "tools.view_image", "toolArguments": {"path": "/opaque/own.png", "detail": "original"}, "pngDimensions": {"width": 2, "height": 1}}

    def metadata(self, mime="application/octet-stream", returned=None):
        returned = self.source if returned is None else returned
        data_url = "data:" + mime + ";base64," + base64.b64encode(returned).decode()
        return {"tool": "tools.view_image", "toolArguments": self.request["toolArguments"],
                "response": {"detail": "original", "dataUrlMime": mime, "dataUrlCharacters": len(data_url),
                             "displayedVia": "image(result.image_url, original)", "decodedBytes": len(returned),
                             "decodedSha256": hashlib.sha256(returned).hexdigest(), "pngDimensions": {"width": 2, "height": 1}}}

    def test_observed_octet_stream_png_is_not_relabelled(self):
        metadata = self.metadata()
        result = validate(self.request, metadata, self.source)
        self.assertEqual(result["mimeAccepted"], "application/octet-stream")
        self.assertEqual(metadata["response"]["dataUrlMime"], "application/octet-stream")

    def test_png_transport_also_passes(self):
        self.assertEqual(validate(self.request, self.metadata("image/png"), self.source)["mimeAccepted"], "image/png")

    def test_unknown_or_misleading_mime_fails(self):
        for mime in ("image/jpeg", "image/svg+xml", "unknown", "text/plain", "application/octet-stream;anything"):
            with self.subTest(mime=mime), self.assertRaises(ValueError):
                validate(self.request, self.metadata(mime), self.source)

    def test_truncated_returned_original_fails(self):
        with self.assertRaisesRegex(ValueError, "length"):
            validate(self.request, self.metadata(returned=self.source[:-1]), self.source)

    def test_same_length_different_actual_returned_bytes_fails(self):
        returned = self.source[:40] + bytes([self.source[40] ^ 1]) + self.source[41:]
        with self.assertRaisesRegex(ValueError, "bytes differ"):
            validate(self.request, self.metadata(returned=returned), self.source)

    def test_wrong_dimensions_or_original_detail_or_arguments_fails(self):
        for field, value in (("pngDimensions", {"width": 1, "height": 2}), ("detail", "high"), ("dataUrlCharacters", 1), ("decodedBytes", True)):
            metadata = self.metadata()
            metadata["response"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate(self.request, metadata, self.source)
        metadata = copy.deepcopy(self.metadata())
        metadata["toolArguments"]["path"] = "/opaque/peer.png"
        with self.assertRaises(ValueError):
            validate(self.request, metadata, self.source)

    def test_wrong_source_magic_or_ihdr_crc_fails(self):
        for returned in (b"not a PNG" + self.source[9:], self.source[:29] + b"\0\0\0\0" + self.source[33:]):
            with self.assertRaises(ValueError):
                png_dimensions(returned)

    def test_extra_fields_or_missing_decoded_live_witness_fails(self):
        metadata = self.metadata()
        del metadata["response"]["decodedSha256"]
        with self.assertRaises(ValueError):
            validate(self.request, metadata, self.source)
        metadata = self.metadata()
        metadata["response"]["privateReasoning"] = "forbidden"
        with self.assertRaises(ValueError):
            validate(self.request, metadata, self.source)


if __name__ == "__main__":
    unittest.main()
