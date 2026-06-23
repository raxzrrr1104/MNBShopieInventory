import os
import json
import requests

def backup():
    # Read environment variables from .env
    env = {}
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    k, v = line.strip().split('=', 1)
                    env[k.strip()] = v.strip()
                
    url = env.get('SUPABASE_URL')
    key = env.get('SUPABASE_KEY')
    
    if not url or not key:
        print("Error: SUPABASE_URL or SUPABASE_KEY not found in .env")
        return
        
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}'
    }
    
    tables = ['inventory', 'sales', 'categories']
    print("Starting database backup...")
    for table in tables:
        try:
            res = requests.get(f"{url}/rest/v1/{table}?select=*", headers=headers)
            if res.status_code == 200:
                filename = f"backup_{table}.json"
                with open(filename, "w") as f:
                    json.dump(res.json(), f, indent=4)
                print(f"✅ Backed up '{table}' to {filename} ({len(res.json())} records)")
            else:
                print(f"❌ Failed to backup '{table}': {res.status_code} - {res.text}")
        except Exception as e:
            print(f"❌ Error backing up '{table}': {e}")

if __name__ == '__main__':
    backup()
