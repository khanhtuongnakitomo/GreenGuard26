import json
import hmac
import hashlib
import string
import random
import os
import numpy as np
from pathlib import Path

import qrcode
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)
QR_SECRET = os.getenv("QR_SECRET")
if not QR_SECRET:
    print("WARNING: QR_SECRET not found in .env, falling back to empty string for dev")
    QR_SECRET = ""

MACHINE_CODE = os.getenv("MACHINE_CODE", "0001")


def generate_claim_token():
    chars = string.ascii_letters + string.digits
    random_str = "".join(random.choices(chars, k=21))
    return f"GP-CLAIM-{random_str}"


def build_signed_payload(items, total_points, expires_at_str, machine_code=None):
    """
    Build QR payload signed with QR_SECRET (must match app/backend).
    Includes machineCode so the app can claim even if machine POST was missed.
    """
    total_items = sum(item["quantity"] for item in items)

    # Key order is part of the signature — do not reorder
    payload_data = {
        "claimToken": generate_claim_token(),
        "totalItems": total_items,
        "totalPoints": total_points,
        "items": items,
        "expiresAt": expires_at_str,
        "machineCode": machine_code or MACHINE_CODE,
    }

    payload_json_string = json.dumps(payload_data, separators=(",", ":"))

    signature = hmac.new(
        QR_SECRET.encode("utf-8"),
        payload_json_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload_data["signature"] = signature
    final_qr_string = json.dumps(payload_data, separators=(",", ":"))

    return final_qr_string, payload_data["claimToken"]


def generate_qr_image(payload_string, box_size=10, border=4):
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload_string)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img_rgb = img.convert("RGB")
    cv_img = np.array(img_rgb)
    cv_img = cv_img[:, :, ::-1].copy()  # RGB to BGR

    return cv_img
