"""Build the place catalog from editorial JSON, original map notes and sourced additions.
No network calls. --thumbnails refreshes existing image previews (requires Pillow).
"""
import argparse
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {'k': 'http://www.opengis.net/kml/2.2'}
THEMES = [
    ('communities', 'Courts & communities', 'Off the Grid Communities'),
    ('streets', 'Streets', 'Good Streets'),
    ('unexpected', 'Unexpected places', 'Crazy that its Real Places'),
    ('shared', 'Shared spaces', 'Private Shared Space'),
    ('public-private', 'Public / private', 'Public Private Integrations'),
    ('houses', 'Unusual homes', 'Off the Grid Houses'),
    ('escapes', 'A different pace', 'Not City Amidst the City'),
    ('deep-lots', 'Deep lots', 'Brownstones with Deep lots (>170ft)'),
    ('more', 'Other places', ''),
]

class Credits(HTMLParser):
    def __init__(self):
        super().__init__(); self.items = []; self.current = None
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            url = dict(attrs).get('href', '')
            self.current = {'name': '', 'url': url if url.startswith('https://') else ''}
    def handle_data(self, text):
        if self.current is not None: self.current['name'] += text
    def handle_endtag(self, tag):
        if tag == 'a' and self.current is not None:
            self.items.append(self.current); self.current = None

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'p', 'div'): self.parts.append(' ')
    def handle_endtag(self, tag):
        if tag in ('p', 'div'): self.parts.append(' ')

def readable_note(value):
    # The KML contains HTML and a few damaged duplicate historical paragraphs.
    # Keep readable curator paragraphs; original source data remains untouched.
    parts = re.split(r'<br\s*/?>\s*<br\s*/?>', value, flags=re.I)
    parser = PlainText()
    parser.feed(' '.join(part for part in parts if chr(65533) not in part))
    return re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()

def key(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())

def build(thumbnails=False):
    document = ET.parse(ROOT / 'offthegridnyc.kml').getroot()
    notes = json.loads((ROOT / 'place-notes.json').read_text(encoding='utf-8'))
    cache = json.loads((ROOT / 'photo_cache.json').read_text(encoding='utf-8'))
    points = {}
    for folder in document.findall('.//k:Folder', NS):
        theme = next(t[0] for t in THEMES if t[2] == folder.findtext('k:name', '', NS))
        for point in folder.findall('k:Placemark', NS):
            points[key(point.findtext('k:name', '', NS))] = (point, theme)
    for point in document.findall('./k:Document/k:Placemark', NS):
        points[key(point.findtext('k:name', '', NS))] = (point, 'more')
    places, seen = [], set()
    for location in json.loads((ROOT / 'locations.json').read_text(encoding='utf-8')):
        slug = location['slug']
        if slug in seen: continue
        assert re.fullmatch(r'[a-z0-9-]+', slug), slug
        seen.add(slug)
        point, theme = points[key(location['name'])]
        lng, lat, *_ = map(float, point.findtext('.//k:Point/k:coordinates', '', NS).strip().split(','))
        assert -90 <= lat <= 90 and -180 <= lng <= 180, slug
        additions = notes.get(slug, {})
        original = readable_note(point.findtext('k:description', '', NS))
        description = additions.get('description') or location.get('description') or original
        assert description.strip(), f'{slug}: add a sourced description or a curator note before publishing'
        photos = []
        if location.get('hasPhotos') and not additions.get('hidePhotos'):
            photos = [path.relative_to(ROOT).as_posix() for path in sorted((ROOT / 'locations' / slug / 'images').glob('photo_*.jpg'))]
        thumbnail = f'assets/images/places/{slug}.webp'
        if thumbnails and photos:
            from PIL import Image, ImageOps
            target = ROOT / thumbnail; target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(ROOT / photos[0]) as image:
                image = ImageOps.exif_transpose(image).convert('RGB'); image.thumbnail((800, 600)); image.save(target, 'WEBP', quality=78)
        credits = Credits(); credits.feed(cache.get(location['name'], {}).get('attributions') or '')
        source_type = additions.get('descriptionOrigin', 'sourced') if additions.get('description') else ('catalog' if location.get('description') else 'curator')
        places.append({
            'slug': slug, 'name': additions.get('name', location['name'].strip()), 'originalName': location['name'].strip(),
            'description': description.strip(), 'descriptionOrigin': source_type,
            'history': location.get('history', '').strip(), 'context': additions.get('context', ''),
            'curatorNote': original if original and original != description.strip() and not additions.get('hideCuratorNote') else '',
            'sources': additions.get('sources', []), 'theme': theme,
            'themeLabel': next(t[1] for t in THEMES if t[0] == theme),
            'lat': lat, 'lng': lng, 'url': f'locations/{slug}/index.html',
            'image': (thumbnail if (ROOT / thumbnail).is_file() else photos[0]) if photos else None,
            'photos': photos, 'credits': credits.items,
        })
    target = ROOT / 'assets/data/places.json'; target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({'themes': [{'id': t[0], 'label': t[1]} for t in THEMES], 'places': places}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sections = []
    for theme, label, _ in THEMES:
        links = ''.join(f'<li><a href="../{p["url"]}">{html.escape(p["name"])}</a></li>' for p in sorted(places, key=lambda p: p['name'].lower()) if p['theme'] == theme)
        sections.append(f'<section><h2>{html.escape(label)}</h2><ul>{links}</ul></section>')
    directory = ROOT / 'browse/index.html'; directory.parent.mkdir(exist_ok=True)
    directory.write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>All places · Off The Grid NYC</title><meta name="description" content="Every place in the Off The Grid NYC map, organized by type.">
<link rel="canonical" href="https://offthegridnyc.com/browse/"><link rel="stylesheet" href="../assets/css/explore.css"><link rel="icon" href="../favicon.ico"></head>
<body><main class="directory"><a class="brand" href="../">Off The Grid <span>NYC</span></a><h1>All places</h1>
<p><a href="../">← Return to the map</a></p><div class="directory-grid">''' + ''.join(sections) + '</div></main></body></html>\n', encoding='utf-8')
    urls = ['https://offthegridnyc.com/', 'https://offthegridnyc.com/browse/'] + [f'https://offthegridnyc.com/{p["url"]}' for p in places]
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{html.escape(url)}</loc></url>\n' for url in urls) + '</urlset>\n', encoding='utf-8')
    print(f'Built {len(places)} unique places; no empty descriptions; {sum(bool(p["photos"]) for p in places)} photo galleries.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--thumbnails', action='store_true'); build(parser.parse_args().thumbnails)
