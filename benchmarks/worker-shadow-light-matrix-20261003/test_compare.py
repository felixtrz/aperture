"""In-memory synthetic comparison tests, never native render evidence."""
import unittest
from PIL import Image
from compare import difference

class PixelTests(unittest.TestCase):
    def test_equal_rgb_and_rgba(self):
        image = Image.new("RGB", (8, 8), (4, 5, 6))
        self.assertEqual(difference(image, image.convert("RGBA")), {"differentPixels": 0, "maximumChannelDifference": 0, "boundsInclusive": None})

    def test_changed_pixels_and_inclusive_bounds(self):
        image = Image.new("RGB", (8, 8), (4, 5, 6))
        changed = image.copy()
        changed.putpixel((2, 3), (14, 5, 6))
        changed.putpixel((6, 5), (4, 25, 6))
        self.assertEqual(difference(image, changed), {"differentPixels": 2, "maximumChannelDifference": 20, "boundsInclusive": [2, 3, 6, 5]})

    def test_dimension_mismatch_fails(self):
        with self.assertRaises(ValueError):
            difference(Image.new("RGB", (8, 8)), Image.new("RGB", (9, 8)))

if __name__ == "__main__":
    unittest.main()
