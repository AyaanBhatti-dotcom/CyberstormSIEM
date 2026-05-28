import cors from "cors";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { LiveStore } from "./live-store.js";

const PORT = 8000;
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws/live" });

const store = new LiveStore();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json());

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

store.onEvent = async (event) => {
  broadcast({ type: "activity", data: event });
  broadcast({ type: "state", data: store.getState() });
};

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", live: true, engine: "node" });
});

app.get("/api/state", (_req, res) => {
  res.json(store.getState());
});

app.post("/api/ingest", async (req, res) => {
  const created = await store.publishEvent(req.body);
  res.json(created);
});

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "state", data: store.getState() }));
});

httpServer.listen(PORT, () => {
  console.log(`Cyberstorm SIEM live server http://localhost:${PORT}`);
});
