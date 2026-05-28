import { useMemo } from 'react';
import { useLiveFeedContext } from '../context/LiveFeedContext';
import { ActivityFeed } from '../components/ActivityFeed';
import { TimelineChart } from '../components/Charts';
import { PageHeader, Panel } from '../components/ui';
import type { Team, TimeSeriesPoint } from '../types';

const config: Record<
  Team,
  {
    title: string;
    subtitle: string;
    accent: string;
    feedKey: 'red_feed' | 'blue_feed' | 'target_feed';
    series: 'red' | 'blue' | 'target';
  }
> = {
  red: {
    title: 'Red Team Activity',
    subtitle: 'Live offensive actions against Metasploitable',
    accent: 'var(--red)',
    feedKey: 'red_feed',
    series: 'red',
  },
  blue: {
    title: 'Blue Team Activity',
    subtitle: 'Live defensive responses and analyst actions',
    accent: 'var(--blue)',
    feedKey: 'blue_feed',
    series: 'blue',
  },
  target: {
    title: 'Metasploitable Asset',
    subtitle: 'Live telemetry from the target host under attack',
    accent: 'var(--target)',
    feedKey: 'target_feed',
    series: 'target',
  },
};

export function TeamPage({ team }: { team: Team }) {
  const { state, highlightId } = useLiveFeedContext();
  const c = config[team];

  const chartData: TimeSeriesPoint[] = useMemo(() => {
    if (!state) return [];
    return state.timeline.map((p) => ({
      time: p.time,
      red: c.series === 'red' ? p.red : 0,
      blue: c.series === 'blue' ? p.blue : 0,
      target: c.series === 'target' ? p.target : 0,
    }));
  }, [state, c.series]);

  if (!state) {
    return <div className="flex h-64 items-center justify-center text-zinc-500">Loading…</div>;
  }

  return (
    <>
      <PageHeader title={c.title} subtitle={c.subtitle} />
      <div className="space-y-4 p-6">
        <Panel title="Event rate (live)">
          <TimelineChart data={chartData} />
        </Panel>
        <Panel title="Activity stream">
          <ActivityFeed
            items={state[c.feedKey]}
            highlightId={highlightId}
            accent={c.accent}
            emptyLabel="No events yet"
          />
        </Panel>
      </div>
    </>
  );
}
