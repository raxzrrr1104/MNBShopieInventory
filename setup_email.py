#!/usr/bin/env python3
import os
import sys

def main():
    print("=" * 60)
    print("          ScanNGo - SMTP Email Config Wizard")
    print("=" * 60)
    print("This utility will help you configure automated daily summaries")
    print("to: mohitshers@gmail.com\n")
    print("Gmail is the recommended provider. If using Gmail, make sure you")
    print("have generated an 'App Password' from your Google Account settings.")
    print("Do NOT enter your raw Gmail account password if 2FA is active.")
    print("-" * 60)

    # 1. Ask for provider
    provider = input("Select provider: [1] Gmail (Default), [2] Custom SMTP: ").strip()
    
    if provider == '2':
        smtp_server = input("Enter SMTP Server (e.g. smtp.mail.yahoo.com): ").strip()
        smtp_port = input("Enter SMTP Port (default: 587): ").strip() or "587"
    else:
        smtp_server = "smtp.gmail.com"
        smtp_port = "587"

    # 2. Ask for credentials
    email_user = input("Enter your sender Email Address: ").strip()
    if not email_user:
        print("Error: Email address is required.")
        sys.exit(1)

    print("\nFor Gmail, App Passwords can be generated at: ")
    print("https://myaccount.google.com/apppasswords")
    email_pass = input("Enter SMTP / App Password: ").strip()
    if not email_pass:
        print("Error: Password is required.")
        sys.exit(1)

    # Create the config text
    env_content = f"""# ScanNGo SMTP Configuration
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
        print("SUCCESS: SMTP configuration saved to:")
        print(f"  {env_path}")
        print("=" * 60)
        print("The ScanNGo server will load these settings on next start.")
        print("You can verify email settings by hitting 'Email Daily Summary' on the UI!")
        print("=" * 60)
    except Exception as e:
        print(f"\nError writing configuration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
