import { useMemo, useState } from 'react';
import { useLiveFeedContext } from '../context/LiveFeedContext';
import { formatTime } from '../hooks/useLiveFeed';
import { PageHeader, Panel } from '../components/ui';
import type { Team } from '../types';

const roleLabels: Record<Team, string> = {
  red: 'Red Team VM',
  blue: 'Blue Team VM',
  target: 'Metasploitable',
};

const roleStyles: Record<Team, string> = {
  red: 'bg-red-600 text-white',
  blue: 'border border-white/40 bg-white/10 text-white',
  target: 'bg-red-950 text-red-200 border border-red-800',
};

export function DataConnectors() {
  const { state } = useLiveFeedContext();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = search.toLowerCase();
    return state.connectors.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.hostname.toLowerCase().includes(q) ||
        c.ip.includes(q)
    );
  }, [state, search]);

  if (!state) {
    return <div className="flex h-64 items-center justify-center text-neutral-500">Loading…</div>;
  }

  const { connector_summary: summary } = state;

  return (
    <>
      <PageHeader
        title="Data connectors"
        subtitle="Live status for Red Team, Blue Team, and Metasploitable log sources"
      />

      <div className="border-b border-red-900/40 bg-red-950/30 px-6 py-2 text-sm text-red-200">
        Live mode — connector event rates update as activity streams in.
      </div>

      <div className="grid grid-cols-3 gap-4 p-6">
        {[
          { label: 'Onboarded connectors', value: summary.onboarded },
          { label: 'Connected', value: summary.connected },
          { label: 'Updates', value: summary.updates },
        ].map((k) => (
          <div
            key={k.label}
            className="flex overflow-hidden rounded border border-red-900/40 bg-[var(--bg-panel)]"
          >
            <div className="w-1 bg-red-600" />
            <div className="px-4 py-3">
              <div className="text-2xl font-semibold text-white">{k.value}</div>
              <div className="text-xs text-neutral-400">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 pb-2">
        <input
          type="search"
          placeholder="Search by name or IP"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border border-red-900/40 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-red-600 focus:outline-none"
        />
      </div>

      <div className="px-6 pb-6">
        <Panel title="VM connectors">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500">
              <tr>
                <th className="w-2 pb-2" />
                <th className="pb-2">Connector</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Last event</th>
                <th className="pb-2">Rate / min</th>
                <th className="pb-2">Data types</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-red-900/20 hover:bg-red-950/20">
                  <td className="py-3">
                    <div
                      className="mx-auto h-8 w-1 rounded"
                      style={{
                        background: c.status === 'connected' ? '#dc2626' : '#525252',
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-xs text-neutral-500">
                      {c.hostname} · {c.ip}
                    </div>
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${roleStyles[c.role]}`}
                    >
                      {roleLabels[c.role]}
                    </span>
                  </td>
                  <td className="py-3 text-neutral-400">
                    {c.last_event_at ? formatTime(c.last_event_at) : '—'}
                  </td>
                  <td className="py-3 font-mono text-white">
                    {c.event_rate_per_min.toFixed(1)}
                  </td>
                  <td className="py-3 text-xs text-neutral-400">{c.data_types.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
