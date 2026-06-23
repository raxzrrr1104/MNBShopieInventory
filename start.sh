#!/bin/bash

# Navigate to script directory
cd "$(dirname "$0")"

echo "=========================================================="
echo "          MNB Shopie - Local Server Startup"
echo "=========================================================="

# 1. Check for Python virtual environment
if [ ! -d ".venv" ]; then
    echo "ERROR: Virtual environment '.venv' not found."
    echo "Please create a virtual environment first: python3 -m venv .venv"
    echo "And install requirements: .venv/bin/pip install -r requirements.txt"
    exit 1
fi

# 2. Check for .env file configuration
if [ ! -f ".env" ]; then
    echo "WARNING: '.env' configuration file not found."
    echo "We recommend running 'python3 setup_email.py' to configure SMTP and Supabase settings."
    echo "----------------------------------------------------------"
fi

# 3. Start the Flask server
echo "Starting backend server via virtual environment..."
echo "Open: https://localhost:3000"
echo "=========================================================="

# Kill any process running on port 3000
PORT=3000
echo "Checking if port $PORT is in use..."
PIDS=$(lsof -t -i:$PORT 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "Killing processes on port $PORT (PIDs: $PIDS)..."
    kill -9 $PIDS 2>/dev/null || true
    sleep 1
fi

exec .venv/bin/python server.py
