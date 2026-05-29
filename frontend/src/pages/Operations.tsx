import { useEffect, useRef, useState } from 'react';
import { useLiveFeedContext } from '../context/LiveFeedContext';
import { formatTime } from '../hooks/useLiveFeed';
import { SeverityBadge } from '../components/ui';
import type { TeamActivity } from '../types';

// ── Node positions (SVG viewBox 0 0 520 290) ─────────────────
const N = {
  kali:   { x: 110, y: 215, color: '#ef4444', label: 'KALI',   sub: '192.168.102.129' },
  target: { x: 260, y:  65, color: '#f97316', label: 'TARGET', sub: '192.168.102.131' },
  blue:   { x: 410, y: 215, color: '#3b82f6', label: 'BLUE',   sub: '192.168.102.130' },
} as const;

const ATTACK_PATH  = `M ${N.kali.x},${N.kali.y} L ${N.target.x},${N.target.y}`;
const DEFENSE_PATH = `M ${N.blue.x},${N.blue.y} L ${N.target.x},${N.target.y}`;

type Particle = { id: string; path: string; color: string };

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Network Map ───────────────────────────────────────────────
function NetworkMap({
  latestRed,
  latestBlue,
  redCount,
  blueCount,
}: {
  latestRed?: string;
  latestBlue?: string;
  redCount: number;
  blueCount: number;
}) {
  const [particles, setParticles]   = useState<Particle[]>([]);
  const [pulseNodes, setPulseNodes] = useState<Record<string, boolean>>({});
  const [flashLines, setFlashLines] = useState<Record<string, boolean>>({});

  const prevRed  = useRef('');
  const prevBlue = useRef('');

  function spawnParticles(path: string, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        setParticles(p => [...p.slice(-30), { id: uid(), path, color }]);
      }, i * 130);
    }
  }

  function pulse(key: string) {
    setPulseNodes(m => ({ ...m, [key]: true }));
    setTimeout(() => setPulseNodes(m => ({ ...m, [key]: false })), 1600);
  }

  function flash(key: string) {
    setFlashLines(m => ({ ...m, [key]: true }));
    setTimeout(() => setFlashLines(m => ({ ...m, [key]: false })), 700);
  }

  useEffect(() => {
    if (!latestRed || latestRed === prevRed.current) return;
    prevRed.current = latestRed;
    spawnParticles(ATTACK_PATH, '#ef4444', 5);
    flash('attack');
    pulse('kali');
    pulse('target');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRed]);

  useEffect(() => {
    if (!latestBlue || latestBlue === prevBlue.current) return;
    prevBlue.current = latestBlue;
    spawnParticles(DEFENSE_PATH, '#3b82f6', 4);
    flash('defense');
    pulse('blue');
    pulse('target');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestBlue]);

  const nodeFilter: Record<string, string> = {
    kali: 'g-red', target: 'g-orange', blue: 'g-blue',
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <style>{`
        @keyframes fp {
          0%   { offset-distance: 0%;   opacity: 1; }
          80%  { opacity: .85; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes np {
          0%   { transform: scale(1);   opacity: .85; }
          100% { transform: scale(2.6); opacity: 0;   }
        }
        .pulse-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: np 1.5s ease-out forwards;
        }
      `}</style>

      <svg viewBox="0 0 520 290" className="w-full max-w-[480px]" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="g-red">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="g-blue">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="g-orange">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Connection lines ── */}
        <line
          x1={N.kali.x} y1={N.kali.y} x2={N.target.x} y2={N.target.y}
          stroke={flashLines.attack ? '#ef4444' : '#ef444428'}
          strokeWidth={flashLines.attack ? 1.5 : 1}
          strokeDasharray="5 4"
          filter={flashLines.attack ? 'url(#g-red)' : undefined}
          style={{ transition: 'stroke 0.1s, stroke-width 0.1s' }}
        />
        <line
          x1={N.blue.x} y1={N.blue.y} x2={N.target.x} y2={N.target.y}
          stroke={flashLines.defense ? '#3b82f6' : '#3b82f628'}
          strokeWidth={flashLines.defense ? 1.5 : 1}
          strokeDasharray="5 4"
          filter={flashLines.defense ? 'url(#g-blue)' : undefined}
          style={{ transition: 'stroke 0.1s, stroke-width 0.1s' }}
        />

        {/* ── Line labels ── */}
        <text x={172} y={154} fill="#ef444444" fontSize={8} fontFamily="monospace"
          transform="rotate(-38,172,154)" textAnchor="middle">ATTACK</text>
        <text x={352} y={154} fill="#3b82f644" fontSize={8} fontFamily="monospace"
          transform="rotate(38,352,154)" textAnchor="middle">DEFENSE</text>

        {/* ── Particles ── */}
        {particles.map(p => (
          <circle key={p.id} r={3.5} fill={p.color}
            style={{
              offsetPath: `path("${p.path}")`,
              animation: 'fp 1.2s ease-in forwards',
              filter: `drop-shadow(0 0 5px ${p.color})`,
            }}
            onAnimationEnd={() => setParticles(ps => ps.filter(x => x.id !== p.id))}
          />
        ))}

        {/* ── Nodes ── */}
        {(Object.entries(N) as [string, typeof N[keyof typeof N]][]).map(([key, node]) => (
          <g key={key}>
            {pulseNodes[key] && (
              <circle cx={node.x} cy={node.y} r={28}
                fill="none" stroke={node.color} strokeWidth={2}
                className="pulse-ring"
              />
            )}
            <circle cx={node.x} cy={node.y} r={28}
              fill="#050505"
              stroke={node.color}
              strokeWidth={pulseNodes[key] ? 2 : 1.5}
              strokeOpacity={pulseNodes[key] ? 1 : 0.6}
              filter={`url(#${nodeFilter[key]})`}
              style={{ transition: 'stroke-width 0.2s, stroke-opacity 0.2s' }}
            />
            <text x={node.x} y={node.y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill={node.color} fontSize={9} fontWeight="bold"
              fontFamily="monospace" letterSpacing={1.5}
            >{node.label}</text>
            <text x={node.x} y={node.y + 46}
              textAnchor="middle"
              fill={node.color} fillOpacity={0.35}
              fontSize={7.5} fontFamily="monospace"
            >{node.sub}</text>
          </g>
        ))}
      </svg>

      {/* ── Score strip under map ── */}
      <div className="flex items-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="font-bold tabular-nums text-red-400">{redCount}</span>
          <span className="text-zinc-600 text-xs">red ops</span>
        </div>
        <div className="text-zinc-700 font-bold">VS</div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="font-bold tabular-nums text-zinc-300">{blueCount}</span>
          <span className="text-zinc-600 text-xs">blue ops</span>
        </div>
      </div>
    </div>
  );
}

// ── Event row (sidebar) ───────────────────────────────────────
function EventRow({ event, highlighted }: { event: TeamActivity; highlighted: boolean }) {
  const isRed = event.team === 'red';
  return (
    <div
      className={`border-b px-3 py-2.5 transition-all duration-200 ${
        highlighted
          ? isRed
            ? 'border-l-2 border-l-red-500 bg-red-950/30 border-b-red-900/20'
            : 'border-l-2 border-l-blue-500 bg-zinc-900/30 border-b-zinc-800/20'
          : isRed
          ? 'border-b-red-900/15 hover:bg-red-950/10'
          : 'border-b-zinc-800/20 hover:bg-zinc-900/15'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span className="text-xs font-medium text-white leading-snug">{event.action}</span>
        <SeverityBadge severity={event.severity} />
      </div>
      <p className="text-[10px] text-zinc-500 leading-snug line-clamp-2">{event.message}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <time className="text-[9px] text-zinc-600">{formatTime(event.timestamp)}</time>
        {event.mitre_id && (
          <span className={`text-[9px] font-mono ${isRed ? 'text-red-500/50' : 'text-blue-400/50'}`}>
            {event.mitre_id}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Operations page ───────────────────────────────────────────
export function Operations() {
  const { state, highlightId } = useLiveFeedContext();

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Connecting to live stream…
      </div>
    );
  }

  const { kpis, exercise, asset } = state;

  return (
    <div className="flex h-full flex-col">

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-red-900/20 bg-black/20 px-5 py-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-zinc-500">{exercise.name}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-400">{exercise.phase}</span>
          <span className="text-zinc-700">·</span>
          <span className={
            asset.risk_level === 'critical' || asset.risk_level === 'high'
              ? 'font-medium text-red-400'
              : 'text-zinc-400'
          }>
            {asset.hostname} — risk: {asset.risk_level}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600">Target alerts</p>
            <p className="text-base font-bold tabular-nums text-orange-400">{kpis.target_alerts}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-zinc-600">Open incidents</p>
            <p className="text-base font-bold tabular-nums text-zinc-300">{kpis.open_incidents}</p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex min-h-0 flex-1">

        {/* Red feed */}
        <div className="flex w-64 shrink-0 flex-col border-r border-red-900/20">
          <div className="flex shrink-0 items-center gap-2 border-b border-red-900/20 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">
              Red — Offense
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {state.red_feed.length === 0 ? (
              <p className="px-3 py-5 text-xs text-zinc-600">Waiting for red team events…</p>
            ) : (
              state.red_feed.map(e => (
                <EventRow key={e.id} event={e} highlighted={highlightId === e.id} />
              ))
            )}
          </div>
        </div>

        {/* Network map (center) */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
          <NetworkMap
            latestRed={state.red_feed[0]?.id}
            latestBlue={state.blue_feed[0]?.id}
            redCount={kpis.red_actions_24h}
            blueCount={kpis.blue_actions_24h}
          />
        </div>

        {/* Blue feed */}
        <div className="flex w-64 shrink-0 flex-col border-l border-zinc-800/30">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/30 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Blue — Defense
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {state.blue_feed.length === 0 ? (
              <p className="px-3 py-5 text-xs text-zinc-600">Waiting for blue team events…</p>
            ) : (
              state.blue_feed.map(e => (
                <EventRow key={e.id} event={e} highlighted={highlightId === e.id} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Target strip ── */}
      {state.target_feed.length > 0 && (
        <div className="shrink-0 border-t border-red-900/20 bg-black/80 px-5 py-2 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-red-400/50">
              Target feed
            </span>
            <div className="flex gap-1.5 overflow-x-auto">
              {state.target_feed.slice(0, 8).map(evt => (
                <div key={evt.id}
                  className={`shrink-0 rounded border px-2 py-1 text-[10px] transition-all ${
                    highlightId === evt.id
                      ? 'border-orange-500/50 bg-orange-950/30 text-orange-300'
                      : 'border-red-900/20 bg-red-950/10 text-red-400/60'
                  }`}>
                  {evt.action}
                  <span className="ml-1.5 text-zinc-600">{formatTime(evt.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
