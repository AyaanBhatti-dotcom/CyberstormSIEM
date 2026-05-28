#!/usr/bin/env python3
"""
CyberstormSIEM - Blue Team Agent
Watches auth, syslog, and UFW logs for defensive actions and forwards
them to the SIEM. Also supports manual event injection via logger.

── Manual event injection ────────────────────────────────────────────
Log a custom blue team action from anywhere in the terminal:

    logger -t blue_op "ACTION: Isolated host 192.168.x.x | high | success"
    logger -t blue_op "ACTION: Opened incident INC-001 | medium | in_progress"
    logger -t blue_op "ACTION: Containment playbook executed | critical | success"

Format:  ACTION: <description> | <severity> | <outcome>
Severities: critical, high, medium, low, info
Outcomes:   success, blocked, in_progress, detected, failed
──────────────────────────────────────────────────────────────────────

Usage:
    sudo python3 agent_blue.py
"""
import json
import re
import subprocess
import threading
import sys
from urllib.request import urlopen, Request

# ── Config ────────────────────────────────────────────────
# Pass SIEM IP as argument, or fall back to the default
# Usage: sudo python3 agent_blue.py 192.168.100.10
SIEM_IP     = sys.argv[1] if len(sys.argv) > 1 else "192.168.102.10"
SIEM_URL    = f"http://{SIEM_IP}:8000/api/ingest"
SOURCE_HOST = "blue-team-01"
ACTOR       = "Blue Analyst"
# ──────────────────────────────────────────────────────────


def post_event(action, severity, outcome, message, mitre_id=None):
    event = {
        "team":        "blue",
        "actor":       ACTOR,
        "action":      action,
        "severity":    severity,
        "outcome":     outcome,
        "source_host": SOURCE_HOST,
        "message":     message,
    }
    if mitre_id:
        event["mitre_id"] = mitre_id
    try:
        data = json.dumps(event).encode()
        req  = Request(SIEM_URL, data=data, headers={"Content-Type": "application/json"})
        urlopen(req, timeout=5)
        print(f"[+] {action}")
    except Exception as e:
        print(f"[-] Failed to post: {e}", file=sys.stderr)


# ── Auth log parser ────────────────────────────────────────

def parse_auth(line):
    if "sudo" in line and "COMMAND" in line:
        m   = re.search(r"COMMAND=(.+)$", line)
        cmd = m.group(1).strip() if m else "unknown"
        # Map common defensive commands
        if any(x in cmd for x in ["iptables", "ufw", "firewall"]):
            post_event("Firewall rule applied", "high", "success",
                       f"sudo: {cmd}", mitre_id="T1562")
        elif any(x in cmd for x in ["kill", "pkill", "service stop"]):
            post_event("Process terminated", "medium", "success",
                       f"sudo: {cmd}", mitre_id="T1489")
        elif any(x in cmd for x in ["passwd", "usermod", "userdel"]):
            post_event("Account modified", "medium", "success",
                       f"sudo: {cmd}", mitre_id="T1098")
        else:
            post_event("Privileged command executed", "low", "success",
                       f"sudo: {cmd}")

    elif "Accepted password" in line or "Accepted publickey" in line:
        m    = re.search(r"Accepted \S+ for (\S+) from ([\d.]+)", line)
        user = m.group(1) if m else "unknown"
        src  = m.group(2) if m else "unknown"
        post_event("Analyst logged in", "info", "success",
                   f"{user} logged in from {src}")


# ── UFW / firewall log parser ──────────────────────────────

def parse_ufw(line):
    if "UFW BLOCK" in line:
        src_m = re.search(r"SRC=([\d.]+)", line)
        dst_m = re.search(r"DST=([\d.]+)", line)
        dpt_m = re.search(r"DPT=(\d+)", line)
        src   = src_m.group(1) if src_m else "unknown"
        dst   = dst_m.group(1) if dst_m else "unknown"
        dpt   = dpt_m.group(1) if dpt_m else "?"
        post_event("Firewall block triggered", "medium", "blocked",
                   f"UFW blocked {src} → {dst}:{dpt}",
                   mitre_id="T1562")

    elif "UFW ALLOW" in line:
        post_event("Firewall rule allowed traffic", "info", "success",
                   line.strip())


# ── Syslog parser (manual blue_op + auto detections) ──────

def parse_syslog(line):
    # Manual injections via: logger -t blue_op "ACTION: ... | severity | outcome"
    if "blue_op" in line:
        m = re.search(r"ACTION:\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(\w+)", line)
        if m:
            action   = m.group(1).strip()
            severity = m.group(2).strip().lower()
            outcome  = m.group(3).strip().lower()
            valid_sev = {"critical", "high", "medium", "low", "info"}
            valid_out = {"success", "blocked", "in_progress", "detected", "failed"}
            severity  = severity if severity in valid_sev else "medium"
            outcome   = outcome  if outcome  in valid_out else "in_progress"
            post_event(action, severity, outcome,
                       f"Manual: {action}")
        return

    # Auto-detect snort/suricata alert lines
    if "snort" in line.lower() and "alert" in line.lower():
        post_event("IDS alert triggered", "high", "detected",
                   line.strip())

    if "suricata" in line.lower() and "alert" in line.lower():
        post_event("IDS alert triggered", "high", "detected",
                   line.strip())

    # Detect tcpdump/Wireshark capture started (analyst investigating)
    if re.search(r"tcpdump|tshark", line.lower()):
        post_event("Packet capture started", "low", "in_progress",
                   "Network capture initiated by analyst")


# ── Tail + dispatch ────────────────────────────────────────

WATCHERS = [
    ("/var/log/auth.log", parse_auth),
    ("/var/log/syslog",   parse_syslog),
    ("/var/log/ufw.log",  parse_ufw),
]


def tail(path, parser):
    print(f"[*] Watching {path}")
    try:
        proc = subprocess.Popen(
            ["tail", "-F", "-n", "0", path],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        )
        for line in proc.stdout:
            try:
                parser(line)
            except Exception as e:
                print(f"[-] Parse error on {path}: {e}", file=sys.stderr)
    except Exception as e:
        print(f"[-] Could not tail {path}: {e}", file=sys.stderr)


if __name__ == "__main__":
    print("[*] CyberstormSIEM blue team agent starting")
    print("[*] SIEM endpoint:", SIEM_URL)
    print()
    print("[!] Manual event injection:")
    print('    logger -t blue_op "ACTION: <description> | <severity> | <outcome>"')
    print('    Example: logger -t blue_op "ACTION: Blocked attacker IP | high | success"')
    print()

    threads = [
        threading.Thread(target=tail, args=(p, fn), daemon=True)
        for p, fn in WATCHERS
    ]
    for t in threads:
        t.start()

    print(f"[*] Watching {len(threads)} log files — press Ctrl+C to stop")
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\n[*] Agent stopped.")
