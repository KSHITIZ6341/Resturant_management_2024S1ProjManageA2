# ui_main.py
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QStackedWidget, QPushButton
from PyQt6.QtCore import QPropertyAnimation, QEasingCurve
from PyQt6.QtGui import QFont

# Global colour definitions
BACKGROUND_COLOR = "#f5f1d1"  # Light yellow (for overall background)
NAVBAR_COLOR = "#7ea2d7"  # Navigation bar background
ACCENT_COLOR2 = "#f33e6a"  # Pinkish black (hover color)


class Sidebar(QWidget):
    def __init__(self, main_window, nav_items):
        super().__init__()
        self.main_window = main_window
        self.nav_items = nav_items
        self.expanded_width = 200
        self.collapsed_width = 40
        self.is_expanded = True
        self.initUI()

    def initUI(self):
        # Set the sidebar's background color.
        self.setStyleSheet(f"background-color: {NAVBAR_COLOR};")

        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(10, 10, 10, 10)
        self.layout.setSpacing(10)

        # Bold font for navigation text.
        bold_font = QFont()
        bold_font.setBold(True)

        # Create a toggle button with a hamburger icon.
        # This button is visible only when the sidebar is collapsed.
        self.toggle_button = QPushButton("☰")
        self.toggle_button.setFont(bold_font)
        self.toggle_button.setStyleSheet(f"""
            QPushButton {{
                background-color: {NAVBAR_COLOR};
                color: white;
                border: none;
                padding: 5px;
            }}
            QPushButton:hover {{
                background-color: {ACCENT_COLOR2};
                color: white;
            }}
        """)
        # Clicking the toggle icon expands the sidebar.
        self.toggle_button.clicked.connect(self.expand)
        # Initially hidden since the sidebar starts expanded.
        self.toggle_button.setVisible(False)
        self.layout.addWidget(self.toggle_button)

        self.buttons = {}
        # Create navigation buttons styled as seamless text slabs.
        for name, widget in self.nav_items.items():
            btn = QPushButton(name)
            btn.setFont(bold_font)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: transparent;
                    color: white;
                    border: none;
                    padding: 10px;
                    text-align: left;
                }}
                QPushButton:hover {{
                    background-color: {ACCENT_COLOR2};
                    color: white;
                }}
            """)
            # Clicking a nav button switches the page instantly.
            btn.clicked.connect(lambda checked, w=widget: self.main_window.switch_page(w))
            self.layout.addWidget(btn)
            self.buttons[name] = btn

        self.layout.addStretch(1)
        # Set the sidebar's initial width.
        self.setMaximumWidth(self.expanded_width)

    def collapse(self):
        if not self.is_expanded:
            return
        animation = QPropertyAnimation(self, b"maximumWidth")
        animation.setDuration(300)
        animation.setEasingCurve(QEasingCurve.Type.InOutQuad)
        animation.setStartValue(self.expanded_width)
        animation.setEndValue(self.collapsed_width)
        animation.start()
        self._animation = animation  # Keep reference to avoid garbage collection.
        self.is_expanded = False
        # Hide navigation buttons and show toggle icon.
        for btn in self.buttons.values():
            btn.setVisible(False)
        self.toggle_button.setVisible(True)

    def expand(self):
        if self.is_expanded:
            return
        animation = QPropertyAnimation(self, b"maximumWidth")
        animation.setDuration(300)
        animation.setEasingCurve(QEasingCurve.Type.InOutQuad)
        animation.setStartValue(self.collapsed_width)
        animation.setEndValue(self.expanded_width)
        animation.start()
        self._animation = animation  # Keep reference to avoid garbage collection.
        self.is_expanded = True
        # Show navigation buttons and hide toggle icon.
        for btn in self.buttons.values():
            btn.setVisible(True)
        self.toggle_button.setVisible(False)


class MainUI(QWidget):
    def __init__(self, main_window, nav_items, default_page=None):
        super().__init__()
        self.main_window = main_window
        self.nav_items = nav_items
        self.initUI(default_page)

    def initUI(self, default_page):
        # Horizontal layout: Sidebar on left, pages on right.
        self.layout = QHBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)

        self.sidebar = Sidebar(self.main_window, self.nav_items)
        self.layout.addWidget(self.sidebar)

        self.pages = QStackedWidget()
        self.layout.addWidget(self.pages, 1)

        # Add each page widget to the stacked widget.
        for widget in self.nav_items.values():
            self.pages.addWidget(widget)

        # Set the default page if provided.
        if default_page and default_page in self.nav_items:
            self.pages.setCurrentWidget(self.nav_items[default_page])
        else:
            self.pages.setCurrentIndex(0)

    def switch_page(self, new_widget):
        # Switch page instantly.
        self.pages.setCurrentWidget(new_widget)
