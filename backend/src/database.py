import sqlite3

DB_NAME = "tour_group.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            order_number TEXT NOT NULL,
            service_type TEXT NOT NULL,
            adults INTEGER NOT NULL,
            kids INTEGER NOT NULL,
            arrival_time TEXT NOT NULL,
            order_date TEXT NOT NULL,
            order_data TEXT,
            order_docx_path TEXT,
            order_pdf_path TEXT
        )
    ''')

    existing_order_columns = {
        row[1] for row in cursor.execute("PRAGMA table_info(orders)").fetchall()
    }
    if "order_docx_path" not in existing_order_columns:
        cursor.execute("ALTER TABLE orders ADD COLUMN order_docx_path TEXT")
    if "order_pdf_path" not in existing_order_columns:
        cursor.execute("ALTER TABLE orders ADD COLUMN order_pdf_path TEXT")

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL,
            invoice_data TEXT,
            gst_breakdown REAL,
            final_total REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS revision_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            revision_data TEXT,
            revised_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_email TEXT,
            google_app_password TEXT,
            email_subject_template TEXT,
            email_body_template TEXT,
            print_template TEXT,
            invoice_template TEXT,
            order_template TEXT
        )
    ''')

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id)")

    conn.commit()
    conn.close()


if __name__ == '__main__':
    init_db()
