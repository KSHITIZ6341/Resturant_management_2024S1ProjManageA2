import sys, os, platform, json, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QFormLayout, QHBoxLayout, QLabel, QComboBox,
    QLineEdit, QDateEdit, QTimeEdit, QPushButton, QMessageBox, QFrame,
    QInputDialog, QStackedWidget, QRadioButton, QButtonGroup, QDialog,
    QDialogButtonBox, QGridLayout
)
from PyQt6.QtCore import QDate, QTime, Qt, QEvent
import database
from docx_generator import save_order_as_docx
from pdf_generator import generate_order_pdf  # (Not used for invoice now)


def get_menu_items():
    """
    Extract menu items from the database.
    Returns a list of rows with keys "name" and "category".
    """
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, category FROM menu_items")
    items = cursor.fetchall()
    conn.close()
    return items


def clear_layout(layout):
    """Remove all widgets from the given layout."""
    while layout.count():
        child = layout.takeAt(0)
        if child.widget():
            child.widget().deleteLater()


class PrintSettingsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Print Settings")
        self.setupUI()

    def setupUI(self):
        layout = QGridLayout(self)
        layout.addWidget(QLabel("Option 1:"), 0, 0)
        self.option1 = QLineEdit("Default value")
        layout.addWidget(self.option1, 0, 1)
        layout.addWidget(QLabel("Option 2:"), 1, 0)
        self.option2 = QLineEdit("Default value")
        layout.addWidget(self.option2, 1, 1)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons, 2, 0, 1, 2)


class OrderManager(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.menu_items = []  # Loaded from the database
        self.initUI()
        self.load_customers()
        self.load_menu_items()
        self.update_counts()

    def showEvent(self, event):
        super().showEvent(event)
        # Reload data when the widget is shown.
        self.load_customers()
        self.load_menu_items()
        self.update_counts()

    def initUI(self):
        self.setContentsMargins(20, 20, 20, 20)
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(15)

        # Title
        title_label = QLabel("Order Manager")
        title_label.setStyleSheet("QLabel { font-size: 40px; font-weight: bold; color: #333333; }")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        main_layout.addWidget(title_label, alignment=Qt.AlignmentFlag.AlignCenter)

        # Form layout
        form_layout = QFormLayout()
        form_layout.setLabelAlignment(Qt.AlignmentFlag.AlignRight)
        form_layout.setSpacing(10)
        label_style = "QLabel { font-size: 20px; font-weight: bold; color: #333333; }"

        # Customer Dropdown
        customer_label = QLabel("Customer:")
        customer_label.setStyleSheet(label_style)
        self.customer_combo = self.create_pill_dropdown(["Select Customer"])
        form_layout.addRow(customer_label, self.customer_combo)

        # Order Number
        order_label = QLabel("Order Number:")
        order_label.setStyleSheet(label_style)
        self.order_number_edit = self.create_animated_textbox("Order Number")
        self.order_number_edit.setFixedWidth(250)
        form_layout.addRow(order_label, self.order_number_edit)

        # Date & Time
        dt_label = QLabel("Date & Time:")
        dt_label.setStyleSheet(label_style)
        dt_layout = QHBoxLayout()
        self.date_edit = self.create_styled_calendar()
        self.date_edit.setFixedWidth(200)
        self.time_edit = self.create_pill_timebox()
        self.time_edit.setFixedWidth(120)
        dt_layout.addWidget(self.date_edit)
        dt_layout.addWidget(self.time_edit)
        form_layout.addRow(dt_label, dt_layout)

        # Service & People
        sp_label = QLabel("Service & People:")
        sp_label.setStyleSheet(label_style)
        sp_layout = QHBoxLayout()
        self.radio_lunch = QRadioButton("Lunch")
        self.radio_dinner = QRadioButton("Dinner")
        self.radio_lunch.setStyleSheet("font-size: 18px;")
        self.radio_dinner.setStyleSheet("font-size: 18px;")
        self.service_group = QButtonGroup(self)
        self.service_group.addButton(self.radio_lunch)
        self.service_group.addButton(self.radio_dinner)
        self.radio_lunch.setChecked(True)
        sp_layout.addWidget(self.radio_lunch)
        sp_layout.addWidget(self.radio_dinner)
        self.adults_edit = self.create_animated_textbox("Adults")
        self.adults_edit.setFixedWidth(100)
        self.kids_edit = self.create_animated_textbox("Kids (Optional)")
        self.kids_edit.setFixedWidth(130)
        sp_layout.addWidget(self.adults_edit)
        sp_layout.addWidget(self.kids_edit)
        form_layout.addRow(sp_label, sp_layout)

        main_layout.addLayout(form_layout)

        # Toggle Buttons for categories
        toggle_layout = QHBoxLayout()
        toggle_layout.setSpacing(0)
        self.btn_entree = QPushButton("Entree")
        self.btn_entree.setCheckable(True)
        self.btn_entree.clicked.connect(lambda: self.toggle_menu_section(0))
        self.btn_entree.setFixedHeight(50)
        self.btn_entree.setStyleSheet("""
            QPushButton { background-color: transparent; color: #333333; border: 1px solid #CCCCCC; padding: 10px; font-size: 18px; }
            QPushButton:checked { background-color: #42A5F5; color: white; }
        """)
        self.btn_mains = QPushButton("Mains")
        self.btn_mains.setCheckable(True)
        self.btn_mains.clicked.connect(lambda: self.toggle_menu_section(1))
        self.btn_mains.setFixedHeight(50)
        self.btn_mains.setStyleSheet("""
            QPushButton { background-color: transparent; color: #333333; border: 1px solid #CCCCCC; border-left: none; padding: 10px; font-size: 18px; }
            QPushButton:checked { background-color: #66BB6A; color: white; }
        """)
        self.btn_desserts = QPushButton("Desserts")
        self.btn_desserts.setCheckable(True)
        self.btn_desserts.clicked.connect(lambda: self.toggle_menu_section(2))
        self.btn_desserts.setFixedHeight(50)
        self.btn_desserts.setStyleSheet("""
            QPushButton { background-color: transparent; color: #333333; border: 1px solid #CCCCCC; border-left: none; padding: 10px; font-size: 18px; }
            QPushButton:checked { background-color: #FFA726; color: white; }
        """)
        self.btn_entree.setChecked(True)
        toggle_layout.addWidget(self.btn_entree)
        toggle_layout.addWidget(self.btn_mains)
        toggle_layout.addWidget(self.btn_desserts)
        main_layout.addLayout(toggle_layout)

        # QStackedWidget for sections
        self.section_stack = QStackedWidget(self)
        self.entree_section = self.create_menu_section("")
        self.main_section = self.create_menu_section("")
        self.dessert_section = self.create_menu_section("")
        self.section_stack.addWidget(self.entree_section)
        self.section_stack.addWidget(self.main_section)
        self.section_stack.addWidget(self.dessert_section)
        main_layout.addWidget(self.section_stack)

        # Print Order Button (disabled until required fields are filled)
        self.btn_print = QPushButton("Print Order", self)
        self.btn_print.setFixedWidth(200)
        self.btn_print.setStyleSheet("""
            QPushButton { background-color: #243878; color: white; border: none; border-radius: 20px; padding: 10px 16px; font-size: 22px; }
            QPushButton:disabled { background-color: #AAAAAA; }
            QPushButton:hover:!disabled { background-color: #f33e6a; }
        """)
        self.btn_print.clicked.connect(self.print_order)
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_print)
        btn_layout.addStretch()
        main_layout.addLayout(btn_layout)

        # Real-Time Calculator label
        self.count_label = QLabel("")
        self.count_label.setStyleSheet("font-size: 10px; color: #666666;")
        main_layout.addWidget(self.count_label, alignment=Qt.AlignmentFlag.AlignCenter)

        self.setStyleSheet(self.load_light_styles())
        self.setLayout(main_layout)
        self.update_print_button_state()

    # ---------- UI Helper Methods ----------
    def toggle_menu_section(self, index):
        self.section_stack.setCurrentIndex(index)
        self.btn_entree.setChecked(index == 0)
        self.btn_mains.setChecked(index == 1)
        self.btn_desserts.setChecked(index == 2)

    def create_menu_section(self, category):
        frame = QFrame(self)
        frame.setFrameShape(QFrame.Shape.StyledPanel)
        frame.setStyleSheet("QFrame { border: 1px solid #CCCCCC; border-radius: 20px; padding: 10px; }")
        layout = QVBoxLayout(frame)
        layout.setSpacing(10)
        layout.setContentsMargins(10, 10, 10, 10)
        frame.row_layout = QVBoxLayout()
        frame.row_layout.setSpacing(0)
        frame.row_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        layout.addLayout(frame.row_layout)
        return frame

    def add_new_menu_item_row(self, section_frame, item_name, comment=""):
        row_widget = QFrame(self)
        row_widget.setFixedHeight(90)
        row_widget.setStyleSheet("QFrame { border-bottom: 1px solid #CCCCCC; }")
        row_layout = QHBoxLayout(row_widget)
        row_layout.setContentsMargins(0, 5, 0, 5)
        row_layout.setSpacing(10)

        item_number_edit = QLineEdit(self)
        item_number_edit.setPlaceholderText("No.")
        item_number_edit.setFixedSize(80, 40)
        item_number_edit.setStyleSheet("""
            QLineEdit { background-color: #F0F0F0; color: #333333; border-radius: 5px; padding: 5px; border: 1px solid #CCCCCC; font-size: 14px; }
            QLineEdit:focus { background-color: #E0E0E0; }
        """)
        item_number_edit.textChanged.connect(self.update_counts)
        row_widget.item_number_edit = item_number_edit
        row_layout.addWidget(item_number_edit)

        name_edit = QLineEdit(self)
        name_edit.setText(item_name.upper())
        name_edit.setReadOnly(True)
        name_edit.setFixedHeight(40)
        name_edit.setStyleSheet("""
            QLineEdit { background-color: transparent; color: #333333; border: none; font-size: 18px; font-weight: bold; qproperty-alignment: 'AlignCenter'; }
        """)
        row_widget.name_edit = name_edit
        row_layout.addWidget(name_edit)

        comment_edit = QLineEdit(self)
        comment_edit.setPlaceholderText("Add comment")
        comment_edit.setText(comment)
        comment_edit.setFixedSize(200, 40)
        comment_edit.setReadOnly(True)
        comment_edit.setStyleSheet("""
            QLineEdit { background-color: transparent; color: #333333; border: 1px solid #CCCCCC; border-radius: 5px; padding: 5px; font-size: 16px; }
            QLineEdit:hover:!disabled { background-color: #F8F8F8; }
        """)
        comment_edit.mousePressEvent = lambda event, edit=comment_edit: self.custom_edit_comment(event, edit)
        row_widget.comment_edit = comment_edit
        row_layout.addWidget(comment_edit)

        section_frame.row_layout.addWidget(row_widget)
        self.update_counts()

    def custom_edit_comment(self, event, comment_edit):
        dialog = QInputDialog(self)
        dialog.setWindowTitle("Edit Comment")
        dialog.setLabelText("Comment:")
        dialog.setTextValue(comment_edit.text())
        dialog.setStyleSheet("""
            QInputDialog { background-color: #FFFFFF; }
            QLabel { font-size: 18px; color: #333333; }
            QLineEdit { font-size: 16px; padding: 5px; border: 1px solid #CCCCCC; }
        """)
        if dialog.exec():
            comment_edit.setText(dialog.textValue())

    def create_pill_dropdown(self, items):
        dropdown = QComboBox(self)
        dropdown.setFixedHeight(50)
        dropdown.addItems(items)
        dropdown.setStyleSheet("""
            QComboBox { background-color: #F0F0F0; color: #666666; border-radius: 20px; padding: 8px; border: 1px solid #CCCCCC; font-size: 18px; }
            QComboBox QAbstractItemView { background-color: #F0F0F0; selection-background-color: #E0E0E0; font-size: 18px; }
            QComboBox::drop-down { border: none; }
            QComboBox:hover { background-color: #E0E0E0; }
        """)
        return dropdown

    def create_animated_textbox(self, placeholder):
        textbox = QLineEdit(self)
        textbox.setPlaceholderText(placeholder)
        textbox.setFixedHeight(50)
        textbox.setStyleSheet("""
            QLineEdit { background-color: #F0F0F0; color: #333333; border-radius: 20px; padding: 8px; border: 1px solid #CCCCCC; font-size: 18px; }
            QLineEdit:focus { background-color: #E0E0E0; }
        """)
        return textbox

    def create_pill_timebox(self):
        from PyQt6.QtCore import QTime
        timebox = QTimeEdit(self)
        timebox.setTime(QTime.currentTime())
        timebox.setDisplayFormat("hh:mm AP")
        timebox.setFixedHeight(50)
        timebox.setMinimumTime(QTime(0, 0))
        timebox.setTimeRange(QTime(0, 0), QTime(23, 45))
        timebox.setStyleSheet("""
            QTimeEdit { background-color: #F0F0F0; color: #333333; border-radius: 20px; padding: 8px; border: 1px solid #CCCCCC; font-size: 18px; }
            QTimeEdit:hover { background-color: #E0E0E0; }
        """)
        return timebox

    def create_styled_calendar(self):
        date_edit = QDateEdit(self)
        date_edit.setCalendarPopup(True)
        date_edit.setDate(QDate.currentDate())
        date_edit.setFixedHeight(50)
        date_edit.setDisplayFormat("dddd d MMM yyyy")
        date_edit.setStyleSheet("""
            QDateEdit { background-color: #F0F0F0; color: #333333; border-radius: 20px; padding: 8px; border: 1px solid #CCCCCC; font-size: 18px; }
            QDateEdit::drop-down { border: none; }
            QDateEdit:hover { background-color: #E0E0E0; }
        """)
        if date_edit.calendarWidget():
            date_edit.calendarWidget().setStyleSheet("""
                QCalendarWidget { background-color: #FFFFFF; color: #333333; selection-background-color: #FF2D55; border: 1px solid #CCCCCC; }
                QCalendarWidget QToolButton { color: #333333; }
            """)
        return date_edit

    def load_customers(self):
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email FROM customers")
            customers = cursor.fetchall()
            conn.close()
        except Exception as e:
            customers = []
            print("Error loading customers:", e)
        self.customer_combo.clear()
        self.customer_combo.setMinimumContentsLength(24)
        self.customer_combo.addItem("Select Customer")
        for customer in customers:
            self.customer_combo.addItem(customer["name"], customer["id"])

    def load_menu_items(self):
        clear_layout(self.entree_section.row_layout)
        clear_layout(self.main_section.row_layout)
        clear_layout(self.dessert_section.row_layout)
        self.menu_items = get_menu_items()
        for item in self.menu_items:
            category = item["category"].upper()
            name = item["name"]
            if category == "ENTREE":
                self.add_new_menu_item_row(self.entree_section, name)
            elif category == "MAIN":
                self.add_new_menu_item_row(self.main_section, name)
            elif category == "DESSERT":
                self.add_new_menu_item_row(self.dessert_section, name)
            else:
                pass

    def gather_section_items(self, section_frame):
        items = []
        for i in range(section_frame.row_layout.count()):
            row_widget = section_frame.row_layout.itemAt(i).widget()
            if row_widget is not None:
                qty_text = row_widget.item_number_edit.text().strip()
                try:
                    qty = int(qty_text) if qty_text else 0
                except ValueError:
                    qty = 0
                item_name = row_widget.name_edit.text().strip()
                comment = row_widget.comment_edit.text().strip()
                items.append((item_name, qty, comment))
        return items

    def sum_section(self, section):
        total = 0
        for i in range(section.row_layout.count()):
            row_widget = section.row_layout.itemAt(i).widget()
            if row_widget is not None:
                qty_text = row_widget.item_number_edit.text().strip()
                try:
                    qty = int(qty_text) if qty_text != "" else 0
                except ValueError:
                    qty = 0
                total += qty
        return total

    def calculate_total_items(self):
        total_entree = self.sum_section(self.entree_section)
        total_mains = self.sum_section(self.main_section)
        total_desserts = self.sum_section(self.dessert_section)
        return total_entree, total_mains, total_desserts

    def update_counts(self):
        total_entree, total_mains, total_desserts = self.calculate_total_items()
        self.count_label.setText(
            f"Entree: {total_entree} | Mains: {total_mains} | Desserts: {total_desserts}"
        )
        self.update_print_button_state()

    def update_print_button_state(self):
        if (self.customer_combo.currentText() == "Select Customer" or
                not self.order_number_edit.text().strip() or
                not self.date_edit.text().strip()):
            self.btn_print.setEnabled(False)
        else:
            self.btn_print.setEnabled(True)

    def load_light_styles(self):
        return """
            QMainWindow, QWidget { background-color: #FFFFFF; }
            QPushButton { background-color: transparent; color: #333333; border-radius: 20px; padding: 10px; border: 1px solid #CCCCCC; }
            QPushButton:hover { background-color: #CCCCCC; }
            QLabel, QLineEdit { background-color: transparent; }
        """

    # ---------- Invoice Creation Helper ----------
    def create_invoice_record(self, order_data):
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO invoices (order_id, invoice_number, invoice_data, gst_breakdown, final_total)
                VALUES (?, ?, ?, ?, ?)
            """, (0, "", "Auto-generated invoice for order " + order_data["order_number"], 0.0, 0.0))
            invoice_id = cursor.lastrowid
            formatted_invoice_num = f"INV-{invoice_id:05d}"
            cursor.execute("UPDATE invoices SET invoice_number = ? WHERE id = ?", (formatted_invoice_num, invoice_id))
            conn.commit()
            conn.close()
            return formatted_invoice_num
        except Exception as e:
            QMessageBox.critical(self, "Invoice Error", f"Failed to create invoice record:\n{e}")
            return None

        def update_order_files_info(self, order_id, base_filename):
            """
            Updates the order record with the base file name (location info).
            Here we store the same base filename in the order_docx_path column.
            """
            try:
                conn = database.get_connection()
                cursor = conn.cursor()
                cursor.execute("UPDATE orders SET order_docx_path = ? WHERE id = ?", (base_filename, order_id))
                conn.commit()
                conn.close()
            except Exception as e:
                QMessageBox.warning(self, "Database Warning", f"Failed to update order file info:\n{e}")

    # ---------- Plain Text Generation Helper ----------
    def generate_order_text(self, order_data, output_folder, base_filename):
        text_filename = f"{base_filename}.txt"
        full_path = os.path.join(output_folder, text_filename)
        try:
            with open(full_path, "w") as f:
                f.write(f"Order Number: {order_data.get('order_number', '0000')}\n")
                f.write(f"Customer: {order_data.get('customer_name', 'Unknown')}\n")
                f.write(f"Date: {order_data.get('date', '')}\n")
                f.write("Quantities:\n")
                for section, label in zip(["entree", "mains", "desserts"], ["Entrée", "Mains", "Desserts"]):
                    f.write(f"  {label}:\n")
                    items = order_data.get(section, [])
                    for item_name, qty, comment in items:
                        f.write(f"    {item_name}: {qty}\n")
            return full_path
        except Exception as e:
            QMessageBox.critical(self, "Text File Error", f"Failed to create plain text file:\n{e}")
            return None

    # ---------- Email Sending Helper ----------
    def send_order_email(self, order_data, recipient_email, docx_path):
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sender_email, google_app_password, email_subject_template, email_body_template
                FROM settings WHERE id = 1
            """)
            row = cursor.fetchone()
            conn.close()
            if not row:
                QMessageBox.warning(self, "Email Error", "No email settings found in the database.")
                return
            sender_email = row["sender_email"]
            app_password = row["google_app_password"]
            subject_template = row["email_subject_template"] or "[order number] invoice [invoice number]"
            body_template = row["email_body_template"] or "Thank you for your order, below are your invoice details."
            if not sender_email or not app_password:
                QMessageBox.warning(self, "Email Error", "Incomplete email settings. Please update them.")
                return

            order_num = order_data["order_number"]
            customer_name = order_data["customer_name"]
            invoice_num = order_data.get("invoice_number", order_num)
            subject = (subject_template
                       .replace("[order number]", order_num)
                       .replace("[invoice number]", invoice_num)
                       .replace("[customer name]", customer_name))

            additional_plain = f"\n\nInvoice Details:\nInvoice Number: {invoice_num}\nOrder Number: {order_num}\nCustomer: {customer_name}\nDate: {order_data['date']}\nTotal Pax: {order_data['total_pax']}"
            if order_data.get("kids", 0) > 0:
                additional_plain += f"\nKids: {order_data['kids']}"
            additional_plain += "\n\nDo not reply to this autogenerated email address."

            additional_html = f"""
            <p style="font-family: Arial; font-size: 14px; font-weight: bold;">
            Invoice Details:<br>
            Invoice Number: {invoice_num}<br>
            Order Number: {order_num}<br>
            Customer: {customer_name}<br>
            Date: {order_data['date']}<br>
            Total Pax: {order_data['total_pax']}<br>
            """
            if order_data.get("kids", 0) > 0:
                additional_html += f"Kids: {order_data['kids']}<br>"
            additional_html += "</p>"
            contact_button = """
            <a href="mailto:restaurant@thelittlesnail.com.au" style="
               display: inline-block; padding: 10px 20px; font-size: 16px; font-weight: bold; 
               color: white; background: linear-gradient(45deg, #FF6B6B, #FFD93D); text-decoration: none; 
               border-radius: 25px;">
               Contact Little Snail Restaurant
            </a>
            """
            footer_html = "<p style='font-size: 12px; color: #666;'>Do not reply to this autogenerated email address.</p>"
            html_body = f"""
            <html>
              <body style="font-family: Arial; font-size: 14px;">
                <p>{body_template.replace("[order number]", order_num)
            .replace("[invoice number]", invoice_num)
            .replace("[customer name]", customer_name)}</p>
                {additional_html}
                {contact_button}
                {footer_html}
              </body>
            </html>
            """

            msg = MIMEMultipart("alternative")
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject
            msg['Importance'] = "High"
            msg['X-Priority'] = "1"
            part1 = MIMEText(body_template + additional_plain, "plain")
            part2 = MIMEText(html_body, "html")
            msg.attach(part1)
            msg.attach(part2)

            # Attach the DOCX invoice.
            with open(docx_path, "rb") as f:
                docx_part = MIMEApplication(f.read(), Name=os.path.basename(docx_path))
            docx_part['Content-Disposition'] = f'attachment; filename="{os.path.basename(docx_path)}"'
            msg.attach(docx_part)

            print("Connecting to SMTP server...")
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            print("Logging in as:", sender_email)
            server.login(sender_email, app_password)
            print("Sending email to:", recipient_email)
            server.send_message(msg)
            server.quit()
            QMessageBox.information(self, "Email Sent", f"Invoice email sent successfully to {recipient_email}.")
        except Exception as e:
            QMessageBox.critical(self, "Email Error", f"Failed to send email:\n{e}")
            print("Email error:", e)

    # ---------- Main Print Order ----------
    def print_order(self):
        if (self.customer_combo.currentText() == "Select Customer" or
                not self.order_number_edit.text().strip() or
                not self.date_edit.text().strip()):
            QMessageBox.warning(self, "Input Error",
                                "Please select a customer, enter an order number, and select a date.")
            return

        try:
            adults = int(self.adults_edit.text())
            kids = int(self.kids_edit.text()) if self.kids_edit.text() else 0
        except ValueError:
            QMessageBox.warning(self, "Invalid Input", "Adults and Kids must be numeric values.")
            return

        total_pax = adults + kids
        if total_pax <= 0:
            QMessageBox.warning(self, "Invalid Order", "Total pax must be greater than zero.")
            return

        total_entree, total_mains, total_desserts = self.calculate_total_items()
        conditions = []
        if adults != total_mains:
            conditions.append(f"Number of adults ({adults}) must equal number of mains ({total_mains}).")
        if total_pax != total_desserts:
            conditions.append(f"Total pax ({total_pax}) must equal number of desserts ({total_desserts}).")
        if total_entree < total_mains:
            conditions.append(f"Number of entrée ({total_entree}) must be >= number of mains ({total_mains}).")
        if conditions:
            msg = "The following conditions are not met:\n" + "\n".join(conditions) + "\n\nOverride and continue?"
            ret = QMessageBox.question(self, "Order Conditions", msg,
                                       QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
            if ret != QMessageBox.StandardButton.Yes:
                return

        if self.show_print_settings() == QDialog.DialogCode.Rejected:
            return

        overall_total = total_entree + total_mains + total_desserts

        # Retrieve pricing information from the customer record
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT price_lunch, price_dinner, price_kids FROM customers WHERE id = ?",
                           (self.customer_combo.currentData(),))
            pricing = cursor.fetchone()
            conn.close()
            if pricing:
                # Determine service type and corresponding unit price
                if self.radio_lunch.isChecked():
                    unit_price = pricing["price_lunch"]
                else:
                    unit_price = pricing["price_dinner"]
                kids_price = pricing["price_kids"]

                # Check that adult price is not 0
                if unit_price == 0:
                    QMessageBox.warning(self, "Pricing Error",
                                        "The customer's price for lunch/dinner is 0. Please update the customer pricing.")
                    return

                calculated_total = (adults * unit_price) + (kids * kids_price)
            else:
                calculated_total = 0.0
                unit_price = 0.0
                kids_price = 0.0
        except Exception as e:
            QMessageBox.warning(self, "Pricing Error", f"Failed to retrieve pricing information:\n{e}")
            return

        # Determine service type
        order_service = "Lunch" if self.radio_lunch.isChecked() else "Dinner"

        # Build order_data dictionary with pricing and service info
        order_data = {
            "order_number": self.order_number_edit.text().strip() or "0000",
            "customer_name": self.customer_combo.currentText().strip() or "Unknown",
            "date": f"{self.date_edit.text()} {self.time_edit.text()}",
            "total_pax": total_pax,
            "entree": self.gather_section_items(self.entree_section),
            "mains": self.gather_section_items(self.main_section),
            "desserts": self.gather_section_items(self.dessert_section),
            "adults": adults,
            "kids": kids,
            "adult_price": unit_price,
            "kid_price": kids_price,
            "service_type": order_service,
            "calculated_total": calculated_total
        }

        # Create invoice record and add invoice number to order_data.
        invoice_number = self.create_invoice_record(order_data)
        if invoice_number is None:
            return
        order_data["invoice_number"] = invoice_number

        # Specify permanent output folder for DOCX.
        output_folder = os.path.join(os.getcwd(), "data", "Tour_Group_Orders")
        try:
            # Generate the order DOCX (this file is saved and opened for the user locally).
            docx_path = save_order_as_docx(order_data, output_folder)
            print("DOCX file created at:", docx_path)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to create DOCX file:\n{e}")
            return

        # Also generate a plain text file with the order's quantities.
        base_filename = os.path.splitext(os.path.basename(docx_path))[0]
        text_path = self.generate_order_text(order_data, output_folder, base_filename)
        if text_path:
            print("Plain text order file created at:", text_path)

        # Open the DOCX file in the default application for local viewing.
        try:
            if platform.system() == "Windows":
                os.startfile(docx_path)
            elif platform.system() == "Darwin":
                os.system(f"open '{docx_path}'")
            else:
                os.system(f"xdg-open '{docx_path}'")
        except Exception as e:
            QMessageBox.warning(self, "Open Error", f"Failed to open DOCX:\n{e}")

        # Now, generate the invoice PDF to be sent via email.
        invoice_pdf_filename = f"invoice_{order_data['order_number']}_{invoice_number}.pdf"
        invoice_pdf_path = os.path.join(output_folder, invoice_pdf_filename)
        try:
            generate_order_pdf(order_data, invoice_pdf_path)
            print("Invoice PDF created at:", invoice_pdf_path)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to create invoice PDF:\n{e}")
            return

        # Retrieve selected customer's email.
        customer_id = self.customer_combo.currentData()
        if not customer_id:
            QMessageBox.warning(self, "Customer Error", "Please select a valid customer to email.")
            return
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM customers WHERE id = ?", (customer_id,))
            row = cursor.fetchone()
            conn.close()
            if row is None or not row["email"]:
                QMessageBox.warning(self, "Customer Error", "No email found for the selected customer.")
                return
            recipient_email = row["email"]
        except Exception as e:
            QMessageBox.critical(self, "Database Error", f"Failed to retrieve customer email:\n{e}")
            return

        # Send email with the PDF invoice attached.
        self.send_order_email(order_data, recipient_email, invoice_pdf_path)

        QMessageBox.information(
            self, "Order Processed",
            f"Order successfully processed.\n"
            f"Total Pax: {total_pax}\n"
            f"Entrée: {self.sum_section(self.entree_section)}, Mains: {self.sum_section(self.main_section)}, Desserts: {self.sum_section(self.dessert_section)}\n"
            f"Overall Total: {overall_total}\n"
            f"Order DOCX saved at:\n{docx_path}\n"
            f"Invoice PDF generated and sent via email."
        )

    def show_print_settings(self):
        dialog = PrintSettingsDialog(self)
        return dialog.exec()

    # ---------------------- End of OrderManager methods ---------------------- #


if __name__ == "__main__":
    from PyQt6.QtWidgets import QApplication

    app = QApplication(sys.argv)
    window = OrderManager()
    window.show()
    sys.exit(app.exec())
