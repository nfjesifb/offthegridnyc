import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('enhance_pages', ROOT / 'scripts/enhance_pages.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
PLACES = json.loads((ROOT / 'assets/data/places.json').read_text(encoding='utf-8'))['places']


class GenerationTests(unittest.TestCase):
    def test_every_checked_in_page_matches_the_template(self):
        for place in PLACES:
            with self.subTest(place=place['slug']):
                content = generator.render(place, PLACES)
                self.assertEqual(content, (ROOT / place['url']).read_text(encoding='utf-8'))
                self.assertEqual(content.count('id="context-map"'), 1)
                self.assertNotIn('<iframe', content)

    def test_editorial_content_and_attributes_are_escaped(self):
        place = copy.deepcopy(PLACES[0])
        place.update(name='A "quoted" <place>', description='<script>alert(1)</script>', context='A & B')
        content = generator.render(place, PLACES)
        self.assertNotIn('<script>alert(1)</script>', content)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;', content)
        self.assertIn('A &amp; B', content)
        self.assertIn('&#34;quoted&#34;', content)

    def test_empty_sections_are_omitted_and_sourced_copy_is_used(self):
        place = next(p for p in PLACES if p['slug'] == 'temple-court')
        content = generator.render(place, PLACES)
        self.assertNotIn('class="gallery"', content)
        self.assertIn('Windsor Terrace', content)
        self.assertIn('brownstoner.com', content)
        self.assertNotIn('not independently verified', content)
        empty = dict(place, history='', context='', curatorNote='', sources=[])
        self.assertNotIn('<h2>Background</h2>', generator.render(empty, PLACES))

    def test_nearby_distance_is_geographic_and_symmetric(self):
        self.assertEqual(generator.distance(PLACES[0], PLACES[0]), 0)
        self.assertAlmostEqual(generator.distance(PLACES[0], PLACES[1]), generator.distance(PLACES[1], PLACES[0]))


if __name__ == '__main__':
    unittest.main()
