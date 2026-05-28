import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  Crosshair,
  LayoutDashboard,
  Plug,
  Radio,
  Search,
  Server,
  Settings,
  Shield,
} from 'lucide-react';
import { AppBackground } from '@/components/AppBackground';
import { LiveFeedProvider, useLiveFeedContext } from '../context/LiveFeedContext';

const nav = [
  { to: '/', label: 'Operations', icon: LayoutDashboard },
  { to: '/red', label: 'Red Team', icon: Crosshair },
  { to: '/blue', label: 'Blue Team', icon: Shield },
  { to: '/target', label: 'Metasploitable', icon: Server },
  { to: '/connectors', label: 'Data Connectors', icon: Plug },
  { to: '/incidents', label: 'Incidents', icon: Activity },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/configure', label: 'Configure', icon: Settings },
];

function Shell() {
  const { connected, state, lastActivity } = useLiveFeedContext();

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <AppBackground />
      <header className="relative z-10 flex h-11 items-center justify-between border-b border-red-900/50 bg-black/80 px-4 text-sm backdrop-blur-md">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight text-white">
            Cyberstorm<span className="text-red-600">SIEM</span>
          </span>
          <span className="hidden text-neutral-500 md:inline">Red vs Blue Range</span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              connected ? 'text-red-500' : 'text-neutral-500'
            }`}
          >
            <Radio className={`h-3 w-3 ${connected ? 'live-dot' : ''}`} />
            {connected ? 'LIVE' : 'Reconnecting…'}
          </span>
          {lastActivity && (
            <span className="hidden max-w-md truncate text-xs text-neutral-400 lg:inline">
              Latest: [{lastActivity.team.toUpperCase()}] {lastActivity.action}
            </span>
          )}
          <span className="text-neutral-300">SOC Admin</span>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="flex w-52 shrink-0 flex-col border-r border-red-900/40 bg-black/80 backdrop-blur-md">
          <nav className="flex flex-col gap-0.5 p-2">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-l-2 border-red-600 bg-red-950/40 text-white'
                      : 'border-l-2 border-transparent text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          {state && (
            <div className="mt-auto border-t border-red-900/40 p-3 text-xs text-neutral-500">
              <div className="text-neutral-400">Exercise phase</div>
              <div className="mt-1 font-medium text-red-500">{state.exercise.phase}</div>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-transparent">
          <Outlet />
        </main>
      </div>

      <footer className="relative z-10 flex h-8 items-center justify-between border-t border-red-900/40 bg-black/80 px-4 text-xs text-neutral-500 backdrop-blur-md">
        <span>Live stream — Red, Blue, and Metasploitable events update in real time</span>
        <span className="text-neutral-400">
          {state
            ? `${state.kpis.red_actions_24h + state.kpis.blue_actions_24h + state.kpis.target_alerts} events`
            : '—'}
        </span>
      </footer>
    </div>
  );
}

export function Layout() {
  return (
    <LiveFeedProvider>
      <Shell />
    </LiveFeedProvider>
  );
}
