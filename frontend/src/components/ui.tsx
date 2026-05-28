import type { Outcome, Severity, Team } from '../types';

export function Panel({
  title,
  children,
  className = '',
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded border border-red-900/30 bg-[var(--bg-panel)] ${className}`}
    >
      <header className="flex items-center justify-between border-b border-red-900/25 bg-red-950/20 px-4 py-2.5">
        <h2 className="text-sm font-medium text-white">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: number;
  delta: number;
  accent: string;
}) {
  return (
    <div className="rounded border border-red-900/30 bg-[var(--bg-panel)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-2xl font-semibold text-white">{value}</span>
        {delta > 0 && (
          <span className="mb-0.5 text-xs font-medium" style={{ color: accent }}>
            +{delta}
          </span>
        )}
      </div>
    </div>
  );
}

const severityColors: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#dc2626',
  medium: '#ffffff',
  low: '#737373',
  info: '#525252',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const isLight = severity === 'medium';
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
      style={{
        backgroundColor: isLight ? 'rgba(255,255,255,0.15)' : `${severityColors[severity]}22`,
        color: severityColors[severity],
        border: isLight ? '1px solid rgba(255,255,255,0.25)' : 'none',
      }}
    >
      {severity}
    </span>
  );
}

const outcomeColors: Record<Outcome, string> = {
  success: '#ffffff',
  blocked: '#ef4444',
  in_progress: '#fca5a5',
  detected: '#dc2626',
  failed: '#991b1b',
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className="text-[10px] font-medium uppercase"
      style={{ color: outcomeColors[outcome] }}
    >
      {outcome.replace('_', ' ')}
    </span>
  );
}

const teamColors: Record<Team, string> = {
  red: 'var(--red)',
  blue: 'var(--blue)',
  target: 'var(--target)',
};

export function TeamBadge({ team }: { team: Team }) {
  const labels = { red: 'RED', blue: 'BLUE', target: 'TARGET' };
  const isBlue = team === 'blue';
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
      style={{
        backgroundColor: isBlue ? 'rgba(255,255,255,0.12)' : `${teamColors[team]}22`,
        color: teamColors[team],
        border: isBlue ? '1px solid rgba(255,255,255,0.3)' : 'none',
      }}
    >
      {labels[team]}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-red-900/40 bg-gradient-to-r from-red-950/30 to-black px-6 py-4">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
    </div>
  );
}
