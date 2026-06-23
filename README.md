# MNB Shopie — Enterprise Inventory & Billing Management System

An enterprise-grade, mobile-first inventory management, barcode scanning, and billing dashboard built with Python/Flask, Vanilla JS, and Supabase. The system is designed to allow billing personnel to manage stock, scan items via a camera or manual barcode input, complete checkouts, print/email PDF receipts, and track sales performance in real-time.

---

## 🌟 Key Features

### 📋 Stock Dashboard
- **Intake Mode**: Fast-increment stock by barcode scan, search similar titles to prevent duplicate SKU generation, and register new products.
- **Bill Mode**: Quick addition of inventory items directly to a checkout cart.
- **Smart Filtering**: Instant categorization of stock levels: In Stock, Low Stock, and Out of Stock.
- **Search Engine**: Real-time fuzzy query filtering of SKUs, barcodes, and names.
- **Stock Distribution Chart**: Interactive Chart.js visualization of current category distributions.

### 📷 Scanner Hub
- **Camera Scanning**: Integration with `html5-qrcode` to enable barcode scanning via front/rear cameras on both desktop and mobile devices.
- **Web-based Auto-Lookup**: Automatic scanning querying Open Food Facts, UPCitemdb, Open Library (ISBN), and fallback search scrapers to pull product names and images for new items automatically.
- **Manual Input**: Fallback manual barcode or SKU input.

### 🛒 Billing & PDF Checkout
- **Interactive Cart**: Supports custom quantity modifications and pricing updates on the fly during checkouts.
- **Self-Generating Receipts**: Compiles transaction receipts with tabular structures and totals using ReportLab in Python.
- **Receipt Emailing**: Sends the generated PDF directly to the customer's inbox via secure SMTP.

### 📊 Business Analytics
- **Live Performance KPIs**: Visual indicators for Gross Revenue, Net Profit, Items Sold, and Profit Margins.
- **Trends & Contribution charts**: Line charts representing revenue/profit progression, top performing products, and profit share doughnut charts.
- **Sales Logging**: Dynamic breakdown table of transactions with CSV exports.

### 🔒 Access Security Gate (New)
- **Session Protection**: Flask cookie sessions block all application page access and API requests unless a valid authenticated session is present.
- **Premium Glassmorphic Login**: Custom styled entrance page with error-handling shake animations.

---

## 🏗️ Architecture & Technology Stack

```
                     ┌──────────────────┐
                     │   Web Browser    │
                     │  (Desktop/Mobile)│
                     └────────┬─────────┘
                              │ HTTPS
                              ▼
                     ┌──────────────────┐
                     │  Flask Server    │
                     │    (server.py)   │
                     └────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
     │  Supabase   │   │ ReportLab   │   │ SMTP Relay  │
     │  (Database) │   │ (PDF Engine)│   │  (Emails)   │
     └─────────────┘   └─────────────┘   └─────────────┘
```

1. **Frontend**: HTML5, Vanilla JavaScript, CSS variables (custom styling system), and Chart.js.
2. **Backend**: Python 3.9+ and Flask.
3. **Database Layer**: Supabase (REST API calls for atomic database persistence).
4. **Barcode Scanning Library**: HTML5 QR Code (webcam stream).
5. **PDF Generator**: ReportLab.
6. **Automation**: Daily background reporting scheduler.

---

## 📁 File Directory Map

- [`server.py`](file:///Users/darshan/Desktop/ScanNGo/server.py): Main Flask backend router. Holds all API endpoints, auth middleware (`before_request`), daily email scheduler, Supabase integrations, and PDF generator code.
- [`index.html`](file:///Users/darshan/Desktop/ScanNGo/index.html): The main layout of the application serving the Stock Dashboard, modals, and scanner workflows.
- [`analytics.html`](file:///Users/darshan/Desktop/ScanNGo/analytics.html): Dynamic analytical interface displaying sales metrics, top performers, and transaction logs.
- [`login.html`](file:///Users/darshan/Desktop/ScanNGo/login.html): Glassmorphic login gate page.
- [`app.js`](file:///Users/darshan/Desktop/ScanNGo/app.js): Frontend client logic managing scanning camera instantiations, cart additions, modal views, settings updates, search operations, and dashboard UI rendering.
- [`style.css`](file:///Users/darshan/Desktop/ScanNGo/style.css): Global stylesheet containing CSS custom properties (variables), grid setups, responsive queries, and UI components.
- [`start.sh`](file:///Users/darshan/Desktop/ScanNGo/start.sh): Local developer script to start the server. It frees port 3000, checks the virtual environment, and runs Flask.
- [`setup.py`](file:///Users/darshan/Desktop/ScanNGo/setup.py): Set up local SQLite tables (historical/fallback configurations).
- [`migrate_to_supabase.py`](file:///Users/darshan/Desktop/ScanNGo/migrate_to_supabase.py): Migration helper script to sync files from local CSV sheets onto Supabase table definitions.
- [`setup_email.py`](file:///Users/darshan/Desktop/ScanNGo/setup_email.py): Setup CLI helper to configure SMTP values in environment settings.
- [`vercel.json`](file:///Users/darshan/Desktop/ScanNGo/vercel.json): Server deployment configurations for Vercel.

---

## ⚙️ Environment Configuration (`.env`)

To run the application, configure a `.env` file in the root directory containing the following parameters:

```env
# Supabase Database Credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-service-role-or-anon-key

# Flask Session Security
SESSION_SECRET_KEY=secure-random-phrase-goes-here

# Authentication Credentials (Defaults to MNBUser/MNBShopie@123)
LOGIN_USER=MNBUser
LOGIN_PASS=MNBShopie@123
```

---

## 🗄️ Supabase Table Structures

Ensure the following tables are provisioned in your Supabase database:

### 1. `inventory` Table
- `sku` (text, Primary Key)
- `barcode` (text, Index)
- `name` (text)
- `quantity` (integer)
- `image_url` (text)
- `intake_price` (numeric/float)

### 2. `sales` Table
- `id` (integer, Auto-Incrementing Primary Key)
- `date` (text)
- `product_name` (text)
- `sku` (text)
- `intake` (numeric/float)
- `sold_price` (numeric/float)
- `profit` (numeric/float)
- `quantity` (integer)

---

## 🚀 Local Installation & Running Instructions

### 1. Prerequisites
Ensure you have Python 3.9 or higher installed.

### 2. Initialize Virtual Environment & Install Dependencies
```bash
# Create environment
python3 -m venv .venv

# Activate environment
source .venv/bin/activate

# Install required python packages
pip install -r requirements.txt
```

### 3. Startup the Server
Run the local boot script to free port `3000` and start the server:
```bash
chmod +x start.sh
./start.sh
```

### 4. Self-Signed Developer Certificate
The backend runs in **secure HTTPS mode** by generating a self-signed SSL certificate on boot. This is mandatory to allow browser permission access to the camera (scanning) when viewing the dashboard from other devices on the same local network.
- When opening the URL `https://localhost:3000`, your browser will show a warning page ("Your connection is not private").
- Click **Advanced** and then **Proceed to localhost (unsafe)** to enter the dashboard.

---

## 🔑 Login Gate Details
- **User ID**: `MNBUser`
- **Password**: `MNBShopie@123`

The authentication is session-based, keeping users logged in locally across tabs. When finished, clicking the red **Logout** option on the navigation bar destroys the session securely and redirects the client.

---
Created with <3 by Mohit Sherkhane
