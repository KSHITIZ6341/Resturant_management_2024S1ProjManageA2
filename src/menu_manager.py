# menu_manager.py
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QMessageBox, QLineEdit, QDialog, QFormLayout, QLabel,
    QHeaderView, QRadioButton, QButtonGroup, QSpacerItem, QSizePolicy
)
from PyQt6.QtCore import Qt, QEvent
from PyQt6.QtGui import QFont, QKeySequence, QShortcut
import database


def show_styled_confirmation(parent, title, text):
    msg = QMessageBox(parent)
    msg.setWindowTitle(title)
    msg.setText(text)
    msg.setStandardButtons(QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
    msg.setStyleSheet("""
        QMessageBox {
            background-color: white;
            font-family: Arial;
            font-size: 15px;
        }
        QPushButton {
            background-color: #243878;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 8px 16px;
            font-size: 15px;
        }
        QPushButton:hover {
            background-color: #f33e6a;
        }
    """)
    return msg.exec()


class MenuItemDialog(QDialog):
    def __init__(self, parent=None, menu_item=None):
        super().__init__(parent)
        self.setWindowTitle("Menu Item Details")
        self.setMinimumSize(350, 150)
        self.menu_item = menu_item
        self.initUI()

    def initUI(self):
        self.layout = QFormLayout(self)
        self.layout.setContentsMargins(15, 15, 15, 15)
        self.layout.setSpacing(15)

        # Use a smaller pill-style for inputs and radio buttons.
        edit_style = """
            QLineEdit, QRadioButton {
                background-color: white;
                border: 1px solid #ccc;
                border-radius: 15px;
                padding: 5px 10px;
                font-size: 14px;
                min-height: 30px;
            }
            QRadioButton {
                padding: 5px 10px;
            }
        """
        # Replace drop-down with radio buttons for category.
        self.category_group = QButtonGroup(self)
        self.radio_entree = QRadioButton("ENTREE")
        self.radio_entree.setStyleSheet(edit_style)
        self.radio_main = QRadioButton("MAIN")
        self.radio_main.setStyleSheet(edit_style)
        self.radio_dessert = QRadioButton("DESSERT")
        self.radio_dessert.setStyleSheet(edit_style)
        self.category_group.addButton(self.radio_entree)
        self.category_group.addButton(self.radio_main)
        self.category_group.addButton(self.radio_dessert)
        if self.menu_item:
            cat = self.menu_item["category"].upper()
            if cat == "MAIN":
                self.radio_main.setChecked(True)
            elif cat == "DESSERT":
                self.radio_dessert.setChecked(True)
            else:
                self.radio_entree.setChecked(True)
        else:
            self.radio_entree.setChecked(True)
        radio_layout = QHBoxLayout()
        radio_layout.addWidget(self.radio_entree)
        radio_layout.addWidget(self.radio_main)
        radio_layout.addWidget(self.radio_dessert)
        self.layout.addRow("Category:", radio_layout)

        self.name_edit = QLineEdit(self)
        self.name_edit.setStyleSheet(edit_style)
        if self.menu_item:
            self.name_edit.setText(self.menu_item["name"])
        self.layout.addRow("Name:", self.name_edit)

        # Save button: pill-shaped.
        self.btn_save = QPushButton("Save", self)
        self.btn_save.setStyleSheet("""
            QPushButton {
                background-color: white;
                color: #333333;
                border: 1px solid #ccc;
                border-radius: 25px;
                padding: 10px 20px;
                font-size: 16px;
            }
            QPushButton:hover {
                background-color: #90EE90;
            }
        """)
        self.btn_save.clicked.connect(self.accept)
        self.layout.addRow(self.btn_save)

    def accept(self):
        if not self.name_edit.text().strip():
            QMessageBox.warning(self, "Validation Error", "Name cannot be empty.")
            return
        super().accept()

    def get_data(self):
        if self.radio_main.isChecked():
            category = "MAIN"
        elif self.radio_dessert.isChecked():
            category = "DESSERT"
        else:
            category = "ENTREE"
        return {
            "category": category,
            "name": self.name_edit.text()
        }


class MenuManager(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Menu Manager")
        self.initUI()
        self.load_menu_items()
        self.shortcut_add = QShortcut(QKeySequence("Ctrl+N"), self)
        self.shortcut_add.activated.connect(self.add_menu_item)
        self.shortcut_delete = QShortcut(QKeySequence(Qt.Key.Key_Delete), self)
        self.shortcut_delete.activated.connect(self.delete_selected_item)

    def initUI(self):
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(15, 15, 15, 15)
        self.layout.setSpacing(15)

        # Title Label
        title_label = QLabel("Menu Items")
        title_font = QFont("Arial", 32, QFont.Weight.Bold)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.layout.addWidget(title_label)

        # Spacer: 60px below title.
        spacer = QSpacerItem(0, 60, QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Fixed)
        self.layout.addItem(spacer)

        # Control Row: sort buttons on left and add button on right.
        control_layout = QHBoxLayout()
        self.btn_sort_name = QPushButton("Sort by Name", self)
        self.btn_sort_name.setStyleSheet("""
            QPushButton {
                background-color: #243878;
                color: white;
                border: none;
                border-radius: 25px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton:hover {
                background-color: #f33e6a;
            }
        """)
        self.btn_sort_name.clicked.connect(self.sort_by_name)
        control_layout.addWidget(self.btn_sort_name)

        self.btn_sort_category = QPushButton("Sort by Category", self)
        self.btn_sort_category.setStyleSheet("""
            QPushButton {
                background-color: #243878;
                color: white;
                border: none;
                border-radius: 25px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton:hover {
                background-color: #f33e6a;
            }
        """)
        self.btn_sort_category.clicked.connect(self.sort_by_category)
        control_layout.addWidget(self.btn_sort_category)

        control_layout.addStretch()  # Push sort buttons to the left.

        self.btn_add = QPushButton("Add New Menu Item", self)
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
        self.btn_add.clicked.connect(self.add_menu_item)
        control_layout.addWidget(self.btn_add)

        self.layout.addLayout(control_layout)

        # Table Setup: 3 columns: Category, Name, Action.
        self.table = QTableWidget(self)
        self.table.setColumnCount(3)
        self.table.setHorizontalHeaderLabels(["Category", "Name", "Action"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.verticalHeader().setDefaultSectionSize(50)
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
                color: #333333;
                font-weight: bold;
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

        # Real-time counter label at the bottom.
        self.counter_label = QLabel("")
        self.counter_label.setStyleSheet("font-size: 10px; color: #666666;")
        self.layout.addWidget(self.counter_label, alignment=Qt.AlignmentFlag.AlignCenter)

    def load_menu_items(self):
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM menu_items")
        items = cursor.fetchall()
        conn.close()

        # Sort items by category order: ENTREE, MAIN, DESSERT.
        order = {"ENTREE": 1, "MAIN": 2, "DESSERT": 3}
        sorted_items = sorted(items, key=lambda x: order.get(x["category"].upper(), 99))

        self.table.setRowCount(0)
        for item in sorted_items:
            row = self.table.rowCount()
            self.table.insertRow(row)
            # Category Column
            category_item = QTableWidgetItem(item["category"])
            category_item.setFont(QFont("Arial", 15, QFont.Weight.Bold))
            self.table.setItem(row, 0, category_item)
            # Name Column (Always uppercase)
            name_item = QTableWidgetItem(item["name"].upper())
            name_item.setFont(QFont("Arial", 15, QFont.Weight.Bold))
            # Store the item ID for keyboard deletion.
            name_item.setData(Qt.ItemDataRole.UserRole, item["id"])
            self.table.setItem(row, 1, name_item)

            # Action Column: Two connected rectangular buttons.
            action_widget = QWidget()
            action_layout = QHBoxLayout(action_widget)
            action_layout.setContentsMargins(0, 0, 0, 0)
            action_layout.setSpacing(0)

            btn_edit = QPushButton("✎", action_widget)
            btn_edit.setToolTip("Edit Menu Item")
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
            btn_edit.clicked.connect(lambda checked, item_id=item["id"]: self.edit_menu_item_by_id(item_id))

            btn_delete = QPushButton("🗑", action_widget)
            btn_delete.setToolTip("Delete Menu Item")
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
            btn_delete.clicked.connect(lambda checked, item_id=item["id"]: self.delete_menu_item_by_id(item_id))

            action_layout.addWidget(btn_edit)
            action_layout.addWidget(btn_delete)
            self.table.setCellWidget(row, 2, action_widget)
        self.update_counter()

    def update_counter(self):
        entree = main = dessert = 0
        for row in range(self.table.rowCount()):
            cat = self.table.item(row, 0).text().upper()
            if cat == "ENTREE":
                entree += 1
            elif cat == "MAIN":
                main += 1
            elif cat == "DESSERT":
                dessert += 1
        self.counter_label.setText(f"ENTREE: {entree} | MAIN: {main} | DESSERT: {dessert}")

    def sort_by_name(self):
        self.table.sortItems(1, Qt.SortOrder.AscendingOrder)

    def sort_by_category(self):
        self.table.sortItems(0, Qt.SortOrder.AscendingOrder)
        # For custom order, you could re-load sorted data from the database.

    def add_menu_item(self):
        dialog = MenuItemDialog(self)
        if dialog.exec():
            data = dialog.get_data()
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO menu_items (category, name) VALUES (?, ?)",
                (data["category"], data["name"])
            )
            conn.commit()
            conn.close()
            self.load_menu_items()

    def edit_menu_item_by_id(self, item_id):
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM menu_items WHERE id = ?", (item_id,))
        menu_item = cursor.fetchone()
        conn.close()
        if menu_item:
            dialog = MenuItemDialog(self, menu_item)
            if dialog.exec():
                data = dialog.get_data()
                conn = database.get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE menu_items SET category=?, name=? WHERE id=?",
                    (data["category"], data["name"], item_id)
                )
                conn.commit()
                conn.close()
                self.load_menu_items()

    def delete_menu_item_by_id(self, item_id):
        reply = show_styled_confirmation(self, "Delete Menu Item", "Are you sure you want to delete this menu item?")
        if reply == QMessageBox.StandardButton.Yes:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
            conn.commit()
            conn.close()
            self.load_menu_items()

    def delete_selected_item(self):
        selected = self.table.selectedItems()
        if selected:
            row = selected[0].row()
            # Retrieve the ID from the Name column's UserRole.
            item = self.table.item(row, 1)
            if item:
                item_id = item.data(Qt.ItemDataRole.UserRole)
                if item_id:
                    self.delete_menu_item_by_id(item_id)

    def keyPressEvent(self, event):
        if event.matches(QKeySequence.StandardKey.New):
            self.add_menu_item()
        elif event.key() in (Qt.Key.Key_Delete, Qt.Key.Key_Backspace):
            self.delete_selected_item()
        else:
            super().keyPressEvent(event)


if __name__ == '__main__':
    import sys
    from PyQt6.QtWidgets import QApplication

    app = QApplication(sys.argv)
    window = MenuManager()
    window.show()
    sys.exit(app.exec())
