#!/usr/bin/env python3
import os
import csv
import requests

def load_env():
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def main():
    print("=" * 60)
    print("      ScanNGo to Supabase Migration Utility")
    print("=" * 60)
    
    env = load_env()
    supabase_url = env.get('SUPABASE_URL') or os.environ.get('SUPABASE_URL')
    supabase_key = env.get('SUPABASE_KEY') or os.environ.get('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("ERROR: Supabase credentials not found.")
        print("Please configure SUPABASE_URL and SUPABASE_KEY in your `.env` file first.")
        return
        
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    # 1. Migrate Inventory
    inv_file = 'inventory.csv'
    if os.path.exists(inv_file):
        print(f"\n[1/2] Migrating {inv_file}...")
        payload = []
        try:
            with open(inv_file, mode='r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        intake = float(row.get('intake_price') or 0.0)
                    except ValueError:
                        intake = 0.0
                    payload.append({
                        'sku': row.get('sku', '').strip(),
                        'barcode': row.get('barcode', '').strip(),
                        'name': row.get('name', '').strip(),
                        'quantity': int(row.get('quantity', 0) or 0),
                        'image_url': row.get('image_url', '').strip(),
                        'intake_price': intake
                    })
            if payload:
                url = f"{supabase_url}/rest/v1/inventory"
                res = requests.post(url, json=payload, headers=headers, timeout=15)
                if res.status_code in (200, 201):
                    print(f"SUCCESS: Migrated {len(payload)} products to 'inventory' table.")
                else:
                    print(f"FAILED: Supabase API returned status {res.status_code} - {res.text}")
            else:
                print("No inventory records found in CSV.")
        except Exception as e:
            print(f"ERROR reading {inv_file}: {e}")
    else:
        print(f"\n[1/2] Skipping inventory migration: {inv_file} not found.")

    # 2. Migrate Sales
    sales_file = 'sales.csv'
    if os.path.exists(sales_file):
        print(f"\n[2/2] Migrating {sales_file}...")
        payload = []
        try:
            with open(sales_file, mode='r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        intake = float(row.get('intake', 0.0) or 0.0)
                        sold_price = float(row.get('sold_price', 0.0) or 0.0)
                        profit = float(row.get('profit', 0.0) or 0.0)
                        qty = int(row.get('quantity', 1) or 1)
                    except ValueError:
                        continue
                    payload.append({
                        'date': row.get('date', '').strip(),
                        'product_name': row.get('product_name', '').strip(),
                        'sku': row.get('sku', '').strip(),
                        'intake': intake,
                        'sold_price': sold_price,
                        'profit': profit,
                        'quantity': qty
                    })
            if payload:
                # For sales table, it is generated always as identity, so we just bulk insert.
                # Remove Prefer: resolution=merge-duplicates header since we don't have uniqueness key constraints on sales logs
                headers_sales = headers.copy()
                if "Prefer" in headers_sales:
                    del headers_sales["Prefer"]
                url = f"{supabase_url}/rest/v1/sales"
                res = requests.post(url, json=payload, headers=headers_sales, timeout=15)
                if res.status_code in (200, 201):
                    print(f"SUCCESS: Migrated {len(payload)} transactions to 'sales' table.")
                else:
                    print(f"FAILED: Supabase API returned status {res.status_code} - {res.text}")
            else:
                print("No sales records found in CSV.")
        except Exception as e:
            print(f"ERROR reading {sales_file}: {e}")
    else:
        print(f"\n[2/2] Skipping sales migration: {sales_file} not found.")

    print("\nMigration completed.")

if __name__ == "__main__":
    main()
