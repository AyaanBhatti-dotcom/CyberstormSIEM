import { useLiveFeedContext } from '../context/LiveFeedContext';
import { PageHeader, Panel, SeverityBadge } from '../components/ui';
import { formatTime } from '../hooks/useLiveFeed';

export function Incidents() {
  const { state } = useLiveFeedContext();
  const incidents = [
    ...(state?.red_feed.slice(0, 3).map((e, i) => ({
      id: `INC-${100 + i}`,
      title: e.action,
      severity: e.severity,
      owner: 'Unassigned',
      time: e.timestamp,
    })) ?? []),
    ...(state?.blue_feed.slice(0, 2).map((e, i) => ({
      id: `INC-${200 + i}`,
      title: e.action,
      severity: e.severity,
      owner: 'Blue Analyst',
      time: e.timestamp,
    })) ?? []),
  ];

  return (
    <>
      <PageHeader title="Incident Review" subtitle="Incidents derived from live range activity" />
      <div className="p-6">
        <Panel title="Open incidents">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="pb-2">ID</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Severity</th>
                <th className="pb-2">Owner</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-t border-white/10">
                  <td className="py-2 font-mono text-zinc-400">{inc.id}</td>
                  <td className="py-2 text-zinc-200">{inc.title}</td>
                  <td className="py-2">
                    <SeverityBadge severity={inc.severity} />
                  </td>
                  <td className="py-2 text-zinc-400">{inc.owner}</td>
                  <td className="py-2 text-zinc-500">{formatTime(inc.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

export function Search() {
  return (
    <>
      <PageHeader title="Search" subtitle="Query live event data (connect VMs to enable full search)" />
      <div className="p-6">
        <Panel title="Query">
          <input
            className="w-full rounded border border-red-900/40 bg-black px-3 py-2 font-mono text-sm text-white focus:border-red-600 focus:outline-none"
            defaultValue="host=metasploitable AND severity>=high"
            readOnly
          />
          <p className="mt-3 text-xs text-zinc-500">
            Live events stream via WebSocket. Full log search will be available when VM connectors
            send syslog to the ingestion API.
          </p>
        </Panel>
      </div>
    </>
  );
}

export function Configure() {
  const vms = [
    { role: 'Red Team VM', host: 'red-team-01', ip: '192.168.56.102' },
    { role: 'Blue Team VM', host: 'blue-team-01', ip: '192.168.56.103' },
    { role: 'Metasploitable', host: 'metasploitable', ip: '192.168.56.101' },
  ];

  return (
    <>
      <PageHeader title="Configure" subtitle="Range VM endpoints for live ingestion" />
      <div className="grid gap-4 p-6 md:grid-cols-3">
        {vms.map((vm) => (
          <Panel key={vm.host} title={vm.role}>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-500">Hostname</dt>
                <dd className="font-mono text-zinc-200">{vm.host}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">IP</dt>
                <dd className="font-mono text-zinc-200">{vm.ip}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Ingest API</dt>
                <dd className="font-mono text-xs text-red-500">POST /api/ingest</dd>
              </div>
            </dl>
          </Panel>
        ))}
      </div>
    </>
  );
}
