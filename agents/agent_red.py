#!/usr/bin/env python3
"""
CyberstormSIEM - Red Team Agent (Kali)
Watches syslog for commands tagged by the bash logger hook and maps
them to MITRE ATT&CK techniques before forwarding to the SIEM.

── Setup (run once on Kali) ──────────────────────────────────────────
Add this line to ~/.bashrc then run: source ~/.bashrc

    export PROMPT_COMMAND='logger -t kali_op "CMD: $(history 1 | sed "s/^[[:space:]]*[0-9]*[[:space:]]*//")"'

Every command you run will be silently logged to syslog and picked
up by this agent automatically.
──────────────────────────────────────────────────────────────────────

Usage:
    sudo python3 agent_red.py
"""
import json
import re
import subprocess
import threading
import sys
from urllib.request import urlopen, Request

# ── Config ────────────────────────────────────────────────
# Pass SIEM IP as argument, or fall back to the default
# Usage: sudo python3 agent_red.py 192.168.100.10
SIEM_IP     = sys.argv[1] if len(sys.argv) > 1 else "192.168.102.10"
SIEM_URL    = f"http://{SIEM_IP}:8000/api/ingest"
SOURCE_HOST = "kali"
ACTOR       = "Red Operator"
# ──────────────────────────────────────────────────────────

# Maps command keywords → (action label, MITRE ID, severity)
TOOL_MAP = [
    (r"\bnmap\b",          "Network port scan",           "T1046", "medium"),
    (r"\bnetdiscover\b",   "Network host discovery",      "T1018", "low"),
    (r"\barp-scan\b",      "ARP network scan",            "T1018", "low"),
    (r"\bhydra\b",         "Brute force attack",          "T1110", "high"),
    (r"\bmedusa\b",        "Brute force attack",          "T1110", "high"),
    (r"\bpatator\b",       "Brute force attack",          "T1110", "high"),
    (r"\bcrackmap\b",      "Credential spray",            "T1110", "high"),
    (r"\bmsfconsole\b",    "Metasploit framework opened", "T1210", "high"),
    (r"\bmsfvenom\b",      "Payload generated",           "T1587", "high"),
    (r"use exploit",       "Exploit module loaded",       "T1210", "critical"),
    (r"\bexploit\b",       "Exploit executed",            "T1210", "critical"),
    (r"\bgobuster\b",      "Web directory brute force",   "T1083", "medium"),
    (r"\bdirb\b",          "Web directory scan",          "T1083", "medium"),
    (r"\bnikto\b",         "Web vulnerability scan",      "T1190", "medium"),
    (r"\bsqlmap\b",        "SQL injection scan",          "T1190", "high"),
    (r"\benum4linux\b",    "SMB enumeration",             "T1135", "medium"),
    (r"\bsmbclient\b",     "SMB access attempt",          "T1021", "medium"),
    (r"\bsmbmap\b",        "SMB share mapping",           "T1135", "medium"),
    (r"\bnetcat\b|\bnc\b", "Netcat connection",           "T1059", "high"),
    (r"\bsocat\b",         "Socat tunnel/shell",          "T1059", "high"),
    (r"\bssh\b",           "SSH connection attempt",      "T1021", "medium"),
    (r"\bscp\b",           "File transfer via SCP",       "T1105", "medium"),
    (r"\bjohn\b",          "Password cracking",           "T1110", "high"),
    (r"\bhashcat\b",       "Password cracking",           "T1110", "high"),
    (r"\bwhoami\b|\bid\b", "User identity discovered",    "T1033", "low"),
    (r"\buname\b",         "System info gathered",        "T1082", "low"),
    (r"\bps\b|\bpstree\b", "Process enumeration",         "T1057", "low"),
    (r"\bnetstat\b|\bss\b","Network connection enum",     "T1049", "low"),
    (r"\bwireless\b|\baircrack\b", "Wireless attack",     "T1040", "high"),
    (r"\btcpdump\b|\bwireshark\b", "Packet capture",      "T1040", "medium"),
    (r"\bcurl\b|\bwget\b", "HTTP request made",           "T1105", "low"),
]


def classify(cmd):
    """Return (action, mitre_id, severity) for a command string, or None."""
    low = cmd.lower()
    for pattern, action, mitre, severity in TOOL_MAP:
        if re.search(pattern, low):
            return action, mitre, severity
    return None


def post_event(action, severity, outcome, message, mitre_id=None):
    event = {
        "team":        "red",
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
        print(f"[+] {action}  ({mitre_id})")
    except Exception as e:
        print(f"[-] Failed to post: {e}", file=sys.stderr)


def watch_syslog():
    """Tail syslog for kali_op tagged entries from the bash PROMPT_COMMAND hook."""
    print("[*] Watching /var/log/syslog for kali_op entries")
    proc = subprocess.Popen(
        ["tail", "-F", "-n", "0", "/var/log/syslog"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
    )
    for line in proc.stdout:
        if "kali_op" not in line:
            continue
        m = re.search(r"CMD:\s*(.+)$", line)
        if not m:
            continue
        cmd = m.group(1).strip()
        if not cmd or cmd == "history 1":
            continue

        result = classify(cmd)
        if result:
            action, mitre, severity = result
            post_event(action, severity, "in_progress",
                       f"Command: {cmd}", mitre_id=mitre)
        else:
            # Still log unknown commands at info level so nothing is missed
            post_event("Command executed", "info", "in_progress",
                       f"Command: {cmd}")


if __name__ == "__main__":
    print("[*] CyberstormSIEM red team agent starting")
    print("[*] SIEM endpoint:", SIEM_URL)
    print()
    print("[!] Make sure your ~/.bashrc contains:")
    print('    export PROMPT_COMMAND=\'logger -t kali_op "CMD: $(history 1 | sed \\"s/^[[:space:]]*[0-9]*[[:space:]]*//")"\'')
    print("    Then run: source ~/.bashrc")
    print()

    t = threading.Thread(target=watch_syslog, daemon=True)
    t.start()

    print("[*] Listening for commands — press Ctrl+C to stop")
    try:
        t.join()
    except KeyboardInterrupt:
        print("\n[*] Agent stopped.")
