import os
import sys

LOCATIONS_DIR = 'locations'
FAVICON_LINK_HTML = '  <link rel="icon" href="/favicon.ico" type="image/x-icon">\n'
HEAD_TAG_END = '</head>'

def add_favicon_to_html(file_path):
    """Reads an HTML file, adds a favicon link if missing, and saves it."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if favicon link already exists (simple check)
        if FAVICON_LINK_HTML.strip() in content:
            print(f"Skipped (already present): {file_path}")
            return False

        # Find the closing head tag and insert before it
        head_end_index = content.find(HEAD_TAG_END)
        if head_end_index == -1:
            print(f"Warning: Could not find {HEAD_TAG_END} in {file_path}. Skipping.")
            return False

        new_content = content[:head_end_index] + FAVICON_LINK_HTML + content[head_end_index:]

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {file_path}")
        return True

    except IOError as e:
        print(f"Error processing file {file_path}: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred with {file_path}: {e}")
        return False

if __name__ == "__main__":
    print(f"Starting favicon update in '{LOCATIONS_DIR}' directory...")
    updated_count = 0
    skipped_count = 0
    error_count = 0

    if not os.path.isdir(LOCATIONS_DIR):
        print(f"Error: Directory '{LOCATIONS_DIR}' not found.")
        sys.exit(1)

    for root, dirs, files in os.walk(LOCATIONS_DIR):
        for filename in files:
            if filename.lower() == 'index.html':
                full_path = os.path.join(root, filename)
                if add_favicon_to_html(full_path):
                    updated_count += 1
                else:
                    # Could be skipped or error, check logs for specifics
                    # For simplicity here, we don't differentiate further in counts
                    pass # Message already printed by the function

    print(f"\nFavicon update process finished.")
    print(f"  Files updated: {updated_count}")
    # Note: Skipped count isn't precisely tracked here, rely on function output
