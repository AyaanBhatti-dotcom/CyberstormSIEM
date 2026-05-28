export type Team = 'red' | 'blue' | 'target';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Outcome = 'success' | 'blocked' | 'in_progress' | 'detected' | 'failed';

export interface TeamActivity {
  id: string;
  timestamp: string;
  team: Team;
  actor: string;
  action: string;
  target: string;
  severity: Severity;
  outcome: Outcome;
  mitre_id: string | null;
  related_incident_id: string | null;
  source_host: string;
  message: string;
}

export interface KpiSnapshot {
  red_actions_24h: number;
  blue_actions_24h: number;
  target_alerts: number;
  open_incidents: number;
  red_delta: number;
  blue_delta: number;
  target_delta: number;
}

export interface UrgencyBucket {
  urgency: Severity;
  count: number;
}

export interface TimeSeriesPoint {
  time: string;
  red: number;
  blue: number;
  target: number;
}

export interface VmConnector {
  id: string;
  name: string;
  role: Team;
  hostname: string;
  ip: string;
  status: 'connected' | 'disconnected' | 'error';
  last_event_at: string | null;
  event_rate_per_min: number;
  data_types: string[];
}

export interface ConnectorSummary {
  onboarded: number;
  connected: number;
  updates: number;
}

export interface AssetStatus {
  hostname: string;
  ip: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  alerts_open: number;
  services_at_risk: string[];
  contained: boolean;
}

export interface ExerciseMeta {
  name: string;
  phase: string;
  started_at: string;
  red_operator: string;
  blue_operator: string;
  elapsed_seconds: number;
}

export interface LiveState {
  exercise: ExerciseMeta;
  kpis: KpiSnapshot;
  asset: AssetStatus;
  urgency: UrgencyBucket[];
  timeline: TimeSeriesPoint[];
  red_feed: TeamActivity[];
  blue_feed: TeamActivity[];
  target_feed: TeamActivity[];
  connectors: VmConnector[];
  connector_summary: ConnectorSummary;
}
