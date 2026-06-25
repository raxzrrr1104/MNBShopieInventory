import sys
import os

# Add parent directory to sys.path so we can import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app
import aws_lambda_wsgi

def handler(event, context):
    return aws_lambda_wsgi.response(app, event, context)
