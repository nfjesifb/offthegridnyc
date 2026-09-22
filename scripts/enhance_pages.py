"""Render every place from one minimal template. No network calls or asset downloads."""
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parents[1]

def distance(a, b):
    value = sin(radians(b['lat']-a['lat'])/2)**2 + cos(radians(a['lat']))*cos(radians(b['lat']))*sin(radians(b['lng']-a['lng'])/2)**2
    return 3958.8 * 2 * asin(min(1, sqrt(value)))

def render(place, places):
    environment = Environment(loader=FileSystemLoader(ROOT), autoescape=select_autoescape(['html']), trim_blocks=True, lstrip_blocks=True)
    nearby = sorted((dict(p, distance=distance(place, p)) for p in places if p['slug'] != place['slug']), key=lambda p: p['distance'])[:4]
    access_note = 'Check current access before visiting. A place on this map is not necessarily open to the public.'
    if place['theme'] in ('communities', 'shared', 'houses', 'deep-lots', 'more'):
        access_note = 'Homes and shared residential spaces may be private. View from public streets unless entry is clearly permitted; map pins are reference points, not confirmed entrances.'
    return environment.get_template('location-template.html').render(place=place, nearby=nearby, access_note=access_note) + '\n'

def main():
    places = json.loads((ROOT / 'assets/data/places.json').read_text(encoding='utf-8'))['places']
    for place in places:
        target = ROOT / place['url']; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render(place, places), encoding='utf-8')
    print(f'Rendered {len(places)} complete place pages.')

if __name__ == '__main__': main()
