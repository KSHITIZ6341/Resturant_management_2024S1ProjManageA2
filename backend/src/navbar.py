from PyQt6.QtWidgets import QWidget, QHBoxLayout, QPushButton
from PyQt6.QtCore import Qt

# Color definitions for consistency
NAVBAR_COLOR = "#243878"
ACCENT_COLOR = "#f33e6a"


class NavBar(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()

    def setup_ui(self):
        self.setStyleSheet(f"background-color: {NAVBAR_COLOR};")
        layout = QHBoxLayout(self)
        layout.setContentsMargins(20, 10, 20, 10)
        layout.setSpacing(30)
        layout.setAlignment(Qt.AlignmentFlag.AlignLeft)

        # Example buttons
        buttons = {
            "Home": self.on_home,
            "About": self.on_about,
            "Contact": self.on_contact
        }
        for label, callback in buttons.items():
            btn = QPushButton(label)
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: transparent;
                    color: white;
                    border: none;
                    font-size: 16px;
                }}
                QPushButton:hover {{
                    color: {ACCENT_COLOR};
                }}
            """)
            btn.clicked.connect(callback)
            layout.addWidget(btn)

    def on_home(self):
        print("Home clicked!")

    def on_about(self):
        print("About clicked!")

    def on_contact(self):
        print("Contact clicked!")
