import json
import xml.etree.ElementTree as ET
import os
import re
import glob

# --- Configuration ---
JSON_FILE = 'locations.json'
KML_FILE = 'offthegridnyc.kml'
TEMPLATE_FILE = 'location-template.html'
OUTPUT_DIR = 'locations'
API_KEY = 'AIzaSyBBksh0YwSl7gekcaTX-_xRcBE-Me125rc' # Your Google API Key

# --- Helper Functions ---
def slugify(text):
    """Convert text into a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'\s+', '-', text)       # Replace spaces with hyphens
    text = re.sub(r'[^\w\-]+', '', text)  # Remove non-alphanumeric chars (except hyphen)
    text = re.sub(r'\-\-+', '-', text)     # Replace multiple hyphens with single
    text = text.strip('-')              # Trim leading/trailing hyphens
    return text

def parse_kml(kml_file):
    """Parses the KML file to extract coordinates for each placemark name."""
    coords_map = {}
    try:
        # Register namespace to handle KML structure properly
        namespaces = {'kml': 'http://www.opengis.net/kml/2.2'}
        tree = ET.parse(kml_file)
        root = tree.getroot()
        # Find Placemarks within the KML Document structure
        for placemark in root.findall('.//kml:Placemark', namespaces):
            name_tag = placemark.find('kml:name', namespaces)
            point_tag = placemark.find('.//kml:Point/kml:coordinates', namespaces)
            if name_tag is not None and point_tag is not None and name_tag.text:
                name = name_tag.text.strip()
                coords_text = point_tag.text.strip()
                try:
                    # Coordinates are typically lon,lat,alt
                    lon, lat, *_ = map(float, coords_text.split(','))
                    coords_map[name] = {'lat': lat, 'lng': lon}
                except (ValueError, IndexError) as e:
                    print(f"Warning: Could not parse coordinates for '{name}': {coords_text} - Error: {e}")
    except ET.ParseError as e:
        print(f"Error parsing KML file {kml_file}: {e}")
    except FileNotFoundError:
        print(f"Error: KML file not found at {kml_file}")
    return coords_map

# --- Main Script ---
if __name__ == "__main__":
    # 1. Read JSON data
    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            locations_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: JSON file not found at {JSON_FILE}")
        exit(1)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON file {JSON_FILE}: {e}")
        exit(1)

    # 2. Parse KML coordinates
    coordinates = parse_kml(KML_FILE)
    if not coordinates:
        print("Warning: No coordinates found or KML parsing failed. Location pages might lack map data.")

    # 3. Read HTML template
    try:
        with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
            template_content = f.read()
    except FileNotFoundError:
        print(f"Error: Template file not found at {TEMPLATE_FILE}")
        exit(1)

    # 4. Create output directory if it doesn't exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory '{OUTPUT_DIR}' ensured.")

    # 5. Generate pages and image directories
    generated_count = 0
    skipped_count = 0
    for location in locations_data:
        name = location.get('name', 'Unknown Location')
        description = location.get('description', 'No description available.')
        history = location.get('history', 'No history available.')

        # Ensure empty strings if null/None
        description = description if description else 'No description available.'
        history = history if history else 'No history available.'

        # Get coordinates from KML data
        coords = coordinates.get(name)
        if not coords:
            print(f"Warning: Coordinates not found in KML for '{name}'. Skipping map features for this page.")
            lat, lng = 0, 0 # Default coordinates if not found
            # Decide if you want to skip page generation entirely if no coords
            # skipped_count += 1
            # continue
        else:
            lat, lng = coords['lat'], coords['lng']

        # Create specific directory for this location's page and images
        location_slug = slugify(name)
        location_output_dir = os.path.join(OUTPUT_DIR, location_slug)
        images_dir = os.path.join(location_output_dir, 'images')
        os.makedirs(images_dir, exist_ok=True) # Create images subdir

        # Generate satellite image URL
        satellite_image_url = f"https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=18&size=600x400&maptype=satellite&key={API_KEY}"

        # Find local images
        image_files = []
        for ext in ('*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp'):
            image_files.extend(glob.glob(os.path.join(images_dir, ext)))

        # Generate carousel slides HTML
        carousel_slides_html = []
        # -- Satellite Slide --
        carousel_slides_html.append(
            f'  <div class="swiper-slide satellite-slide">'
            f'    <img src="{satellite_image_url}" alt="Satellite view of {name}">'
            f'    <span>Satellite View</span>'
            f'  </div>'
        )
        # -- Local Image Slides --
        for img_path in image_files:
            img_filename = os.path.basename(img_path)
            # Relative path from the HTML file to the image inside its 'images' subdir
            relative_img_src = os.path.join('images', img_filename).replace('\\', '/')
            carousel_slides_html.append(
                f'  <div class="swiper-slide">'
                f'    <img src="{relative_img_src}" alt="{name}">'
                f'  </div>'
            )

        carousel_content = "\n".join(carousel_slides_html)

        # Construct Roadview URL
        roadview_url = f"https://roadview.planninglabs.nyc/view/{lng}/{lat}"

        # Replace placeholders
        page_content = template_content.replace('{{LOCATION_NAME}}', name)
        page_content = page_content.replace('{{DESCRIPTION}}', description)
        page_content = page_content.replace('{{HISTORY}}', history)
        page_content = page_content.replace('{{LAT}}', str(lat))
        page_content = page_content.replace('{{LNG}}', str(lng))
        page_content = page_content.replace('{{CAROUSEL_SLIDES}}', carousel_content)
        page_content = page_content.replace('{{ROADVIEW_URL}}', roadview_url)
        # Ensure API key is replaced in both script URL and img src
        # page_content = page_content.replace('AIzaSyBBksh0YwSl7gekcaTX-_xRcBE-Me125rc', API_KEY) # Replacing placeholder if it was missed

        # API key replacement in template JS/Image URLs (if hardcoded in template)
        # It's better practice to ensure the template uses the API_KEY variable if needed,
        # but this handles cases where it might be directly in the template.
        # page_content = page_content.replace('YOUR_API_KEY_PLACEHOLDER', API_KEY)

        # Generate filename
        filename = 'index.html' # Output file will be index.html inside the location's folder
        filepath = os.path.join(location_output_dir, filename)

        # Write the generated page
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(page_content)
            generated_count += 1
        except (IOError, OSError) as e: # Catch OSError for directory issues too
            print(f"Error writing file or creating directory for {name} at {filepath}: {e}")
            skipped_count += 1

    print(f"\nGeneration complete.")
    print(f"  Pages generated: {generated_count}")
    print(f"  Pages skipped (due to errors/missing coords if configured): {skipped_count}")