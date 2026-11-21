"""Guard the shared design tokens and Atlas type floor."""
import re
import unittest
from pathlib import Path

STYLES = (Path(__file__).resolve().parents[1] / 'dist' / 'style.css').read_text(encoding='utf-8')
STYLES = re.sub(r'/\*.*?\*/', '', STYLES, flags=re.S)
ROOT = re.search(r':root\s*\{([^}]+)\}', STYLES)
HEX = r'(?<![\w-])#[\da-fA-F]{3,8}\b'


class DesignTests(unittest.TestCase):
    def test_hex_colors_are_declared_as_tokens(self):
        outside_root = STYLES[:ROOT.start()] + STYLES[ROOT.end():]
        colors = []
        for block in re.findall(r'\{([^{}]*)\}', outside_root):
            colors.extend(re.findall(HEX, block))
        self.assertEqual(colors, [])

    def test_font_sizes_follow_the_shared_type_floor(self):
        sizes = re.findall(r'(?:^|[;{])\s*font(?:-size)?\s*:\s*([^;}]+)', STYLES)
        for value in sizes:
            with self.subTest(value=value):
                self.assertNotRegex(value, r'\b\d+(?:\.\d+)?px\b')
                for size in re.findall(r'(?<![\w.])(\d*\.?\d+)rem\b', value):
                    self.assertGreaterEqual(float(size), 0.875)


if __name__ == '__main__':
    unittest.main()
