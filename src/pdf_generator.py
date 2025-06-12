import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from datetime import datetime

def generate_order_pdf(order_data, output_pdf_path):
    """
    Generates a PDF invoice with:
      - A rectangle behind the logo at the top-left (with 15-point padding around the logo),
        using color #1b1a24.
      - The logo (logo.png) placed on top of that rectangle (sized 3.0" x 2.0").
      - Customer name in uppercase, skipping empty fields.
      - Bill calculation based on total adults/kids using the provided pricing.
      - The current date/time (instead of the order's date) is used.
      - Under the total, the GST amount (10%) is displayed on the same line and then an extra line below
        stating “Includes a GST of $X”.
      - "Make all checks payable..." and "THANK YOU FOR YOUR BUSINESS!" are centered at the bottom.

    output_pdf_path must be a full file path ending with ".pdf".
    """
    c = canvas.Canvas(output_pdf_path, pagesize=letter)
    width, height = letter

    # --- Draw rectangle behind the logo ---
    logo_path = os.path.join(os.path.dirname(__file__), "logo.png")
    # Define logo size (twice the original)
    logo_width = 3.0 * inch
    logo_height = 2.0 * inch
    logo_x = 0.75 * inch
    logo_y = height - 1.75 * inch  # Position logo 1.75 inches from top

    # Use padding: 15 points (15/72 inch)
    padding = 7 / 77 * inch
    rect_x = logo_x - padding
    rect_y = logo_y - padding
    rect_width = logo_width + 2 * padding
    rect_height = logo_height + 2 * padding

    c.setFillColor(HexColor("#1b1a24"))
    c.rect(rect_x, rect_y, rect_width, rect_height, fill=1, stroke=0)

    # --- Place the logo on top of the rectangle ---
    try:
        if os.path.exists(logo_path):
            c.drawImage(
                logo_path,
                logo_x,
                logo_y,
                width=logo_width,
                height=logo_height,
                preserveAspectRatio=True,
                mask='auto'
            )
    except Exception as e:
        print("Could not load logo:", e)

    # --- "INVOICE" text at top-right ---
    c.setFont("Times-BoldItalic", 22)
    c.setFillColor(HexColor("#000000"))
    c.drawRightString(width - 0.75 * inch, height - 1.0 * inch, "INVOICE")

    # --- Business info below the logo ---
    c.setFont("Helvetica-Oblique", 10)
    business_lines = [
        "Shop 3 50 Murray St",
        "Pyrmont 2009, Sydney",
        "02 9212 7512",
        "restaurant@thelittlesnail.com.au"
    ]
    text_x = 0.75 * inch
    text_y = logo_y - 0.4 * inch
    for line in business_lines:
        c.drawString(text_x, text_y, line)
        text_y -= 12

    # --- "BILL TO" section ---
    bill_top = height - 3.0 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(0.75 * inch, bill_top, "BILL TO:")

    cust_name = (order_data.get("customer_name") or "UNKNOWN").upper()
    cust_phone = order_data.get("customer_phone", "")
    cust_other = order_data.get("customer_other", "")
    c.setFont("Helvetica", 10)
    line_y = bill_top - 16
    c.drawString(0.75 * inch, line_y, cust_name)
    line_y -= 14
    if cust_phone.strip():
        c.drawString(0.75 * inch, line_y, cust_phone.strip())
        line_y -= 14
    if cust_other.strip():
        c.drawString(0.75 * inch, line_y, cust_other.strip())
        line_y -= 14

    # --- Invoice number & current date/time at top-right ---
    c.setFont("Helvetica", 10)
    invoice_num = order_data.get("invoice_number", "INV-XXXX")
    c.drawRightString(width - 0.75 * inch, bill_top, f"Invoice#: {invoice_num}")
    current_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.drawRightString(width - 0.75 * inch, bill_top - 14, f"Date: {current_dt}")

    # --- Bill Calculation ---
    total_adults = order_data.get("adults", 0)
    total_kids = order_data.get("kids", 0)
    adult_price = order_data.get("adult_price", 0.0)
    kid_price = order_data.get("kid_price", 0.0)
    calculated_total = (total_adults * adult_price) + (total_kids * kid_price)
    gst_amount = calculated_total * 0.1  # 10% GST

    # --- Items table ---
    table_top = bill_top - 60
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.75 * inch, table_top, "Items")
    c.drawString(2.75 * inch, table_top, "Rate (GST inc.)")
    c.drawString(4.0 * inch, table_top, "     Qty")
    c.drawString(5.0 * inch, table_top, "     Total")

    c.setFont("Helvetica", 10)
    row_height = 16
    y_cursor = table_top - row_height

    # Adults row
    c.drawString(0.75 * inch, y_cursor, "Adults")
    c.drawRightString(3.7 * inch, y_cursor, f"${adult_price:.2f}")
    c.drawRightString(4.7 * inch, y_cursor, str(total_adults))
    c.drawRightString(5.7 * inch, y_cursor, f"${total_adults * adult_price:.2f}")

    y_cursor -= row_height
    # Kids row
    c.drawString(0.75 * inch, y_cursor, "Kids")
    c.drawRightString(3.7 * inch, y_cursor, f"${kid_price:.2f}")
    c.drawRightString(4.7 * inch, y_cursor, str(total_kids))
    c.drawRightString(5.7 * inch, y_cursor, f"${total_kids * kid_price:.2f}")

    y_cursor -= row_height
    c.setFont("Helvetica-Bold", 10)
    total_line = f"${calculated_total:.2f}"
    c.drawString(0.75 * inch, y_cursor, "TOTAL")
    c.drawRightString(5.7 * inch, y_cursor, total_line)
    # Draw GST information in a new line below TOTAL
    y_cursor -= row_height
    gst_line = f"(Includes a GST of ${gst_amount:.2f})"
    c.drawRightString(5.7 * inch, y_cursor, gst_line)

    # --- Footer: Centered payment instructions and thank-you message ---
    c.setFont("Times-Bold", 12)
    center_text_y = 1.5 * inch
    c.drawCentredString(width / 2, center_text_y, "Make all checks payable to:")
    c.drawCentredString(width / 2, center_text_y - 14, "The Little Snail Restaurant")
    c.setFont("Times-BoldItalic", 14)
    c.drawCentredString(width / 2, center_text_y - 40, "THANK YOU FOR YOUR BUSINESS!")

    c.showPage()
    c.save()
    return output_pdf_path

if __name__ == "__main__":
    sample_data = {
        "customer_name": "john doe",
        "customer_phone": "0400 123 456",
        "invoice_number": "INV-01234",
        "date": "2025-03-31",  # Not used in header; current datetime is used instead.
        "adults": 3,
        "kids": 2,
        "adult_price": 50.0,
        "kid_price": 20.0
    }
    output_file = os.path.join(os.getcwd(), "sample_invoice.pdf")
    final_path = generate_order_pdf(sample_data, output_file)
    print("Invoice generated at:", final_path)
