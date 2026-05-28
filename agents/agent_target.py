#!/usr/bin/env python
"""
CyberstormSIEM - Target Agent (Metasploitable)
Watches auth, apache, and syslog and forwards events to the SIEM.
Python 2/3 compatible — no external dependencies.

Usage:
    sudo python agent_target.py
"""
from __future__ import print_function
import json
import re
import subprocess
import threading
import sys

# Python 2/3 urllib compatibility
try:
    from urllib.request import urlopen, Request
    from urllib.error import URLError
except ImportError:
    from urllib2 import urlopen, Request, URLError

# ── Config ────────────────────────────────────────────────
# Pass SIEM IP as argument, or fall back to the default
# Usage: sudo python agent_target.py 192.168.100.10
SIEM_IP     = sys.argv[1] if len(sys.argv) > 1 else "192.168.102.10"
SIEM_URL    = "http://{}:8000/api/ingest".format(SIEM_IP)
SOURCE_HOST = "metasploitable"
# ──────────────────────────────────────────────────────────

LOG_FILES = [
    "/var/log/auth.log",
    "/var/log/syslog",
    "/var/log/apache2/access.log",
]


def post_event(action, severity, outcome, message, mitre_id=None, actor=None):
    event = {
        "team":        "target",
        "actor":       actor or SOURCE_HOST,
        "action":      action,
        "severity":    severity,
        "outcome":     outcome,
        "source_host": SOURCE_HOST,
        "message":     message,
    }
    if mitre_id:
        event["mitre_id"] = mitre_id
    try:
        data = json.dumps(event).encode("utf-8")
        req  = Request(SIEM_URL, data=data, headers={"Content-Type": "application/json"})
        urlopen(req, timeout=5)
        print("[+] {}".format(action))
    except Exception as e:
        print("[-] Failed to post: {}".format(e), file=sys.stderr)


def parse_auth(line):
    if "Failed password" in line:
        m    = re.search(r"Failed password for (?:invalid user )?(\S+) from ([\d.]+)", line)
        user = m.group(1) if m else "unknown"
        src  = m.group(2) if m else "unknown"
        post_event("SSH authentication failure", "high", "detected",
                   "Failed SSH login for '{}' from {}".format(user, src),
                   mitre_id="T1110", actor=src)

    elif "BREAK-IN ATTEMPT" in line:
        post_event("SSH brute force detected", "critical", "detected",
                   line.strip(), mitre_id="T1110")

    elif "Accepted password" in line:
        m    = re.search(r"Accepted password for (\S+) from ([\d.]+)", line)
        user = m.group(1) if m else "unknown"
        src  = m.group(2) if m else "unknown"
        post_event("SSH login success", "critical", "success",
                   "Successful SSH login for '{}' from {}".format(user, src),
                   mitre_id="T1078", actor=src)

    elif "sudo" in line and "COMMAND" in line:
        m   = re.search(r"COMMAND=(.+)$", line)
        cmd = m.group(1).strip() if m else "unknown"
        post_event("Privileged command executed", "high", "success",
                   "sudo: {}".format(cmd), mitre_id="T1078")


def parse_syslog(line):
    low = line.lower()

    if "vsftpd" in low:
        if any(x in line for x in ["FAIL", "refused", "OOPS", "unable"]):
            post_event("FTP service error", "medium", "detected", line.strip())
        elif "connect" in low:
            m   = re.search(r"from ([\d.]+)", line)
            src = m.group(1) if m else "unknown"
            post_event("FTP connection", "medium", "detected",
                       "vsftpd connection from {}".format(src), actor=src)

    if re.search(r"TCP.*:4444|NEW.*4444", line):
        post_event("Suspicious outbound connection", "critical", "detected",
                   line.strip(), mitre_id="T1059")

    if "samba" in low or "smbd" in low:
        m   = re.search(r"from ([\d.]+|\S+)", line)
        src = m.group(1) if m else "unknown"
        post_event("SMB access", "medium", "detected",
                   "Samba connection: {}".format(line.strip()),
                   mitre_id="T1021", actor=src)


def parse_apache(line):
    m = re.search(r'"(?:GET|POST|HEAD|PUT|DELETE) ([^ ]+) HTTP[^"]*" (\d{3})', line)
    if not m:
        return
    path = m.group(1)
    code = m.group(2)
    src_m = re.search(r'^([\d.]+)', line)
    src  = src_m.group(1) if src_m else "unknown"

    sqli = ["'", "union+select", "1=1", "--", "0x", "char("]
    scan = ["/admin", "/phpmyadmin", "/wp-admin", "/manager",
            "/.env", "/config", "/backup", "/shell", "/.git"]

    if any(p in path.lower() for p in sqli):
        post_event("SQL injection attempt", "critical", "detected",
                   "SQLi in {} from {} → {}".format(path, src, code),
                   mitre_id="T1190", actor=src)
    elif any(p in path.lower() for p in scan):
        post_event("Web directory scan", "medium", "detected",
                   "Scan {} from {} → {}".format(path, src, code),
                   mitre_id="T1083", actor=src)
    elif code == "200" and any(x in path for x in ["/dvwa", "/mutillidae", "/tikiwiki"]):
        post_event("Vulnerable web app accessed", "high", "success",
                   "Access to {} from {} → 200".format(path, src),
                   mitre_id="T1190", actor=src)


PARSERS = {
    "/var/log/auth.log":             parse_auth,
    "/var/log/syslog":               parse_syslog,
    "/var/log/apache2/access.log":   parse_apache,
}


def tail(path, parser):
    print("[*] Watching {}".format(path))
    try:
        proc = subprocess.Popen(
            ["tail", "-F", "-n", "0", path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
        )
        for line in proc.stdout:
            try:
                parser(line)
            except Exception as e:
                print("[-] Parse error on {}: {}".format(path, e), file=sys.stderr)
    except Exception as e:
        print("[-] Could not tail {}: {}".format(path, e), file=sys.stderr)


if __name__ == "__main__":
    print("[*] CyberstormSIEM target agent starting")
    print("[*] SIEM endpoint: {}".format(SIEM_URL))

    threads = []
    for path, parser in PARSERS.items():
        t = threading.Thread(target=tail, args=(path, parser))
        t.daemon = True
        threads.append(t)
        t.start()

    print("[*] Watching {} log files — press Ctrl+C to stop".format(len(threads)))
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\n[*] Agent stopped.")
