from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Team(str, Enum):
    RED = "red"
    BLUE = "blue"
    TARGET = "target"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class TeamActivity(BaseModel):
    id: str
    timestamp: datetime
    team: Literal["red", "blue", "target"]
    actor: str
    action: str
    target: str
    severity: Severity = Severity.INFO
    outcome: Literal["success", "blocked", "in_progress", "detected", "failed"] = "in_progress"
    mitre_id: str | None = None
    related_incident_id: str | None = None
    source_host: str
    message: str


class KpiSnapshot(BaseModel):
    red_actions_24h: int
    blue_actions_24h: int
    target_alerts: int
    open_incidents: int
    red_delta: int
    blue_delta: int
    target_delta: int


class UrgencyBucket(BaseModel):
    urgency: Severity
    count: int


class TimeSeriesPoint(BaseModel):
    time: str
    red: int
    blue: int
    target: int


class VmConnector(BaseModel):
    id: str
    name: str
    role: Literal["red", "blue", "target"]
    hostname: str
    ip: str
    status: Literal["connected", "disconnected", "error"]
    last_event_at: datetime | None
    event_rate_per_min: float
    data_types: list[str]


class ConnectorSummary(BaseModel):
    onboarded: int
    connected: int
    updates: int


class AssetStatus(BaseModel):
    hostname: str
    ip: str
    risk_level: Literal["critical", "high", "medium", "low"]
    alerts_open: int
    services_at_risk: list[str]
    contained: bool


class ExerciseMeta(BaseModel):
    name: str
    phase: str
    started_at: datetime
    red_operator: str
    blue_operator: str
    elapsed_seconds: int


class LiveState(BaseModel):
    exercise: ExerciseMeta
    kpis: KpiSnapshot
    asset: AssetStatus
    urgency: list[UrgencyBucket]
    timeline: list[TimeSeriesPoint]
    red_feed: list[TeamActivity]
    blue_feed: list[TeamActivity]
    target_feed: list[TeamActivity]
    connectors: list[VmConnector]
    connector_summary: ConnectorSummary


class IngestEvent(BaseModel):
    team: Literal["red", "blue", "target"]
    actor: str
    action: str
    target: str = "metasploitable"
    severity: Severity = Severity.MEDIUM
    outcome: Literal["success", "blocked", "in_progress", "detected", "failed"] = "in_progress"
    mitre_id: str | None = None
    source_host: str
    message: str
