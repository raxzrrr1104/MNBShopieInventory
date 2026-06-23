#!/usr/bin/env python3
import os
import sys

def main():
    print("=" * 60)
    print("      MNB Shopie - Supabase & SMTP Email Config Wizard")
    print("=" * 60)
    print("This utility will help you configure your database and email services.")
    print("Settings will be written to '.env' automatically.\n")
    
    # 1. Supabase Configuration
    print("--- 1. Supabase Cloud Database Configuration ---")
    print("Get these from your Supabase Project Settings -> API.")
    supabase_url = input("Enter Supabase URL (e.g., https://xyz.supabase.co): ").strip()
    supabase_key = input("Enter Supabase Service Role Key (secret): ").strip()
    
    if not supabase_url or not supabase_key:
        print("\nERROR: Supabase URL and Key are required to save products.")
        sys.exit(1)
        
    # 2. SMTP Email Configuration
    print("\n--- 2. SMTP Email Server Configuration ---")
    configure_email = input("Do you want to configure email daily summaries? [Y/n]: ").strip().lower()
    
    smtp_server = "smtp.gmail.com"
    smtp_port = "587"
    email_user = ""
    email_pass = ""
    
    if configure_email != 'n':
        provider = input("Select provider: [1] Gmail (Default), [2] Custom SMTP: ").strip()
        if provider == '2':
            smtp_server = input("Enter SMTP Server (e.g. smtp.mail.yahoo.com): ").strip()
            smtp_port = input("Enter SMTP Port (default: 587): ").strip() or "587"
            
        email_user = input("Enter sender Email Address: ").strip()
        print("For Gmail, generate an 'App Password' at: https://myaccount.google.com/apppasswords")
        email_pass = input("Enter SMTP / App Password: ").strip()

    # Create .env content
    env_content = f"""# Supabase Configuration
SUPABASE_URL={supabase_url}
SUPABASE_KEY={supabase_key}

# SMTP Configuration
SMTP_SERVER={smtp_server}
SMTP_PORT={smtp_port}
SMTP_USER={email_user}
SMTP_PASSWORD={email_pass}
"""

    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    
    try:
        with open(env_path, "w") as f:
            f.write(env_content)
        
        print("\n" + "=" * 60)
        print("SUCCESS: Credentials saved to:")
        print(f"  {env_path}")
        print("=" * 60)
        print("Next steps:")
        print("1. Run the migration script to upload local records to Supabase:")
        print("   python3 migrate_to_supabase.py")
        print("2. Start your local server:")
        print("   ./start.sh")
        print("=" * 60)
    except Exception as e:
        print(f"\nError writing configuration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
