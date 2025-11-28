import json
import xml.etree.ElementTree as ET
import os
import re
import glob
import requests
import time
import argparse
from jinja2 import Environment, FileSystemLoader

# --- Configuration ---
JSON_FILE = 'locations.json'
KML_FILE = 'offthegridnyc.kml'
STREETVIEW_KML_FILE = 'offthegridnycstreetview.kml' # Added for specific street view coords
TEMPLATE_FILE = 'location-template.html'
OUTPUT_DIR = 'locations'
API_KEY = 'AIzaSyAmyMcwz10htD0p0FLI3S4WgAAnnVQdf4I' # Your Google API Key (Updated)
CACHE_FILE = 'photo_cache.json' # Added for caching photo results
STATIC_MAP_CACHE = {} # Added for caching static map images

# Default Street View Parameters (if not found in KML)
DEFAULT_HEADING = 0
DEFAULT_PITCH = 0
DEFAULT_ZOOM = 1

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
    """Parses the KML file to extract coordinates and LookAt params for each placemark name."""
    data_map = {}
    try:
        # Register namespace to handle KML structure properly
        namespaces = {'kml': 'http://www.opengis.net/kml/2.2'}
        tree = ET.parse(kml_file)
        root = tree.getroot()
        # Find Placemarks within the KML Document structure
        for placemark in root.findall('.//kml:Placemark', namespaces):
            name_tag = placemark.find('kml:name', namespaces)
            point_tag = placemark.find('.//kml:Point/kml:coordinates', namespaces)
            lookat_tag = placemark.find('.//kml:LookAt', namespaces) # Find LookAt tag

            if name_tag is not None and point_tag is not None and name_tag.text:
                name = name_tag.text.strip()
                coords_text = point_tag.text.strip()
                location_data = {}
                try:
                    # Coordinates are typically lon,lat,alt
                    lon, lat, *_ = map(float, coords_text.split(','))
                    location_data['lat'] = lat
                    location_data['lng'] = lon
                except (ValueError, IndexError) as e:
                    print(f"Warning: Could not parse coordinates for '{name}': {coords_text} - Error: {e}")
                    continue # Skip if coordinates are bad

                # Extract LookAt parameters if available
                if lookat_tag is not None:
                    heading_tag = lookat_tag.find('kml:heading', namespaces)
                    pitch_tag = lookat_tag.find('kml:tilt', namespaces) # KML uses 'tilt' for pitch
                    range_tag = lookat_tag.find('kml:range', namespaces) # Range can approximate zoom

                    location_data['heading'] = float(heading_tag.text) if heading_tag is not None and heading_tag.text else DEFAULT_HEADING
                    location_data['pitch'] = float(pitch_tag.text) if pitch_tag is not None and pitch_tag.text else DEFAULT_PITCH
                    # Simple range-to-zoom conversion (adjust as needed)
                    if range_tag is not None and range_tag.text:
                        range_val = float(range_tag.text)
                        location_data['zoom'] = max(0, 20 - (range_val / 50)) # Heuristic conversion
                    else:
                        location_data['zoom'] = DEFAULT_ZOOM
                else:
                    location_data['heading'] = DEFAULT_HEADING
                    location_data['pitch'] = DEFAULT_PITCH
                    location_data['zoom'] = DEFAULT_ZOOM

                data_map[name] = location_data

    except ET.ParseError as e:
        print(f"Error parsing KML file {kml_file}: {e}")
    except FileNotFoundError:
        print(f"Error: KML file not found at {kml_file}")
    return data_map

def get_place_photos(place_name, api_key, lat=None, lng=None):
    """Uses Text Search (New) to find a place and returns its ID and photo resource names.
    Includes optional location bias for better accuracy.
    """ # Docstring updated
    search_query = f"{place_name} NYC"
    search_url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': api_key,
        'X-Goog-FieldMask': 'places.id,places.photos' # Ensure ID and photos are requested
    }
    data = {
        'textQuery': search_query
    }

    # Add location bias if coordinates are provided
    if lat is not None and lng is not None:
        data['locationBias'] = {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng
                },
                "radius": 1000.0 # Bias results within a 1km radius
            }
        }
        print(f"  Using location bias: lat={lat}, lng={lng}")

    try:
        response = requests.post(search_url, headers=headers, json=data, timeout=15) # Increased timeout slightly
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        result = response.json()

        if 'places' in result and result['places']:
            place = result['places'][0] # Assume the first result is the most relevant
            place_id = place.get('id')
            photo_names = []
            if place_id and 'photos' in place and place['photos']:
                # Get up to 5 photo resource names
                photo_names = [photo['name'] for photo in place['photos'][:5]]
                print(f"  Found place ID '{place_id}' and {len(photo_names)} photo(s) for '{place_name}' via Places API.")
                return {'place_id': place_id, 'photo_names': photo_names}
            elif place_id:
                 print(f"  Found place ID '{place_id}' but no photos for '{place_name}' via Places API.")
                 return {'place_id': place_id, 'photo_names': []} # Return ID even if no photos
            else:
                print(f"  Place found for '{place_name}' but missing ID.")
        else:
            print(f"  Place not found for '{place_name} NYC' via Places API.")

    except requests.exceptions.RequestException as e:
        print(f"Error calling Places API search for '{place_name}': {e}")
    except Exception as e:
        print(f"An unexpected error occurred processing Places API search response for '{place_name}': {e}")

    return None # Return None if place/ID not found or error occurred

def get_place_attributions(place_id, api_key):
    """Fetches HTML attributions for a given place ID using the Places API (v1)."""
    if not place_id:
        return None

    details_url = f"https://places.googleapis.com/v1/places/{place_id}"
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': api_key,
        # Request photo author attributions specifically
        'X-Goog-FieldMask': 'photos.authorAttributions'
    }

    try:
        response = requests.get(details_url, headers=headers, timeout=10)
        response.raise_for_status()
        result = response.json()

        html_attributions = []
        # Check if 'photos' key exists and is a list
        photos_data = result.get('photos', [])
        if isinstance(photos_data, list):
            for photo in photos_data:
                # Check if 'authorAttributions' key exists and is a list
                attributions = photo.get('authorAttributions', [])
                if isinstance(attributions, list):
                    for attr in attributions:
                        display_name = attr.get('displayName', 'Unknown Contributor')
                        uri = attr.get('uri')
                        # Create an HTML link if URI is available
                        if uri:
                            # Ensure URI starts with https: (Google URIs often start with //)
                            if uri.startswith('//'):
                                uri = 'https:' + uri
                            html_attributions.append(f'<a href="{uri}" target="_blank" rel="noopener noreferrer">{display_name}</a>')
                        else:
                            html_attributions.append(display_name)

        if html_attributions:
            # Join unique attributions with a separator (e.g., comma or period)
            # Using set to remove duplicates, then join
            unique_attributions = list(set(html_attributions))
            combined_attributions = ", ".join(unique_attributions)
            print(f"  Found attributions for place ID '{place_id}'.")
            return combined_attributions
        else:
            print(f"  No attributions found for place ID '{place_id}'.")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error calling Places API details for place ID '{place_id}': {e}")
        return None
    except Exception as e: # Catch unexpected errors
        print(f"An unexpected error occurred processing Places API details response for '{place_id}': {e}")
        return None

def construct_photo_url(photo_name, api_key, max_width=1200):
    """Constructs the URL for the Place Photo (New) API media endpoint."""
    # Correct format: https://places.googleapis.com/v1/{NAME}/media?key=YOUR_API_KEY&maxWidthPx=400
    # NAME is the resource name from the Photos object, e.g. places/PLACE_ID/photos/PHOTO_RESOURCE
    if not photo_name or not photo_name.startswith('places/'):
        print(f"Warning: Invalid or missing photo resource name format: {photo_name}")
        return None
    base_url = "https://places.googleapis.com/v1"
    # Ensure photo_name is used directly as it contains the full resource path
    full_url = f"{base_url}/{photo_name}/media?key={api_key}&maxWidthPx={max_width}&skipHttpRedirect=true"
    return full_url

def download_image(url, save_path):
    """Downloads an image from a URL and saves it to a specified path.
    Handles the two-step process for the new Places Photo API (v1) which
    returns a JSON with photoUri when skipHttpRedirect=true.
    """
    try:
        # First request to get the JSON response with photoUri
        print(f"  Fetching photo metadata from: {url[:100]}...") # Shorten URL for logging
        meta_response = requests.get(url)
        meta_response.raise_for_status()

        try:
            photo_data = meta_response.json()
        except json.JSONDecodeError:
            print(f"  Error: Response from {url[:100]}... was not valid JSON.")
            # Attempt to download directly if it wasn't JSON (maybe old API link?)
            print("  Attempting direct download...")
            image_response = requests.get(url, stream=True)
            image_response.raise_for_status()
            image_content = image_response.content
        else:
            photo_uri = photo_data.get('photoUri')
            if not photo_uri:
                print(f"  Error: 'photoUri' not found in response from {url[:100]}...")
                return False

            print(f"  Fetching actual image from: {photo_uri[:100]}...")
            # Second request to download the actual image
            image_response = requests.get(photo_uri, stream=True)
            image_response.raise_for_status()
            image_content = image_response.content # Read content directly for saving

        # Save the image content
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, 'wb') as f:
            f.write(image_content)
        # Keep log message concise
        print(f"  Successfully downloaded image to {os.path.basename(save_path)}")
        return True

    except requests.exceptions.RequestException as e:
        # Log specific error if possible (e.g., status code)
        err_msg = str(e)
        if hasattr(e, 'response') and e.response is not None:
            err_msg += f" (Status code: {e.response.status_code})"
        print(f"  Error downloading image metadata/data related to {url[:100]}...: {err_msg}")
    except IOError as e:
        print(f"  Error saving image to {save_path}: {e}")
    except Exception as e: # Catch unexpected errors
        print(f"  An unexpected error occurred during image download: {e}")

    return False

# --- Main Script ---
if __name__ == "__main__":
    # --- Argument Parsing ---
    parser = argparse.ArgumentParser(description='Generate location pages for Off The Grid NYC.')
    parser.add_argument('--force-refresh', action='store_true',
                        help='Force refresh of Google Places photo data, ignoring the cache.')
    args = parser.parse_args()

    # --- Load Cache ---
    photo_cache = {}
    if os.path.exists(CACHE_FILE) and not args.force_refresh:
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                photo_cache = json.load(f)
            print(f"Loaded photo cache from {CACHE_FILE}")
        except (IOError, json.JSONDecodeError) as e:
            print(f"Warning: Could not load or parse cache file {CACHE_FILE}: {e}. Proceeding without cache.")
            photo_cache = {}
    elif args.force_refresh:
        print("Cache refresh forced. API calls will be made.")

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

    # 2. Parse KML files
    print(f"Parsing KML file: {KML_FILE}")
    map_coords = parse_kml(KML_FILE) # For main map marker
    print(f"Parsing Street View KML file: {STREETVIEW_KML_FILE}")
    streetview_data = parse_kml(STREETVIEW_KML_FILE) # For street view positioning and POV

    if not map_coords:
        print("Error: Could not parse map coordinates from KML. Exiting.")
        exit(1)

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

    # Setup Jinja2 environment ONCE before the loop
    env = Environment(loader=FileSystemLoader('.'))
    try:
        # Load the template ONCE
        template = env.get_template('location-template.html')
    except Exception as e:
        print(f"Error loading template 'location-template.html': {e}")
        exit(1)

    photo_status_map = {} # Dictionary to store photo download status and slug for each location

    for location in locations_data:
        name = location.get('name', 'Unknown Location')
        description = location.get('description', 'No description available.')
        history = location.get('history', 'No history available.')
        borough = location.get('borough', 'N/A')
        neighborhood = location.get('neighborhood', 'N/A')
        cross_streets = location.get('cross_streets', 'N/A')
        address = location.get('address', 'N/A')

        # Ensure empty strings if null/None
        description = description if description else 'No description available.'
        history = history if history else 'No history available.'

        # Get coordinates from parsed KML data
        if name not in map_coords:
            print(f"Warning: Map coordinates not found in KML for '{name}'. Skipping this location.")
            skipped_count += 1
            continue # Skip this location if map coords missing

        map_lat = map_coords[name]['lat']
        map_lng = map_coords[name]['lng']

        # Get specific Street View coordinates and POV from parsed street view KML data
        if name in streetview_data:
            sv_entry = streetview_data[name]
            roadview_heading = sv_entry.get('heading', DEFAULT_HEADING)
            roadview_pitch = sv_entry.get('pitch', DEFAULT_PITCH)
            roadview_zoom = sv_entry.get('zoom', DEFAULT_ZOOM)
            # Use street view coords for the actual panorama position
            streetview_lat = sv_entry.get('lat', map_lat)
            streetview_lng = sv_entry.get('lng', map_lng)
        else:
            print(f"Warning: Street View data not found for '{name}'. Using defaults and map coordinates.")
            roadview_heading = DEFAULT_HEADING
            roadview_pitch = DEFAULT_PITCH
            roadview_zoom = DEFAULT_ZOOM
            streetview_lat, streetview_lng = map_lat, map_lng # Fallback

        # Create specific directory for this location's page and images
        location_slug = slugify(name)
        location_output_dir = os.path.join(OUTPUT_DIR, location_slug)
        images_dir = os.path.join(location_output_dir, 'images')
        os.makedirs(images_dir, exist_ok=True) # Create images subdir

        # --- Fetch Google Places Info (with Caching) ---
        print(f"Processing: {name}")
        google_photo_urls = []
        photo_resource_names = [] # Initialize
        attributions = None # Initialize attributions
        place_id = None # Initialize place_id

        # Check cache first unless force_refresh is set
        cached_data = photo_cache.get(name)

        if not args.force_refresh and cached_data:
            photo_resource_names = cached_data.get('photo_names', [])
            attributions = cached_data.get('attributions') # Can be None if not previously fetched/found
            place_id = cached_data.get('place_id') # Get cached place_id too
            print(f"  Cache hit for {name}. Found {len(photo_resource_names)} photo names. Attributions cached: {'Yes' if attributions else 'No'}")

            # If attributions weren't cached previously but we have a place_id, try fetching them now
            if not attributions and place_id and API_KEY:
                 print(f"  Cached data found, but attributions missing. Fetching attributions for {place_id}...")
                 attributions = get_place_attributions(place_id, API_KEY)
                 # Update cache entry immediately if attributions found
                 if attributions:
                     photo_cache[name]['attributions'] = attributions

        else:
            if args.force_refresh and name in photo_cache:
                 print(f"  Force refresh for {name}. Clearing cached data and calling Places API...")
            # --- Call APIs if cache miss or force_refresh ---
            # Pass coordinates for location bias
            photo_api_result = get_place_photos(name, API_KEY, lat=map_lat, lng=map_lng)

            if photo_api_result:
                place_id = photo_api_result.get('place_id')
                photo_resource_names = photo_api_result.get('photo_names', [])

                if place_id:
                    attributions = get_place_attributions(place_id, API_KEY)
                else:
                    print(f"  Warning: Could not get place_id for {name}, cannot fetch attributions.")

                # Update cache with new data
                photo_cache[name] = {
                    'place_id': place_id,
                    'photo_names': photo_resource_names,
                    'attributions': attributions
                }
            else:
                # Place not found or error occurred during photo search
                # Ensure cache reflects this by storing empty data or removing the entry
                photo_cache[name] = {
                    'place_id': None,
                    'photo_names': [],
                    'attributions': None
                }
                print(f"  Places API search failed for {name}. No photos or attributions will be available.")

        # --- Construct Photo URLs & Download ---
        if photo_resource_names:
            # print(f"DEBUG: Found {len(photo_resource_names)} photo names for {name}.") # Less verbose debug
            for photo_name in photo_resource_names:
                photo_url = construct_photo_url(photo_name, API_KEY)
                if photo_url:
                    # print(f"\nDEBUG: Test this Google Photo URL in your browser:\n{photo_url}\n") # Optional detailed debug
                    google_photo_urls.append(photo_url)
                else:
                    print(f"  Warning: Could not construct URL for photo name {photo_name}")
        else:
             # Ensure this message shows even if API returned empty/error previously and was cached
            if not args.force_refresh and name in photo_cache and not photo_cache[name]:
                 pass # Already printed cache hit message, no need for 'No photos found' again unless it was a fresh API call
            elif args.force_refresh or name not in photo_cache: # Only print if it was a fresh API call result
                print(f"  No photos found for '{name}' via Places API.")

        # Download Google Places Photos
        local_photo_paths = []
        for i, url in enumerate(google_photo_urls):
            photo_filename = f"photo_{i+1}.jpg"
            photo_save_path_abs = os.path.join(images_dir, photo_filename)
            # Path root-absolute for template: '/locations/<slug>/images/photo_1.jpg'
            path_for_template = '/' + os.path.join('locations', location_slug, 'images', photo_filename).replace('\\', '/')
                        
            # Check if file exists
            if os.path.exists(photo_save_path_abs) and os.path.getsize(photo_save_path_abs) > 0:
                 print(f"  Using existing photo: {photo_filename}")
                 local_photo_paths.append(path_for_template)
                 continue

            # Download the image
            if download_image(url, photo_save_path_abs):
                local_photo_paths.append(path_for_template)

        planning_labs_roadview_url = f"https://roadview.planninglabs.nyc/view/{streetview_lng}/{streetview_lat}"

        # Prepare template context
        context = {
            'name': name,
            'borough': borough,
            'neighborhood': neighborhood,
            'cross_streets': cross_streets,
            'address': address,
            'description': description,
            'history': history,
            'lat': streetview_lat, # Use coords consistent with Street View
            'lng': streetview_lng,
            'google_maps_api_key': API_KEY,
            'street_view_data': {
                'lat': streetview_lat,
                'lng': streetview_lng,
                'heading': roadview_heading,
                'pitch': roadview_pitch,
                'zoom': roadview_zoom
            },
            'photos': local_photo_paths,
            'planning_labs_roadview_url': planning_labs_roadview_url,
            'slug': location_slug,
            'attributions': attributions # Add attributions to context
            # Add any other variables needed by the template
        }

        # Track if photos were successfully processed for this location
        location_has_photos = bool(local_photo_paths)
        # Store both status and slug
        photo_status_map[name] = {'hasPhotos': location_has_photos, 'slug': location_slug}

        # Render the template with the context
        rendered_html = template.render(context)

        # Write the rendered HTML to the output file
        output_path = os.path.join(location_output_dir, 'index.html')
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(rendered_html)

        print(f"Generated page for {location['name']} ({output_path})")

    # --- Save Cache ---
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(photo_cache, f, indent=2) # Use indent for readability
        print(f"Saved photo cache to {CACHE_FILE}")
    except IOError as e:
        print(f"Error saving photo cache to {CACHE_FILE}: {e}")

    # --- Update original JSON with photo status and slug ---
    print("\nUpdating offthegridnyc.json with photo status and slug...")
    try:
        # Re-read the original data structure to ensure we have the latest full list
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            # Load into a new variable to avoid modifying the one used in the loop if needed elsewhere
            master_locations_data = json.load(f)

        updated_count = 0
        # Add the flag and slug to the master data structure
        for location_dict in master_locations_data:
            loc_name = location_dict.get('name')
            if loc_name:
                # Use the status and slug recorded during the run
                status_info = photo_status_map.get(loc_name) # Get the dict we stored
                if status_info:
                    location_dict['hasPhotos'] = status_info.get('hasPhotos', False)
                    location_dict['slug'] = status_info.get('slug')
                else:
                    # Location might have been skipped or name mismatch
                    location_dict['hasPhotos'] = False
                    # Generate slug as a fallback if needed, though ideally it matches
                    location_dict['slug'] = slugify(loc_name) if loc_name else None

                if loc_name in photo_status_map: # Count only if we actively processed it
                    updated_count +=1
            else:
                # Handle entries potentially missing a name
                location_dict['hasPhotos'] = False
                location_dict['slug'] = None

        # Write the updated data back to the JSON file
        with open(JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(master_locations_data, f, indent=2) # Use indent for readability
        print(f"Successfully updated {updated_count} locations in {JSON_FILE} with 'hasPhotos' and 'slug' info.")

    except Exception as e:
        print(f"Error updating {JSON_FILE}: {e}")

    print(f"\nGeneration complete.")
    # Adjust counts as needed, these might be less relevant now
    # print(f"  Pages generated: {generated_count}")
    # print(f"  Pages skipped (due to errors/missing coords if configured): {skipped_count}")