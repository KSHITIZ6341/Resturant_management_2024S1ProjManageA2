import sqlite3
import getpass

# This script configures the email settings in the database.

DB_NAME = 'src/tour_group.db'

def configure_email():
    print("--- Email Sender Configuration ---")
    sender_email = input("Enter the Gmail address you want to send from: ")
    print("\nEnter your Google App Password. This is NOT your regular password.")
    print("See: https://support.google.com/accounts/answer/185833")
    google_app_password = getpass.getpass("Enter App Password: ")

    if not (sender_email and google_app_password):
        print("\nEmail and App Password cannot be empty. Aborting.")
        return

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Check if settings already exist
    cursor.execute("SELECT id FROM settings WHERE id = 1")
    exists = cursor.fetchone()

    if exists:
        print("\nUpdating existing email settings...")
        cursor.execute("""
            UPDATE settings 
            SET sender_email = ?, google_app_password = ?
            WHERE id = 1
        """, (sender_email, google_app_password))
    else:
        print("\nInserting new email settings...")
        cursor.execute("""
            INSERT INTO settings (id, sender_email, google_app_password) 
            VALUES (1, ?, ?)
        """, (sender_email, google_app_password))
    
    conn.commit()
    conn.close()

    print("\nConfiguration saved successfully!")
    print("The application is now ready to send emails.")

if __name__ == '__main__':
    configure_email()
