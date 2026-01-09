import React, { createContext, useContext, ReactNode } from 'react';
import { useRaceSession } from './useRaceSession';

type RaceContextType = ReturnType<typeof useRaceSession>;

const RaceContext = createContext<RaceContextType | null>(null);

export function RaceProvider({ children }: { children: ReactNode }) {
  const raceSession = useRaceSession();

  return (
    <RaceContext.Provider value={raceSession}>{children}</RaceContext.Provider>
  );
}

export function useRace(): RaceContextType {
  const context = useContext(RaceContext);
  if (!context) {
    throw new Error('useRace must be used within a RaceProvider');
  }
  return context;
}
