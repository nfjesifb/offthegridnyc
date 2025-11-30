import os
import json
import subprocess
import xml.etree.ElementTree as ET
from flask import Flask, render_template, request, redirect, url_for, session, flash

app = Flask(__name__)
app.secret_key = 'super_secret_key_for_local_dev'

# Configuration
LOCATIONS_FILE = 'locations.json'
KML_FILE = 'offthegridnyc.kml'
SV_KML_FILE = 'offthegridnycstreetview.kml'
ADMIN_PASSWORD = 'admin'

def load_locations():
    if os.path.exists(LOCATIONS_FILE):
        with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_locations(locations):
    with open(LOCATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(locations, f, indent=2)

def register_namespaces():
    ET.register_namespace('', "http://www.opengis.net/kml/2.2")

def get_or_create_document(root, namespace):
    document = root.find(f'{namespace}Document')
    if document is None:
        document = root
    return document

def update_kml_marker(name, lat, lng):
    try:
        register_namespaces()
        tree = ET.parse(KML_FILE)
        root = tree.getroot()
        namespace = "{http://www.opengis.net/kml/2.2}"
        document = get_or_create_document(root, namespace)
            
        placemark = ET.Element(f'{namespace}Placemark')
        
        name_elem = ET.SubElement(placemark, f'{namespace}name')
        name_elem.text = name
        
        style_elem = ET.SubElement(placemark, f'{namespace}styleUrl')
        style_elem.text = '#icon-1899-0288D1'
        
        point = ET.SubElement(placemark, f'{namespace}Point')
        coords = ET.SubElement(point, f'{namespace}coordinates')
        coords.text = f"{lng},{lat},0"
        
        document.append(placemark)
        tree.write(KML_FILE, encoding='utf-8', xml_declaration=True)
        return True
    except Exception as e:
        print(f"Error updating Main KML: {e}")
        return False

def update_streetview_kml(name, lat, lng):
    try:
        register_namespaces()
        tree = ET.parse(SV_KML_FILE)
        root = tree.getroot()
        namespace = "{http://www.opengis.net/kml/2.2}"
        document = get_or_create_document(root, namespace)
        
        placemark = ET.Element(f'{namespace}Placemark')
        
        name_elem = ET.SubElement(placemark, f'{namespace}name')
        name_elem.text = name
        
        # Only saving Point (Lat/Lng) as Heading/Pitch are not used by the template
        point = ET.SubElement(placemark, f'{namespace}Point')
        coords = ET.SubElement(point, f'{namespace}coordinates')
        coords.text = f"{lng},{lat},0"

        document.append(placemark)
        tree.write(SV_KML_FILE, encoding='utf-8', xml_declaration=True)
        return True
    except Exception as e:
        print(f"Error updating SV KML: {e}")
        return False

@app.route('/')
def index():
    if 'logged_in' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid password')
    return render_template('admin/login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'logged_in' not in session:
        return redirect(url_for('login'))
    return render_template('admin/dashboard.html')

@app.route('/add_location', methods=['POST'])
def add_location():
    if 'logged_in' not in session:
        return redirect(url_for('login'))
    
    try:
        # Extract form data
        name = request.form['name']
        description = request.form['description']
        
        # Map Location
        lat = request.form['lat']
        lng = request.form['lng']
        
        # Street View Location
        sv_lat = request.form['sv_lat']
        sv_lng = request.form['sv_lng']
        
        # 1. Update locations.json
        locations = load_locations()
        new_location = {
            "name": name,
            "description": description,
            "borough": "NYC",
            "neighborhood": "",
            "satellite_image_local": ""
        }
        locations.append(new_location)
        save_locations(locations)
        
        # 2. Update Main KML
        update_kml_marker(name, lat, lng)
        
        # 3. Update Street View KML
        update_streetview_kml(name, sv_lat, sv_lng)
        
        # 4. Run generation script
        subprocess.run(['python', 'generate_pages.py'], check=True)
        
        flash(f'Successfully added "{name}" and regenerated pages!')
        
    except Exception as e:
        flash(f'Error adding location: {str(e)}')
        print(e)
        
    return redirect(url_for('dashboard'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
