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


SCRIPTS = {
    path.name: path.read_text(encoding='utf-8')
    for pattern in ('*.js', '*.mjs')
    for path in (Path(__file__).resolve().parents[1] / 'dist').glob(pattern)
}
# Names that are written in capitals anyway.
ACRONYMS = {'API', 'GUID', 'JSON', 'UI', 'ID', 'NPC', 'XP'}


class LabelCaseTests(unittest.TestCase):
    """The shared spec has no all-caps labels (#46): text is written as it reads."""

    def test_no_text_is_upper_cased_in_script(self):
        for name, source in SCRIPTS.items():
            with self.subTest(script=name):
                # Capitalising a first letter, for sentence case, is fine.
                calls = re.findall(r'(?<!\[0\]\.)(?<!charAt\(0\)\.)toUpperCase\(\)', source)
                self.assertEqual(calls, [])

    def test_markup_text_has_no_all_caps_words(self):
        for name, source in SCRIPTS.items():
            with self.subTest(script=name):
                shouting = []
                # Text between tags, and quoted words, in the markup the scripts write.
                for text in re.findall(r">([^<>`$]+)<|'([A-Za-z][A-Za-z ·]*)'", source):
                    for word in re.findall(r'\b[A-Z]{3,}\b', ''.join(text)):
                        if word not in ACRONYMS:
                            shouting.append(word)
                self.assertEqual(shouting, [])


if __name__ == '__main__':
    unittest.main()
