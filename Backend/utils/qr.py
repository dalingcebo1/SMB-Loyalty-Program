import base64
from io import BytesIO
import qrcode

def generate_qr_code(data: str) -> dict:
    """
    Generate a QR code PNG as a base64 string, encoding the provided data (e.g., payment reference or order id).
    The QR code, when scanned, will return the original data string.
    Returns a dict with both the encoded data and the base64 image.
    """
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(data)  # data should be the payment reference or order id
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_bytes = buffered.getvalue()
    img_base64 = base64.b64encode(img_bytes).decode("utf-8")
    return {
        "qr_data": data,         # This is what will be encoded in the QR code
        "qr_code_base64": img_base64  # This is the image to display
    }
