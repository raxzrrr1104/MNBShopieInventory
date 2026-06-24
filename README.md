# MNB Shopie — Enterprise Inventory & Billing Management System

[![Python Version](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/flask-v3.0-green.svg)](https://flask.palletsprojects.com/)
[![Supabase](https://img.shields.io/badge/database-Supabase--PostgreSQL-emerald.svg)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An enterprise-grade, mobile-first inventory management, barcode scanning, and billing dashboard built with a Python/Flask backend, Vanilla JS frontend, and Supabase (PostgreSQL) database. The system is designed to allow billing personnel to manage stock, scan items via a camera or manual barcode input, complete checkouts, print/email PDF receipts, log business nominal expenses, and track sales performance in real-time.

---

## 🌟 Core Highlights & Showcase Value

* **Zero-Dependency Camera Scanning**: Direct camera stream integration using the `html5-qrcode` engine.
* **Autonomous Web Scraping & Metadata Parsing**: Instant SKU auto-discovery through Open Food Facts, UPCitemdb, Open Library (ISBN), and DuckDuckGo Lite search scrapers to pull product names and images for new items automatically.
* **Relational Invoice Auditing Ledger**: Built with parent checkout invoices (`bills` table), detailed line items (`bill_items` table), and returns auditing logs (`transaction_logs` table) with cascade deletion triggers.
* **Automated PDF Compiler & Mail dispatcher**: Custom ReportLab PDF invoice builder. Automatically compiles, formats, and emails revised receipts to customers during checkouts, refunds, or swaps.
* **Nominal Expenses Log & True Net Analytics**: Dedicated panel for logging operational expenses (rent, utility bills, salaries). Integrates directly with Business Analytics to deduct costs from gross profit for true Net Profit tracking.

---

## 📋 Detailed Feature Walkthrough

### 1. Stock Dashboard
* **Intake Mode**: Fast-increment stock by barcode scan, search similar titles to prevent duplicate SKU generation, and register new products.
* **Bill Mode**: Quick addition of inventory items directly to a checkout cart.
* **Smart Filtering**: Instant categorization of stock levels: In Stock, Low Stock, and Out of Stock.
* **Search Engine**: Real-time fuzzy query filtering of SKUs, barcodes, and names.
* **Stock Distribution Chart**: Interactive Chart.js visualization of current category distributions.

### 2. Billing & Returns Wizard
* **Interactive Cart**: Supports custom quantity modifications and pricing updates on the fly during checkouts.
* **PDF Receipt Downloader**: Integrated JS downloader that fetches PDF bytes via secure AJAX, bypassing browser HTTPS download blocks on self-signed localhost environments.
* **Return & Swap constraints**: Enforces validation constraints preventing refunds/swaps on already returned items or replacement items. Re-opens and refreshes the invoice modal in-place.
* **Dynamic 'EXCHANGED' Invoice Status**: Automatically updates and flags invoice status dynamically if a product exchange is executed.

### 3. Business Analytics & Expenses Log
* **Performance KPIs**: Visual indicators for Gross Revenue, Net Profit (true net after expenses), Items Sold, and Profit Margins.
* **Trends & Contribution charts**: Line charts representing revenue/profit progression, top performing products, and profit share doughnut charts.
* **Expenses Ledger**: Full CRUD panel in `analytics.html` to log name and total cost of business nominals, showing live lists and net profit updates.
* **Sales Logging**: Dynamic breakdown table of transactions with CSV exports.

### 4. Access Security Gate
* **Session Protection**: Flask cookie sessions block all application page access and API requests unless a valid authenticated session is present.
* **Premium Glassmorphic Login**: Custom styled entrance page with error-handling shake animations.

---

## 🏗️ Architecture & Technology Stack

```
                     ┌──────────────────┐
                     │   Web Browser    │
                     │  (Desktop/Mobile)│
                     └────────┬─────────┘
                              │ HTTPS (Self-Signed Dev Certificate)
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
     │ (PostgreSQL)│   │ (PDF Engine)│   │  (Emails)   │
     └─────────────┘   └─────────────┘   └─────────────┘
```

1. **Frontend**: HTML5, Vanilla JavaScript, CSS variables (custom styling system), and Chart.js.
2. **Backend**: Python 3.9+ and Flask.
3. **Database Layer**: Supabase (REST API calls for atomic database persistence).
4. **Barcode Scanning Library**: HTML5 QR Code (webcam stream).
5. **PDF Generator**: ReportLab.
6. **Automation**: Daily background reporting scheduler.

---

## 📁 Repository Directory Structure

* [`server.py`](./server.py): Main Flask backend router. Holds all API endpoints, auth middleware (`before_request`), daily email scheduler, Supabase integrations, and PDF generator code.
* [`index.html`](./index.html): The main layout of the application serving the Stock Dashboard, modals, and scanner workflows.
* [`analytics.html`](./analytics.html): Dynamic analytical interface displaying sales metrics, top performers, nominal expenses CRUD, and transaction logs.
* [`login.html`](./login.html): Glassmorphic login gate page.
* [`app.js`](./app.js): Frontend client logic managing scanning camera instantiations, cart additions, modal views, settings updates, search operations, and dashboard UI rendering.
* [`style.css`](./style.css): Global stylesheet containing CSS custom properties (variables), grid setups, responsive queries, and UI components.
* [`start.sh`](./start.sh): Local developer script to start the server. It frees port 3000, checks the virtual environment, and runs Flask.
* [`schema.sql`](./schema.sql): Standard table structures (inventory, sales, categories).
* [`schema_billing.sql`](./schema_billing.sql): Relational table structures (bills, bill_items, transaction_logs, expenses).

---

## ⚙️ Environment Configuration (`.env`)

Configure a `.env` file in the root directory containing the following parameters:

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

## 🗄️ Supabase Table Migrations

Run the following SQL scripts in your Supabase SQL Editor to provision the required table schemas:

### Core Tables (`schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS inventory (
    sku text PRIMARY KEY,
    barcode text,
    name text,
    quantity integer DEFAULT 0,
    image_url text,
    intake_price numeric(10,2) DEFAULT 0.00,
    selling_price numeric(10,2) DEFAULT 0.00,
    category text DEFAULT 'General'
);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);

CREATE TABLE IF NOT EXISTS sales (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    date text,
    product_name text,
    sku text,
    intake numeric(10,2) DEFAULT 0.00,
    sold_price numeric(10,2) DEFAULT 0.00,
    profit numeric(10,2) DEFAULT 0.00,
    quantity integer DEFAULT 1,
    category text DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS categories (
    name text PRIMARY KEY
);
INSERT INTO categories (name) VALUES ('General') ON CONFLICT DO NOTHING;
```

### Relational Billing & Expenses (`schema_billing.sql`)
```sql
CREATE TABLE IF NOT EXISTS bills (
    bill_no text PRIMARY KEY,
    date text NOT NULL,
    customer_email text,
    total_amount numeric(10,2) NOT NULL,
    discount_type text DEFAULT 'none',
    discount_value numeric(10,2) DEFAULT 0.00,
    net_amount numeric(10,2) NOT NULL,
    status text DEFAULT 'completed'             -- 'completed', 'partially_refunded', 'exchanged', 'refunded'
);

CREATE TABLE IF NOT EXISTS bill_items (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    bill_no text REFERENCES bills(bill_no) ON DELETE CASCADE,
    sku text REFERENCES inventory(sku) ON DELETE RESTRICT,
    product_name text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    original_price numeric(10,2) NOT NULL,
    discount_share numeric(10,2) DEFAULT 0.00,
    final_sold_price numeric(10,2) NOT NULL,
    intake_price numeric(10,2) DEFAULT 0.00,
    returned_quantity integer DEFAULT 0 CHECK (returned_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS transaction_logs (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    parent_bill_no text REFERENCES bills(bill_no) ON DELETE CASCADE,
    type text NOT NULL,                         -- 'refund' or 'exchange'
    date text NOT NULL,
    items_involved jsonb NOT NULL,              -- e.g., [{"sku": "MAN-1", "qty": 1, "action": "returned"}]
    cash_delta numeric(10,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS expenses (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    amount numeric(10,2) NOT NULL,
    date text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_no ON bill_items(bill_no);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_bill ON transaction_logs(parent_bill_no);
```

---

## 🚀 Local Setup & Installation

### 1. Prerequisites
Make sure you have **Python 3.9+** and **Pip** installed on your system.

### 2. Clone Repository & Setup Virtual Environment
```bash
# Clone the repository
git clone https://github.com/raxzrrr1104/MNBShopieInventory.git
cd MNBShopieInventory

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install required python packages
pip install -r requirements.txt
```

### 3. Start the Flask Server
Boot the local server using the startup script which cleans port `3000` automatically:
```bash
chmod +x start.sh
./start.sh
```

### 4. Accessing the Dashboard & Bypassing local SSL warnings
The local developer environment serves assets over **secure HTTPS mode** by generating a self-signed SSL certificate on boot. This is mandatory to allow browser webcam permission access to the barcode scanner from mobile devices on the same local network.
1. When opening `https://localhost:3000`, the browser will show a warning page ("Your connection is not private").
2. Click **Advanced** and then click **Proceed to localhost (unsafe)**.
3. Access the dashboard securely!

---

## 🔑 Default Login Credentials
* **User ID**: `MNBUser`
* **Password**: `MNBShopie@123`

---

## ☁️ Deploying to Vercel

This repository is fully configured and ready for serverless hosting on **Vercel** out-of-the-box. 

### 1. Vercel Configuration Details
The repository contains a [`vercel.json`](./vercel.json) file that handles routing and builds your Python Flask serverless function via `@vercel/python`.

### 2. Steps to Deploy
1. Push your repository code to GitHub:
   ```bash
   git push origin main
   ```
2. Log in to the [Vercel Dashboard](https://vercel.com/) and click **Add New Project**.
3. Select and import your GitHub repository (`MNBShopieInventory`).
4. In the **Environment Variables** section, add the following credentials from your `.env` file:
   * `SUPABASE_URL`
   * `SUPABASE_KEY`
   * `LOGIN_USER`
   * `LOGIN_PASS`
   * `FLASK_SECRET_KEY`
5. Click **Deploy**. Vercel will install the requirements from [`requirements.txt`](./requirements.txt), compile the serverless function, and host your app live!

---
Developed by **Mohit Sherkhane**
