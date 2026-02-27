from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, QTextEdit, QPushButton, QMessageBox, QDialog, QDialogButtonBox, QLabel
)
from PyQt6.QtCore import Qt
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import database


class EmailSettingsDialog(QDialog):
    def __init__(self, parent=None, sender_email="", app_password=""):
        super().__init__(parent)
        self.setWindowTitle("Change Email Settings")
        self.sender_email = sender_email
        self.app_password = app_password
        self.initUI()

    def initUI(self):
        layout = QFormLayout(self)

        # Styled input for sender email (squircle and white)
        self.sender_email_edit = QLineEdit(self)
        self.sender_email_edit.setText(self.sender_email)
        self.sender_email_edit.setStyleSheet("""
            QLineEdit {
                background-color: white;
                border: 2px solid #ccc;
                border-radius: 15px;
                padding: 8px 16px;
                font-size: 16px;
            }
        """)
        layout.addRow("Sender Email:", self.sender_email_edit)

        # Styled input for app password with echo mode
        self.app_password_edit = QLineEdit(self)
        self.app_password_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.app_password_edit.setText(self.app_password)
        self.app_password_edit.setStyleSheet("""
            QLineEdit {
                background-color: white;
                border: 2px solid #ccc;
                border-radius: 15px;
                padding: 8px 16px;
                font-size: 16px;
            }
        """)
        layout.addRow("Google App Password:", self.app_password_edit)

        # Dialog buttons
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel, parent=self)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def get_settings(self):
        return self.sender_email_edit.text().strip(), self.app_password_edit.text().strip()


class EmailManager(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.sender_email = ""
        self.app_password = ""
        self.initUI()
        self.load_settings()

    def initUI(self):
        # Global styling for input boxes and buttons
        self.setStyleSheet("""
            QLineEdit, QTextEdit {
                background-color: white;
                border: 2px solid #ccc;
                border-radius: 15px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton {
                background-color: #243878;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton:hover {
                background-color: #f33e6a;
            }
            QLabel.title {
                font-size: 32px;
                font-weight: bold;
            }
            QLabel.formLabel {
                font-size: 18px;
            }
        """)

        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(20, 20, 20, 20)
        self.layout.setSpacing(15)

        # Header area: Title and Change Email Settings button
        header_layout = QHBoxLayout()
        title_label = QLabel("Email Settings", self)
        title_label.setObjectName("titleLabel")
        title_label.setProperty("class", "title")
        title_label.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        header_layout.addWidget(title_label)

        # Spacer to push the button to the right
        header_layout.addStretch()

        self.change_settings_button = QPushButton("Change Email Settings ⚠", self)
        self.change_settings_button.setStyleSheet("""
            QPushButton {
                background-color: grey;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                font-size: 16px;
            }
            QPushButton:hover {
                background-color: #888888;
            }
        """)
        self.change_settings_button.clicked.connect(self.change_email_settings)
        header_layout.addWidget(self.change_settings_button)
        self.layout.addLayout(header_layout)
        # Add a 20px vertical space below the header
        self.layout.addSpacing(20)

        # Form layout for email templates
        form_layout = QFormLayout()
        form_layout.setSpacing(10)

        # Email Subject Template Label and input (wider)
        subject_label = QLabel("Email Subject Template:", self)
        subject_label.setProperty("class", "formLabel")
        self.email_subject_edit = QLineEdit(self)
        self.email_subject_edit.setFixedWidth(500)
        form_layout.addRow(subject_label, self.email_subject_edit)

        # Email Body Template Label and input (wider and taller)
        body_label = QLabel("Email Body Template:", self)
        body_label.setProperty("class", "formLabel")
        self.email_body_edit = QTextEdit(self)
        self.email_body_edit.setFixedWidth(500)
        self.email_body_edit.setFixedHeight(150)  # Taller than its width
        form_layout.addRow(body_label, self.email_body_edit)

        self.layout.addLayout(form_layout)

        # Action buttons: Save Settings and Test Email with squircle design
        action_layout = QHBoxLayout()
        action_layout.addStretch()
        self.save_button = QPushButton("Save Settings", self)
        self.save_button.clicked.connect(self.save_settings)
        action_layout.addWidget(self.save_button)
        self.test_button = QPushButton("Test Email", self)
        self.test_button.clicked.connect(self.test_email)
        action_layout.addWidget(self.test_button)
        action_layout.addStretch()
        self.layout.addLayout(action_layout)

    def load_settings(self):
        """
        Load email settings from the database's settings table.
        If no record exists, create one with default values.
        """
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM settings WHERE id = 1")
        row = cursor.fetchone()
        conn.close()
        if row:
            self.sender_email = row["sender_email"] if row["sender_email"] else ""
            self.app_password = row["google_app_password"] if row["google_app_password"] else ""
            self.email_subject_edit.setText(row["email_subject_template"] if row["email_subject_template"] else "[order number] invoice [invoice number]")
            self.email_body_edit.setPlainText(row["email_body_template"] if row["email_body_template"] else "Thank you for bla bla bla, and below is your invoice")
        else:
            # Insert default settings if no record exists
            self.sender_email = ""
            self.app_password = ""
            self.email_subject_edit.setText("[order number] invoice [invoice number]")
            self.email_body_edit.setPlainText("Thank you for bla bla bla, and below is your invoice")
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO settings (id, sender_email, google_app_password, email_subject_template, email_body_template)
                VALUES (1, '', '', '[order number] invoice [invoice number]', 'Thank you for bla bla bla, and below is your invoice')
            """)
            conn.commit()
            conn.close()

    def change_email_settings(self):
        """
        Open a dialog to change the sender's email and app password.
        """
        dialog = EmailSettingsDialog(self, self.sender_email, self.app_password)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            new_email, new_password = dialog.get_settings()
            self.sender_email = new_email
            self.app_password = new_password

    def save_settings(self):
        """
        Save the email settings to the database.
        """
        email_subject = self.email_subject_edit.text().strip()
        email_body = self.email_body_edit.toPlainText().strip()

        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE settings SET sender_email = ?, google_app_password = ?, email_subject_template = ?, email_body_template = ?
            WHERE id = 1
        """, (self.sender_email, self.app_password, email_subject, email_body))
        conn.commit()
        conn.close()
        QMessageBox.information(self, "Settings Saved", "Email settings have been saved successfully.")

    def test_email(self):
        """
        Send a test email using the provided settings to verify connectivity.
        The test email is sent to 'your email' and is marked as important.
        """
        if not self.sender_email or not self.app_password:
            QMessageBox.warning(self, "Missing Information", "Please provide both sender email and app password by clicking 'Change Email Settings'.")
            return

        # Create a simple test email message
        msg = MIMEMultipart()
        msg['From'] = self.sender_email
        msg['To'] = "test email"
        msg['Subject'] = "Test Email from Tour Group Management"
        # Mark email as important
        msg['Importance'] = "High"
        msg['X-Priority'] = "1"
        body = "This is a test email to verify your email settings. This email is marked as important."
        msg.attach(MIMEText(body, 'plain'))

        try:
            # Connect to Gmail SMTP using TLS on port 587
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(self.sender_email, self.app_password)
            server.send_message(msg)
            server.quit()
            QMessageBox.information(self, "Email Sent", "Test email sent successfully to -your email-!")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to send test email:\n{str(e)}")


if __name__ == '__main__':
    import sys
    from PyQt6.QtWidgets import QApplication

    app = QApplication(sys.argv)
    window = EmailManager()
    window.show()
    sys.exit(app.exec())
