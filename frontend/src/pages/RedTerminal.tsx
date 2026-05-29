import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// ── Matrix rain canvas ────────────────────────────────────────
function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const SIZE = 16;
    const CHARS =
      'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモラリルレロワヲン' +
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&<>/\\|';

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols = Math.floor(canvas.width / SIZE);
    const drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -80));

    const id = setInterval(() => {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${SIZE}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillStyle = drops[i] <= 1 ? '#afffb0' : '#00c832';
        ctx.fillText(ch, i * SIZE, drops[i] * SIZE);
        if (drops[i] * SIZE > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }, 40);

    return () => clearInterval(id);
  }, []);

  return <canvas ref={ref} className="absolute inset-0 z-0 opacity-35" />;
}

// ── Red Terminal ──────────────────────────────────────────────
type Phase = 'idle' | 'connecting' | 'connected' | 'error';

export function RedTerminal() {
  const mountRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [form, setForm] = useState({
    host: '192.168.102.129',
    username: 'kali',
    password: '',
  });

  // Create terminal instance once on mount
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#000000',
        foreground: '#00ff41',
        cursor: '#00ff41',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(0,255,65,0.25)',
        black: '#000000',
        red: '#ff4444',
        green: '#00ff41',
        yellow: '#dddd00',
        blue: '#5577ff',
        magenta: '#ff44ff',
        cyan: '#00dddd',
        white: '#cccccc',
        brightBlack: '#555555',
        brightRed: '#ff6666',
        brightGreen: '#44ff44',
        brightYellow: '#ffff44',
        brightBlue: '#7799ff',
        brightMagenta: '#ff66ff',
        brightCyan: '#44ffff',
        brightWhite: '#ffffff',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;
    return () => term.dispose();
  }, []);

  // Open terminal in DOM once connected
  useEffect(() => {
    if (phase !== 'connected' || !mountRef.current || !termRef.current) return;
    const term = termRef.current;
    const fit = fitRef.current!;
    term.open(mountRef.current);
    const t = setTimeout(() => fit.fit(), 60);
    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [phase]);

  // Send resize events to server
  useEffect(() => {
    if (phase !== 'connected' || !termRef.current) return;
    const disp = termRef.current.onResize(({ rows, cols }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    });
    return () => disp.dispose();
  }, [phase]);

  const connect = useCallback(() => {
    setPhase('connecting');
    setErrMsg('');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/shell`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'connect', ...form }));

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'connected') {
            setPhase('connected');
            termRef.current?.onData((d) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(new TextEncoder().encode(d));
              }
            });
          } else if (msg.type === 'error') {
            setPhase('error');
            setErrMsg(msg.message);
          }
        } catch {}
        return;
      }
      termRef.current?.write(new Uint8Array(e.data as ArrayBuffer));
    };

    ws.onclose = () => {
      termRef.current?.write('\r\n\x1b[31m[CONNECTION TERMINATED]\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setPhase('error');
      setErrMsg('WebSocket error — ensure the SIEM server is running on port 8000.');
    };
  }, [form]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    termRef.current?.dispose();
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: { background: '#000000', foreground: '#00ff41', cursor: '#00ff41' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;
    setPhase('idle');
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black font-mono select-none">
      <MatrixRain />

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)',
        }}
      />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex h-9 items-center justify-between border-b border-green-500/25 bg-black/75 px-5 backdrop-blur-sm">
        <span className="text-xs font-bold tracking-[0.22em] text-green-400">
          ⬡ RED OPS TERMINAL
        </span>
        <div className="flex items-center gap-6 text-xs">
          {phase === 'connected' && (
            <button
              onClick={disconnect}
              className="tracking-widest text-red-600 hover:text-red-400 transition-colors"
            >
              DISCONNECT
            </button>
          )}
          <span className={phase === 'connected' ? 'text-green-400' : 'text-green-800'}>
            {phase === 'connected'
              ? `● SHELL  ${form.username}@${form.host}`
              : '○ NO SESSION'}
          </span>
          <Link
            to="/"
            className="tracking-widest text-green-800 hover:text-green-500 transition-colors"
          >
            ← SIEM
          </Link>
        </div>
      </div>

      {/* Connect form */}
      {phase !== 'connected' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pt-9">
          <div className="w-96 border border-green-500/35 bg-black/92 p-9 shadow-[0_0_60px_rgba(0,255,65,0.08)]">
            <div className="mb-1 text-xl font-bold tracking-[0.3em] text-green-400">
              ESTABLISH SESSION
            </div>
            <div className="mb-8 text-xs tracking-[0.2em] text-green-900">
              SSH SECURE SHELL PROTOCOL v2
            </div>

            {(
              [
                { label: 'TARGET HOST', key: 'host', type: 'text' },
                { label: 'USERNAME', key: 'username', type: 'text' },
                { label: 'PASSWORD', key: 'password', type: 'password' },
              ] as const
            ).map(({ label, key, type }) => (
              <div key={key} className="mb-4">
                <div className="mb-1.5 text-xs tracking-[0.2em] text-green-800">{label}</div>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && phase !== 'connecting' && connect()}
                  className="w-full border border-green-500/30 bg-black px-3 py-2 text-sm text-green-300 outline-none placeholder:text-green-900 focus:border-green-500/60"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            ))}

            {phase === 'error' && (
              <div className="mb-4 border border-red-700/50 bg-red-950/25 px-3 py-2 text-xs text-red-400">
                ✗ {errMsg}
              </div>
            )}

            <button
              onClick={connect}
              disabled={phase === 'connecting' || !form.host || !form.username}
              className="mt-3 w-full border border-green-500/50 bg-green-950/20 py-2.5 text-sm font-bold tracking-[0.25em] text-green-400 transition-all hover:bg-green-900/30 hover:border-green-400 hover:shadow-[0_0_20px_rgba(0,255,65,0.15)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {phase === 'connecting' ? '[ CONNECTING… ]' : '[ CONNECT ]'}
            </button>
          </div>
        </div>
      )}

      {/* Terminal */}
      <div
        className={`absolute inset-0 z-20 pt-9 transition-opacity duration-200 ${
          phase === 'connected' ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          ref={mountRef}
          className="h-full w-full p-2"
          style={{ boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
}
