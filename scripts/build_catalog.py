"""Build discovery data and directory from the existing sources, without API calls.
Use --thumbnails to refresh WebP previews (requires Pillow).
"""
import argparse
import html
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {'k': 'http://www.opengis.net/kml/2.2'}
THEMES = [
    ('communities', 'Hidden courts & communities', 'Off the Grid Communities'),
    ('streets', 'Streets worth a detour', 'Good Streets'),
    ('unexpected', 'Unexpected NYC', 'Crazy that its Real Places'),
    ('shared', 'Shared spaces', 'Private Shared Space'),
    ('public-private', 'Public meets private', 'Public Private Integrations'),
    ('houses', 'Unusual homes', 'Off the Grid Houses'),
    ('escapes', 'A different pace', 'Not City Amidst the City'),
    ('deep-lots', 'Deep-lot brownstones', 'Brownstones with Deep lots (>170ft)'),
    ('more', 'More discoveries', ''),
]

def key(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())

def build(thumbnails=False):
    document = ET.parse(ROOT / 'offthegridnyc.kml').getroot()
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
        if slug in seen:
            continue
        seen.add(slug)
        point, theme = points[key(location['name'])]
        lng, lat, *_ = map(float, point.findtext('.//k:Point/k:coordinates', '', NS).strip().split(','))
        assert -90 <= lat <= 90 and -180 <= lng <= 180, slug
        page = f'locations/{slug}/index.html'
        assert (ROOT / page).is_file(), f'Missing detail page: {page}'
        photo = f'locations/{slug}/images/photo_1.jpg'
        thumbnail = f'assets/images/places/{slug}.webp'
        if thumbnails and (ROOT / photo).is_file():
            from PIL import Image, ImageOps
            target = ROOT / thumbnail
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(ROOT / photo) as image:
                image = ImageOps.exif_transpose(image).convert('RGB')
                image.thumbnail((800, 600))
                image.save(target, 'WEBP', quality=78)
        places.append({
            'slug': slug, 'name': location['name'].strip(), 'description': location.get('description', ''),
            'history': location.get('history', ''), 'theme': theme,
            'themeLabel': next(t[1] for t in THEMES if t[0] == theme),
            'lat': lat, 'lng': lng, 'url': page,
            'image': thumbnail if (ROOT / thumbnail).is_file() else (photo if (ROOT / photo).is_file() else None),
        })
    target = ROOT / 'assets/data/places.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({'themes': [{'id': t[0], 'label': t[1]} for t in THEMES], 'places': places}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    sections = []
    for theme, label, _ in THEMES:
        links = ''.join(f'<li><a href="../{p["url"]}">{html.escape(p["name"])}</a></li>' for p in places if p['theme'] == theme)
        sections.append(f'<section><h2>{html.escape(label)}</h2><ul>{links}</ul></section>')
    directory = ROOT / 'browse/index.html'
    directory.parent.mkdir(exist_ok=True)
    directory.write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>All places · Off The Grid NYC</title><meta name="description" content="Browse every place in the Off The Grid NYC guide, organized by theme.">
<link rel="canonical" href="https://offthegridnyc.com/browse/"><link rel="stylesheet" href="../assets/css/explore.css"><link rel="icon" href="../favicon.ico"></head>
<body><main class="shell directory"><a class="brand" href="../">OFF THE GRID <span>NYC</span></a><p class="eyebrow">The complete field guide</p><h1>Every place has a story.</h1>
<p>Human-curated places. AI-assisted descriptions. Check access before visiting; some places are private homes.</p><p><a href="../#explore">Open the interactive explorer →</a></p><div class="directory-grid">''' + ''.join(sections) + '</div></main></body></html>\n', encoding='utf-8')
    urls = ['https://offthegridnyc.com/', 'https://offthegridnyc.com/browse/'] + [f'https://offthegridnyc.com/{p["url"]}' for p in places]
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{html.escape(url)}</loc></url>\n' for url in urls) + '</urlset>\n', encoding='utf-8')
    print(f'Built {len(places)} unique places across {len(THEMES)} themes.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--thumbnails', action='store_true')
    build(parser.parse_args().thumbnails)
