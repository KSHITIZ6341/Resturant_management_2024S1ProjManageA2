# customer_manager.py
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QMessageBox, QLineEdit, QDialog, QFormLayout, QLabel, QHeaderView
)
from PyQt6.QtCore import pyqtSignal, Qt
from PyQt6.QtGui import QFont
import database


class CustomerDialog(QDialog):
    def __init__(self, parent=None, customer=None):
        super().__init__(parent)
        self.setWindowTitle("Customer Details")
        self.customer = customer
        self.initUI()

    def initUI(self):
        self.layout = QFormLayout(self)
        # Pill-shaped, white background style for input fields.
        edit_style = """
            QLineEdit {
                background-color: white;
                border: 1px solid #ccc;
                border-radius: 20px;
                padding: 8px 16px;
                font-size: 18px;
            }
        """
        self.name_edit = QLineEdit(self)
        self.name_edit.setStyleSheet(edit_style)
        self.email_edit = QLineEdit(self)
        self.email_edit.setStyleSheet(edit_style)
        self.price_lunch_edit = QLineEdit(self)
        self.price_lunch_edit.setStyleSheet(edit_style)
        self.price_dinner_edit = QLineEdit(self)
        self.price_dinner_edit.setStyleSheet(edit_style)
        self.price_kids_edit = QLineEdit(self)
        self.price_kids_edit.setStyleSheet(edit_style)
        self.phone_edit = QLineEdit(self)
        self.phone_edit.setStyleSheet(edit_style)
        self.address_edit = QLineEdit(self)
        self.address_edit.setStyleSheet(edit_style)
        self.additional_info_edit = QLineEdit(self)
        self.additional_info_edit.setStyleSheet(edit_style)

        if self.customer:
            # Always capitalize the customer name.
            self.name_edit.setText(self.customer["name"].upper())
            self.email_edit.setText(self.customer["email"])
            self.price_lunch_edit.setText(str(self.customer["price_lunch"]))
            self.price_dinner_edit.setText(str(self.customer["price_dinner"]))
            self.price_kids_edit.setText(str(self.customer["price_kids"]))
            self.phone_edit.setText(self.customer["phone"] if self.customer["phone"] else "")
            self.address_edit.setText(self.customer["address"] if self.customer["address"] else "")
            self.additional_info_edit.setText(
                self.customer["additional_info"] if self.customer["additional_info"] else ""
            )

        self.layout.addRow("Name:", self.name_edit)
        self.layout.addRow("Email:", self.email_edit)
        self.layout.addRow("Price (Lunch):", self.price_lunch_edit)
        self.layout.addRow("Price (Dinner):", self.price_dinner_edit)
        self.layout.addRow("Price (Kids):", self.price_kids_edit)
        self.layout.addRow("Phone:", self.phone_edit)
        self.layout.addRow("Address:", self.address_edit)
        self.layout.addRow("Additional Info:", self.additional_info_edit)

        # Save button with rectangular style (no rounding)
        self.btn_save = QPushButton("Save", self)
        self.btn_save.setStyleSheet("""
            QPushButton {
                background-color: white;
                color: #333333;
                border: 1px solid #ccc;
                border-radius: 0px;
                padding: 10px 20px;
                font-size: 18px;
            }
            QPushButton:hover {
                background-color: #90EE90;
            }
        """)
        self.btn_save.clicked.connect(self.accept)
        self.layout.addRow(self.btn_save)

    def accept(self):
        # Validate that Name and price fields are not empty and are valid numbers.
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, "Validation Error", "Name cannot be empty.")
            return

        try:
            _ = float(self.price_lunch_edit.text())
            _ = float(self.price_dinner_edit.text())
            _ = float(self.price_kids_edit.text())
        except ValueError:
            QMessageBox.warning(self, "Validation Error", "Prices must be numeric values.")
            return

        super().accept()

    def get_data(self):
        return {
            "name": self.name_edit.text(),
            "email": self.email_edit.text(),
            "price_lunch": float(self.price_lunch_edit.text()),
            "price_dinner": float(self.price_dinner_edit.text()),
            "price_kids": float(self.price_kids_edit.text()),
            "phone": self.phone_edit.text(),
            "address": self.address_edit.text(),
            "additional_info": self.additional_info_edit.text()
        }


class CustomerManager(QWidget):
    # Signal emitted when customer data is updated
    data_updated = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.initUI()
        self.load_customers()

    def initUI(self):
        self.layout = QVBoxLayout(self)
        self.layout.setSpacing(10)
        self.layout.setContentsMargins(20, 20, 20, 20)

        # Title Header
        header_label = QLabel("Customer Manager", self)
        header_font = QFont("Arial", 32, QFont.Weight.Bold)
        header_label.setFont(header_font)
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.layout.addWidget(header_label)

        # Add Customer Button (moved to the right, green pill)
        self.btn_add = QPushButton("Add Customer", self)
        self.btn_add.setObjectName("addButton")
        self.btn_add.clicked.connect(self.add_customer)
        add_layout = QHBoxLayout()
        add_layout.addStretch()
        self.btn_add.setStyleSheet("""
            QPushButton {
                background-color: #28a745;
                color: white;
                border: none;
                border-radius: 25px;
                padding: 10px 20px;
                font-size: 18px;
            }
            QPushButton:hover {
                background-color: #218838;
            }
        """)
        add_layout.addWidget(self.btn_add)
        self.layout.addLayout(add_layout)

        # Customer Table: Columns - Name, Email, Phone, Price, Action
        self.table = QTableWidget(self)
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(["Name", "Email", "Phone", "Price", "Action"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        # Set each row height to 50px.
        self.table.verticalHeader().setDefaultSectionSize(50)
        # Hide vertical header (no row numbers)
        self.table.verticalHeader().setVisible(False)
        self.table.setStyleSheet("""
            QTableWidget {
                background-color: white;
                border: 1px solid #ddd;
            }
            QTableWidget::item {
                border: none;
                padding: 8px;
                font-size: 15px;
                font-weight: bold;
                color: #333333;
            }
            QHeaderView::section {
                background-color: #243878;
                color: white;
                padding: 10px;
                font-size: 15px;
                border: none;
            }
        """)
        self.layout.addWidget(self.table)
        self.setStyleSheet(self.load_styles())

    def load_customers(self):
        """Load customer records from the database."""
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers")
        rows = cursor.fetchall()
        conn.close()

        self.table.setRowCount(0)
        for row in rows:
            self.add_customer_row(row)

    def add_customer_row(self, customer):
        """
        Adds a customer record as a new row in the table.
        The table has columns: Name, Email, Phone, Price, Action.
        - The Price column is a button displaying "L:xx D:xx K:xx" (as integers).
        - When the Price button is clicked, a popup shows the individual prices.
        - The Action column contains two connected rectangular buttons (same size) that fill the cell.
        """
        row_position = self.table.rowCount()
        self.table.insertRow(row_position)
        self.table.setRowHeight(row_position, 50)

        # Name (always uppercase)
        name_item = QTableWidgetItem(customer["name"].upper())
        name_font = QFont("Arial", 24, QFont.Weight.Bold)
        name_item.setFont(name_font)
        self.table.setItem(row_position, 0, name_item)

        # Email
        email_item = QTableWidgetItem(customer["email"])
        email_font = QFont("Arial", 24, QFont.Weight.Bold)
        email_item.setFont(email_font)
        self.table.setItem(row_position, 1, email_item)

        # Phone
        phone_item = QTableWidgetItem(customer["phone"] if customer["phone"] else "")
        phone_font = QFont("Arial", 24, QFont.Weight.Bold)
        phone_item.setFont(phone_font)
        self.table.setItem(row_position, 2, phone_item)

        # Price button: format "L:xx D:xx K:xx"
        lunch = int(customer["price_lunch"])
        dinner = int(customer["price_dinner"])
        kids = int(customer["price_kids"])
        price_text = f"L:{lunch} D:{dinner} K:{kids}"
        btn_price = QPushButton(price_text)
        btn_price.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #243878;
                border: 1px solid #CCCCCC;
                border-radius: 10px;
                font-size: 20px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
            }
        """)
        btn_price.clicked.connect(lambda _, cl=lunch, cd=dinner, ck=kids:
                                    QMessageBox.information(self, "Price Details",
                                                            f"Lunch Price: {cl}\nDinner Price: {cd}\nKids Price: {ck}"))
        self.table.setCellWidget(row_position, 3, btn_price)

        # Action column: two connected rectangular buttons filling full cell width.
        actions_widget = QWidget()
        actions_layout = QHBoxLayout(actions_widget)
        actions_layout.setContentsMargins(0, 0, 0, 0)
        actions_layout.setSpacing(0)

        # Edit button: yellow with pen and hamburger icon (✎☰)
        btn_edit = QPushButton("✎☰", actions_widget)
        btn_edit.setToolTip("Edit Customer")
        btn_edit.setFixedSize(50, 50)
        btn_edit.setStyleSheet("""
            QPushButton {
                background-color: #FFD700;
                color: #333333;
                border: 1px solid #CCCCCC;
                border-right: none;
                border-radius: 5px;
                font-size: 20px;
            }
            QPushButton:hover {
                background-color: #FFC107;
            }
        """)
        btn_edit.clicked.connect(lambda _, cid=customer["id"]: self.edit_customer(cid))

        # Delete button: red with bin and hamburger icon (🗑☰)
        btn_delete = QPushButton("🗑☰", actions_widget)
        btn_delete.setToolTip("Delete Customer")
        btn_delete.setFixedSize(50, 50)
        btn_delete.setStyleSheet("""
            QPushButton {
                background-color: #FF6347;
                color: white;
                border: 1px solid #CCCCCC;
                border-left: none;
                border-radius: 5px;
                font-size: 20px;
            }
            QPushButton:hover {
                background-color: #FF4500;
            }
        """)
        btn_delete.clicked.connect(lambda _, cid=customer["id"]: self.delete_customer(cid))

        actions_layout.addWidget(btn_edit)
        actions_layout.addWidget(btn_delete)
        self.table.setCellWidget(row_position, 4, actions_widget)

    def add_customer(self):
        """Opens a dialog to add a new customer."""
        dialog = CustomerDialog(self)
        if dialog.exec():
            data = dialog.get_data()
            # Ensure Name and price fields are not empty
            if not data["name"].strip():
                QMessageBox.warning(self, "Validation Error", "Name cannot be empty.")
                return
            try:
                float(data["price_lunch"])
                float(data["price_dinner"])
                float(data["price_kids"])
            except ValueError:
                QMessageBox.warning(self, "Validation Error", "Prices must be numeric values.")
                return

            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO customers (name, email, price_lunch, price_dinner, price_kids, phone, address, additional_info)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data["name"], data["email"], data["price_lunch"], data["price_dinner"],
                data["price_kids"], data["phone"], data["address"], data["additional_info"]
            ))
            conn.commit()
            conn.close()
            self.load_customers()
            self.data_updated.emit()

    def edit_customer(self, customer_id):
        """Opens a dialog to edit an existing customer."""
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
        customer = cursor.fetchone()
        conn.close()
        if customer:
            dialog = CustomerDialog(self, customer)
            if dialog.exec():
                data = dialog.get_data()
                # Validate Name and prices
                if not data["name"].strip():
                    QMessageBox.warning(self, "Validation Error", "Name cannot be empty.")
                    return
                try:
                    float(data["price_lunch"])
                    float(data["price_dinner"])
                    float(data["price_kids"])
                except ValueError:
                    QMessageBox.warning(self, "Validation Error", "Prices must be numeric values.")
                    return

                conn = database.get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE customers SET name = ?, email = ?, price_lunch = ?, price_dinner = ?, price_kids = ?, phone = ?, address = ?, additional_info = ?
                    WHERE id = ?
                """, (
                    data["name"], data["email"], data["price_lunch"], data["price_dinner"],
                    data["price_kids"], data["phone"], data["address"], data["additional_info"], customer_id
                ))
                conn.commit()
                conn.close()
                self.load_customers()
                self.data_updated.emit()

    def delete_customer(self, customer_id):
        """Deletes a customer after confirmation."""
        reply = QMessageBox.question(
            self, "Delete Customer", "Are you sure you want to delete this customer?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
            conn.commit()
            conn.close()
            self.load_customers()
            self.data_updated.emit()

    def load_styles(self):
        """Returns QSS styling for the Customer Manager UI."""
        return """
            QTableWidget {
                background-color: white;
                border: 1px solid #ddd;
            }
            QTableWidget::item {
                border: none;
                padding: 8px;
                font-size: 15px;
                font-weight: bold;
                color: #333333;
            }
            QHeaderView::section {
                background-color: #243878;
                color: white;
                padding: 10px;
                font-size: 15px;
                border: none;
            }
        """


if __name__ == "__main__":
    from PyQt6.QtWidgets import QApplication
    import sys

    app = QApplication(sys.argv)
    app.setStyleSheet("QWidget { font-family: Arial; background-color: white; }")
    window = CustomerManager()
    window.show()
    sys.exit(app.exec())
