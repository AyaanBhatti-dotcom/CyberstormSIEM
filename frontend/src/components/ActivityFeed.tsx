import { formatTime } from '../hooks/useLiveFeed';
import type { TeamActivity } from '../types';
import { OutcomeBadge, SeverityBadge } from './ui';

export function ActivityFeed({
  items,
  highlightId,
  accent,
  emptyLabel,
}: {
  items: TeamActivity[];
  highlightId: string | null;
  accent: string;
  emptyLabel: string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-neutral-500">{emptyLabel}</p>;
  }

  return (
    <ul className="max-h-[420px] space-y-1 overflow-y-auto">
      {items.map((item) => (
        <li
          key={item.id}
          className={`rounded border border-transparent px-3 py-2.5 transition-colors ${
            highlightId === item.id
              ? 'animate-slide-in border-red-600/40 bg-red-950/40'
              : 'hover:bg-red-950/20'
          }`}
          style={
            highlightId === item.id
              ? { borderLeftColor: accent, borderLeftWidth: 3 }
              : { borderLeftWidth: 3, borderLeftColor: 'transparent' }
          }
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{item.action}</span>
                <SeverityBadge severity={item.severity} />
                <OutcomeBadge outcome={item.outcome} />
              </div>
              <p className="mt-1 truncate text-xs text-zinc-500">{item.message}</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                {item.actor} → {item.target}
                {item.mitre_id && (
                  <span className="ml-2 text-zinc-500">MITRE {item.mitre_id}</span>
                )}
              </p>
            </div>
            <time className="shrink-0 text-[11px] text-zinc-500">{formatTime(item.timestamp)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
