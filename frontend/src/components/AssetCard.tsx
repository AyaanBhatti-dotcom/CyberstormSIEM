import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { AssetStatus, ExerciseMeta } from '../types';
import { formatElapsed } from '../hooks/useLiveFeed';

const riskColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#dc2626',
  medium: '#ffffff',
  low: '#737373',
};

export function AssetCard({
  asset,
  exercise,
}: {
  asset: AssetStatus;
  exercise: ExerciseMeta;
}) {
  return (
    <div className="rounded border border-red-600/40 bg-gradient-to-br from-red-950/50 to-black p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-white">{asset.hostname}</h3>
            {asset.contained && (
              <span className="flex items-center gap-1 rounded border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                <ShieldCheck className="h-3 w-3" /> CONTAINED
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-400">{asset.ip} — primary exercise target</p>
        </div>
        <div className="text-right">
          <div
            className="text-xs font-bold uppercase"
            style={{ color: riskColors[asset.risk_level] }}
          >
            {asset.risk_level} risk
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">{asset.alerts_open}</div>
          <div className="text-[10px] text-neutral-500">open alerts</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span>
          Phase: <strong className="text-red-500">{exercise.phase}</strong>
        </span>
        <span>Elapsed: {formatElapsed(exercise.elapsed_seconds)}</span>
        <span>Red: {exercise.red_operator}</span>
        <span>Blue: {exercise.blue_operator}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {asset.services_at_risk.map((s) => (
          <span
            key={s}
            className="rounded border border-red-600/40 bg-red-950/50 px-2 py-0.5 text-[10px] uppercase text-red-300"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
