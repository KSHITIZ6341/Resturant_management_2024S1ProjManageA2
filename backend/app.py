import json
import os
import smtplib
import threading
import uuid
import glob
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from src import database
from src.docx_generator import save_order_as_docx
from src.pdf_generator import generate_order_pdf

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CUSTOMERS_FILE = os.path.join(BASE_DIR, "customers.json")
MENU_ITEMS_FILE = os.path.join(BASE_DIR, "menu_items.json")
INVOICES_DIR = os.path.join(BASE_DIR, "invoices")
ORDERS_DIR = os.path.join(BASE_DIR, "orders")
LEGACY_ORDER_FILES_DIR = os.path.join(BASE_DIR, "data", "Tour_Group_Orders")
JSON_LOCK = threading.Lock()
VALID_MENU_CATEGORIES = {"ENTREE", "MAIN", "DESSERT"}


def read_json(file_path):
    with JSON_LOCK:
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                payload = json.load(file)
                return payload if isinstance(payload, list) else []
        except (FileNotFoundError, json.JSONDecodeError):
            return []


def write_json(file_path, data):
    with JSON_LOCK:
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False)


def to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_order_sections(order_payload, menu_items):
    menu_lookup = {
        (entry.get("name") or "").strip().lower(): (entry.get("category") or "ENTREE").strip().upper()
        for entry in menu_items
    }

    sections = {"entree": [], "mains": [], "desserts": []}
    for item_name, raw in order_payload.items():
        if isinstance(raw, dict):
            qty = raw.get("quantity")
            comment = (raw.get("comment") or "").strip()
        else:
            qty = raw
            comment = ""

        try:
            qty = int(qty or 0)
        except (TypeError, ValueError):
            qty = 0

        if qty <= 0:
            continue

        category = menu_lookup.get((item_name or "").strip().lower(), "ENTREE")
        normalized_name = (item_name or "").strip()

        if category == "MAIN":
            sections["mains"].append((normalized_name, qty, comment))
        elif category == "DESSERT":
            sections["desserts"].append((normalized_name, qty, comment))
        else:
            sections["entree"].append((normalized_name, qty, comment))

    return sections


def send_order_email(order_data, customer_email, attachment_path):
    conn = database.get_connection()
    settings = conn.cursor().execute("SELECT * FROM settings WHERE id = 1").fetchone()
    conn.close()

    if not (settings and settings["sender_email"] and settings["google_app_password"]):
        raise ValueError("Email settings are not configured.")

    sender_email = settings["sender_email"]
    app_password = settings["google_app_password"]
    subject_template = settings["email_subject_template"] or "[order number] invoice [invoice number]"
    body_template = settings["email_body_template"] or "Thank you for your order."

    subject = (
        subject_template
        .replace("[order number]", order_data.get("order_number", ""))
        .replace("[invoice number]", order_data.get("invoice_number", ""))
        .replace("[customer name]", order_data.get("customer_name", ""))
    )
    body = (
        body_template
        .replace("[order number]", order_data.get("order_number", ""))
        .replace("[invoice number]", order_data.get("invoice_number", ""))
        .replace("[customer name]", order_data.get("customer_name", ""))
    )

    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = customer_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with open(attachment_path, "rb") as file:
        extension = os.path.splitext(attachment_path)[1].replace(".", "") or "octet-stream"
        attachment = MIMEApplication(file.read(), _subtype=extension)
        attachment.add_header("Content-Disposition", "attachment", filename=os.path.basename(attachment_path))
        msg.attach(attachment)

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as server:
        server.starttls()
        server.login(sender_email, app_password)
        server.send_message(msg)


def ensure_customer_payload(payload):
    if not payload or not (payload.get("name") or "").strip():
        raise ValueError("Customer name is required.")

    return {
        "name": (payload.get("name") or "").strip(),
        "email": (payload.get("email") or "").strip(),
        "price_lunch": float(payload.get("price_lunch") or 0),
        "price_dinner": float(payload.get("price_dinner") or 0),
        "price_kids": float(payload.get("price_kids") or 0),
        "phone": (payload.get("phone") or "").strip(),
        "address": (payload.get("address") or "").strip(),
        "additional_info": (payload.get("additional_info") or "").strip()
    }


def ensure_menu_item_payload(payload):
    name = (payload.get("name") or "").strip()
    category = (payload.get("category") or "").strip().upper()
    if not name:
        raise ValueError("Menu item name is required.")
    if category not in VALID_MENU_CATEGORIES:
        category = "ENTREE"
    return {"name": name, "category": category}


def row_get(row, key, default=None):
    if isinstance(row, dict):
        return row.get(key, default)
    try:
        if key in row.keys():
            return row[key]
    except Exception:
        pass
    return default


def sanitize_order_token(order_number, order_id):
    source = str(order_number or "").strip()
    cleaned = "".join(ch for ch in source if ch.isalnum() or ch in {"-", "_"})
    return cleaned or f"order_{order_id}"


def normalize_order_payload(raw_payload):
    if isinstance(raw_payload, dict):
        return raw_payload
    if isinstance(raw_payload, str) and raw_payload.strip():
        try:
            parsed = json.loads(raw_payload)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}
    return {}


def get_asset_search_roots(asset_type):
    if asset_type == "pdf":
        return [INVOICES_DIR, LEGACY_ORDER_FILES_DIR]
    if asset_type == "docx":
        return [ORDERS_DIR, LEGACY_ORDER_FILES_DIR, INVOICES_DIR]
    return []


def normalize_asset_path(path_value, asset_type):
    if not path_value:
        return None

    candidate = str(path_value).strip()
    if not candidate:
        return None
    if not os.path.isabs(candidate):
        candidate = os.path.join(BASE_DIR, candidate)

    absolute = os.path.abspath(candidate)
    for root in get_asset_search_roots(asset_type):
        normalized_root = os.path.abspath(root)
        if absolute == normalized_root or absolute.startswith(f"{normalized_root}{os.sep}"):
            return absolute
    return None


def persist_order_asset_path(order_id, asset_type, file_path):
    column = "order_pdf_path" if asset_type == "pdf" else "order_docx_path"
    conn = database.get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE orders SET {column} = ? WHERE id = ?", (file_path, order_id))
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


def build_printable_order_data_from_existing_order(order, invoice_number):
    customers = read_json(CUSTOMERS_FILE)
    customer_id = str(row_get(order, "customer_id", "") or "")
    customer = next((entry for entry in customers if str(entry.get("id")) == customer_id), {}) or {}

    adults = int(row_get(order, "adults", 0) or 0)
    kids = int(row_get(order, "kids", 0) or 0)
    total_pax = adults + kids

    service_type = str(row_get(order, "service_type", "Lunch") or "Lunch")
    if service_type.lower() == "lunch":
        adult_price = to_float(customer.get("price_lunch"))
    else:
        adult_price = to_float(customer.get("price_dinner"))
    kid_price = to_float(customer.get("price_kids"))

    order_payload = normalize_order_payload(row_get(order, "order_data", {}))
    menu_items = read_json(MENU_ITEMS_FILE)
    sections = build_order_sections(order_payload, menu_items)

    order_number = str(row_get(order, "order_number", "") or "").strip()
    if not order_number:
        order_number = f"order_{row_get(order, 'id', 'unknown')}"

    return {
        "order_number": order_number,
        "customer_name": customer.get("name") or "Unknown",
        "customer_phone": customer.get("phone") or "",
        "customer_other": customer.get("address") or "",
        "date": f"{row_get(order, 'order_date', '')} {row_get(order, 'arrival_time', '')}".strip(),
        "total_pax": total_pax,
        "entree": sections["entree"],
        "mains": sections["mains"],
        "desserts": sections["desserts"],
        "adults": adults,
        "kids": kids,
        "adult_price": adult_price,
        "kid_price": kid_price,
        "service_type": service_type,
        "calculated_total": (adults * adult_price) + (kids * kid_price),
        "invoice_number": invoice_number,
    }


def find_existing_asset_file(order, invoice_number, asset_type):
    order_id = row_get(order, "id")
    order_number = row_get(order, "order_number", "")

    candidates = []
    stored_path = row_get(order, "order_pdf_path") if asset_type == "pdf" else row_get(order, "order_docx_path")
    if stored_path:
        candidates.append(stored_path)

    safe_order_number = sanitize_order_token(order_number, order_id)
    for root in get_asset_search_roots(asset_type):
        if asset_type == "pdf":
            candidates.append(os.path.join(root, f"invoice_{safe_order_number}_{invoice_number}.pdf"))
            candidates.extend(glob.glob(os.path.join(root, f"*_{invoice_number}.pdf")))
        else:
            candidates.extend(glob.glob(os.path.join(root, f"{safe_order_number}_*_{invoice_number}.docx")))
            candidates.extend(glob.glob(os.path.join(root, f"*_{invoice_number}.docx")))

    seen = set()
    for candidate in candidates:
        normalized = normalize_asset_path(candidate, asset_type)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        if os.path.exists(normalized):
            return normalized
    return None


def generate_missing_asset(order, invoice_number, asset_type):
    printable_order_data = build_printable_order_data_from_existing_order(order, invoice_number)
    order_id = row_get(order, "id", "unknown")
    safe_order_number = sanitize_order_token(printable_order_data.get("order_number"), order_id)

    if asset_type == "pdf":
        os.makedirs(INVOICES_DIR, exist_ok=True)
        target_path = os.path.join(INVOICES_DIR, f"invoice_{safe_order_number}_{invoice_number}.pdf")
        generate_order_pdf(printable_order_data, target_path)
        return target_path if os.path.exists(target_path) else None

    os.makedirs(ORDERS_DIR, exist_ok=True)
    printable_order_data["order_number"] = safe_order_number
    target_path = save_order_as_docx(printable_order_data, ORDERS_DIR)
    return target_path if target_path and os.path.exists(target_path) else None


def get_order_asset_path(order_id, asset_type):
    if asset_type not in {"pdf", "docx"}:
        return None, "Unsupported asset type.", 400

    conn = database.get_connection()
    cursor = conn.cursor()
    order_row = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order_row:
        conn.close()
        return None, "Order not found.", 404

    invoice = cursor.execute(
        "SELECT invoice_number FROM invoices WHERE order_id = ? ORDER BY id DESC LIMIT 1",
        (order_id,),
    ).fetchone()
    invoice_number = invoice["invoice_number"] if invoice and invoice["invoice_number"] else f"INV-{order_id:05d}"
    conn.close()

    order = dict(order_row)
    existing_path = find_existing_asset_file(order, invoice_number, asset_type)
    if existing_path:
        persist_order_asset_path(order_id, asset_type, existing_path)
        return existing_path, None, 200

    generated_path = generate_missing_asset(order, invoice_number, asset_type)
    if generated_path:
        normalized = normalize_asset_path(generated_path, asset_type)
        if normalized and os.path.exists(normalized):
            persist_order_asset_path(order_id, asset_type, normalized)
            return normalized, None, 200

    return None, f"{asset_type.upper()} file could not be generated for this order.", 404


@app.route("/api/customers", methods=["GET"])
def get_customers():
    return jsonify(read_json(CUSTOMERS_FILE))


@app.route("/api/customers", methods=["POST"])
def add_customer():
    try:
        payload = ensure_customer_payload(request.json or {})
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    customers = read_json(CUSTOMERS_FILE)
    new_customer = {"id": str(uuid.uuid4()), **payload}
    customers.append(new_customer)
    write_json(CUSTOMERS_FILE, customers)
    return jsonify(new_customer), 201


@app.route("/api/customers/<customer_id>", methods=["PUT"])
def update_customer(customer_id):
    customers = read_json(CUSTOMERS_FILE)
    try:
        payload = ensure_customer_payload(request.json or {})
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    updated_customer = None
    for customer in customers:
        if str(customer.get("id")) == str(customer_id):
            customer.update(payload)
            updated_customer = customer
            break

    if updated_customer is None:
        return jsonify({"message": "Customer not found."}), 404

    write_json(CUSTOMERS_FILE, customers)
    return jsonify(updated_customer)


@app.route("/api/customers/<customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    customers = read_json(CUSTOMERS_FILE)
    remaining = [entry for entry in customers if str(entry.get("id")) != str(customer_id)]
    if len(remaining) == len(customers):
        return jsonify({"message": "Customer not found."}), 404
    write_json(CUSTOMERS_FILE, remaining)
    return jsonify({"message": "Customer deleted."})


@app.route("/api/menu-items", methods=["GET"])
def get_menu_items():
    return jsonify(read_json(MENU_ITEMS_FILE))


@app.route("/api/menu-items", methods=["POST"])
def add_menu_item():
    menu_items = read_json(MENU_ITEMS_FILE)
    try:
        payload = ensure_menu_item_payload(request.json or {})
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    new_item = {"id": str(uuid.uuid4()), **payload}
    menu_items.append(new_item)
    write_json(MENU_ITEMS_FILE, menu_items)
    return jsonify(new_item), 201


@app.route("/api/menu-items/<item_id>", methods=["PUT"])
def update_menu_item(item_id):
    menu_items = read_json(MENU_ITEMS_FILE)
    target = next((entry for entry in menu_items if str(entry.get("id")) == str(item_id)), None)
    if not target:
        return jsonify({"message": "Menu item not found."}), 404

    try:
        payload = ensure_menu_item_payload(request.json or target)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    target.update(payload)
    write_json(MENU_ITEMS_FILE, menu_items)
    return jsonify(target)


@app.route("/api/menu-items/<item_id>", methods=["DELETE"])
def delete_menu_item(item_id):
    menu_items = read_json(MENU_ITEMS_FILE)
    remaining = [entry for entry in menu_items if str(entry.get("id")) != str(item_id)]
    if len(remaining) == len(menu_items):
        return jsonify({"message": "Menu item not found."}), 404
    write_json(MENU_ITEMS_FILE, remaining)
    return jsonify({"message": "Menu item deleted."})


@app.route("/api/orders", methods=["GET"])
def get_orders():
    customers = read_json(CUSTOMERS_FILE)
    customer_map = {str(customer.get("id")): customer.get("name") for customer in customers}

    conn = database.get_connection()
    rows = conn.cursor().execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    conn.close()

    orders = [dict(row) for row in rows]
    for order in orders:
        order["customer_name"] = customer_map.get(str(order.get("customer_id")), "Unknown")
        if order.get("order_data"):
            try:
                order["order_data"] = json.loads(order["order_data"])
            except json.JSONDecodeError:
                order["order_data"] = {}
        else:
            order["order_data"] = {}

    return jsonify(orders)


@app.route("/api/orders/<int:order_id>/pdf", methods=["GET"])
def view_order_pdf(order_id):
    file_path, error_message, status_code = get_order_asset_path(order_id, "pdf")
    if error_message:
        return jsonify({"message": error_message}), status_code
    return send_file(
        file_path,
        mimetype="application/pdf",
        as_attachment=False,
        download_name=os.path.basename(file_path),
    )


@app.route("/api/orders/<int:order_id>/docx", methods=["GET"])
def view_order_docx(order_id):
    file_path, error_message, status_code = get_order_asset_path(order_id, "docx")
    if error_message:
        return jsonify({"message": error_message}), status_code
    return send_file(
        file_path,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=False,
        download_name=os.path.basename(file_path),
    )


@app.route("/api/orders/<int:order_id>/docx/path", methods=["GET"])
def get_order_docx_path(order_id):
    file_path, error_message, status_code = get_order_asset_path(order_id, "docx")
    if error_message:
        return jsonify({"message": error_message}), status_code
    return jsonify({"path": file_path})


@app.route("/api/orders", methods=["POST"])
def add_order_and_process():
    payload = request.json or {}
    required_fields = ["customer_id", "order_number", "service_type", "adults", "kids", "arrival_time", "order_date"]
    missing = [field for field in required_fields if payload.get(field) in (None, "")]
    if missing:
        return jsonify({"message": f"Missing required fields: {', '.join(missing)}"}), 400

    order_payload = payload.get("order_data") or {}
    if not isinstance(order_payload, dict):
        return jsonify({"message": "order_data must be an object."}), 400

    new_order_id = None
    try:
        customers = read_json(CUSTOMERS_FILE)
        customer = next((entry for entry in customers if str(entry.get("id")) == str(payload["customer_id"])), None)
        if not customer:
            return jsonify({"message": "Customer not found."}), 404

        try:
            adults = int(payload["adults"])
            kids = int(payload["kids"])
        except (TypeError, ValueError):
            return jsonify({"message": "Adults and kids must be numeric values."}), 400
        total_pax = adults + kids
        if total_pax <= 0:
            return jsonify({"message": "Total pax must be greater than zero."}), 400

        menu_items = read_json(MENU_ITEMS_FILE)
        sections = build_order_sections(order_payload, menu_items)
        total_entree = sum(item[1] for item in sections["entree"])
        total_mains = sum(item[1] for item in sections["mains"])
        total_desserts = sum(item[1] for item in sections["desserts"])

        rule_violations = []
        if adults != total_mains:
            rule_violations.append(f"Adults ({adults}) must equal mains ({total_mains}).")
        if total_pax != total_desserts:
            rule_violations.append(f"Total pax ({total_pax}) must equal desserts ({total_desserts}).")
        if total_entree < total_mains:
            rule_violations.append(f"Entree count ({total_entree}) must be >= mains ({total_mains}).")
        if rule_violations and not bool(payload.get("override_rules")):
            return jsonify({"message": "Order validation failed.", "violations": rule_violations}), 400

        service_type = str(payload["service_type"]).strip() or "Lunch"
        adult_price = to_float(customer.get("price_lunch")) if service_type.lower() == "lunch" else to_float(customer.get("price_dinner"))
        kid_price = to_float(customer.get("price_kids"))
        if adult_price <= 0:
            return jsonify({"message": "Customer pricing is missing for selected service type."}), 400

        calculated_total = (adults * adult_price) + (kids * kid_price)

        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO orders (customer_id, order_number, service_type, adults, kids, arrival_time, order_date, order_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(payload["customer_id"]),
                str(payload["order_number"]).strip(),
                service_type,
                adults,
                kids,
                str(payload["arrival_time"]).strip(),
                str(payload["order_date"]).strip(),
                json.dumps(order_payload)
            ),
        )
        new_order_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO invoices (order_id, invoice_number, invoice_data, gst_breakdown, final_total)
            VALUES (?, ?, ?, ?, ?)
            """,
            (new_order_id, "", f"Auto-generated invoice for order {payload['order_number']}", calculated_total * 0.1, calculated_total),
        )
        invoice_id = cursor.lastrowid
        invoice_number = f"INV-{invoice_id:05d}"
        cursor.execute("UPDATE invoices SET invoice_number = ? WHERE id = ?", (invoice_number, invoice_id))
        conn.commit()
        conn.close()

        printable_order_data = {
            "order_number": str(payload["order_number"]).strip(),
            "customer_name": customer.get("name", "Unknown"),
            "date": f"{payload['order_date']} {payload['arrival_time']}",
            "total_pax": total_pax,
            "entree": sections["entree"],
            "mains": sections["mains"],
            "desserts": sections["desserts"],
            "adults": adults,
            "kids": kids,
            "adult_price": adult_price,
            "kid_price": kid_price,
            "service_type": service_type,
            "calculated_total": calculated_total,
            "invoice_number": invoice_number
        }

        os.makedirs(ORDERS_DIR, exist_ok=True)
        os.makedirs(INVOICES_DIR, exist_ok=True)

        docx_path = save_order_as_docx(printable_order_data, ORDERS_DIR)
        invoice_pdf_filename = f"invoice_{printable_order_data['order_number']}_{invoice_number}.pdf"
        pdf_path = os.path.join(INVOICES_DIR, invoice_pdf_filename)
        generate_order_pdf(printable_order_data, pdf_path)

        update_conn = database.get_connection()
        update_cursor = update_conn.cursor()
        update_cursor.execute(
            "UPDATE orders SET order_docx_path = ?, order_pdf_path = ? WHERE id = ?",
            (docx_path, pdf_path, new_order_id),
        )
        update_conn.commit()
        update_conn.close()

        if customer.get("email"):
            send_order_email(printable_order_data, customer.get("email"), pdf_path)

        return jsonify(
            {
                "id": new_order_id,
                "message": "Order saved and processed successfully.",
                "invoice_number": invoice_number,
                "docx_path": docx_path,
                "pdf_path": pdf_path,
            }
        ), 201
    except Exception as error:
        if new_order_id is None:
            return jsonify(
                {
                    "message": "Failed to process order.",
                    "error": str(error),
                }
            ), 500
        return jsonify(
            {
                "id": new_order_id,
                "message": "Order saved, but post-processing failed.",
                "error": str(error),
            }
        ), 207


@app.route("/api/orders/<int:order_id>", methods=["PUT"])
def update_order(order_id):
    payload = request.json or {}
    conn = database.get_connection()
    cursor = conn.cursor()
    existing = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"message": "Order not found."}), 404

    try:
        existing_order_data = json.loads(existing["order_data"] or "{}")
    except json.JSONDecodeError:
        existing_order_data = {}

    def to_int(value, default_value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default_value

    updates = {
        "order_number": payload.get("order_number", existing["order_number"]),
        "service_type": payload.get("service_type", existing["service_type"]),
        "adults": to_int(payload.get("adults"), existing["adults"]),
        "kids": to_int(payload.get("kids"), existing["kids"]),
        "arrival_time": payload.get("arrival_time", existing["arrival_time"]),
        "order_date": payload.get("order_date", existing["order_date"]),
        "order_data": json.dumps(payload.get("order_data", existing_order_data)),
    }

    if "customer_id" in payload and payload["customer_id"] not in (None, ""):
        updates["customer_id"] = str(payload["customer_id"])
    else:
        updates["customer_id"] = existing["customer_id"]

    cursor.execute(
        """
        UPDATE orders
        SET customer_id = ?, order_number = ?, service_type = ?, adults = ?, kids = ?, arrival_time = ?, order_date = ?, order_data = ?
        WHERE id = ?
        """,
        (
            updates["customer_id"],
            updates["order_number"],
            updates["service_type"],
            updates["adults"],
            updates["kids"],
            updates["arrival_time"],
            updates["order_date"],
            updates["order_data"],
            order_id,
        ),
    )
    conn.commit()
    row = cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    conn.close()

    customers = read_json(CUSTOMERS_FILE)
    customer_map = {str(customer.get("id")): customer.get("name") for customer in customers}
    result = dict(row)
    result["customer_name"] = customer_map.get(str(result.get("customer_id")), "Unknown")
    try:
        result["order_data"] = json.loads(result.get("order_data") or "{}")
    except json.JSONDecodeError:
        result["order_data"] = {}

    return jsonify(result)


@app.route("/api/orders/<int:order_id>", methods=["DELETE"])
def delete_order(order_id):
    conn = database.get_connection()
    cursor = conn.cursor()
    existing = cursor.execute("SELECT id FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"message": "Order not found."}), 404

    cursor.execute("DELETE FROM invoices WHERE order_id = ?", (order_id,))
    cursor.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Order deleted."})


@app.route("/api/settings", methods=["GET"])
def get_settings():
    conn = database.get_connection()
    settings = conn.cursor().execute("SELECT * FROM settings WHERE id = 1").fetchone()
    conn.close()

    if not settings:
        return jsonify(
            {
                "sender_email": "",
                "google_app_password": "",
                "email_subject_template": "",
                "email_body_template": "",
            }
        )

    payload = dict(settings)
    payload["smtp_username"] = payload.get("sender_email", "")
    payload["smtp_password"] = payload.get("google_app_password", "")
    return jsonify(payload)


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    payload = request.json or {}
    sender_email = (payload.get("sender_email") or payload.get("smtp_username") or "").strip()
    app_password = (payload.get("google_app_password") or payload.get("smtp_password") or "").strip()
    email_subject_template = (payload.get("email_subject_template") or "").strip()
    email_body_template = (payload.get("email_body_template") or "").strip()

    conn = database.get_connection()
    cursor = conn.cursor()
    exists = cursor.execute("SELECT id FROM settings WHERE id = 1").fetchone()

    if exists:
        cursor.execute(
            """
            UPDATE settings
            SET sender_email = ?, google_app_password = ?, email_subject_template = ?, email_body_template = ?
            WHERE id = 1
            """,
            (sender_email, app_password, email_subject_template, email_body_template),
        )
    else:
        cursor.execute(
            """
            INSERT INTO settings (id, sender_email, google_app_password, email_subject_template, email_body_template)
            VALUES (1, ?, ?, ?, ?)
            """,
            (sender_email, app_password, email_subject_template, email_body_template),
        )

    conn.commit()
    conn.close()
    return jsonify({"message": "Settings updated successfully"})


database.init_db()

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug_mode)
