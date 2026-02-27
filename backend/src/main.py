import sys
import os
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QStackedWidget, QPushButton, QSizePolicy, QGraphicsBlurEffect, QTabWidget
)
from PyQt6.QtCore import Qt, QEvent, QRect, QPropertyAnimation, QEasingCurve
from PyQt6.QtGui import QFont

import customer_manager
import menu_manager
import order_manager
import invoice_manager  # Contains the InvoiceManager class
import email_manager

# Global color definitions for consistency
NAVBAR_COLOR = "#243878"  # Sidebar and toggle button background
CONTENT_BG = "#f5f1d1"  # Main content background
ACCENT_COLOR = "#f33e6a"  # Hover color for buttons


# --- Settings Page ---
class SettingsPage(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        self.tabWidget = QTabWidget(self)
        layout.addWidget(self.tabWidget)
        # Add the Email Settings tab
        self.email_settings = email_manager.EmailManager()
        self.tabWidget.addTab(self.email_settings, "Email Settings")


# --- Sidebar Widget (Navigation Bar) ---
class Sidebar(QWidget):
    def __init__(self, main_window, nav_pages):
        super().__init__(main_window)
        self.main_window = main_window  # Reference to MainWindow
        self.nav_pages = nav_pages  # Dictionary mapping labels to page widgets
        self.expanded_width = 200  # Expanded width of sidebar
        self.collapsed_width = 0  # Collapsed width (hidden)
        self.is_expanded = False  # Start in collapsed state
        self._animation = None  # Placeholder for animations
        self.setup_ui()
        self.installEventFilter(self)

    def setup_ui(self):
        # Set a refined gradient background
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet("""
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 rgba(36,56,120,180), stop:1 rgba(36,56,120,120));
        """)
        # Adjust sidebar height to match its parent
        parent_height = self.parent().height() if self.parent() is not None else 0
        self.setGeometry(0, 0, self.collapsed_width, parent_height)

        # Layout for navigation buttons
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        bold_font = QFont()
        bold_font.setBold(True)
        self.nav_buttons = {}

        # Create a button for each navigation page
        for label, page in self.nav_pages.items():
            btn = QPushButton(label, self)
            btn.setFont(bold_font)
            btn.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
            btn.setMinimumHeight(40)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: transparent;
                    color: white;
                    border: none;
                    padding: 10px;
                    text-align: left;
                }}
                QPushButton:hover {{
                    background-color: {ACCENT_COLOR};
                }}
            """)
            # Use lambda to pass the correct page to switch_page
            btn.clicked.connect(lambda checked, p=page: self.main_window.switch_page(p))
            layout.addWidget(btn)
            self.nav_buttons[label] = btn

        layout.addStretch()

    def eventFilter(self, source, event):
        # Collapse the sidebar if the mouse leaves its area
        if event.type() == QEvent.Type.Leave:
            self.collapse()
        return super().eventFilter(source, event)

    def animate_width(self, start, end):
        # Animate the sidebar width for a smooth transition
        parent_height = self.parent().height() if self.parent() is not None else self.height()
        start_rect = QRect(0, 0, start, parent_height)
        end_rect = QRect(0, 0, end, parent_height)
        anim = QPropertyAnimation(self, b"geometry")
        anim.setDuration(300)
        anim.setStartValue(start_rect)
        anim.setEndValue(end_rect)
        anim.setEasingCurve(QEasingCurve.Type.InOutQuad)
        anim.start()
        self._animation = anim  # Keep a reference to avoid garbage collection

    def expand(self):
        if self.is_expanded:
            return
        self.animate_width(self.collapsed_width, self.expanded_width)
        self.is_expanded = True
        self.main_window.toggle_btn.setVisible(False)
        blur = QGraphicsBlurEffect()
        blur.setBlurRadius(5)
        self.main_window.stack.setGraphicsEffect(blur)

    def collapse(self):
        if not self.is_expanded:
            return
        self.animate_width(self.expanded_width, self.collapsed_width)
        self.is_expanded = False
        self.main_window.toggle_btn.setVisible(True)
        self.main_window.stack.setGraphicsEffect(None)

    def toggle(self):
        if self.is_expanded:
            self.collapse()
        else:
            self.expand()


# --- Main Window ---
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Tour Group Management")
        self.resize(900, 1200)

        # Create pages for navigation
        self.pages_dict = {
            "Customers": customer_manager.CustomerManager(),
            "Menu": menu_manager.MenuManager(),
            "Orders": order_manager.OrderManager(),
            "Invoices": invoice_manager.InvoiceManager(),
            "Settings": SettingsPage()
        }

        # Central widget and main layout
        central_widget = QWidget(self)
        central_widget.setStyleSheet(f"background-color: {CONTENT_BG};")
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Main content area with horizontal layout
        self.content_widget = QWidget(self)
        self.content_widget.setStyleSheet(f"background-color: {CONTENT_BG};")
        main_layout.addWidget(self.content_widget, 1)
        content_layout = QHBoxLayout(self.content_widget)
        content_layout.setContentsMargins(0, 0, 0, 0)

        # Stacked widget holding all the pages
        self.stack = QStackedWidget(self.content_widget)
        for page in self.pages_dict.values():
            self.stack.addWidget(page)
        content_layout.addWidget(self.stack)
        # Set the default page to "Orders"
        self.stack.setCurrentWidget(self.pages_dict["Orders"])

        # Create the Sidebar (navbar) overlay
        self.sidebar = Sidebar(self, self.pages_dict)
        self.sidebar.setParent(self.content_widget)
        self.sidebar.move(0, 0)
        self.sidebar.resize(self.sidebar.geometry().width(), self.content_widget.height())

        # Toggle button for the sidebar
        self.toggle_btn = QPushButton("☰", self.content_widget)
        self.toggle_btn.setFixedSize(60, 60)
        toggle_font = QFont()
        toggle_font.setPointSize(28)
        toggle_font.setBold(True)
        self.toggle_btn.setFont(toggle_font)
        self.toggle_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {NAVBAR_COLOR};
                color: white;
                border: none;
                border-radius: 15px;
            }}
            QPushButton:hover {{
                background-color: {ACCENT_COLOR};
            }}
        """)
        self.toggle_btn.clicked.connect(self.sidebar.toggle)
        self.update_toggle_position()

        self.installEventFilter(self)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.update_toggle_position()
        if self.content_widget:
            self.sidebar.setGeometry(0, 0, self.sidebar.geometry().width(), self.content_widget.height())

    def update_toggle_position(self):
        margin = 10
        if self.toggle_btn:
            self.toggle_btn.move(margin, margin)
            self.toggle_btn.setVisible(not self.sidebar.is_expanded)

    def switch_page(self, widget):
        # Switch the current page in the stacked widget
        self.stack.setCurrentWidget(widget)

    def eventFilter(self, source, event):
        # Collapse the sidebar if a click occurs outside its boundaries
        if event.type() == QEvent.Type.MouseButtonPress:
            global_pos = event.globalPosition().toPoint()
            sidebar_rect = QRect(self.sidebar.mapToGlobal(self.sidebar.rect().topLeft()), self.sidebar.size())
            if self.sidebar.is_expanded and not sidebar_rect.contains(global_pos):
                self.sidebar.collapse()
                self.update_toggle_position()
        return super().eventFilter(source, event)


def main():
    app = QApplication(sys.argv)
    # Global style: set default font and background color.
    app.setStyleSheet("QWidget { font-family: Arial; }")
    app.setStyleSheet(app.styleSheet() + f" QWidget {{ background-color: {CONTENT_BG}; }}")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
