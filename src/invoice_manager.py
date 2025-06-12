import sys, os, shutil
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QDateEdit, QTableView,
    QPushButton, QMessageBox, QGridLayout, QDialog, QDialogButtonBox, QTextEdit,
    QApplication, QTableWidget, QTableWidgetItem, QComboBox, QToolTip
)
from PyQt6.QtCore import QSortFilterProxyModel, QDate, QTime, Qt, QEvent
from PyQt6.QtGui import QFont, QStandardItemModel, QStandardItem, QShortcut, QKeySequence, QCursor
import database
from docx_generator import save_order_as_docx
from pdf_generator import generate_order_pdf  # for invoice generation

from docx_generator import save_order_as_docx
from pdf_generator import generate_order_pdf  # Function with signature (order_data, output_pdf_path)

# Folder where invoice files (PDF, DOCX, plain text) are stored.
OUTPUT_FOLDER = os.path.join(os.getcwd(), "data", "Tour_Group_Orders")

class InvoiceFilterProxy(QSortFilterProxyModel):
    """
    Custom proxy model that filters invoices by customer.
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self._customer_filter = ""

    def setCustomerFilter(self, customer):
        self._customer_filter = customer
        self.invalidateFilter()

    def filterAcceptsRow(self, source_row, source_parent):
        if self._customer_filter:
            idx_customer = self.sourceModel().index(source_row, 1, source_parent)
            customer_data = self.sourceModel().data(idx_customer, Qt.ItemDataRole.DisplayRole) or ""
            if customer_data != self._customer_filter:
                return False
        return True

class InvoiceEditDialog(QDialog):
    """
    A dialog for editing an invoice record.
    """
    def __init__(self, invoice_record, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Edit Invoice")
        self.invoice_record = invoice_record  # a dict with invoice data
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout(self)
        lbl_invoice = QLabel(f"Invoice Number: {self.invoice_record.get('invoice_number', '')}")
        lbl_invoice.setFont(QFont("Arial", 14, QFont.Weight.Bold))
        layout.addWidget(lbl_invoice)
        lbl_order = QLabel(f"Order ID: {self.invoice_record.get('order_number', '')}")
        layout.addWidget(lbl_order)
        self.txt_invoice_data = QTextEdit(self)
        self.txt_invoice_data.setPlainText(self.invoice_record.get("invoice_data", ""))
        layout.addWidget(self.txt_invoice_data)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def get_updated_data(self):
        return self.txt_invoice_data.toPlainText()

class InvoiceDetailsDialog(QDialog):
    """
    A dialog that displays the plain text order details in a table format.
    """
    def __init__(self, order_text, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Invoice Order Details")
        self.resize(400, 300)
        layout = QVBoxLayout(self)
        table = QTableWidget(self)
        lines = order_text.splitlines()
        rows = []
        # Assume plain text file contains header lines for Order Number, Customer, Date,
        # followed by lines with "    Item: qty"
        for line in lines:
            if ":" in line and not line.startswith("Order") and not line.startswith("Customer") and not line.startswith("Date"):
                parts = line.strip().split(":", 1)
                if len(parts) == 2:
                    rows.append((parts[0].strip(), parts[1].strip()))
        table.setRowCount(len(rows))
        table.setColumnCount(2)
        table.setHorizontalHeaderLabels(["Item", "Quantity"])
        for r, (item, qty) in enumerate(rows):
            table.setItem(r, 0, QTableWidgetItem(item))
            table.setItem(r, 1, QTableWidgetItem(qty))
        layout.addWidget(table)
        btn = QPushButton("Close", self)
        btn.clicked.connect(self.accept)
        layout.addWidget(btn)

class InvoiceManager(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Invoice Manager")
        self.resize(900, 600)
        self.invoices = []
        self.initUI()
        self.load_invoices()
        self.setup_shortcuts()

    def initUI(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)
        header_label = QLabel("Invoice Manager", self)
        header_font = QFont("Segoe UI", 32, QFont.Weight.Bold)
        header_label.setFont(header_font)
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        main_layout.addWidget(header_label)

        # SORT SETTINGS LAYOUT (replacing previous filters)
        sort_layout = QHBoxLayout()
        lbl_sort = QLabel("Sort By:")
        lbl_sort.setFont(QFont("Segoe UI", 16))
        self.sort_combo = QComboBox()
        self.sort_combo.setMinimumHeight(40)
        self.sort_combo.addItems(["Invoice Number", "Date", "Customer"])
        self.sort_combo.currentTextChanged.connect(self.sort_option_changed)
        sort_layout.addWidget(lbl_sort)
        sort_layout.addWidget(self.sort_combo)
        self.customer_sort_combo = QComboBox()
        self.customer_sort_combo.setMinimumHeight(40)
        self.customer_sort_combo.setVisible(False)
        self.customer_sort_combo.currentTextChanged.connect(self.apply_sort)
        sort_layout.addWidget(self.customer_sort_combo)
        sort_layout.addStretch()
        main_layout.addLayout(sort_layout)

        self.table_view = QTableView()
        self.table_view.setStyleSheet("""
            QTableView {
                background-color: white;
                border: 1px solid #ddd;
                gridline-color: #ddd;
                font-size: 14px;
            }
            QHeaderView::section {
                background-color: #243878;
                color: white;
                padding: 8px;
                font-size: 16px;
                border: none;
            }
        """)
        main_layout.addWidget(self.table_view, 1)

        action_layout = QHBoxLayout()
        action_layout.addStretch()
        self.btn_view_invoice = QPushButton("View Order Details")
        self.btn_view_invoice.setMinimumHeight(40)
        self.btn_view_invoice.setStyleSheet("""
            QPushButton {
                background-color: #243878;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton:hover { background-color: #f33e6a; }
        """)
        self.btn_view_invoice.clicked.connect(self.view_invoice_details)
        self.btn_edit_invoice = QPushButton("Edit Invoice")
        self.btn_edit_invoice.setMinimumHeight(40)
        self.btn_edit_invoice.setStyleSheet("""
            QPushButton {
                background-color: #243878;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton:hover { background-color: #f33e6a; }
        """)
        self.btn_edit_invoice.clicked.connect(self.edit_invoice)
        action_layout.addWidget(self.btn_view_invoice)
        action_layout.addWidget(self.btn_edit_invoice)
        action_layout.addStretch()
        main_layout.addLayout(action_layout)

        self.model = QStandardItemModel()
        self.model.setHorizontalHeaderLabels(["Invoice No", "Customer Name", "Order Number", "Date"])
        self.proxy_model = InvoiceFilterProxy(self)
        self.proxy_model.setSourceModel(self.model)
        self.table_view.setModel(self.proxy_model)
        self.table_view.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self.table_view.setSelectionMode(QTableView.SelectionMode.SingleSelection)
        self.table_view.horizontalHeader().setStretchLastSection(True)
        self.table_view.setColumnWidth(0, 150)
        self.table_view.setColumnWidth(1, 300)
        self.table_view.setColumnWidth(2, 150)
        self.table_view.setColumnWidth(3, 150)
        self.table_view.viewport().installEventFilter(self)
        self.setStyleSheet(self.styleSheet() + """
            QWidget { background-color: #f5f1d1; }
        """)

    def sort_option_changed(self, text):
        if text == "Customer":
            self.customer_sort_combo.setVisible(True)
            self.populate_customer_dropdown()
        else:
            self.customer_sort_combo.setVisible(False)
            self.apply_sort()

    def populate_customer_dropdown(self):
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            query = """
                SELECT DISTINCT c.name as customer
                FROM invoices inv
                JOIN orders o ON inv.order_id = o.id
                JOIN customers c ON o.customer_id = c.id
                WHERE c.name IS NOT NULL
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            conn.close()
            customers = [row["customer"] for row in rows if row["customer"]]
            customers.sort()
            self.customer_sort_combo.clear()
            self.customer_sort_combo.addItems(customers)
        except Exception as e:
            QMessageBox.critical(self, "Database Error", f"Failed to load customers:\n{e}")

    def apply_sort(self):
        sort_by = self.sort_combo.currentText()
        if sort_by == "Invoice Number":
            self.proxy_model.sort(0, Qt.SortOrder.AscendingOrder)
            self.proxy_model.setCustomerFilter("")
        elif sort_by == "Date":
            self.proxy_model.sort(3, Qt.SortOrder.AscendingOrder)
            self.proxy_model.setCustomerFilter("")
        elif sort_by == "Customer":
            selected_customer = self.customer_sort_combo.currentText()
            self.proxy_model.setCustomerFilter(selected_customer)
        else:
            self.proxy_model.invalidateFilter()

    def setup_shortcuts(self):
        QShortcut(QKeySequence("Ctrl+E"), self, activated=self.edit_invoice)
        QShortcut(QKeySequence("Ctrl+N"), self, activated=self.create_new_invoice)
        QShortcut(QKeySequence("Delete"), self, activated=self.delete_selected_invoice)
        QShortcut(QKeySequence("Backspace"), self, activated=self.delete_selected_invoice)

    def showEvent(self, event):
        self.load_invoices()
        super().showEvent(event)

    def load_invoices(self):
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            query = """
                SELECT inv.*, o.order_number, o.id as order_id, c.name as customer, inv.created_at
                FROM invoices inv
                JOIN orders o ON inv.order_id = o.id
                JOIN customers c ON o.customer_id = c.id
            """
            cursor.execute(query)
            raw_invoices = cursor.fetchall()
            conn.close()
        except Exception as e:
            QMessageBox.critical(self, "Database Error", f"Failed to load invoices:\n{e}")
            return
        converted = []
        for inv in raw_invoices:
            inv_dict = dict(inv)
            raw_date = inv_dict.get("created_at", "")
            qdate = QDate.fromString(raw_date, "yyyy-MM-dd")
            formatted_date = qdate.toString("dd MMM yyyy") if qdate.isValid() else raw_date
            inv_dict["created_at"] = formatted_date
            converted.append(inv_dict)
        self.invoices = converted
        self.model.setRowCount(0)
        for inv in self.invoices:
            row_data = [
                inv.get("invoice_number", ""),
                inv.get("customer", ""),
                inv.get("order_number", ""),
                inv.get("created_at", "")
            ]
            row_items = [QStandardItem(str(item)) for item in row_data]
            self.model.appendRow(row_items)
        self.apply_sort()

    def eventFilter(self, source, event):
        if source == self.table_view.viewport() and event.type() == QEvent.Type.MouseMove:
            index = self.table_view.indexAt(event.pos())
            if index.isValid() and index.column() == 0:
                invoice_no = self.model.item(index.row(), 0).text()
                text_filename = f"{invoice_no}.txt"
                text_path = os.path.join(OUTPUT_FOLDER, text_filename)
                if os.path.exists(text_path):
                    with open(text_path, "r") as f:
                        content = f.read()
                    QToolTip.showText(event.globalPosition().toPoint(), content, self.table_view)
                else:
                    QToolTip.hideText()
            else:
                QToolTip.hideText()
        return super().eventFilter(source, event)

    def view_invoice_details(self):
        index = self.table_view.currentIndex()
        if not index.isValid():
            QMessageBox.warning(self, "No Selection", "Please select an invoice to view details.")
            return
        source_index = self.proxy_model.mapToSource(index)
        invoice_no = self.model.item(source_index.row(), 0).text()
        text_filename = f"{invoice_no}.txt"
        text_path = os.path.join(OUTPUT_FOLDER, text_filename)
        if not os.path.exists(text_path):
            QMessageBox.warning(self, "File Not Found", "Plain text order data file not found for this invoice.")
            return
        with open(text_path, "r") as f:
            order_text = f.read()
        details_dialog = InvoiceDetailsDialog(order_text, self)
        details_dialog.exec()

    def edit_invoice(self):
        index = self.table_view.currentIndex()
        if not index.isValid():
            QMessageBox.warning(self, "No Selection", "Please select an invoice to edit.")
            return
        source_index = self.proxy_model.mapToSource(index)
        invoice_no = self.model.item(source_index.row(), 0).text()
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM invoices WHERE invoice_number = ?", (invoice_no,))
            row = cursor.fetchone()
            conn.close()
            if row is None:
                QMessageBox.warning(self, "Error", "Invoice record not found.")
                return
            invoice_record = dict(row)
        except Exception as e:
            QMessageBox.critical(self, "Database Error", f"Failed to retrieve invoice:\n{e}")
            return
        dialog = InvoiceEditDialog(invoice_record, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            new_invoice_data = dialog.get_updated_data()
            try:
                conn = database.get_connection()
                cursor = conn.cursor()
                new_invoice_number = f"INV-{int(invoice_record['id']):05d}-E"
                cursor.execute("UPDATE invoices SET invoice_number = ?, invoice_data = ? WHERE id = ?",
                               (new_invoice_number, new_invoice_data, invoice_record["id"]))
                conn.commit()
                conn.close()
                old_pdf_filename = f"invoice_{invoice_record.get('order_id', '0000')}_{invoice_no}.pdf"
                old_pdf_path = os.path.join(OUTPUT_FOLDER, old_pdf_filename)
                if os.path.exists(old_pdf_path):
                    os.remove(old_pdf_path)
                # Assume updated_order_data is built from invoice_record (ensure it has order_number and customer info)
                updated_order_data = invoice_record.copy()
                # In case some keys are missing, you might want to fill them in.
                base_filename = f"{updated_order_data.get('order_number', '0000')}_{updated_order_data.get('customer', 'Unknown').replace(' ', '')}_{new_invoice_number}"
                new_pdf_filename = f"invoice_{updated_order_data.get('order_number', '0000')}_{new_invoice_number}.pdf"
                new_pdf_path = os.path.join(OUTPUT_FOLDER, new_pdf_filename)
                from pdf_generator import generate_order_pdf
                # Call generate_order_pdf with only two parameters: updated_order_data and new_pdf_path
                generate_order_pdf(updated_order_data, new_pdf_path)
                QMessageBox.information(self, "Success", "Invoice updated successfully.")
                self.load_invoices()
            except Exception as e:
                QMessageBox.critical(self, "Database Error", f"Failed to update invoice:\n{e}")

    def create_new_invoice(self):
        new_dialog = QDialog(self)
        new_dialog.setWindowTitle("Create New Invoice")
        layout = QVBoxLayout(new_dialog)
        order_id_edit = QLineEdit(new_dialog)
        order_id_edit.setPlaceholderText("Order ID")
        layout.addWidget(order_id_edit)
        invoice_data_edit = QTextEdit(new_dialog)
        invoice_data_edit.setPlaceholderText("Enter invoice details (quantities etc.)")
        layout.addWidget(invoice_data_edit)
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(new_dialog.accept)
        buttons.rejected.connect(new_dialog.reject)
        layout.addWidget(buttons)
        if new_dialog.exec() == QDialog.DialogCode.Accepted:
            order_id = order_id_edit.text().strip() or "0000"
            invoice_data = invoice_data_edit.toPlainText()
            try:
                conn = database.get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO invoices (order_id, invoice_number, invoice_data, gst_breakdown, final_total)
                    VALUES (?, ?, ?, ?, ?)
                """, (order_id, "", invoice_data, 0.0, 0.0))
                invoice_id = cursor.lastrowid
                new_invoice_number = f"INV-{invoice_id:05d}"
                cursor.execute("UPDATE invoices SET invoice_number = ? WHERE id = ?", (new_invoice_number, invoice_id))
                conn.commit()
                conn.close()
                QMessageBox.information(self, "New Invoice", f"New invoice created: {new_invoice_number}")
                self.load_invoices()
            except Exception as e:
                QMessageBox.critical(self, "Database Error", f"Failed to create new invoice:\n{e}")

    def delete_selected_invoice(self):
        index = self.table_view.currentIndex()
        if not index.isValid():
            return
        source_index = self.proxy_model.mapToSource(index)
        invoice_no = self.model.item(source_index.row(), 0).text()
        ret = QMessageBox.question(self, "Delete Invoice",
                                   f"Are you sure you want to delete invoice {invoice_no}?",
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if ret == QMessageBox.StandardButton.Yes:
            try:
                conn = database.get_connection()
                cursor = conn.cursor()
                cursor.execute("DELETE FROM invoices WHERE invoice_number = ?", (invoice_no,))
                conn.commit()
                conn.close()
                pdf_filename = f"invoice_{self.model.item(source_index.row(), 2).text()}_{invoice_no}.pdf"
                pdf_path = os.path.join(OUTPUT_FOLDER, pdf_filename)
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                text_filename = f"{invoice_no}.txt"
                text_path = os.path.join(OUTPUT_FOLDER, text_filename)
                if os.path.exists(text_path):
                    os.remove(text_path)
                QMessageBox.information(self, "Deleted", f"Invoice {invoice_no} deleted.")
                self.load_invoices()
            except Exception as e:
                QMessageBox.critical(self, "Database Error", f"Failed to delete invoice:\n{e}")

if __name__ == "__main__":
    from PyQt6.QtWidgets import QApplication
    app = QApplication(sys.argv)
    window = InvoiceManager()
    window.show()
    sys.exit(app.exec())
