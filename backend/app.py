import json
import uuid
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

from flask import Flask, jsonify, request
from flask_cors import CORS

from src import database
from src.docx_generator import save_order_as_docx

app = Flask(__name__)
CORS(app)

# --- JSON File Paths ---
CUSTOMERS_FILE = 'customers.json'
MENU_ITEMS_FILE = 'menu_items.json'

# --- JSON Helper Functions ---
def read_json(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def write_json(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

# --- Email Sending Logic (adapted from order_manager.py) ---
def send_order_email(order_data, customer_email, docx_path):
    conn = database.get_connection()
    settings = conn.cursor().execute("SELECT * FROM settings WHERE id = 1").fetchone()
    conn.close()

    if not (settings and settings['sender_email'] and settings['google_app_password']):
        raise ValueError("Email settings are not configured in the database.")

    sender_email = settings['sender_email']
    app_password = settings['google_app_password']
    subject_template = settings['email_subject_template'] or "Your Order Confirmation"
    body_template = settings['email_body_template'] or "Thank you for your order! Please find your receipt attached."

    subject = subject_template.replace("[order number]", order_data.get('order_number', ''))
    body = body_template.replace("[customer name]", order_data.get('customer_name', ''))

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = customer_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    with open(docx_path, "rb") as f:
        attach = MIMEApplication(f.read(), _subtype="docx")
        attach.add_header('Content-Disposition', 'attachment', filename=os.path.basename(docx_path))
        msg.attach(attach)

    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(sender_email, app_password)
    server.send_message(msg)
    server.quit()

# --- Customer API Endpoints (JSON-based) ---
@app.route('/api/customers', methods=['GET'])
def get_customers():
    customers = read_json(CUSTOMERS_FILE)
    return jsonify(customers)

@app.route('/api/customers', methods=['POST'])
def add_customer():
    customers = read_json(CUSTOMERS_FILE)
    new_customer = request.json
    new_customer['id'] = str(uuid.uuid4())
    customers.append(new_customer)
    write_json(CUSTOMERS_FILE, customers)
    return jsonify(new_customer), 201

# ... (other customer endpoints remain the same) ...

# --- Menu Item API Endpoints (JSON-based) ---
@app.route('/api/menu-items', methods=['GET'])
def get_menu_items():
    menu_items = read_json(MENU_ITEMS_FILE)
    return jsonify(menu_items)

@app.route('/api/menu-items', methods=['POST'])
def add_menu_item():
    menu_items = read_json(MENU_ITEMS_FILE)
    payload = request.json or {}
    name = (payload.get('name') or '').strip()
    category = (payload.get('category') or '').strip().upper()

    if not name:
        return jsonify({'message': 'Menu item name is required.'}), 400
    if category not in {'ENTREE', 'MAIN', 'DESSERT'}:
        category = 'ENTREE'

    new_item = {
        'id': str(uuid.uuid4()),
        'name': name,
        'category': category
    }
    menu_items.append(new_item)
    write_json(MENU_ITEMS_FILE, menu_items)
    return jsonify(new_item), 201

@app.route('/api/menu-items/<item_id>', methods=['PUT'])
def update_menu_item(item_id):
    menu_items = read_json(MENU_ITEMS_FILE)
    payload = request.json or {}
    updated = None
    for item in menu_items:
        if str(item.get('id')) == str(item_id):
            if 'name' in payload:
                item['name'] = (payload['name'] or '').strip()
            if 'category' in payload:
                item['category'] = (payload['category'] or '').strip().upper()
            updated = item
            break

    if updated is None:
        return jsonify({'message': 'Menu item not found.'}), 404

    write_json(MENU_ITEMS_FILE, menu_items)
    return jsonify(updated)

@app.route('/api/menu-items/<item_id>', methods=['DELETE'])
def delete_menu_item(item_id):
    menu_items = read_json(MENU_ITEMS_FILE)
    remaining = [item for item in menu_items if str(item.get('id')) != str(item_id)]
    if len(remaining) == len(menu_items):
        return jsonify({'message': 'Menu item not found.'}), 404
    write_json(MENU_ITEMS_FILE, remaining)
    return jsonify({'message': 'Menu item deleted.'})

# --- Order API Endpoints (SQLite-based) ---
@app.route('/api/orders', methods=['GET'])
def get_orders():
    customers = read_json(CUSTOMERS_FILE)
    customer_map = {str(c.get('id')): c.get('name') for c in customers}
    conn = database.get_connection()
    db_orders = conn.cursor().execute("SELECT * FROM orders").fetchall()
    conn.close()
    orders = [dict(row) for row in db_orders]
    for order in orders:
        order['customer_name'] = customer_map.get(str(order['customer_id']), 'Unknown')
    return jsonify(orders)

@app.route('/api/orders', methods=['POST'])
def add_order_and_process():
    data = request.json
    conn = database.get_connection()
    cursor = conn.cursor()

    # 1. Save the Order
    cursor.execute("""
        INSERT INTO orders (customer_id, order_number, service_type, adults, kids, arrival_time, order_date, order_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['customer_id'], data['order_number'], data['service_type'], 
        data['adults'], data['kids'], data['arrival_time'], 
        data['order_date'], json.dumps(data['order_data'])
    ))
    new_order_id = cursor.lastrowid

    # 2. Create the Invoice
    cursor.execute("INSERT INTO invoices (order_id, invoice_number) VALUES (?, ?)", (new_order_id, 'temp'))
    new_invoice_id = cursor.lastrowid
    invoice_number = f"INV-{new_invoice_id:05d}"
    cursor.execute("UPDATE invoices SET invoice_number = ? WHERE id = ?", (invoice_number, new_invoice_id))
    conn.commit()
    conn.close()

    # --- Post-Save Processing ---
    try:
        # Prepare data for document generation and email
        customers = read_json(CUSTOMERS_FILE)
        customer = next((c for c in customers if str(c.get('id')) == str(data['customer_id'])), None)
        if not customer:
            raise ValueError("Customer not found for email processing.")

        full_order_data = {**data, "customer_name": customer.get('name'), "invoice_number": invoice_number}

        # 3. Generate DOCX
        output_folder = os.path.join(os.getcwd(), "invoices") # Save to a dedicated invoices folder
        os.makedirs(output_folder, exist_ok=True)
        docx_path = save_order_as_docx(full_order_data, output_folder)

        # 4. Send Email
        send_order_email(full_order_data, customer.get('email'), docx_path)

        return jsonify({
            'id': new_order_id,
            'message': 'Order saved, invoice created, and email sent successfully.',
            'invoice_number': invoice_number,
            'docx_path': docx_path
        }), 201

    except Exception as e:
        # This part is crucial. If post-processing fails, the order is still saved.
        # We return a success response for the order creation but include the error.
        return jsonify({
            'id': new_order_id,
            'message': 'Order saved, but failed to generate documents or send email.',
            'error': str(e)
        }), 207 # 207 Multi-Status

@app.route('/api/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    data = request.json or {}
    conn = database.get_connection()
    cursor = conn.cursor()
    existing = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'message': 'Order not found.'}), 404

    try:
        existing_order_detail = json.loads(existing['order_data'] or '{}')
    except json.JSONDecodeError:
        existing_order_detail = {}

    def _coerce_int(value, fallback):
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback

    update_fields = {
        'order_number': data.get('order_number', existing['order_number']),
        'service_type': data.get('service_type', existing['service_type']),
        'adults': _coerce_int(data.get('adults'), existing['adults']),
        'kids': _coerce_int(data.get('kids'), existing['kids']),
        'arrival_time': data.get('arrival_time', existing['arrival_time']),
        'order_date': data.get('order_date', existing['order_date']),
        'order_data': json.dumps(data.get('order_data', existing_order_detail))
    }

    cursor.execute("""
        UPDATE orders
        SET order_number = ?, service_type = ?, adults = ?, kids = ?, arrival_time = ?, order_date = ?, order_data = ?
        WHERE id = ?
    """, (
        update_fields['order_number'],
        update_fields['service_type'],
        update_fields['adults'],
        update_fields['kids'],
        update_fields['arrival_time'],
        update_fields['order_date'],
        update_fields['order_data'],
        order_id
    ))
    conn.commit()
    updated_row = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    conn.close()

    if updated_row:
        orders_dict = dict(updated_row)
        customers = read_json(CUSTOMERS_FILE)
        customer_map = {str(c.get('id')): c.get('name') for c in customers}
        orders_dict['customer_name'] = customer_map.get(str(orders_dict['customer_id']), 'Unknown')
        return jsonify(orders_dict)

    return jsonify({'message': 'Unable to retrieve updated order.'}), 500

# --- Settings API Endpoints ---
@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = database.get_connection()
    settings = conn.cursor().execute("SELECT * FROM settings WHERE id = 1").fetchone()
    conn.close()
    if settings:
        return jsonify(dict(settings))
    # If no settings, return a default structure
    return jsonify({
        'sender_email': '',
        'google_app_password': '',
        'email_subject_template': '',
        'email_body_template': ''
    })

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    data = request.json
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM settings WHERE id = 1")
    exists = cursor.fetchone()

    if exists:
        cursor.execute("""
            UPDATE settings 
            SET sender_email = ?, google_app_password = ?, email_subject_template = ?, email_body_template = ?
            WHERE id = 1
        """, (data['sender_email'], data['google_app_password'], data['email_subject_template'], data['email_body_template']))
    else:
        cursor.execute("""
            INSERT INTO settings (id, sender_email, google_app_password, email_subject_template, email_body_template) 
            VALUES (1, ?, ?, ?, ?)
        """, (data['sender_email'], data['google_app_password'], data['email_subject_template'], data['email_body_template']))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'Settings updated successfully'})


if __name__ == '__main__':
    # Ensure the main app runs from the project root for correct cwd
    app.run(debug=True)
