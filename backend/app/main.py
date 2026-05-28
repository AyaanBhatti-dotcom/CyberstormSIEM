from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .models import IngestEvent, LiveState
from .simulator import simulator
from .state import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(simulator.run())
    yield
    simulator.stop()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Cyberstorm SIEM", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "live": True}


@app.get("/api/state", response_model=LiveState)
def get_state():
    return store.get_state()


@app.post("/api/ingest")
async def ingest(event: IngestEvent):
    """Push a real event from a VM agent or forwarder."""
    created = await store.publish_event(event)
    return created


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    queue = store.subscribe()
    try:
        await websocket.send_json(
            {"type": "state", "data": store.get_state().model_dump(mode="json")}
        )
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(payload, default=str))
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        store.unsubscribe(queue)
