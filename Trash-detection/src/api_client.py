import os
import requests
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3003/api")
MACHINE_CODE = os.getenv("MACHINE_CODE", "BK_BIN_01")
MACHINE_API_KEY = os.getenv("MACHINE_API_KEY", "")

def report_session(claim_token, items):
    """
    POST the session to the backend.
    """
    url = f"{BACKEND_URL}/contributions"
    headers = {
        "Content-Type": "application/json",
        "x-machine-api-key": MACHINE_API_KEY
    }
    payload = {
        "machineCode": MACHINE_CODE,
        "claimToken": claim_token,
        "items": items
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        return True, response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error reporting session to backend: {e}")
        return False, str(e)

def send_heartbeat():
    """
    Optional: Ping the dashboard that the machine is alive.
    For now, creating a session updates lastSeenAt on the backend, 
    but we can also use a dedicated heartbeat endpoint if available.
    """
    url = f"{BACKEND_URL}/machines/heartbeat"
    headers = {
        "Content-Type": "application/json",
        "x-machine-api-key": MACHINE_API_KEY
    }
    payload = {
        "machineCode": MACHINE_CODE
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Heartbeat failed: {e}")
        return False
