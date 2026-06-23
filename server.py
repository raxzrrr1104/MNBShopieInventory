import os
import csv
import socket
import logging
import difflib
import requests
import urllib.parse
from flask import Flask, request, jsonify, send_file, session, redirect, url_for
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

app.secret_key = os.environ.get('SESSION_SECRET_KEY', 'mnb-shopie-billing-secure-key-2026')
LOGIN_USER = os.environ.get('LOGIN_USER', 'MNBUser')
LOGIN_PASS = os.environ.get('LOGIN_PASS', 'MNBShopie@123')

@app.before_request
def check_auth():
    allowed_paths = ['/login', '/api/login', '/style.css', '/image.png']
    if request.path in allowed_paths:
        return
    if not session.get('logged_in'):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Unauthorized'}), 401
        return redirect('/login')

# Supabase credentials configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

CSV_HEADERS = ['sku', 'barcode', 'name', 'quantity', 'image_url', 'intake_price', 'selling_price', 'category']
SALES_HEADERS = ['date', 'product_name', 'sku', 'intake', 'sold_price', 'profit', 'quantity', 'category']

# Load from .env file if available
if not SUPABASE_URL or not SUPABASE_KEY:
    if os.path.exists('.env'):
        try:
            with open('.env', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        if k.strip() == 'SUPABASE_URL':
                            SUPABASE_URL = v.strip()
                        elif k.strip() == 'SUPABASE_KEY':
                            SUPABASE_KEY = v.strip()
        except Exception as e:
            logging.error(f"Error reading .env for Supabase credentials: {e}")

def supabase_headers():
    return {
        "apikey": SUPABASE_KEY or '',
        "Authorization": f"Bearer {SUPABASE_KEY}" if SUPABASE_KEY else '',
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def read_inventory():
    """Reads all products from Supabase inventory table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.warning("Supabase URL or Key is missing. Check your environment variables.")
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/inventory?select=*"
        res = requests.get(url, headers=supabase_headers(), timeout=10)
        if res.status_code == 200:
            products = res.json()
            parsed = []
            for p in products:
                try:
                    intake = float(p.get('intake_price') or 0.0)
                except (ValueError, TypeError):
                    intake = 0.0
                try:
                    selling = float(p.get('selling_price') or 0.0)
                except (ValueError, TypeError):
                    selling = 0.0
                parsed.append({
                    'sku': p.get('sku', '').strip(),
                    'barcode': p.get('barcode', '').strip(),
                    'name': p.get('name', '').strip(),
                    'quantity': int(p.get('quantity', 0) or 0),
                    'image_url': p.get('image_url', '') or '',
                    'intake_price': intake,
                    'selling_price': selling,
                    'category': p.get('category', 'General') or 'General'
                })
            return parsed
        else:
            logging.error(f"Supabase GET inventory failed: {res.status_code} - {res.text}")
    except Exception as e:
        logging.error(f"Error reading Supabase inventory: {e}")
    return []

def write_inventory(products):
    """Writes (upserts) products back to Supabase inventory table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.warning("Supabase URL or Key is missing. Check your environment variables.")
        return
    try:
        url = f"{SUPABASE_URL}/rest/v1/inventory"
        headers = supabase_headers()
        headers["Prefer"] = "resolution=merge-duplicates"
        
        payload = []
        for p in products:
            payload.append({
                'sku': p['sku'],
                'barcode': p['barcode'],
                'name': p['name'],
                'quantity': p['quantity'],
                'image_url': p.get('image_url', '') or '',
                'intake_price': float(p.get('intake_price', 0.0) or 0.0),
                'selling_price': float(p.get('selling_price', 0.0) or 0.0),
                'category': p.get('category', 'General') or 'General'
            })
            
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        if res.status_code not in (200, 201):
            logging.error(f"Supabase POST inventory upsert failed: {res.status_code} - {res.text}")
    except Exception as e:
        logging.error(f"Error upserting Supabase inventory: {e}")
        raise e

def clean_product_name(title, barcode):
    import re
    if not title:
        return ""
    # Strip barcode itself
    title = title.replace(barcode, "")
    
    # Common retailer/search suffixes
    suffixes = [
        r"\|.*",                      # pipe and anything after
        r"\s+-\s+.*",                  # hyphen with spaces and anything after
        r"\bBuy\b.*?\bonline\b.*",     # Buy ... online
        r"\bBuy\b",                    # just Buy
        r"Amazon\.(in|com|co\.uk|ca|de)", # Amazon sites
        r"Flipkart\.com",
        r"BigBasket",
        r"Jiomart",
        r"Blinkit",
        r"Walmart\.com",
        r"eBay"
    ]
    
    cleaned = title
    for pat in suffixes:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)
    
    # Strip non-alphanumeric trailing/leading symbols
    cleaned = re.sub(r"^[^\w\s\(\)\-\+]+|[^\w\s\(\)\-\+]+$", "", cleaned)
    cleaned = " ".join(cleaned.split())
    return cleaned

def fetch_image_by_name(name):
    image_url = ''
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    import urllib.parse
    # 1. Try Open Food Facts Text Search
    try:
        logging.info(f"Searching OFF by name: {name}")
        query = urllib.parse.quote(name)
        url = f"https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&json=true&page_size=3"
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            off_data = res.json()
            products = off_data.get('products', [])
            for p in products:
                img = p.get('image_front_url') or p.get('image_url')
                if img:
                    image_url = img
                    logging.info(f"OFF Name Search Match Image: {image_url}")
                    break
    except Exception as e:
        logging.warning(f"OFF Name Search failed: {e}")
        
    if not image_url:
        # 2. Try Open Library Search (for books/ISBNs)
        try:
            logging.info(f"Searching Open Library by title: {name}")
            query = urllib.parse.quote(name)
            url = f"https://openlibrary.org/search.json?title={query}&limit=3"
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                ol_data = res.json()
                docs = ol_data.get('docs', [])
                for d in docs:
                    cover_i = d.get('cover_i')
                    if cover_i:
                        image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
                        logging.info(f"Open Library Title Search Match Image: {image_url}")
                        break
        except Exception as e:
            logging.warning(f"Open Library Title Search failed: {e}")
            
    if not image_url:
        # 3. Try DuckDuckGo Lite search link + Open Graph scraping fallback
        try:
            logging.info(f"Searching DDG Lite fallback for name: {name}")
            url = "https://lite.duckduckgo.com/lite/"
            res = requests.post(url, data={'q': name}, headers=headers, timeout=5)
            if res.status_code == 200:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(res.text, 'html.parser')
                links = soup.find_all('a', class_='result-link')
                for link in links[:5]:
                    target_url = link.get('href')
                    if not target_url or target_url.startswith('/') or 'duckduckgo.com' in target_url:
                        continue
                    logging.info(f"DDG Lite Link for Scrape: {target_url}")
                    try:
                        page_res = requests.get(target_url, headers=headers, timeout=5)
                        if page_res.status_code == 200:
                            page_soup = BeautifulSoup(page_res.text, 'html.parser')
                            og_img = page_soup.find('meta', property='og:image') or page_soup.find('meta', attrs={'name': 'twitter:image'})
                            if og_img and og_img.get('content'):
                                image_url = og_img.get('content').strip()
                                logging.info(f"DDG Link Scraper OG Image: {image_url}")
                                break
                    except Exception as e:
                        logging.warning(f"DDG Link Scraper failed for {target_url}: {e}")
        except Exception as e:
            logging.warning(f"DDG Link Scraper failed: {e}")
            
    if not image_url:
        # 4. Try Bing Images search as a high-reliability fallback
        try:
            logging.info(f"Searching Bing Images fallback for name: {name}")
            query = urllib.parse.quote(name)
            url = f"https://www.bing.com/images/search?q={query}"
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                from bs4 import BeautifulSoup
                import re
                soup = BeautifulSoup(res.text, 'html.parser')
                links = soup.find_all('a', class_='iusc')
                for link in links:
                    m_attr = link.get('m')
                    if m_attr:
                        match = re.search(r'"murl"\s*:\s*"([^"]+)"', m_attr)
                        if match:
                            image_url = match.group(1)
                            logging.info(f"Bing Images Match: {image_url}")
                            break
        except Exception as e:
            logging.warning(f"Bing Images search failed: {e}")
            
    return image_url

def get_product_from_web(barcode):
    name, barcode_image = _get_product_from_web_raw(barcode)
    if name:
        logging.info(f"Barcode returned name '{name}'. Prioritizing name-based image search over barcode image...")
        image = fetch_image_by_name(name)
        if image:
            return name, image
    return name, barcode_image

def _get_product_from_web_raw(barcode):
    """Queries Open Food Facts, UPCitemdb, Open Library, and DuckDuckGo search fallbacks with smart clutter filtering."""
    barcode = barcode.strip()
    if not barcode:
        return None, None

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    # 1. Try Open Food Facts API (Food/Drinks/Groceries)
    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        logging.info(f"Querying Open Food Facts for barcode: {barcode}")
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data.get('status') == 1 and 'product' in data:
                prod = data['product']
                brand = prod.get('brands', '')
                name = prod.get('product_name', '')
                qty_str = prod.get('quantity', '')
                full_name = f"{brand} {name}".strip()
                if qty_str:
                    full_name += f" ({qty_str})"
                image_url = prod.get('image_front_url') or prod.get('image_url') or prod.get('image_small_url') or ''
                if name:
                    logging.info(f"Open Food Facts Match: {full_name}")
                    return full_name, image_url
    except Exception as e:
        logging.warning(f"Open Food Facts lookup failed: {e}")

    # 2. Try UPCitemdb API (General retail items)
    try:
        url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
        logging.info(f"Querying UPCitemdb for barcode: {barcode}")
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data.get('code') == 'OK' and data.get('items'):
                item = data['items'][0]
                name = item.get('title', '')
                images = item.get('images', [])
                image_url = images[0] if images else ''
                if name:
                    logging.info(f"UPCitemdb Match: {name}")
                    return name, image_url
    except Exception as e:
        logging.warning(f"UPCitemdb lookup failed: {e}")

    # 3. Try Open Library API (Books/ISBN)
    try:
        url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{barcode}&format=json&jscmd=data"
        logging.info(f"Querying Open Library for ISBN: {barcode}")
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            key = f"ISBN:{barcode}"
            if key in data:
                title = data[key].get('title', '')
                subtitle = data[key].get('subtitle', '')
                authors = ", ".join([a.get('name', '') for a in data[key].get('authors', [])])
                full_name = title
                if subtitle:
                    full_name += f": {subtitle}"
                if authors:
                    full_name += f" by {authors}"
                
                cover_data = data[key].get('cover', {})
                image_url = cover_data.get('large') or cover_data.get('medium') or cover_data.get('small') or ''
                
                if title:
                    logging.info(f"Open Library Match: {full_name}")
                    return full_name, image_url
    except Exception as e:
        logging.warning(f"Open Library lookup failed: {e}")

    # 4. Smart Fallback: Query DuckDuckGo Lite search and filter generic indexes/document links
    try:
        logging.info(f"Querying DuckDuckGo Lite fallback for barcode: {barcode}")
        url = "https://lite.duckduckgo.com/lite/"
        data = {'q': barcode}
        res = requests.post(url, data=data, headers=headers, timeout=5)
        if res.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(res.text, 'html.parser')
            links = soup.find_all('a', class_='result-link')
            
            # Loop through search results to bypass generic barcode listing pages
            for link in links[:10]:
                raw_title = link.get_text().strip()
                first_url = link.get('href')
                if not first_url or first_url.startswith('/') or 'duckduckgo.com' in first_url:
                    continue
                
                # Check for generic directories / documents
                t_lower = raw_title.lower()
                junk_words = [
                    "ean search", "barcode database", "upc lookup", "barcode list",
                    "ean-13", "barcode lookup", "digit-eyes", "scribd", "pdf",
                    "delivery #", "batch id", "list of", "batch_id", "shipping",
                    "packing list", "invoice", "waybill", "generic barcode", "barcode1"
                ]
                
                if any(kw in t_lower for kw in junk_words):
                    continue
                    
                clean_title = clean_product_name(raw_title, barcode)
                if len(clean_title) < 5:
                    continue
                
                # Scraping the target page's Open Graph image if available
                image_url = ''
                if first_url:
                    try:
                        page_res = requests.get(first_url, headers=headers, timeout=5)
                        if page_res.status_code == 200:
                            page_soup = BeautifulSoup(page_res.text, 'html.parser')
                            og_img = page_soup.find('meta', property='og:image') or page_soup.find('meta', attrs={'name': 'twitter:image'})
                            if og_img and og_img.get('content'):
                                image_url = og_img.get('content').strip()
                                logging.info(f"DDG Link Scraper OG Image for Barcode: {image_url}")
                    except Exception as e:
                        logging.warning(f"DDG Link Scraper failed: {e}")
                
                logging.info(f"DuckDuckGo Lite Match: {clean_title}")
                return clean_title, image_url
                
    except Exception as e:
        logging.warning(f"DuckDuckGo Lite lookup failed: {e}")

    return None, None

def find_fuzzy_matches(target_name, existing_products, threshold=0.5):
    """Finds existing products in the DB with similar names to target_name."""
    if not target_name:
        return []
    
    matches = []
    target_lower = target_name.lower()
    
    for prod in existing_products:
        name_lower = prod['name'].lower()
        # Levenshtein / SequenceMatcher ratio
        ratio = difflib.SequenceMatcher(None, target_lower, name_lower).ratio()
        if ratio >= threshold:
            matches.append({
                'product': prod,
                'ratio': ratio
            })
            
    # Sort matches by highest similarity ratio
    matches.sort(key=lambda x: x['ratio'], reverse=True)
    return [m['product'] for m in matches[:3]]

def generate_sku(name):
    """Generates a clean SKU from the product name."""
    clean_name = "".join([c for c in name if c.isalnum() or c.isspace()]).upper()
    parts = clean_name.split()
    if not parts:
        return "SKU-UNKNOWN"
    prefix = "".join([p[:3] for p in parts[:3]])
    import time
    timestamp = str(int(time.time()))[-4:]
    return f"{prefix}-{timestamp}"

def read_sales():
    """Reads all sales records from Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.warning("Supabase URL or Key is missing. Check your environment variables.")
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/sales?select=*"
        res = requests.get(url, headers=supabase_headers(), timeout=10)
        if res.status_code == 200:
            return res.json()
        else:
            logging.error(f"Supabase GET sales failed: {res.status_code} - {res.text}")
    except Exception as e:
        logging.error(f"Error reading Supabase sales: {e}")
    return []

def get_average_selling_prices():
    """Computes average selling price per SKU from Supabase sales table."""
    sales = read_sales()
    sku_sales = {} # sku -> [(sold_price, qty)]
    for row in sales:
        sku = row.get('sku')
        try:
            sold_price = float(row.get('sold_price', 0.0) or 0.0)
            qty = int(row.get('quantity', 1) or 1)
            if sku:
                if sku not in sku_sales:
                    sku_sales[sku] = []
                sku_sales[sku].append((sold_price, qty))
        except (ValueError, TypeError):
            continue
    
    avg_prices = {}
    for sku, sales_list in sku_sales.items():
        total_price = sum(price * qty for price, qty in sales_list)
        total_qty = sum(qty for price, qty in sales_list)
        avg_prices[sku] = round(total_price / total_qty, 2) if total_qty > 0 else 0.0
    return avg_prices

def get_inventory_response(products=None):
    """Wraps read_inventory() results with avg_selling_price attribute and hides settings."""
    if products is None:
        products = read_inventory()
    products = [p for p in products if p['sku'] != '_settings']
    avg_prices = get_average_selling_prices()
    for p in products:
        p['avg_selling_price'] = avg_prices.get(p['sku'], 0.0)
    return products

@app.route('/login')
def login():
    return app.send_static_file('login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if username == LOGIN_USER and password == LOGIN_PASS:
        session['logged_in'] = True
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'message': 'Invalid User ID or Password'}), 401

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect('/login')

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    return jsonify(get_inventory_response())

@app.route('/api/scan', methods=['POST'])
def scan_barcode():
    data = request.json or {}
    barcode = data.get('barcode', '').strip()
    
    if not barcode:
        return jsonify({'error': 'No barcode provided'}), 400
        
    products = read_inventory()
    
    # 1. Check if barcode already exists in DB
    existing_product = next((p for p in products if p['barcode'] == barcode), None)
    if existing_product:
        return jsonify({
            'status': 'exists',
            'product': existing_product
        })
        
    # 2. Barcode is new. Try to get details from the web
    web_name, web_image = get_product_from_web(barcode)
    
    if web_name:
        # Check for fuzzy name matches in database
        similar_products = find_fuzzy_matches(web_name, products)
        if similar_products:
            return jsonify({
                'status': 'similar_found',
                'web_name': web_name,
                'image_url': web_image,
                'similar': similar_products,
                'barcode': barcode
            })
        else:
            # Create a suggested new SKU
            sku = generate_sku(web_name)
            return jsonify({
                'status': 'new_web_match',
                'web_name': web_name,
                'image_url': web_image,
                'sku': sku,
                'barcode': barcode
            })
    else:
        # Could not find product name on the web
        return jsonify({
            'status': 'not_found',
            'barcode': barcode
        })

@app.route('/api/inventory/update', methods=['POST'])
def update_inventory():
    data = request.json or {}
    barcode = data.get('barcode', '').strip()
    sku = data.get('sku', '').strip()
    name = data.get('name', '').strip()
    quantity_to_add = int(data.get('quantity', 0))
    image_url = data.get('image_url', '').strip()
    category = data.get('category', 'General').strip() or 'General'
    try:
        intake_price = float(data.get('intake_price', 0.0) or 0.0)
    except ValueError:
        intake_price = 0.0
    try:
        selling_price = float(data.get('selling_price', 0.0) or 0.0)
    except ValueError:
        selling_price = 0.0
    
    if not barcode or not name:
        return jsonify({'error': 'Barcode and Name are required'}), 400
        
    products = read_inventory()
    
    # 1. Check if barcode already exists
    existing = next((p for p in products if p['barcode'] == barcode), None)
    
    if existing:
        # Verify SKU uniqueness if the user is changing it
        if sku and sku != existing['sku']:
            conflict = next((p for p in products if p['sku'] == sku and p['barcode'] != barcode), None)
            if conflict:
                return jsonify({'error': f"SKU '{sku}' already exists on another product."}), 400
        existing['quantity'] += quantity_to_add
        if name:
            existing['name'] = name
        if sku:
            existing['sku'] = sku
        if image_url:
            existing['image_url'] = image_url
        if 'intake_price' in data:
            existing['intake_price'] = intake_price
        if 'selling_price' in data:
            existing['selling_price'] = selling_price
        if 'category' in data:
            existing['category'] = category
    else:
        # Check SKU conflict for new barcodes
        if sku:
            conflict = next((p for p in products if p['sku'] == sku), None)
            if conflict:
                return jsonify({'error': f"SKU '{sku}' already exists on another product."}), 400
                
        # Check if we should merge/update an existing product by exact Name
        target_product = next((p for p in products if p['name'].lower() == name.lower()), None)
        if target_product:
            target_product['quantity'] += quantity_to_add
            target_product['barcode'] = barcode
            if image_url:
                target_product['image_url'] = image_url
            if 'intake_price' in data:
                target_product['intake_price'] = intake_price
            if 'selling_price' in data:
                target_product['selling_price'] = selling_price
            if 'category' in data:
                target_product['category'] = category
        else:
            # Create completely new product. Enforce unique SKU generation.
            base_sku = sku or generate_sku(name)
            sku_candidate = base_sku
            counter = 1
            while any(p['sku'] == sku_candidate for p in products):
                sku_candidate = f"{base_sku}-{counter}"
                counter += 1
            products.append({
                'sku': sku_candidate,
                'barcode': barcode,
                'name': name,
                'quantity': quantity_to_add,
                'image_url': image_url,
                'intake_price': intake_price,
                'selling_price': selling_price,
                'category': category
            })
            
    write_inventory(products)
    return jsonify({'success': True, 'inventory': get_inventory_response(products)})

@app.route('/api/inventory/edit', methods=['POST'])
def edit_inventory():
    data = request.json or {}
    sku = data.get('sku', '').strip()
    barcode = data.get('barcode', '').strip()
    name = data.get('name', '').strip()
    quantity = int(data.get('quantity', 0))
    image_url = data.get('image_url', '').strip()
    category = data.get('category', 'General').strip() or 'General'
    try:
        intake_price = float(data.get('intake_price', 0.0) or 0.0)
    except ValueError:
        intake_price = 0.0
    try:
        selling_price = float(data.get('selling_price', 0.0) or 0.0)
    except ValueError:
        selling_price = 0.0

    if not sku:
        return jsonify({'error': 'SKU is required to identify the item'}), 400

    products = read_inventory()
    updated = False
    for p in products:
        if p['sku'] == sku:
            # Verify if barcode is changed, it doesn't conflict with another barcode
            if barcode:
                conflict_barcode = next((x for x in products if x['barcode'] == barcode and x['sku'] != sku), None)
                if conflict_barcode:
                    return jsonify({'error': f"Barcode '{barcode}' is already assigned to SKU '{conflict_barcode['sku']}'."}), 400
            p['barcode'] = barcode
            p['name'] = name
            p['quantity'] = quantity
            p['image_url'] = image_url
            p['intake_price'] = intake_price
            p['selling_price'] = selling_price
            p['category'] = category
            updated = True
            break
            
    if not updated:
        # Add new. Ensure SKU is unique.
        if any(p['sku'] == sku for p in products):
            return jsonify({'error': f"SKU '{sku}' already exists"}), 400
        products.append({
            'sku': sku,
            'barcode': barcode,
            'name': name,
            'quantity': quantity,
            'image_url': image_url,
            'intake_price': intake_price,
            'selling_price': selling_price,
            'category': category
        })

    write_inventory(products)
    return jsonify({'success': True, 'inventory': get_inventory_response(products)})

@app.route('/api/inventory/export', methods=['GET'])
def export_csv():
    import io
    products = read_inventory()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    for p in products:
        writer.writerow([
            p.get('sku', ''),
            p.get('barcode', ''),
            p.get('name', ''),
            p.get('quantity', 0),
            p.get('image_url', ''),
            p.get('intake_price', 0.0),
            p.get('selling_price', 0.0),
            p.get('category', 'General')
        ])
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        as_attachment=True,
        download_name='inventory_export.csv',
        mimetype='text/csv'
    )

def generate_sales_csv_content(sales):
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    
    # --- Section 1: Detailed Sales Log ---
    writer.writerow(["=== DETAILED SALES LOG ==="])
    writer.writerow(["Date", "Product Name", "SKU", "Intake Price", "Sold Price", "Quantity", "Revenue", "Net Profit", "Category"])
    
    daily_stats = {} # date -> {revenue, profit, qty}
    monthly_stats = {} # YYYY-MM -> {revenue, profit, qty}
    yearly_stats = {} # YYYY -> {revenue, profit, qty}
    
    for s in sales:
        date = s.get('date', '').strip()
        name = s.get('product_name', '').strip()
        sku = s.get('sku', '').strip()
        try:
            intake = float(s.get('intake', 0.0) or 0.0)
            sold_price = float(s.get('sold_price', 0.0) or 0.0)
            profit = float(s.get('profit', 0.0) or 0.0)
            qty = int(s.get('quantity', 1) or 1)
        except (ValueError, TypeError):
            intake = 0.0
            sold_price = 0.0
            profit = 0.0
            qty = 1
        
        revenue = sold_price * qty
        writer.writerow([date, name, sku, f"{intake:.2f}", f"{sold_price:.2f}", qty, f"{revenue:.2f}", f"{profit:.2f}", s.get('category', 'General')])
        
        if date:
            day_str = date[:10]
            if day_str not in daily_stats:
                daily_stats[day_str] = {'revenue': 0.0, 'profit': 0.0, 'qty': 0}
            daily_stats[day_str]['revenue'] += revenue
            daily_stats[day_str]['profit'] += profit
            daily_stats[day_str]['qty'] += qty
            
            month = date[:7]
            if month not in monthly_stats:
                monthly_stats[month] = {'revenue': 0.0, 'profit': 0.0, 'qty': 0}
            monthly_stats[month]['revenue'] += revenue
            monthly_stats[month]['profit'] += profit
            monthly_stats[month]['qty'] += qty
            
            year = date[:4]
            if year not in yearly_stats:
                yearly_stats[year] = {'revenue': 0.0, 'profit': 0.0, 'qty': 0}
            yearly_stats[year]['revenue'] += revenue
            yearly_stats[year]['profit'] += profit
            yearly_stats[year]['qty'] += qty
            
    writer.writerow([])
    writer.writerow([])
    
    # --- Section 2: Daily Net Profit Summary ---
    writer.writerow(["=== DAILY NET PROFIT SUMMARY ==="])
    writer.writerow(["Date", "Total Quantity", "Total Revenue", "Total Net Profit"])
    for d in sorted(daily_stats.keys(), reverse=True):
        stat = daily_stats[d]
        writer.writerow([d, stat['qty'], f"{stat['revenue']:.2f}", f"{stat['profit']:.2f}"])
        
    writer.writerow([])
    writer.writerow([])
    
    # --- Section 3: Monthly Net Profit Summary ---
    writer.writerow(["=== MONTHLY NET PROFIT SUMMARY ==="])
    writer.writerow(["Month", "Total Quantity", "Total Revenue", "Total Net Profit"])
    for m in sorted(monthly_stats.keys(), reverse=True):
        stat = monthly_stats[m]
        writer.writerow([m, stat['qty'], f"{stat['revenue']:.2f}", f"{stat['profit']:.2f}"])
        
    writer.writerow([])
    writer.writerow([])
    
    # --- Section 4: Yearly Net Profit Summary ---
    writer.writerow(["=== YEARLY NET PROFIT SUMMARY ==="])
    writer.writerow(["Year", "Total Quantity", "Total Revenue", "Total Net Profit"])
    for y in sorted(yearly_stats.keys(), reverse=True):
        stat = yearly_stats[y]
        writer.writerow([y, stat['qty'], f"{stat['revenue']:.2f}", f"{stat['profit']:.2f}"])
        
    return output.getvalue()

@app.route('/api/sales/export', methods=['GET'])
def export_sales_csv():
    import io
    sales = read_sales()
    csv_content = generate_sales_csv_content(sales)
    return send_file(
        io.BytesIO(csv_content.encode('utf-8')),
        as_attachment=True,
        download_name='sales_export.csv',
        mimetype='text/csv'
    )

@app.route('/api/inventory/delete', methods=['POST'])
def delete_product():
    data = request.json or {}
    sku = data.get('sku', '').strip()
    
    if not sku:
        return jsonify({'error': 'SKU is required'}), 400
        
    products = read_inventory()
    filtered_products = [p for p in products if p['sku'] != sku]
    
    if len(filtered_products) == len(products):
        return jsonify({'error': f"Product with SKU '{sku}' not found."}), 404
        
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            url = f"{SUPABASE_URL}/rest/v1/inventory?sku=eq.{sku}"
            res = requests.delete(url, headers=supabase_headers(), timeout=10)
            if res.status_code not in (200, 204):
                logging.error(f"Supabase DELETE failed: {res.status_code} - {res.text}")
        except Exception as e:
            logging.error(f"Error deleting from Supabase: {e}")
            
    write_inventory(filtered_products)
    return jsonify({'success': True, 'inventory': get_inventory_response(filtered_products)})

@app.route('/api/search/image', methods=['POST'])
def search_product_image():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
        
    image_url = fetch_image_by_name(name)
    return jsonify({'image_url': image_url})

import datetime
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def record_sale(product_name, sku, intake, sold_price, quantity, category='General'):
    """Appends a sale transaction to Supabase sales table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        logging.warning("Supabase URL or Key is missing. Check your environment variables.")
        return
    profit = (sold_price - intake) * quantity
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d %I:%M %p")
    try:
        url = f"{SUPABASE_URL}/rest/v1/sales"
        payload = {
            'date': date_str,
            'product_name': product_name,
            'sku': sku,
            'intake': float(intake),
            'sold_price': float(sold_price),
            'profit': float(profit),
            'quantity': int(quantity),
            'category': category or 'General'
        }
        res = requests.post(url, json=payload, headers=supabase_headers(), timeout=10)
        if res.status_code not in (200, 201):
            logging.error(f"Supabase POST sales failed: {res.status_code} - {res.text}")
    except Exception as e:
        logging.error(f"Error recording sale: {e}")

import io
from email.mime.base import MIMEBase
from email import encoders

def generate_receipt_pdf(customer_email, cart, total_amount):
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=30,
        textColor=colors.HexColor('#1e293b'),
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=15
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#334155')
    )
    
    body_bold = ParagraphStyle(
        'DocBodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    # Header Section
    header_data = [
        [
            Paragraph("<b>MNB SHOPIE</b>", title_style),
            Paragraph("<b>INVOICE RECEIPT</b>", ParagraphStyle('InvoiceTitle', fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=colors.HexColor('#4f46e5'), alignment=2))
        ],
        [
            Paragraph("A one stop shop, for all your needs!", subtitle_style),
            Paragraph(f"Date: {datetime.datetime.now().strftime('%B %d, %Y %I:%M %p')}", ParagraphStyle('InvoiceDate', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#64748b'), alignment=2))
        ]
    ]
    
    header_table = Table(header_data, colWidths=[252, 252])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    
    # Decorative colored line
    line_table = Table([[""]], colWidths=[504])
    line_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 2, colors.HexColor('#4f46e5')),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(line_table)
    story.append(Spacer(1, 15))
    
    # Billing Metadata Table
    billing_data = [
        [Paragraph("<b>Billed To:</b>", body_bold), Paragraph(customer_email if customer_email else "Walk-in Customer", body_style)],
        [Paragraph("<b>Payment Status:</b>", body_bold), Paragraph("PAID", ParagraphStyle('PaidBadge', parent=body_style, textColor=colors.HexColor('#059669'), fontName='Helvetica-Bold'))]
    ]
    billing_table = Table(billing_data, colWidths=[100, 404])
    billing_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(billing_table)
    story.append(Spacer(1, 20))
    
    # Items Table Headers
    th_style = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.HexColor('#475569'))
    th_right = ParagraphStyle('THRight', parent=th_style, alignment=2)
    th_center = ParagraphStyle('THCenter', parent=th_style, alignment=1)
    
    items_data = [[
        Paragraph("Product Description", th_style),
        Paragraph("Unit Price", th_right),
        Paragraph("Quantity", th_center),
        Paragraph("Amount", th_right)
    ]]
    
    # Populate items
    td_style = ParagraphStyle('TD', fontName='Helvetica', fontSize=9.5, leading=13, textColor=colors.HexColor('#0f172a'))
    td_right = ParagraphStyle('TDRight', parent=td_style, alignment=2)
    td_center = ParagraphStyle('TDCenter', parent=td_style, alignment=1)
    
    for item in cart:
        name = item.get('name', 'Product')
        qty = int(item.get('quantity', 0))
        price = float(item.get('sold_price', 0.0))
        subtotal = price * qty
        items_data.append([
            Paragraph(name, td_style),
            Paragraph(f"Rs. {price:.2f}", td_right),
            Paragraph(str(qty), td_center),
            Paragraph(f"Rs. {subtotal:.2f}", td_right)
        ])
        
    # spacing row
    items_data.append(["", "", "", ""])
    
    # Grand Total row
    items_data.append([
        "", "",
        Paragraph("<b>Grand Total</b>", ParagraphStyle('GTotalLabel', fontName='Helvetica-Bold', fontSize=11, leading=14, alignment=2, textColor=colors.HexColor('#0f172a'))),
        Paragraph(f"<b>Rs. {total_amount:.2f}</b>", ParagraphStyle('GTotalVal', fontName='Helvetica-Bold', fontSize=12, leading=14, alignment=2, textColor=colors.HexColor('#4f46e5')))
    ])
    
    items_table = Table(items_data, colWidths=[244, 100, 60, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0,0), (-1,0), 8),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor('#e2e8f0')),
        
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,1), (-1,-3), 8),
        ('BOTTOMPADDING', (0,1), (-1,-3), 8),
        ('LINEBELOW', (0,1), (-1,-3), 0.5, colors.HexColor('#f1f5f9')),
        
        ('LINEABOVE', (2,-1), (3,-1), 1.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (2,-1), (3,-1), 12),
        ('BOTTOMPADDING', (2,-1), (3,-1), 12),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 40))
    
    # Note / Greeting
    footer_style = ParagraphStyle(
        'DocFooter',
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#94a3b8'),
        alignment=1
    )
    story.append(Paragraph("Thank you for choosing MNB Shopie. We appreciate your business!", footer_style))
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def send_customer_receipt_email(customer_email, cart, total_amount, smtp_config):
    subject = "Your Luxurious Receipt from MNB Shopie"
    
    msg = MIMEMultipart('mixed')
    msg['Subject'] = subject
    msg['From'] = f"MNB Shopie <{smtp_config['user']}>"
    msg['To'] = customer_email
    
    date_str = datetime.date.today().strftime('%B %d, %Y')
    
    html_content = f"""
    <html>
    <head>
    <style>
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }}
        .header {{ background-color: #1e293b; padding: 40px 30px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; color: #ffffff; }}
        .header p {{ margin: 10px 0 0; color: #94a3b8; font-size: 14px; letter-spacing: 1px; }}
        .content {{ padding: 40px 30px; }}
        .greeting {{ font-size: 18px; color: #334155; margin-bottom: 30px; }}
        .table-container {{ margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }}
        .main-table {{ width: 100%; border-collapse: collapse; }}
        .main-table th {{ background-color: #f1f5f9; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 15px; text-align: left; }}
        .main-table td.main-td {{ padding: 15px; border-top: 1px solid #e2e8f0; color: #334155; vertical-align: middle; }}
        .product-image {{ width: 50px; height: 50px; object-fit: cover; border-radius: 6px; background-color: #f1f5f9; border: 1px solid #e2e8f0; display: block; }}
        .product-name {{ font-weight: 500; font-size: 15px; color: #0f172a; margin: 0; }}
        .product-sku {{ font-size: 12px; color: #94a3b8; margin-top: 4px; }}
        .total-row td.main-td {{ background-color: #f8fafc; font-weight: bold; font-size: 18px; color: #0f172a; border-top: 2px solid #e2e8f0; }}
        .footer {{ padding: 30px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; }}
    </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>MNB Shopie</h1>
                <p>PURCHASE RECEIPT</p>
            </div>
            <div class="content">
                <div class="greeting">
                    Thank you for your purchase, <strong>{customer_email.split('@')[0]}</strong>!<br>
                    <span style="font-size: 14px; color: #64748b; margin-top: 5px; display: block;">Date: {date_str}</span>
                </div>
                
                <div class="table-container">
                    <table class="main-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th style="text-align: center;">Qty</th>
                                <th style="text-align: right;">Price</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
    """
    
    for item in cart:
        name = item.get('name', 'Product')
        sku = item.get('sku', '')
        qty = int(item.get('quantity', 0))
        price = float(item.get('sold_price', 0.0))
        subtotal = price * qty
        image_url = item.get('image_url', '')
        if not image_url:
            image_url = "https://via.placeholder.com/50x50.png?text=Item"
            
        html_content += f"""
                            <tr>
                                <td class="main-td">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td width="65" valign="middle" style="padding: 0; border: none;">
                                                <img src="{image_url}" alt="{name}" class="product-image">
                                            </td>
                                            <td valign="middle" style="padding: 0; border: none;">
                                                <div class="product-name">{name}</div>
                                                <div class="product-sku">SKU: {sku}</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td class="main-td" style="text-align: center;">{qty}</td>
                                <td class="main-td" style="text-align: right;">Rs. {price:.2f}</td>
                                <td class="main-td" style="text-align: right; font-weight: 500;">Rs. {subtotal:.2f}</td>
                            </tr>
        """
        
    html_content += f"""
                            <tr class="total-row">
                                <td class="main-td" colspan="3" style="text-align: right;">Grand Total</td>
                                <td class="main-td" style="text-align: right; color: #4f46e5;">Rs. {total_amount:.2f}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="text-align: center; margin-top: 40px;">
                    <p style="color: #475569; font-size: 15px;">We hope you enjoy your purchase.</p>
                </div>
            </div>
            <div class="footer">
                MNB Shopie &copy; {datetime.date.today().year}. All rights reserved.<br>
                A one stop shop for all your needs!!
            </div>
        </div>
    </body>
    </html>
    """
    
    body_alternative = MIMEMultipart('alternative')
    body_alternative.attach(MIMEText("Please enable HTML to view this luxurious receipt.", 'plain'))
    body_alternative.attach(MIMEText(html_content, 'html'))
    msg.attach(body_alternative)
    
    pdf_data = generate_receipt_pdf(customer_email, cart, total_amount)
    attachment = MIMEBase('application', 'pdf')
    attachment.set_payload(pdf_data)
    encoders.encode_base64(attachment)
    attachment.add_header('Content-Disposition', 'attachment', filename='MNB_Shopie_Invoice.pdf')
    msg.attach(attachment)
        
    server = smtplib.SMTP(smtp_config['server'], int(smtp_config['port']))
    server.starttls()
    server.login(smtp_config['user'], smtp_config['password'])
    server.sendmail(smtp_config['user'], customer_email, msg.as_string())
    server.quit()

@app.route('/api/billing/complete', methods=['POST'])
def complete_billing():
    data = request.json or {}
    cart = data.get('cart', [])
    customer_email = data.get('customer_email', '').strip()
    discount_type = data.get('discount_type', '').strip() # 'percent' or 'amount'
    try:
        discount_value = float(data.get('discount_value', 0.0) or 0.0)
    except ValueError:
        discount_value = 0.0

    if not cart:
        return jsonify({'error': 'Cart is empty'}), 400
        
    products = read_inventory()
    
    # Calculate cart total price first based on product catalog selling price
    cart_total_price = 0.0
    for item in cart:
        sku = item.get('sku')
        qty = int(item.get('quantity', 0))
        prod = next((p for p in products if p['sku'] == sku), None)
        if prod and qty > 0:
            cart_total_price += float(prod.get('selling_price', 0.0)) * qty

    # Calculate overall discount
    total_discount = 0.0
    if discount_value > 0 and cart_total_price > 0:
        if discount_type == 'percent':
            total_discount = cart_total_price * (discount_value / 100.0)
        elif discount_type == 'amount':
            total_discount = min(discount_value, cart_total_price)

    updated = False
    total_amount = 0.0
    net_amount = round(max(0.0, cart_total_price - total_discount), 2)
    
    # Generate unique bill number
    import random
    import string
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d %I:%M %p")
    random_suffix = ''.join(random.choices(string.digits, k=4))
    bill_no = f"BILL-{now.strftime('%Y%m%d')}-{random_suffix}"
    
    bill_items_to_save = []
    
    # Process each cart item with proportional discount
    for item in cart:
        sku = item.get('sku')
        qty = int(item.get('quantity', 0))
        if qty <= 0:
            continue
            
        prod = next((p for p in products if p['sku'] == sku), None)
        if prod:
            # Decrement inventory quantity
            prod['quantity'] = max(0, prod['quantity'] - qty)
            
            # Proportional discount calculation
            item_selling_price = float(prod.get('selling_price', 0.0))
            if cart_total_price > 0:
                discount_per_unit = (item_selling_price / cart_total_price) * total_discount
                sold_price = round(max(0.0, item_selling_price - discount_per_unit), 2)
                discount_share = round(discount_per_unit, 2)
            else:
                sold_price = item_selling_price
                discount_share = 0.0
                
            # Record sale for backwards compatibility with existing Business Analytics
            record_sale(prod['name'], prod['sku'], prod.get('intake_price', 0.0), sold_price, qty, prod.get('category', 'General'))
            
            # Prepare bill item record
            bill_items_to_save.append({
                'bill_no': bill_no,
                'sku': prod['sku'],
                'product_name': prod['name'],
                'quantity': qty,
                'original_price': item_selling_price,
                'discount_share': discount_share,
                'final_sold_price': sold_price,
                'intake_price': float(prod.get('intake_price', 0.0)),
                'returned_quantity': 0
            })
            total_amount += sold_price * qty
            updated = True
            
    if updated:
        # Write updated inventory
        write_inventory(products)
        
        # Save parent bill to Supabase
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                bill_payload = {
                    'bill_no': bill_no,
                    'date': date_str,
                    'customer_email': customer_email,
                    'total_amount': cart_total_price,
                    'discount_type': discount_type or 'none',
                    'discount_value': discount_value,
                    'net_amount': net_amount,
                    'status': 'completed'
                }
                res_bill = requests.post(f"{SUPABASE_URL}/rest/v1/bills", headers=supabase_headers(), json=bill_payload, timeout=10)
                if res_bill.status_code not in (200, 201):
                    logging.error(f"Failed to save parent bill: {res_bill.status_code} - {res_bill.text}")
                    
                # Save child bill items to Supabase
                res_items = requests.post(f"{SUPABASE_URL}/rest/v1/bill_items", headers=supabase_headers(), json=bill_items_to_save, timeout=10)
                if res_items.status_code not in (200, 201):
                    logging.error(f"Failed to save bill items: {res_items.status_code} - {res_items.text}")
            except Exception as e:
                logging.error(f"Error saving relational bill data: {e}")
        
    email_sent = False
    email_error = None
    if customer_email and updated:
        try:
            success, smtp_config = get_smtp_config()
            if success and smtp_config and smtp_config.get('user') and smtp_config.get('password'):
                send_customer_receipt_email(customer_email, cart, total_amount, smtp_config)
                email_sent = True
            else:
                email_error = "SMTP not configured"
        except Exception as e:
            logging.error(f"Failed to send customer receipt email: {e}")
            email_error = str(e)
            
    return jsonify({
        'success': True, 
        'bill_no': bill_no,
        'inventory': get_inventory_response(products),
        'summary': get_sales_summary_data(),
        'email_sent': email_sent,
        'email_error': email_error
    })

@app.route('/api/billing/history', methods=['GET'])
def get_billing_history():
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify([])
    try:
        url = f"{SUPABASE_URL}/rest/v1/bills?select=*&order=date.desc"
        res = requests.get(url, headers=supabase_headers(), timeout=10)
        if res.status_code == 200:
            return jsonify(res.json())
        return jsonify({'error': 'Failed to fetch bills'}), res.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/billing/details/<bill_no>', methods=['GET'])
def get_bill_details(bill_no):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return jsonify({'error': 'Supabase not configured'}), 500
    try:
        encoded_bill = urllib.parse.quote(bill_no)
        # Fetch parent bill
        res_bill = requests.get(f"{SUPABASE_URL}/rest/v1/bills?bill_no=eq.{encoded_bill}", headers=supabase_headers(), timeout=10)
        if res_bill.status_code != 200 or not res_bill.json():
            return jsonify({'error': 'Bill not found'}), 404
        bill = res_bill.json()[0]
        
        # Fetch items
        res_items = requests.get(f"{SUPABASE_URL}/rest/v1/bill_items?bill_no=eq.{encoded_bill}", headers=supabase_headers(), timeout=10)
        items = res_items.json() if res_items.status_code == 200 else []
        
        # Fetch logs
        res_logs = requests.get(f"{SUPABASE_URL}/rest/v1/transaction_logs?parent_bill_no=eq.{encoded_bill}&order=date.desc", headers=supabase_headers(), timeout=10)
        logs = res_logs.json() if res_logs.status_code == 200 else []
        
        return jsonify({
            'bill': bill,
            'items': items,
            'logs': logs
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/billing/refund', methods=['POST'])
def refund_bill_item():
    data = request.json or {}
    bill_no = data.get('bill_no', '').strip()
    sku = data.get('sku', '').strip()
    try:
        qty_to_refund = int(data.get('quantity', 0))
    except ValueError:
        return jsonify({'error': 'Invalid quantity'}), 400
    
    if not bill_no or not sku or qty_to_refund <= 0:
        return jsonify({'error': 'Invalid request parameters'}), 400
        
    try:
        # 1. Fetch parent bill
        encoded_bill = urllib.parse.quote(bill_no)
        res_bill = requests.get(f"{SUPABASE_URL}/rest/v1/bills?bill_no=eq.{encoded_bill}", headers=supabase_headers(), timeout=10)
        if res_bill.status_code != 200 or not res_bill.json():
            return jsonify({'error': 'Bill not found'}), 404
        bill = res_bill.json()[0]
        
        # 2. Fetch target bill item
        res_items = requests.get(f"{SUPABASE_URL}/rest/v1/bill_items?bill_no=eq.{encoded_bill}&sku=eq.{urllib.parse.quote(sku)}", headers=supabase_headers(), timeout=10)
        if res_items.status_code != 200 or not res_items.json():
            return jsonify({'error': 'Bill item not found'}), 404
        item = res_items.json()[0]
        
        # Validate return quantity bounds
        purchased_qty = int(item['quantity'])
        already_returned = int(item.get('returned_quantity', 0) or 0)
        if already_returned + qty_to_refund > purchased_qty:
            return jsonify({'error': f'Cannot refund {qty_to_refund} units. Only {purchased_qty - already_returned} units are remaining.'}), 400
            
        # 3. Update bill item's returned quantity
        new_returned_qty = already_returned + qty_to_refund
        res_update_item = requests.patch(
            f"{SUPABASE_URL}/rest/v1/bill_items?id=eq.{item['id']}",
            headers=supabase_headers(),
            json={'returned_quantity': new_returned_qty},
            timeout=10
        )
        if res_update_item.status_code not in (200, 204):
            return jsonify({'error': 'Failed to update bill item'}), 500
            
        # 4. Increment stock level in inventory
        products = read_inventory()
        prod = next((p for p in products if p['sku'] == sku), None)
        if prod:
            prod['quantity'] = prod['quantity'] + qty_to_refund
            write_inventory(products)
            
        # 5. Insert transaction log audit
        now = datetime.datetime.now()
        date_str = now.strftime("%Y-%m-%d %I:%M %p")
        refund_amount = round(float(item['final_sold_price']) * qty_to_refund, 2)
        log_payload = {
            'parent_bill_no': bill_no,
            'type': 'refund',
            'date': date_str,
            'items_involved': [{'sku': sku, 'product_name': item['product_name'], 'quantity': qty_to_refund, 'action': 'refunded'}],
            'cash_delta': -refund_amount
        }
        requests.post(f"{SUPABASE_URL}/rest/v1/transaction_logs", headers=supabase_headers(), json=log_payload, timeout=10)
        
        # 6. Append negative sale entry to sales table for analytics compatibility
        record_sale(
            f"REFUND: {item['product_name']}",
            sku,
            float(item.get('intake_price', 0.0) or 0.0),
            float(item['final_sold_price']),
            -qty_to_refund,
            prod.get('category', 'General') if prod else 'General'
        )
        
        # 7. Recalculate bill status (check if fully refunded or partially refunded)
        res_all_items = requests.get(f"{SUPABASE_URL}/rest/v1/bill_items?bill_no=eq.{encoded_bill}", headers=supabase_headers(), timeout=10)
        all_items = res_all_items.json() if res_all_items.status_code == 200 else []
        
        all_fully_returned = True
        any_returned = False
        for it in all_items:
            ret = int(it.get('returned_quantity', 0) or 0)
            pur = int(it['quantity'])
            if ret > 0:
                any_returned = True
            if ret < pur:
                all_fully_returned = False
                
        new_status = 'refunded' if all_fully_returned else ('partially_refunded' if any_returned else 'completed')
        
        # Update bill status
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/bills?bill_no=eq.{encoded_bill}",
            headers=supabase_headers(),
            json={'status': new_status},
            timeout=10
        )
        
        return jsonify({
            'success': True,
            'message': 'Refund completed successfully',
            'inventory': get_inventory_response(products),
            'summary': get_sales_summary_data()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/billing/exchange', methods=['POST'])
def exchange_bill_item():
    data = request.json or {}
    bill_no = data.get('bill_no', '').strip()
    returned_sku = data.get('returned_sku', '').strip()
    try:
        returned_qty = int(data.get('returned_quantity', 0))
        exchanged_qty = int(data.get('exchanged_quantity', 0))
    except ValueError:
        return jsonify({'error': 'Invalid quantities'}), 400
    exchanged_sku = data.get('exchanged_sku', '').strip()
    
    if not bill_no or not returned_sku or returned_qty <= 0 or not exchanged_sku or exchanged_qty <= 0:
        return jsonify({'error': 'Invalid request parameters'}), 400
        
    try:
        encoded_bill = urllib.parse.quote(bill_no)
        # 1. Fetch parent bill
        res_bill = requests.get(f"{SUPABASE_URL}/rest/v1/bills?bill_no=eq.{encoded_bill}", headers=supabase_headers(), timeout=10)
        if res_bill.status_code != 200 or not res_bill.json():
            return jsonify({'error': 'Bill not found'}), 404
        bill = res_bill.json()[0]
        
        # 2. Fetch returned bill item
        res_items = requests.get(f"{SUPABASE_URL}/rest/v1/bill_items?bill_no=eq.{encoded_bill}&sku=eq.{urllib.parse.quote(returned_sku)}", headers=supabase_headers(), timeout=10)
        if res_items.status_code != 200 or not res_items.json():
            return jsonify({'error': 'Purchased item not found in bill'}), 404
        ret_item = res_items.json()[0]
        
        # Validate returned bounds
        already_returned = int(ret_item.get('returned_quantity', 0) or 0)
        if already_returned + returned_qty > int(ret_item['quantity']):
            return jsonify({'error': 'Quantity to exchange exceeds purchased limits.'}), 400
            
        products = read_inventory()
        # 3. Fetch exchanged product from inventory
        exch_prod = next((p for p in products if p['sku'] == exchanged_sku), None)
        if not exch_prod:
            return jsonify({'error': 'Exchanged product not found in inventory'}), 404
            
        if exch_prod['quantity'] < exchanged_qty:
            return jsonify({'error': f'Not enough stock for exchange. Only {exch_prod["quantity"]} units available.'}), 400
            
        # 4. Perform stock movements
        ret_prod = next((p for p in products if p['sku'] == returned_sku), None)
        if ret_prod:
            ret_prod['quantity'] = ret_prod['quantity'] + returned_qty
        exch_prod['quantity'] = exch_prod['quantity'] - exchanged_qty
        write_inventory(products)
        
        # 5. Update returned item's returned_quantity
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/bill_items?id=eq.{ret_item['id']}",
            headers=supabase_headers(),
            json={'returned_quantity': already_returned + returned_qty},
            timeout=10
        )
        
        # 6. Insert exchanged item into bill_items
        exch_original_price = float(exch_prod['selling_price'])
        exch_final_price = exch_original_price
        
        exch_item_payload = {
            'bill_no': bill_no,
            'sku': exchanged_sku,
            'product_name': f"EXCHANGE: {exch_prod['name']}",
            'quantity': exchanged_qty,
            'original_price': exch_original_price,
            'discount_share': 0.0,
            'final_sold_price': exch_final_price,
            'intake_price': float(exch_prod.get('intake_price', 0.0) or 0.0),
            'returned_quantity': 0
        }
        requests.post(f"{SUPABASE_URL}/rest/v1/bill_items", headers=supabase_headers(), json=exch_item_payload, timeout=10)
        
        # 7. Calculate cash delta
        value_returned = round(float(ret_item['final_sold_price']) * returned_qty, 2)
        value_issued = round(exch_final_price * exchanged_qty, 2)
        cash_delta = round(value_issued - value_returned, 2)
        
        # 8. Log the transaction
        now = datetime.datetime.now()
        date_str = now.strftime("%Y-%m-%d %I:%M %p")
        log_payload = {
            'parent_bill_no': bill_no,
            'type': 'exchange',
            'date': date_str,
            'items_involved': [
                {'sku': returned_sku, 'product_name': ret_item['product_name'], 'quantity': returned_qty, 'action': 'returned'},
                {'sku': exchanged_sku, 'product_name': exch_prod['name'], 'quantity': exchanged_qty, 'action': 'issued'}
            ],
            'cash_delta': cash_delta
        }
        requests.post(f"{SUPABASE_URL}/rest/v1/transaction_logs", headers=supabase_headers(), json=log_payload, timeout=10)
        
        # 9. Log transactions to sales table for analytics compatibility
        record_sale(
            f"REFUND: {ret_item['product_name']}",
            returned_sku,
            float(ret_item.get('intake_price', 0.0) or 0.0),
            float(ret_item['final_sold_price']),
            -returned_qty,
            ret_prod.get('category', 'General') if ret_prod else 'General'
        )
        record_sale(
            f"EXCHANGE: {exch_prod['name']}",
            exchanged_sku,
            float(exch_prod.get('intake_price', 0.0) or 0.0),
            exch_final_price,
            exchanged_qty,
            exch_prod.get('category', 'General') or 'General'
        )
        
        # Update bill status & net_amount
        new_net = round(float(bill['net_amount']) + cash_delta, 2)
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/bills?bill_no=eq.{encoded_bill}",
            headers=supabase_headers(),
            json={'net_amount': new_net, 'status': 'partially_refunded'},
            timeout=10
        )
        
        return jsonify({
            'success': True,
            'message': 'Exchange completed successfully',
            'inventory': get_inventory_response(products),
            'summary': get_sales_summary_data()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_sales_summary_data(date_str=None):
    """Computes today's (or given date's) and all-time sales metrics from Supabase sales table."""
    sales = read_sales()
    if date_str is None:
        date_str = datetime.date.today().isoformat()
    today_str = date_str
    today_sales = []
    total_profit_today = 0.0
    total_sold_today = 0
    total_amount_today = 0.0
    
    total_profit_all_time = 0.0
    total_sold_all_time = 0
    
    for row in sales:
        try:
            profit = float(row.get('profit', 0.0) or 0.0)
            qty = int(row.get('quantity', 0) or 0)
            sold_price = float(row.get('sold_price', 0.0) or 0.0)
            intake = float(row.get('intake', 0.0) or 0.0)
            date = row.get('date', '')
            
            total_profit_all_time += profit
            total_sold_all_time += qty
            
            if date.startswith(today_str):
                total_profit_today += profit
                total_sold_today += qty
                total_amount_today += (sold_price * qty)
                today_sales.append({
                    'product_name': row.get('product_name'),
                    'sku': row.get('sku'),
                    'intake': intake,
                    'sold_price': sold_price,
                    'profit': profit,
                    'quantity': qty,
                    'time': date[11:16] if len(date) > 11 else ''
                })
        except (ValueError, TypeError):
            continue
        
    return {
        'today': {
            'date': today_str,
            'total_profit': round(total_profit_today, 2),
            'total_items_sold': total_sold_today,
            'total_amount': round(total_amount_today, 2),
            'sales': today_sales
        },
        'all_time': {
            'total_profit': round(total_profit_all_time, 2),
            'total_items_sold': total_sold_all_time
        }
    }

@app.route('/api/sales/summary', methods=['GET'])
def get_sales_summary():
    return jsonify(get_sales_summary_data())

def load_app_settings():
    """Loads system settings (SMTP configurations and recipient email) from Supabase inventory table special row."""
    # Read inventory
    products = read_inventory()
    # Find settings row
    settings_row = next((p for p in products if p['sku'] == '_settings'), None)
    
    # Defaults
    default_settings = {
        'recipient_email': 'mohitshers@gmail.com',
        'smtp_server': 'smtp.gmail.com',
        'smtp_port': '587',
        'smtp_user': '',
        'smtp_password': ''
    }
    
    if not settings_row:
        return default_settings
        
    try:
        import json
        payload = json.loads(settings_row.get('image_url') or '{}')
        return {
            'recipient_email': settings_row.get('name', 'mohitshers@gmail.com').strip(),
            'smtp_server': payload.get('smtp_server', default_settings['smtp_server']),
            'smtp_port': payload.get('smtp_port', default_settings['smtp_port']),
            'smtp_user': payload.get('smtp_user', default_settings['smtp_user']),
            'smtp_password': payload.get('smtp_password', default_settings['smtp_password'])
        }
    except Exception as e:
        logging.error(f"Error parsing application settings from DB: {e}")
        return default_settings

def save_app_settings(settings):
    """Saves system settings into the Supabase inventory table as a special row."""
    import json
    settings_payload = {
        'smtp_server': settings.get('smtp_server', 'smtp.gmail.com'),
        'smtp_port': settings.get('smtp_port', '587'),
        'smtp_user': settings.get('smtp_user', ''),
        'smtp_password': settings.get('smtp_password', '')
    }
    
    settings_product = {
        'sku': '_settings',
        'barcode': '_settings',
        'name': settings.get('recipient_email', 'mohitshers@gmail.com').strip(),
        'quantity': 0,
        'image_url': json.dumps(settings_payload),
        'intake_price': 0.0
    }
    
    products = read_inventory()
    filtered = [p for p in products if p['sku'] != '_settings']
    filtered.append(settings_product)
    write_inventory(filtered)

def get_smtp_config():
    """Retrieves SMTP configuration from DB, falling back to .env or environment variables."""
    try:
        db_settings = load_app_settings()
        if db_settings.get('smtp_user') and db_settings.get('smtp_password'):
            return True, {
                'server': db_settings.get('smtp_server', 'smtp.gmail.com'),
                'port': db_settings.get('smtp_port', '587'),
                'user': db_settings.get('smtp_user'),
                'password': db_settings.get('smtp_password')
            }
    except Exception as e:
        logging.error(f"Error loading SMTP config from database: {e}")

    env_vars = {}
    if os.path.exists('.env'):
        try:
            with open('.env', 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        env_vars[k.strip()] = v.strip()
        except Exception as e:
            logging.error(f"Error reading .env file: {e}")
            
    smtp_server = env_vars.get('SMTP_SERVER') or os.environ.get('SMTP_SERVER')
    smtp_port = env_vars.get('SMTP_PORT') or os.environ.get('SMTP_PORT') or '587'
    smtp_user = env_vars.get('SMTP_USER') or os.environ.get('SMTP_USER')
    smtp_password = env_vars.get('SMTP_PASSWORD') or os.environ.get('SMTP_PASSWORD')
    
    if not smtp_server or not smtp_user or not smtp_password:
        return False, None
    return True, {
        'server': smtp_server,
        'port': smtp_port,
        'user': smtp_user,
        'password': smtp_password
    }

def get_smtp_guide_text():
    return (
        "To enable automated email summaries to mohitshers@gmail.com, you need to configure SMTP settings.\n\n"
        "1. Create a file named `.env` in the project root directory:\n"
        "   /Users/darshan/Desktop/ScanNGo/.env\n\n"
        "2. Add the following variables to the file:\n"
        "   SMTP_SERVER=smtp.gmail.com\n"
        "   SMTP_PORT=587\n"
        "   SMTP_USER=your_email@gmail.com\n"
        "   SMTP_PASSWORD=your_app_password\n\n"
        "Note: For Gmail, you must generate an 'App Password' from your Google Account settings (Security -> 2-Step Verification -> App passwords)."
    )

def send_email_for_date(date_str, smtp_config):
    """Sends sales summary of the specified date to mohitshers@gmail.com with attachment."""
    sales = read_sales()
    
    # Calculate Day, Month, Year, and Yearly stats starting from 2026
    target_day = date_str # e.g. YYYY-MM-DD
    target_month = date_str[:7] # e.g. YYYY-MM
    target_year = date_str[:4] # e.g. YYYY
    
    total_profit_day = 0.0
    total_revenue_day = 0.0
    total_items_sold_day = 0
    today_sales = []
    
    total_profit_month = 0.0
    total_revenue_month = 0.0
    total_items_sold_month = 0
    
    total_profit_year = 0.0
    total_revenue_year = 0.0
    total_items_sold_year = 0
    
    yearly_breakdown = {} # year -> {profit, revenue, items_sold}
    
    for s in sales:
        date = s.get('date', '').strip()
        try:
            profit = float(s.get('profit', 0.0) or 0.0)
            qty = int(s.get('quantity', 0) or 0)
            sold_price = float(s.get('sold_price', 0.0) or 0.0)
            intake = float(s.get('intake', 0.0) or 0.0)
        except (ValueError, TypeError):
            continue
            
        revenue = sold_price * qty
        
        # Accumulate target day
        if date.startswith(target_day):
            total_profit_day += profit
            total_revenue_day += revenue
            total_items_sold_day += qty
            today_sales.append({
                'product_name': s.get('product_name', ''),
                'sku': s.get('sku', ''),
                'intake': intake,
                'sold_price': sold_price,
                'profit': profit,
                'quantity': qty,
                'time': date[11:16] if len(date) > 11 else ''
            })
            
        # Accumulate target month
        if date.startswith(target_month):
            total_profit_month += profit
            total_revenue_month += revenue
            total_items_sold_month += qty
            
        # Accumulate target year
        if date.startswith(target_year):
            total_profit_year += profit
            total_revenue_year += revenue
            total_items_sold_year += qty
            
        # Yearly breakdown starting from 2026
        if date:
            year_str = date[:4]
            if year_str.isdigit():
                year_val = int(year_str)
                if year_val >= 2026:
                    if year_val not in yearly_breakdown:
                        yearly_breakdown[year_val] = {'profit': 0.0, 'revenue': 0.0, 'items_sold': 0}
                    yearly_breakdown[year_val]['profit'] += profit
                    yearly_breakdown[year_val]['revenue'] += revenue
                    yearly_breakdown[year_val]['items_sold'] += qty

    # Make sure years from 2026 up to current year are present in yearly_breakdown
    try:
        current_year_int = int(target_year)
    except (ValueError, TypeError):
        current_year_int = 2026
    for y in range(2026, current_year_int + 1):
        if y not in yearly_breakdown:
            yearly_breakdown[y] = {'profit': 0.0, 'revenue': 0.0, 'items_sold': 0}
            
    subject = f"ScanNGo Daily Sales Summary - {target_day}"
    
    html_content = f"""
    <html>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="background-color: #f1f5f9; padding: 32px 16px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0;">
                <!-- Brand Top Bar -->
                <div style="height: 5px; background-color: #4f46e5;"></div>
                
                <!-- Header -->
                <div style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td>
                                <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em;">MNB Shopie</h1>
                                <div style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">Daily Sales Summary</div>
                            </td>
                            <td style="text-align: right; font-size: 12px; color: #64748b; font-weight: 500;">
                                {target_day}
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Main Content -->
                <div style="padding: 32px;">
                    <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 24px; line-height: 1.5;">
                        Hello, here is the automated sales performance and net profit summary for operations on <strong>{target_day}</strong>:
                    </p>

                    <!-- Today's KPI Cards Grid -->
                    <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Today's Activity ({target_day})</div>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px;">
                        <tr>
                            <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">Items Sold</div>
                                <div style="font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.1;">{total_items_sold_day}</div>
                            </td>
                            <td width="2%">&nbsp;</td>
                            <td width="32%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">Revenue</div>
                                <div style="font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.1;">Rs. {total_revenue_day:.2f}</div>
                            </td>
                            <td width="2%">&nbsp;</td>
                            <td width="32%" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #047857; letter-spacing: 0.05em; margin-bottom: 4px;">Net Profit</div>
                                <div style="font-size: 20px; font-weight: 800; color: #065f46; line-height: 1.1;">Rs. {total_profit_day:.2f}</div>
                            </td>
                        </tr>
                    </table>

                    <!-- Cumulative Net Profit Section -->
                    <div style="font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Cumulative Performance</div>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 32px;">
                        <tr>
                            <td width="49%" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0369a1; letter-spacing: 0.05em; margin-bottom: 4px;">This Month ({target_month})</div>
                                <div style="font-size: 20px; font-weight: 800; color: #075985; line-height: 1.1;">Rs. {total_profit_month:.2f}</div>
                            </td>
                            <td width="2%">&nbsp;</td>
                            <td width="49%" style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; text-align: center;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6d28d9; letter-spacing: 0.05em; margin-bottom: 4px;">This Year ({target_year})</div>
                                <div style="font-size: 20px; font-weight: 800; color: #5b21b6; line-height: 1.1;">Rs. {total_profit_year:.2f}</div>
                            </td>
                        </tr>
                    </table>

                    <!-- Yearly breakdown starting from 2026 -->
                    <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; margin-bottom: 16px;">Yearly Breakdown (from 2026)</h3>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 12px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 32px;">
                        <thead>
                            <tr style="background-color: #f8fafc;">
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Year</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Units Sold</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Total Revenue</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody>
    """
    for index, y_key in enumerate(sorted(yearly_breakdown.keys())):
        y_data = yearly_breakdown[y_key]
        bg_color = "#ffffff" if index % 2 == 0 else "#f8fafc"
        html_content += f"""
                            <tr style="background-color: {bg_color};">
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; color: #0f172a; font-weight: 700;">{y_key}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #475569;">{y_data['items_sold']}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #475569;">Rs. {y_data['revenue']:.2f}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #059669; font-weight: bold;">Rs. {y_data['profit']:.2f}</td>
                            </tr>
        """
        
    html_content += f"""
                        </tbody>
                    </table>

                    <h3 style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; margin-bottom: 16px;">Product Breakdown ({target_day})</h3>
    """
    
    if not today_sales:
        html_content += f"""
                    <div style="text-align: center; padding: 24px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b; font-size: 13px;">
                        No sales transactions recorded for this day.
                    </div>
        """
    else:
        html_content += f"""
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 12px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                        <thead>
                            <tr style="background-color: #f8fafc;">
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Product</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">SKU</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Intake</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Sold Price</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Qty</th>
                                <th style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Profit</th>
                            </tr>
                        </thead>
                        <tbody>
        """
        for index, s in enumerate(today_sales):
            bg_color = "#ffffff" if index % 2 == 0 else "#f8fafc"
            html_content += f"""
                            <tr style="background-color: {bg_color};">
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; color: #0f172a; font-weight: 500;">{s['product_name']}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; font-family: monospace; color: #4f46e5;">{s['sku']}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #475569;">Rs. {s['intake']:.2f}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #475569;">Rs. {s['sold_price']:.2f}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; font-weight: 600; color: #0f172a;">{s['quantity']}</td>
                                <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; color: #059669; font-weight: bold;">Rs. {s['profit']:.2f}</td>
                            </tr>
            """
        html_content += """
                        </tbody>
                    </table>
        """
        
    html_content += """
                </div>

                <!-- Footer -->
                <div style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                        This report was generated automatically by the ScanNGo local server scheduler.
                    </p>
                    <p style="font-size: 10px; color: #cbd5e1; margin-top: 4px; margin-bottom: 0;">
                        MNB Shopie © 2026. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        db_settings = load_app_settings()
        recipient = db_settings.get('recipient_email', 'mohitshers@gmail.com')
    except Exception:
        recipient = "mohitshers@gmail.com"
    msg = MIMEMultipart('mixed')
    msg['Subject'] = subject
    msg['From'] = smtp_config['user']
    msg['To'] = recipient
    
    # Body alternative part
    body_alternative = MIMEMultipart('alternative')
    body_alternative.attach(MIMEText(html_content, 'html'))
    msg.attach(body_alternative)
    
    # Generate CSV Attachment
    try:
        from email.mime.base import MIMEBase
        from email import encoders
        
        csv_content = generate_sales_csv_content(sales)
        attachment = MIMEBase('application', 'octet-stream')
        attachment.set_payload(csv_content.encode('utf-8'))
        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', 'attachment', filename='sales_export.csv')
        msg.attach(attachment)
    except Exception as e:
        logging.error(f"Failed to attach sales CSV: {e}")
        
    server = smtplib.SMTP(smtp_config['server'], int(smtp_config['port']))
    server.starttls()
    server.login(smtp_config['user'], smtp_config['password'])
    server.sendmail(smtp_config['user'], recipient, msg.as_string())
    server.quit()
    
    return True, f"Summary successfully emailed to {recipient}!"

def schedule_midnight_email():
    """Runs in a background thread and triggers the email summary at midnight daily for the previous day."""
    logging.info("Starting background daily midnight email scheduler thread...")
    import time
    while True:
        # Calculate seconds until next midnight
        now = datetime.datetime.now()
        tomorrow = now + datetime.timedelta(days=1)
        midnight = datetime.datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 1) # 1 sec past midnight
        seconds_until_midnight = (midnight - now).total_seconds()
        
        if seconds_until_midnight < 5:
            # If extremely close, push to the next day's midnight to prevent double running
            tomorrow = tomorrow + datetime.timedelta(days=1)
            midnight = datetime.datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 1)
            seconds_until_midnight = (midnight - now).total_seconds()
            
        logging.info(f"Daily midnight email scheduled in {seconds_until_midnight:.1f} seconds.")
        time.sleep(seconds_until_midnight)
        
        # Wake up! Date is now today, so previous day (yesterday) is the target date
        yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        logging.info(f"Midnight scheduler triggered: sending email for {yesterday_str}")
        
        smtp_ok, smtp_config = get_smtp_config()
        if not smtp_ok:
            logging.warning("Midnight email skipped: SMTP not configured.")
            continue
            
        try:
            success, msg = send_email_for_date(yesterday_str, smtp_config)
            logging.info(f"Scheduled midnight email report: {msg}")
        except Exception as e:
            logging.error(f"Scheduled midnight email failed: {e}")

@app.route('/api/sales/email', methods=['POST'])
def email_summary():
    data = request.json or {}
    date_str = data.get('date', datetime.date.today().isoformat())
    
    smtp_ok, smtp_config = get_smtp_config()
    if not smtp_ok:
        return jsonify({
            'success': False,
            'configured': False,
            'message': 'SMTP Credentials are not configured yet.',
            'guide': get_smtp_guide_text()
        })
        
    try:
        success, msg = send_email_for_date(date_str, smtp_config)
        return jsonify({'success': True, 'message': msg})
    except Exception as e:
        logging.error(f"Email API failed: {e}")
        return jsonify({
            'success': False, 
            'message': f'Failed to send email: {str(e)}',
            'guide': "Please verify your SMTP settings in `.env`."
        }), 500
@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        settings = load_app_settings()
        return jsonify(settings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['POST'])
def save_settings_route():
    data = request.json or {}
    recipient_email = data.get('recipient_email', '').strip()
    smtp_server = data.get('smtp_server', '').strip()
    smtp_port = data.get('smtp_port', '').strip()
    smtp_user = data.get('smtp_user', '').strip()
    smtp_password = data.get('smtp_password', '').strip()
    
    if not recipient_email:
        return jsonify({'success': False, 'message': 'Recipient Email is required.'}), 400
        
    try:
        current = load_app_settings()
        updated_settings = {
            'recipient_email': recipient_email,
            'smtp_server': smtp_server or current.get('smtp_server', 'smtp.gmail.com'),
            'smtp_port': smtp_port or current.get('smtp_port', '587'),
            'smtp_user': smtp_user or current.get('smtp_user', ''),
            'smtp_password': smtp_password if smtp_password else current.get('smtp_password', '')
        }
        save_app_settings(updated_settings)
        return jsonify({'success': True, 'message': 'Settings saved successfully to Supabase DB!'})
    except Exception as e:
        logging.error(f"Error saving settings: {e}")
        return jsonify({'success': False, 'message': f'Error saving settings: {str(e)}'}), 500
@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    sales = read_sales()
    timeline_data = {} # date -> {revenue, profit, quantity}
    product_data = {} # sku -> {name, units_sold, revenue, profit}
    
    total_revenue = 0.0
    total_profit = 0.0
    total_items_sold = 0
    
    for row in sales:
        try:
            full_date = row.get('date', '').strip()
            date = full_date[:10] if len(full_date) >= 10 else full_date
            time_str = full_date[11:] if len(full_date) > 11 else ''
            sku = row.get('sku', '').strip()
            name = row.get('product_name', '').strip()
            profit = float(row.get('profit', 0.0) or 0.0)
            qty = int(row.get('quantity', 0) or 0)
            sold_price = float(row.get('sold_price', 0.0) or 0.0)
            
            total_revenue += (sold_price * qty)
            total_profit += profit
            total_items_sold += qty
            
            # Aggregating timeline
            if date:
                if date not in timeline_data:
                    timeline_data[date] = {'date': date, 'revenue': 0.0, 'profit': 0.0, 'quantity': 0, 'sales': []}
                timeline_data[date]['revenue'] += (sold_price * qty)
                timeline_data[date]['profit'] += profit
                timeline_data[date]['quantity'] += qty
                timeline_data[date]['sales'].append({
                    'product_name': name,
                    'sku': sku,
                    'intake': round(float(row.get('intake', 0.0) or 0.0), 2),
                    'sold_price': round(sold_price, 2),
                    'quantity': qty,
                    'profit': round(profit, 2),
                    'time': time_str
                })
                
            # Aggregating products
            if sku:
                if sku not in product_data:
                    product_data[sku] = {'sku': sku, 'name': name, 'units_sold': 0, 'revenue': 0.0, 'profit': 0.0}
                product_data[sku]['units_sold'] += qty
                product_data[sku]['revenue'] += (sold_price * qty)
                product_data[sku]['profit'] += profit
        except (ValueError, TypeError):
            continue
        
    # Sort timeline chronologically
    sorted_timeline = sorted(list(timeline_data.values()), key=lambda x: x['date'])
    # Sort products by revenue
    sorted_products = sorted(list(product_data.values()), key=lambda x: x['revenue'], reverse=True)
    
    margin = (total_profit / total_revenue * 100.0) if total_revenue > 0 else 0.0
    
    # Round float values
    for t in sorted_timeline:
        t['revenue'] = round(t['revenue'], 2)
        t['profit'] = round(t['profit'], 2)
    for p in sorted_products:
        p['revenue'] = round(p['revenue'], 2)
        p['profit'] = round(p['profit'], 2)
        
    return jsonify({
        'summary': {
            'total_revenue': round(total_revenue, 2),
            'total_profit': round(total_profit, 2),
            'total_items_sold': total_items_sold,
            'margin': round(margin, 2)
        },
        'timeline': sorted_timeline,
        'products': sorted_products
    })

@app.route('/api/network-info', methods=['GET'])
def network_info():
    ip = get_local_ip()
    port = 3000
    return jsonify({
        'ip': ip,
        'port': port,
        'local_url': f'https://localhost:{port}',
        'mobile_url': f'https://{ip}:{port}'
    })

def get_local_ip():
    """Retrieves the local IP address of the laptop for easy network connectivity."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def read_categories():
    """Reads all categories from Supabase categories table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return ["General"]
    try:
        url = f"{SUPABASE_URL}/rest/v1/categories?select=*"
        res = requests.get(url, headers=supabase_headers(), timeout=10)
        if res.status_code == 200:
            data = res.json()
            cats = [item['name'] for item in data if 'name' in item]
            if "General" not in cats:
                cats.insert(0, "General")
            return cats
    except Exception as e:
        logging.error(f"Error reading categories: {e}")
    return ["General"]

def write_category(name):
    """Inserts a category into Supabase categories table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    try:
        url = f"{SUPABASE_URL}/rest/v1/categories"
        res = requests.post(url, json={"name": name}, headers=supabase_headers(), timeout=10)
        if res.status_code not in (200, 201):
            logging.error(f"Error writing category: {res.status_code} - {res.text}")
    except Exception as e:
        logging.error(f"Error inserting category: {e}")

@app.route('/api/categories', methods=['GET'])
def get_categories():
    cats = read_categories()
    return jsonify({"categories": cats})

@app.route('/api/categories/add', methods=['POST'])
def add_category():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    write_category(name)
    return jsonify({"categories": read_categories()})

def delete_category_db(name):
    """Deletes a category from Supabase and resets matching products/sales to 'General'."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    try:
        import urllib.parse
        encoded_name = urllib.parse.quote(name)
        # 1. Delete category
        url_cat = f"{SUPABASE_URL}/rest/v1/categories?name=eq.{encoded_name}"
        requests.delete(url_cat, headers=supabase_headers(), timeout=10)

        # 2. Update inventory table
        url_inv = f"{SUPABASE_URL}/rest/v1/inventory?category=eq.{encoded_name}"
        requests.patch(url_inv, json={"category": "General"}, headers=supabase_headers(), timeout=10)

        # 3. Update sales table
        url_sales = f"{SUPABASE_URL}/rest/v1/sales?category=eq.{encoded_name}"
        requests.patch(url_sales, json={"category": "General"}, headers=supabase_headers(), timeout=10)
    except Exception as e:
        logging.error(f"Error deleting category: {e}")

@app.route('/api/categories/delete', methods=['POST'])
def delete_category():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name or name == 'General':
        return jsonify({'error': 'Cannot delete category'}), 400
    delete_category_db(name)
    return jsonify({"categories": read_categories()})

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 3000
    
    # Spawn background scheduler thread only in the main reloader process
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        import threading
        email_thread = threading.Thread(target=schedule_midnight_email, daemon=True)
        email_thread.start()
        
    print("\n" + "="*60)
    print(f" ScanNGo Backend Running in SECURE MODE (HTTPS)!")
    print(f" - Local Dashboard: https://localhost:{port}")
    print(f" - Mobile Access:   https://{local_ip}:{port}")
    print("="*60)
    print(" NOTE: Since we are using a self-signed developer certificate,")
    print(" your browser will show a warning. Click 'Advanced' and 'Proceed'.")
    print(" This is required to allow camera access on iOS/Android devices.")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=True, ssl_context='adhoc')
