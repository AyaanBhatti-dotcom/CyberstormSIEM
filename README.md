# Cyberstorm SIEM — Red vs Blue Live Dashboard

A local SIEM-style dashboard for a **Red Team / Blue Team / Metasploitable** cyber range. Events stream in **live** over WebSocket so you can watch each team’s actions as the exercise runs.

## Quick start

**Terminal 1 — live server (required):**
```powershell
cd server
npm install
npm start
```

**Terminal 2 — UI:**
```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. You should see a green **LIVE** indicator and new events every few seconds.

Or from the project root (after `npm install` in root, `server`, and `frontend`):
```powershell
npm run install:all
npm run dev
```

## What updates live

- **Operations Overview** — Red feed, Blue feed, Metasploitable telemetry, KPIs, charts
- **Red / Blue / Metasploitable pages** — team-specific live streams
- **Data Connectors** — last event time and events/min per VM
- **Incidents** — built from recent live events

## Range VMs (configure to match your lab)

| Role | Hostname | Default IP |
|------|----------|------------|
| Red Team | red-team-01 | 192.168.56.102 |
| Blue Team | blue-team-01 | 192.168.56.103 |
| Target | metasploitable | 192.168.56.101 |

Edit IPs in `server/live-store.js` and `frontend` Configure page when your network differs.

## Push real events from a VM

POST JSON to the live server:

```powershell
curl -X POST http://localhost:8000/api/ingest `
  -H "Content-Type: application/json" `
  -d '{"team":"red","actor":"Red Operator","action":"Manual exploit attempt","severity":"high","outcome":"in_progress","source_host":"red-team-01","message":"Custom event from VM"}'
```

The UI updates immediately for all connected browsers.

## Python backend (optional)

A FastAPI backend is in `backend/` for when Python is installed. Use the Node server (`server/`) for now — same API shape (`/api/state`, `/api/ingest`, `/ws/live`).

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## Project structure

```
Cyberstorm SIEM/
├── frontend/     React UI (Splunk-style ops + Sentinel-style connectors)
├── server/       Node live engine + WebSocket + simulator
└── backend/      Python FastAPI (optional, for future VM syslog)
```

## Next steps (real VM logs)

1. Install syslog or a small forwarder on each VM.
2. Forward logs to `POST /api/ingest` with `team: red | blue | target`.
3. Replace the built-in simulator in `server/index.js` when you no longer need demo events.
