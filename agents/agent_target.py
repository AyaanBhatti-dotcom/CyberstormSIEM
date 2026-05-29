#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Python 2.5 compatible - no external dependencies
import re
import subprocess
import threading
import sys

try:
    from urllib2 import urlopen, Request
except ImportError:
    from urllib.request import urlopen, Request

# ── Config ────────────────────────────────────────────────
# Usage: sudo python agent_target.py <siem-ip>
SIEM_IP     = sys.argv[1] if len(sys.argv) > 1 else "192.168.102.128"
SIEM_URL    = "http://%s:8000/api/ingest" % SIEM_IP
SOURCE_HOST = "metasploitable"
# ──────────────────────────────────────────────────────────


def escape(s):
    if s is None:
        return "null"
    s = str(s)
    s = s.replace("\\", "\\\\")
    s = s.replace('"',  '\\"')
    s = s.replace("\n", "\\n")
    s = s.replace("\r", "\\r")
    return '"' + s + '"'


def to_json(d):
    parts = []
    for k, v in d.items():
        if v is None:
            parts.append('"%s": null' % k)
        else:
            parts.append('"%s": %s' % (k, escape(v)))
    return "{" + ", ".join(parts) + "}"


def post_event(action, severity, outcome, message, mitre_id=None, actor=None):
    event = {
        "team":        "target",
        "actor":       actor or SOURCE_HOST,
        "action":      action,
        "severity":    severity,
        "outcome":     outcome,
        "source_host": SOURCE_HOST,
        "message":     message,
        "mitre_id":    mitre_id,
    }
    try:
        data = to_json(event).encode("utf-8")
        req  = Request(SIEM_URL, data, {"Content-Type": "application/json"})
        urlopen(req, timeout=5)
        sys.stdout.write("[+] %s\n" % action)
        sys.stdout.flush()
    except:
        sys.stderr.write("[-] Failed to post: %s\n" % action)


def parse_auth(line):
    if "Failed password" in line:
        m    = re.search(r"Failed password for (?:invalid user )?(\S+) from ([\d.]+)", line)
        user = m.group(1) if m else "unknown"
        src  = m.group(2) if m else "unknown"
        post_event("SSH authentication failure", "high", "detected",
                   "Failed SSH login for '%s' from %s" % (user, src),
                   mitre_id="T1110", actor=src)

    elif "BREAK-IN ATTEMPT" in line:
        post_event("SSH brute force detected", "critical", "detected",
                   line.strip(), mitre_id="T1110")

    elif "Accepted password" in line:
        m    = re.search(r"Accepted password for (\S+) from ([\d.]+)", line)
        user = m.group(1) if m else "unknown"
        src  = m.group(2) if m else "unknown"
        post_event("SSH login success", "critical", "success",
                   "Successful SSH login for '%s' from %s" % (user, src),
                   mitre_id="T1078", actor=src)

    elif "sudo" in line and "COMMAND" in line:
        m   = re.search(r"COMMAND=(.+)$", line)
        cmd = m.group(1).strip() if m else "unknown"
        post_event("Privileged command executed", "high", "success",
                   "sudo: %s" % cmd, mitre_id="T1078")


def parse_syslog(line):
    low = line.lower()

    if "vsftpd" in low:
        if any(x in line for x in ["FAIL", "refused", "OOPS", "unable"]):
            post_event("FTP service error", "medium", "detected", line.strip())
        elif "connect" in low:
            m   = re.search(r"from ([\d.]+)", line)
            src = m.group(1) if m else "unknown"
            post_event("FTP connection", "medium", "detected",
                       "vsftpd connection from %s" % src, actor=src)

    if re.search(r"TCP.*:4444|NEW.*4444", line):
        post_event("Suspicious outbound connection", "critical", "detected",
                   line.strip(), mitre_id="T1059")

    if "smbd" in low or "samba" in low:
        m   = re.search(r"from ([\d.]+|\S+)", line)
        src = m.group(1) if m else "unknown"
        post_event("SMB access", "medium", "detected",
                   "Samba: %s" % line.strip(),
                   mitre_id="T1021", actor=src)


def parse_apache(line):
    m = re.search(r'"(?:GET|POST|HEAD|PUT|DELETE) ([^ ]+) HTTP[^"]*" (\d{3})', line)
    if not m:
        return
    path  = m.group(1)
    code  = m.group(2)
    src_m = re.search(r'^([\d.]+)', line)
    src   = src_m.group(1) if src_m else "unknown"

    sqli = ["'", "union+select", "1=1", "--", "0x", "char("]
    scan = ["/admin", "/phpmyadmin", "/wp-admin", "/manager",
            "/.env", "/config", "/backup", "/shell", "/.git"]

    if any(p in path.lower() for p in sqli):
        post_event("SQL injection attempt", "critical", "detected",
                   "SQLi in %s from %s -> %s" % (path, src, code),
                   mitre_id="T1190", actor=src)
    elif any(p in path.lower() for p in scan):
        post_event("Web directory scan", "medium", "detected",
                   "Scan %s from %s -> %s" % (path, src, code),
                   mitre_id="T1083", actor=src)
    elif code == "200" and any(x in path for x in ["/dvwa", "/mutillidae", "/tikiwiki"]):
        post_event("Vulnerable web app accessed", "high", "success",
                   "Access to %s from %s -> 200" % (path, src),
                   mitre_id="T1190", actor=src)


PARSERS = {
    "/var/log/auth.log":           parse_auth,
    "/var/log/syslog":             parse_syslog,
    "/var/log/apache2/access.log": parse_apache,
}


def tail(path, parser):
    sys.stdout.write("[*] Watching %s\n" % path)
    sys.stdout.flush()
    try:
        proc = subprocess.Popen(
            ["tail", "-F", "-n", "0", path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        while True:
            line = proc.stdout.readline()
            if not line:
                break
            try:
                parser(line.decode("utf-8", errors="replace"))
            except:
                pass
    except:
        sys.stderr.write("[-] Could not tail %s\n" % path)


if __name__ == "__main__":
    sys.stdout.write("[*] CyberstormSIEM target agent starting\n")
    sys.stdout.write("[*] SIEM endpoint: %s\n" % SIEM_URL)
    sys.stdout.flush()

    threads = []
    for path, parser in PARSERS.items():
        t = threading.Thread(target=tail, args=(path, parser))
        t.daemon = True
        threads.append(t)
        t.start()

    sys.stdout.write("[*] Watching %d log files -- Ctrl+C to stop\n" % len(threads))
    sys.stdout.flush()
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        sys.stdout.write("\n[*] Agent stopped.\n")
