#!/usr/bin/env python3

import json
import logging
import subprocess
import threading
from queue import Queue
from time import sleep

from flask import Flask, jsonify, request

TV_IP = "192.168.1.101"
ADB_DEVICE = f"{TV_IP}:5555"
WATCHDOG_INTERVAL = 30
MAX_RETRIES = 3

logging.basicConfig(
    filename="tv_remote.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

command_queue = Queue()
app = Flask(__name__)


def ping_host():
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", TV_IP],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


def restart_adb_server():
    logging.warning("Restarting ADB server")

    try:
        subprocess.run(
            ["adb", "kill-server"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )

        sleep(2)

        subprocess.run(
            ["adb", "start-server"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
    except Exception as exc:
        logging.error("ADB restart failed: %s", exc)


def adb_connect():
    if not ping_host():
        logging.warning("Device not reachable")
        return False

    try:
        result = subprocess.run(
            ["adb", "connect", ADB_DEVICE],
            capture_output=True,
            text=True,
            timeout=10,
        )

        logging.info("adb connect output: %s", result.stdout.strip())
        return True
    except Exception as exc:
        logging.error("ADB connect error: %s", exc)
        return False


def adb_state():
    try:
        result = subprocess.run(
            ["adb", "devices"],
            capture_output=True,
            text=True,
            timeout=5,
        )

        for line in result.stdout.splitlines():
            if ADB_DEVICE in line:
                if "device" in line:
                    return "device"
                if "offline" in line:
                    return "offline"

        return "disconnected"
    except Exception:
        return "unknown"


def ensure_connection():
    state = adb_state()

    if state == "device":
        return True

    logging.warning("ADB state = %s", state)

    for attempt in range(5):
        logging.info("Reconnect attempt %d/5", attempt + 1)
        adb_connect()
        sleep(2)

        if adb_state() == "device":
            logging.info("Reconnected")
            return True

    restart_adb_server()
    adb_connect()
    sleep(3)
    return adb_state() == "device"


KEYMAP = {
    "power_on": 26,
    "power_off": 26,
    "volume_up": 24,
    "volume_down": 25,
    "mute": 164,
    "unmute": 164,
    "play": 126,
    "pause": 127,
    "home": 3,
    "back": 4,
    "select": 23,
    "up": 19,
    "down": 20,
    "left": 21,
    "right": 22,
    "fast_forward": 90,
    "rewind": 89,
}


def send_key(keycode):
    for attempt in range(MAX_RETRIES):
        if not ensure_connection():
            sleep(2)
            continue

        try:
            result = subprocess.run(
                [
                    "adb",
                    "-s",
                    ADB_DEVICE,
                    "shell",
                    "input",
                    "keyevent",
                    str(keycode),
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )

            if result.returncode == 0:
                logging.info("Key %s sent successfully", keycode)
                return True

            logging.warning("Attempt %d failed", attempt + 1)
        except Exception as exc:
            logging.error("Send key failed: %s", exc)

    return False


@app.route("/status", methods=["GET"])
def status_route():
    return jsonify({"state": adb_state()})


@app.route("/command", methods=["POST"])
def command_route():
    payload = request.get_json(silent=True) or {}
    action = payload.get("action")

    if not action:
        return jsonify({"ok": False, "error": "Missing action"}), 400

    keycode = KEYMAP.get(action)
    if keycode is None:
        return jsonify({"ok": False, "error": f"Unsupported action: {action}"}), 400

    ok = send_key(keycode)
    return jsonify({"ok": ok, "action": action, "device_state": adb_state()})


def watchdog():
    while True:
        sleep(WATCHDOG_INTERVAL)
        adb_state()


if __name__ == "__main__":
    threading.Thread(target=watchdog, daemon=True).start()
    app.run(host="0.0.0.0", port=8080, debug=False)
