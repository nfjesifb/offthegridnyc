import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('enhance_pages', ROOT / 'scripts/enhance_pages.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

class GenerationTests(unittest.TestCase):
    def test_page_enhancement_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'index.html'
            target.write_text((ROOT / 'locations/elevated-acre/index.html').read_text(encoding='utf-8'), encoding='utf-8')
            generator.enhance(target, 'elevated-acre', 'An elevated park.')
            first = target.read_text(encoding='utf-8')
            generator.enhance(target, 'elevated-acre', 'An elevated park.')
            self.assertEqual(first, target.read_text(encoding='utf-8'))
            self.assertEqual(first.count('title="Street view of this location"'), 1)
            self.assertEqual(first.count('<!-- discovery:tools -->'), 1)

    def test_template_enhancement_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'template.html'
            target.write_text((ROOT / 'location-template.html').read_text(encoding='utf-8'), encoding='utf-8')
            generator.enhance(target, '{{ slug }}', '', template=True)
            first = target.read_text(encoding='utf-8')
            generator.enhance(target, '{{ slug }}', '', template=True)
            self.assertEqual(first, target.read_text(encoding='utf-8'))
            self.assertIn('{{ description|striptags|e }}', first)

if __name__ == '__main__':
    unittest.main()
