import xml.dom.minidom
import xml.etree.ElementTree as ET
import os

def normalize_kml(file_path):
    print(f"Processing {file_path}...")
    
    # Parse with ElementTree first to manipulate the structure easily
    ET.register_namespace('', "http://www.opengis.net/kml/2.2")
    tree = ET.parse(file_path)
    root = tree.getroot()
    
    namespace = "{http://www.opengis.net/kml/2.2}"
    
    # Find all Placemarks
    placemarks = root.findall(f".//{namespace}Placemark")
    
    fixed_count = 0
    
    for pm in placemarks:
        # 1. Check/Fix StyleUrl
        style_url = pm.find(f"{namespace}styleUrl")
        if style_url is None:
            # Create styleUrl if missing
            style_url = ET.Element(f"{namespace}styleUrl")
            style_url.text = "#icon-1552-0288D1"
            # Insert before Point if possible, or append
            point = pm.find(f"{namespace}Point")
            if point is not None:
                # Find index of Point
                children = list(pm)
                point_index = children.index(point)
                pm.insert(point_index, style_url)
            else:
                pm.append(style_url)
            fixed_count += 1
        elif style_url.text == "#icon-1899-0288D1":
            # Fix specific wrong style
            style_url.text = "#icon-1552-0288D1"
            fixed_count += 1
            
        # 2. Ensure Order: name, description, styleUrl, Point
        # This is a bit complex with ElementTree, but minidom pretty print helps with indentation.
        # We can re-order children here.
        
        order = ['name', 'description', 'LookAt', 'styleUrl', 'Point']
        children = list(pm)
        children_map = {child.tag.replace(namespace, ''): child for child in children}
        
        # Remove all children
        for child in children:
            pm.remove(child)
            
        # Add back in order
        for tag in order:
            if tag in children_map:
                pm.append(children_map[tag])
                del children_map[tag]
        
        # Add any remaining tags (like ExtendedData)
        for child in children_map.values():
            pm.append(child)

    print(f"Fixed {fixed_count} anomalies in {file_path}")

    # Convert to string and use minidom for pretty printing
    xml_str = ET.tostring(root, encoding='utf-8')
    dom = xml.dom.minidom.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent="  ")
    
    # Remove empty lines caused by pretty printing mixed with existing whitespace
    clean_lines = [line for line in pretty_xml.splitlines() if line.strip()]
    clean_xml = '\n'.join(clean_lines)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(clean_xml)

if __name__ == "__main__":
    files = ['offthegridnyc.kml', 'offthegridnycstreetview.kml']
    for f in files:
        if os.path.exists(f):
            normalize_kml(f)
        else:
            print(f"File {f} not found.")
