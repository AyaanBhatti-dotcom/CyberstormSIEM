import { randomUUID } from "crypto";

const MAX_FEED = 40;
const MAX_TIMELINE = 24;

const PHASES = ["Reconnaissance", "Initial Access", "Exploitation", "Post-Exploitation", "Containment"];

export class LiveStore {
  constructor() {
    this.onEvent = null;
    this._started = new Date();
    this._phase = PHASES[0];
    this._redFeed = [];
    this._blueFeed = [];
    this._targetFeed = [];
    this._urgency = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    this._redCount = 0;
    this._blueCount = 0;
    this._targetCount = 0;
    this._openIncidents = 0;
    this._timeline = [];
    this._connectors = [
      {
        id: "red-01",
        name: "Red Team VM",
        role: "red",
        hostname: "red-team-01",
        ip: "192.168.56.102",
        status: "disconnected",
        last_event_at: null,
        event_rate_per_min: 0,
        data_types: ["attack", "recon", "exploit"],
      },
      {
        id: "blue-01",
        name: "Blue Team VM",
        role: "blue",
        hostname: "blue-team-01",
        ip: "192.168.56.103",
        status: "disconnected",
        last_event_at: null,
        event_rate_per_min: 0,
        data_types: ["analyst", "response", "detection"],
      },
      {
        id: "target-01",
        name: "Metasploitable",
        role: "target",
        hostname: "metasploitable",
        ip: "192.168.56.101",
        status: "disconnected",
        last_event_at: null,
        event_rate_per_min: 0,
        data_types: ["auth", "syslog", "service"],
      },
    ];
    this._asset = {
      hostname: "metasploitable",
      ip: "192.168.56.101",
      risk_level: "low",
      alerts_open: 0,
      services_at_risk: ["ssh", "ftp", "smb", "http"],
      contained: false,
    };
  }

  async publishEvent(raw) {
    const event = {
      id: randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      team: raw.team,
      actor: raw.actor,
      action: raw.action,
      target: raw.target || "metasploitable",
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
