import sqlite3

DB_NAME = "tour_group.db"

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            price_lunch REAL NOT NULL,
            price_dinner REAL NOT NULL,
            price_kids REAL NOT NULL,
            phone TEXT,
            address TEXT,
            additional_info TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            name TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            order_number TEXT NOT NULL,
            service_type TEXT NOT NULL,
            adults INTEGER NOT NULL,
            kids INTEGER NOT NULL,
            arrival_time TEXT NOT NULL,
            order_date TEXT NOT NULL,
            order_data TEXT,
            order_docx_path TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    ''')

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

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
