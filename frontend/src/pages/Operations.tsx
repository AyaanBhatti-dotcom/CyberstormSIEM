import { Fragment, useMemo } from 'react';
import { useLiveFeedContext } from '../context/LiveFeedContext';
import { formatTime } from '../hooks/useLiveFeed';
import { OutcomeBadge, SeverityBadge } from '../components/ui';
import type { TeamActivity } from '../types';

function EventCard({
  event,
  side,
  highlighted,
}: {
  event: TeamActivity;
  side: 'left' | 'right';
  highlighted: boolean;
}) {
  const isRed = event.team === 'red';

  return (
    <div
      className={`w-full max-w-[340px] rounded-lg border px-4 py-3 transition-all duration-300 ${
        highlighted ? 'animate-slide-in' : ''
      } ${
        isRed
          ? 'border-red-900/40 bg-red-950/20 hover:bg-red-950/35'
          : 'border-zinc-800/60 bg-zinc-950 hover:bg-zinc-900/70'
      }`}
      style={
        highlighted
          ? {
              boxShadow: isRed
                ? '0 0 20px rgba(239, 68, 68, 0.22)'
                : '0 0 20px rgba(255,255,255,0.08)',
              borderColor: isRed ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.28)',
            }
          : undefined
      }
    >
      <div className={`flex flex-col gap-1.5 ${side === 'left' ? 'items-end' : 'items-start'}`}>
        {/* Action + badges */}
        <div
          className={`flex flex-wrap items-center gap-1.5 ${
            side === 'left' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span className="text-sm font-semibold leading-tight text-white">{event.action}</span>
          <SeverityBadge severity={event.severity} />
          <OutcomeBadge outcome={event.outcome} />
        </div>

        {/* Message */}
        <p
          className={`text-xs leading-snug text-zinc-400 ${
            side === 'left' ? 'text-right' : 'text-left'
          }`}
        >
          {event.message}
        </p>

        {/* Actor → Target + MITRE */}
        <div
          className={`flex items-center gap-2 text-[11px] ${
            side === 'left' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span className="text-zinc-500">
            {event.actor} → {event.target}
          </span>
          {event.mitre_id && (
            <span
              className={`font-mono text-[10px] ${
                isRed ? 'text-red-500/60' : 'text-zinc-400'
              }`}
            >
              {event.mitre_id}
            </span>
          )}
        </div>

        {/* Time */}
        <time className="text-[10px] text-zinc-600">{formatTime(event.timestamp)}</time>
      </div>
    </div>
  );
}

export function Operations() {
  const { state, highlightId } = useLiveFeedContext();

  const sortedEvents = useMemo(() => {
    if (!state) return [];
    return [...state.red_feed, ...state.blue_feed].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [state?.red_feed, state?.blue_feed]);

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Connecting to live stream…
      </div>
    );
  }

  const { kpis, exercise, asset } = state;

  return (
    <div>
      {/* ── Status bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-red-900/20 px-6 py-4">
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Exercise</p>
            <p className="text-sm font-medium text-white">{exercise.name}</p>
          </div>
          <div className="h-8 w-px bg-red-900/30" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Phase</p>
            <p className="text-sm font-medium text-white">{exercise.phase}</p>
          </div>
          <div className="h-8 w-px bg-red-900/30" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Target</p>
            <p
              className={`text-sm font-medium ${
                asset.risk_level === 'critical' || asset.risk_level === 'high'
                  ? 'text-red-400'
                  : 'text-white'
              }`}
            >
              {asset.hostname} · {asset.risk_level}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Red actions</p>
            <p className="text-xl font-bold tabular-nums text-red-400">{kpis.red_actions_24h}</p>
          </div>
          <div className="flex h-10 items-center px-2 text-xs font-bold text-zinc-600">VS</div>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Blue actions</p>
            <p className="text-xl font-bold tabular-nums text-white">{kpis.blue_actions_24h}</p>
          </div>
        </div>
      </div>

      {/* ── Column headers ─────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_48px_1fr] px-6 pt-5 pb-3">
        <div className="pr-5 text-right">
          <span className="text-[11px] font-bold uppercase tracking-widest text-red-500">
            ⚔ Red Team — Offense
          </span>
        </div>
        <div />
        <div className="pl-5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
            🛡 Blue Team — Defense
          </span>
        </div>
      </div>

      {/* ── Battle timeline ────────────────────────────────── */}
      <div className="px-6 pb-6">
        {sortedEvents.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
            Waiting for live events…
          </div>
        ) : (
          <div className="relative">
            {/* Spine line */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-red-900/25" />

            <div className="grid grid-cols-[1fr_48px_1fr]">
              {sortedEvents.map((event) => (
                <Fragment key={event.id}>
                  {/* Left side — red events */}
                  <div className="flex justify-end py-2 pr-5">
                    {event.team === 'red' && (
                      <EventCard
                        event={event}
                        side="left"
                        highlighted={highlightId === event.id}
                      />
                    )}
                  </div>

                  {/* Center dot */}
                  <div className="flex justify-center pt-3.5">
                    <div
                      className={`relative z-10 h-2.5 w-2.5 rounded-full ${
                        event.team === 'red'
                          ? 'bg-red-500 ring-2 ring-red-900'
                          : 'bg-white ring-2 ring-zinc-700'
                      } ${highlightId === event.id ? 'ring-[3px]' : ''}`}
                    />
                  </div>

                  {/* Right side — blue events */}
                  <div className="py-2 pl-5">
                    {event.team === 'blue' && (
                      <EventCard
                        event={event}
                        side="right"
                        highlighted={highlightId === event.id}
                      />
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Target telemetry strip ─────────────────────────── */}
      {state.target_feed.length > 0 && (
        <div className="sticky bottom-0 border-t border-red-900/20 bg-black/90 px-6 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-red-400/60">
              Target
            </span>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {state.target_feed.slice(0, 8).map((evt) => (
                <div
                  key={evt.id}
                  className={`shrink-0 rounded border px-2.5 py-1 text-xs transition-all ${
                    highlightId === evt.id
                      ? 'animate-slide-in border-red-500/40 bg-red-950/40'
                      : 'border-red-900/30 bg-red-950/10'
                  }`}
                >
                  <span className="text-red-300/80">{evt.action}</span>
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
