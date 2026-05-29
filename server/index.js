import cors from "cors";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { Client as SSHClient } from "ssh2";
import { LiveStore } from "./live-store.js";

const PORT = 8000;
const app = express();
const httpServer = createServer(app);

// Live feed WebSocket
const wss = new WebSocketServer({ server: httpServer, path: "/ws/live" });

// SSH shell WebSocket
const shellWss = new WebSocketServer({ server: httpServer, path: "/ws/shell" });

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

// ── SSH shell proxy ───────────────────────────────────────────
shellWss.on("connection", (ws) => {
  const conn = new SSHClient();
  let stream = null;

  ws.on("message", (data, isBinary) => {
    // Binary = raw terminal input after shell is up
    if (isBinary) {
      if (stream) stream.write(data);
      return;
    }

    // String = JSON control message
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "connect") {
      conn.connect({
        host: msg.host,
        port: 22,
        username: msg.username,
        password: msg.password,
        readyTimeout: 12000,
        algorithms: {
          serverHostKey: [
            "ssh-ed25519",
            "ecdsa-sha2-nistp256",
            "ecdsa-sha2-nistp384",
            "rsa-sha2-512",
            "rsa-sha2-256",
            "ssh-rsa",
          ],
        },
      });
    } else if (msg.type === "resize" && stream) {
      stream.setWindow(msg.rows, msg.cols, 0, 0);
    }
  });

  conn.on("ready", () => {
    ws.send(JSON.stringify({ type: "connected" }));
    conn.shell({ term: "xterm-256color", rows: 24, cols: 80 }, (err, s) => {
      if (err) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
        ws.close();
        return;
      }
      stream = s;
      s.on("data", (d) => {
        if (ws.readyState === 1) ws.send(d);
      });
      s.stderr.on("data", (d) => {
        if (ws.readyState === 1) ws.send(d);
      });
      s.on("close", () => ws.close());
    });
  });

  conn.on("error", (err) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", message: err.message }));
    }
  });

  ws.on("close", () => {
    stream?.close();
    conn.end();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Cyberstorm SIEM live server http://localhost:${PORT}`);
});
