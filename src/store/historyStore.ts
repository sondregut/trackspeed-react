import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimingSession, CaptureStats, TimingMode } from '../types';

interface HistoryState {
  sessions: TimingSession[];
  addSession: (session: Omit<TimingSession, 'id'>) => string;
  removeSession: (id: string) => void;
  getSession: (id: string) => TimingSession | undefined;
  clearHistory: () => void;
}

const generateId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (sessionData) => {
        const id = generateId();
        const session: TimingSession = {
          ...sessionData,
          id,
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
        }));
        return id;
      },

      removeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        }));
      },

      getSession: (id) => {
        return get().sessions.find((s) => s.id === id);
      },

      clearHistory: () => {
        set({ sessions: [] });
      },
    }),
    {
      name: 'sprint-timer-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
