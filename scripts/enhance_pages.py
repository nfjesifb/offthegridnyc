"""Add metadata and shared discovery actions to existing pages and their template.
Idempotent; never contacts the photo APIs or rewrites editorial copy.
"""
import html
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
START, END = '<!-- discovery:head -->', '<!-- /discovery:head -->'
BODY_START, BODY_END = '<!-- discovery:tools -->', '<!-- /discovery:tools -->'

def enhance(path, slug, description, image=None, template=False):
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'\s*<!-- discovery:head -->.*?<!-- /discovery:head -->\s*', '', text, flags=re.S)
    text = re.sub(r'\s*<!-- discovery:tools -->.*?<!-- /discovery:tools -->\s*', '', text, flags=re.S)
    description = '{{ description|striptags|e }}' if template else html.escape(description, quote=True)
    url = f'https://offthegridnyc.com/locations/{slug}/index.html'
    title = '{{ name|e }} · Off The Grid NYC' if template else html.escape(re.search(r'<title>(.*?)</title>', text, re.S).group(1), quote=True)
    head = f'''\n  {START}
  <meta name="description" content="{description}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="https://offthegridnyc.com/{image or 'assets/images/social-card.png'}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="../../assets/css/place-tools.css">
  <script type="module" src="../../src/js/place-tools.js"></script>
  {END}\n'''
    text = text.replace('</head>', head + '</head>')
    toolbar = f'''\n    {BODY_START}
    <section class="otg-tools" data-slug="{slug}" aria-label="Plan your next detour">
      <button type="button" data-save-place aria-pressed="false">♡ Save this place</button>
      <button type="button" data-share-place>Share this place ↗</button>
      <a href="../../?saved=1#explore">View saved places</a>
      <a href="../../#explore">Explore the field guide ↗</a>
      <p>Human-curated, with AI-assisted descriptions. Check details and access before visiting. Some places are private; enjoy them from public streets.</p>
      <p class="otg-status" role="status" aria-live="polite"></p>
      <input class="otg-share-url" aria-label="Share link" readonly hidden>
      <div class="otg-related" aria-label="Related places"></div>
    </section>
    {BODY_END}\n'''
    text = re.sub(r'(<main\b[^>]*>)', lambda match: match.group(1) + toolbar, text, count=1)
    # Existing pages have no borough/neighborhood values; avoid exposing placeholders.
    if template:
        text = text.replace('{{ borough }} / {{ neighborhood }}', "{% if borough != 'N/A' %}{{ borough }}{% endif %}{% if neighborhood != 'N/A' %} / {{ neighborhood }}{% endif %}")
    else:
        text = text.replace('N/A / N/A', 'Off The Grid NYC')
    text = re.sub(r'(?: title="Street view of this location")+', '', text)
    text = text.replace('class="w-full h-full border-0" allowfullscreen', 'title="Street view of this location" class="w-full h-full border-0" allowfullscreen')
    # Carousels remain user-controlled, respecting motion preferences by default.
    text = re.sub(r'\s*autoplay: \{\s*delay: 5000,\s*disableOnInteraction: false,\s*\},', '', text)
    path.write_text(text, encoding='utf-8')

def main():
    places = json.loads((ROOT / 'assets/data/places.json').read_text(encoding='utf-8'))['places']
    for place in places:
        enhance(ROOT / place['url'], place['slug'], place['description'], place['image'])
    enhance(ROOT / 'location-template.html', '{{ slug }}', '', template=True)
    print(f'Enhanced {len(places)} pages and the source template.')

if __name__ == '__main__':
    main()
