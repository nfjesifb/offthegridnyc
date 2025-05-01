import os
import sys
import re

LOCATIONS_DIR = 'locations'
GA_TAG_SNIPPET = '''
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-DS1YWJT1KC"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-DS1YWJT1KC');
</script>
'''
GA_CONFIG_LINE = "gtag('config', 'G-DS1YWJT1KC');" # Unique line to check for existence
HEAD_TAG_START_PATTERN = re.compile(r'<head.*?>', re.IGNORECASE | re.DOTALL)

def add_ga_to_html(file_path):
    """Reads an HTML file, adds the GA tag if missing, and saves it."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if GA config line already exists
        if GA_CONFIG_LINE in content:
            print(f"Skipped (already present): {file_path}")
            return False

        # Find the opening head tag (case-insensitive)
        match = HEAD_TAG_START_PATTERN.search(content)
        if not match:
            print(f"Warning: Could not find opening <head> tag in {file_path}. Skipping.")
            return False

        # Insert the snippet immediately after the opening <head> tag
        insert_pos = match.end()
        new_content = content[:insert_pos] + GA_TAG_SNIPPET + content[insert_pos:]

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
    print(f"Starting Google Analytics tag update in '{LOCATIONS_DIR}' directory...")
    updated_count = 0

    if not os.path.isdir(LOCATIONS_DIR):
        print(f"Error: Directory '{LOCATIONS_DIR}' not found.")
        sys.exit(1)

    for root, dirs, files in os.walk(LOCATIONS_DIR):
        for filename in files:
            # Process only index.html files within the locations subdirectories
            if filename.lower() == 'index.html' and os.path.basename(root) != LOCATIONS_DIR:
                full_path = os.path.join(root, filename)
                if add_ga_to_html(full_path):
                    updated_count += 1
                else:
                    # Message already printed by the function (skipped or error)
                    pass

    print(f"\nGoogle Analytics tag update process finished.")
    print(f"  Files updated: {updated_count}")
