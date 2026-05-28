import { createContext, useContext, type ReactNode } from 'react';
import { useLiveFeed } from '../hooks/useLiveFeed';
import type { LiveState, TeamActivity } from '../types';

interface LiveFeedContextValue {
  state: LiveState | null;
  connected: boolean;
  lastActivity: TeamActivity | null;
  highlightId: string | null;
}

const LiveFeedContext = createContext<LiveFeedContextValue | null>(null);

export function LiveFeedProvider({ children }: { children: ReactNode }) {
  const value = useLiveFeed();
  return <LiveFeedContext.Provider value={value}>{children}</LiveFeedContext.Provider>;
}

export function useLiveFeedContext() {
  const ctx = useContext(LiveFeedContext);
  if (!ctx) throw new Error('useLiveFeedContext must be used within LiveFeedProvider');
  return ctx;
}
