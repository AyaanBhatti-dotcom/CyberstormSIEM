from __future__ import annotations

import asyncio
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from threading import Lock

from .models import (
    AssetStatus,
    ConnectorSummary,
    ExerciseMeta,
    IngestEvent,
    KpiSnapshot,
    LiveState,
    Severity,
    TeamActivity,
    TimeSeriesPoint,
    UrgencyBucket,
    VmConnector,
)

MAX_FEED = 40
MAX_TIMELINE = 24


class LiveStateStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._started = datetime.now(timezone.utc)
        self._red_feed: deque[TeamActivity] = deque(maxlen=MAX_FEED)
        self._blue_feed: deque[TeamActivity] = deque(maxlen=MAX_FEED)
        self._target_feed: deque[TeamActivity] = deque(maxlen=MAX_FEED)
        self._all_events: deque[TeamActivity] = deque(maxlen=500)
        self._timeline: deque[TimeSeriesPoint] = deque(maxlen=MAX_TIMELINE)
        self._urgency: dict[Severity, int] = {s: 0 for s in Severity}
        self._red_count = 0
        self._blue_count = 0
        self._target_count = 0
        self._open_incidents = 2
        self._phase = "Reconnaissance"
        self._connectors = self._default_connectors()
        self._asset = AssetStatus(
            hostname="metasploitable",
            ip="192.168.56.101",
            risk_level="high",
            alerts_open=4,
            services_at_risk=["ssh", "ftp", "smb", "http"],
            contained=False,
        )
        self._subscribers: set[asyncio.Queue] = set()
        self._init_timeline()

    def _default_connectors(self) -> list[VmConnector]:
        now = datetime.now(timezone.utc)
        return [
            VmConnector(
                id="red-01",
                name="Red Team VM",
                role="red",
                hostname="red-team-01",
                ip="192.168.56.102",
                status="connected",
                last_event_at=now,
                event_rate_per_min=0.0,
                data_types=["attack", "recon", "exploit"],
            ),
            VmConnector(
                id="blue-01",
                name="Blue Team VM",
                role="blue",
                hostname="blue-team-01",
                ip="192.168.56.103",
                status="connected",
                last_event_at=now,
                event_rate_per_min=0.0,
                data_types=["analyst", "response", "detection"],
            ),
            VmConnector(
                id="target-01",
                name="Metasploitable",
                role="target",
                hostname="metasploitable",
                ip="192.168.56.101",
                status="connected",
                last_event_at=now,
                event_rate_per_min=0.0,
                data_types=["auth", "syslog", "service"],
            ),
        ]

    def _init_timeline(self) -> None:
        now = datetime.now(timezone.utc)
        for i in range(MAX_TIMELINE):
            t = now - timedelta(minutes=(MAX_TIMELINE - i) * 5)
            self._timeline.append(
                TimeSeriesPoint(
                    time=t.strftime("%H:%M"),
                    red=max(0, 2 + (i % 5) - 2),
                    blue=max(0, 1 + (i % 4) - 1),
                    target=max(0, 3 + (i % 6) - 2),
                )
            )

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    async def _broadcast(self, event: TeamActivity) -> None:
        payload = {"type": "activity", "data": event.model_dump(mode="json")}
        dead: list[asyncio.Queue] = []
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._subscribers.discard(q)

        snapshot = {"type": "state", "data": self.get_state().model_dump(mode="json")}
        for q in list(self._subscribers):
            try:
                q.put_nowait(snapshot)
            except asyncio.QueueFull:
                self._subscribers.discard(q)

    def add_event(self, raw: IngestEvent | TeamActivity) -> TeamActivity:
        if isinstance(raw, TeamActivity):
            event = raw
        else:
            event = TeamActivity(
                id=str(uuid.uuid4())[:8],
                timestamp=datetime.now(timezone.utc),
                team=raw.team,
                actor=raw.actor,
                action=raw.action,
                target=raw.target,
                severity=raw.severity,
                outcome=raw.outcome,
                mitre_id=raw.mitre_id,
                source_host=raw.source_host,
                message=raw.message,
            )

        with self._lock:
            self._all_events.appendleft(event)
            self._urgency[event.severity] = self._urgency.get(event.severity, 0) + 1

            if event.team == "red":
                self._red_feed.appendleft(event)
                self._red_count += 1
            elif event.team == "blue":
                self._blue_feed.appendleft(event)
                self._blue_count += 1
            else:
                self._target_feed.appendleft(event)
                self._target_count += 1

            self._bump_timeline(event.team)
            self._update_connectors(event)
            self._update_asset(event)

        return event

    def _bump_timeline(self, team: str) -> None:
        if not self._timeline:
            return
        last = self._timeline[-1]
        point = TimeSeriesPoint(
            time=datetime.now(timezone.utc).strftime("%H:%M"),
            red=last.red + (1 if team == "red" else 0),
            blue=last.blue + (1 if team == "blue" else 0),
            target=last.target + (1 if team == "target" else 0),
        )
        if len(self._timeline) >= MAX_TIMELINE:
            self._timeline.popleft()
        self._timeline.append(point)

    def _update_connectors(self, event: TeamActivity) -> None:
        role_map = {"red": "red-01", "blue": "blue-01", "target": "target-01"}
        cid = role_map.get(event.team, "target-01")
        for c in self._connectors:
            if c.id == cid:
                c.last_event_at = event.timestamp
                c.event_rate_per_min = min(120.0, c.event_rate_per_min + 0.35)
                c.status = "connected"

    def _update_asset(self, event: TeamActivity) -> None:
        if event.team == "red" and event.outcome == "success":
            self._asset.alerts_open = min(99, self._asset.alerts_open + 1)
            if self._asset.risk_level != "critical":
                levels = ["low", "medium", "high", "critical"]
                idx = levels.index(self._asset.risk_level)
                self._asset.risk_level = levels[min(idx + 1, 3)]  # type: ignore
        if event.team == "blue" and event.outcome in ("blocked", "success"):
            self._asset.alerts_open = max(0, self._asset.alerts_open - 1)
            if "isolate" in event.action.lower():
                self._asset.contained = True
                self._asset.risk_level = "medium"

    def set_phase(self, phase: str) -> None:
        with self._lock:
            self._phase = phase

    def get_state(self) -> LiveState:
        with self._lock:
            elapsed = int((datetime.now(timezone.utc) - self._started).total_seconds())
            return LiveState(
                exercise=ExerciseMeta(
                    name="Red vs Blue — Metasploitable Range",
                    phase=self._phase,
                    started_at=self._started,
                    red_operator="Red Operator",
                    blue_operator="Blue Analyst",
                    elapsed_seconds=elapsed,
                ),
                kpis=KpiSnapshot(
                    red_actions_24h=self._red_count,
                    blue_actions_24h=self._blue_count,
                    target_alerts=self._target_count,
                    open_incidents=self._open_incidents,
                    red_delta=min(self._red_count, 12),
                    blue_delta=min(self._blue_count, 8),
                    target_delta=min(self._target_count, 15),
                ),
                asset=self._asset,
                urgency=[
                    UrgencyBucket(urgency=Severity.CRITICAL, count=self._urgency.get(Severity.CRITICAL, 0)),
                    UrgencyBucket(urgency=Severity.HIGH, count=self._urgency.get(Severity.HIGH, 0)),
                    UrgencyBucket(urgency=Severity.MEDIUM, count=self._urgency.get(Severity.MEDIUM, 0)),
                    UrgencyBucket(urgency=Severity.LOW, count=self._urgency.get(Severity.LOW, 0)),
                ],
                timeline=list(self._timeline),
                red_feed=list(self._red_feed),
                blue_feed=list(self._blue_feed),
                target_feed=list(self._target_feed),
                connectors=list(self._connectors),
                connector_summary=ConnectorSummary(
                    onboarded=3,
                    connected=sum(1 for c in self._connectors if c.status == "connected"),
                    updates=0,
                ),
            )

    async def publish_event(self, raw: IngestEvent | TeamActivity) -> TeamActivity:
        event = self.add_event(raw)
        await self._broadcast(event)
        return event


store = LiveStateStore()
