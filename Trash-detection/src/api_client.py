import os
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000/api").rstrip("/")
MACHINE_CODE = os.getenv("MACHINE_CODE", "0001")
MACHINE_API_KEY = os.getenv("MACHINE_API_KEY", "machine-demo-key")


def report_session(claim_token, items, retries=5):
    """
    POST the session to the backend so the mobile app can claim it.
    Must succeed before showing QR (demo_qr / session enforce this).
    """
    if not MACHINE_API_KEY:
        msg = "MACHINE_API_KEY is empty — set it in Trash-detection/.env"
        print(f"Error reporting session to backend: {msg}")
        return False, msg

    url = f"{BACKEND_URL}/contributions"
    headers = {
        "Content-Type": "application/json",
        "x-machine-api-key": MACHINE_API_KEY,
    }
    payload = {
        "machineCode": MACHINE_CODE,
        "claimToken": claim_token,
        "items": items,
    }

    print(f"Registering session -> {url} machine={MACHINE_CODE} token={claim_token}")

    last_error = None
    for attempt in range(retries):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            session_code = data.get("session", {}).get("sessionCode", "ok")
            print(f"Session registered (attempt {attempt + 1}): {session_code}")
            return True, data
        except requests.exceptions.RequestException as e:
            last_error = e
            body = ""
            if hasattr(e, "response") and e.response is not None:
                try:
                    body = e.response.text
                except Exception:
                    pass
            print(f"Error reporting session (attempt {attempt + 1}/{retries}): {e} {body}")
            if attempt < retries - 1:
                time.sleep(0.6)

    return False, str(last_error)


def send_heartbeat():
    """Optional machine heartbeat ping."""
    url = f"{BACKEND_URL}/machines/heartbeat"
    headers = {
        "Content-Type": "application/json",
        "x-machine-api-key": MACHINE_API_KEY,
    }
    payload = {"machineCode": MACHINE_CODE}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Heartbeat failed: {e}")
        return False
