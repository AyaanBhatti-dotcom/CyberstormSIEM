import { useLiveFeedContext } from '../context/LiveFeedContext';
import { ActivityFeed } from '../components/ActivityFeed';
import { AssetCard } from '../components/AssetCard';
import { TimelineChart, UrgencyChart } from '../components/Charts';
import { KpiCard, PageHeader, Panel } from '../components/ui';

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
    <>
      <PageHeader
        title="Operations Overview"
        subtitle="Live view of Red Team, Blue Team, and Metasploitable activity"
      />
      <div className="space-y-4 p-6">
        <AssetCard asset={asset} exercise={exercise} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
          <KpiCard label="Red actions" value={kpis.red_actions_24h} delta={kpis.red_delta} accent="var(--red)" />
          <KpiCard label="Blue actions" value={kpis.blue_actions_24h} delta={kpis.blue_delta} accent="var(--blue)" />
          <KpiCard label="Target alerts" value={kpis.target_alerts} delta={kpis.target_delta} accent="var(--target)" />
          <KpiCard label="Open incidents" value={kpis.open_incidents} delta={0} accent="#ffffff" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Events by severity">
            <UrgencyChart data={state.urgency} />
          </Panel>
          <Panel title="Activity over time (live)">
            <TimelineChart data={state.timeline} />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Red Team — live feed"
            action={<span className="text-[10px] font-bold text-red-600">OFFENSE</span>}
          >
            <ActivityFeed
              items={state.red_feed}
              highlightId={highlightId}
              accent="var(--red)"
              emptyLabel="Waiting for Red Team activity…"
            />
          </Panel>
          <Panel
            title="Blue Team — live feed"
            action={<span className="text-[10px] font-bold text-white">DEFENSE</span>}
          >
            <ActivityFeed
              items={state.blue_feed}
              highlightId={highlightId}
              accent="var(--blue)"
              emptyLabel="Waiting for Blue Team activity…"
            />
          </Panel>
        </div>

        <Panel title="Metasploitable — target telemetry">
          <ActivityFeed
            items={state.target_feed}
            highlightId={highlightId}
            accent="var(--target)"
            emptyLabel="Waiting for target host events…"
          />
        </Panel>
      </div>
    </>
  );
}
