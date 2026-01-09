import { NativeModules } from 'react-native';

const { RaceSyncModule, RaceSessionModule } = NativeModules;

/**
 * TypeScript interface for RaceSyncModule
 */
export interface IRaceSyncModule {
  getUptimeNanos(): string;
  handleSyncPing(t1: string): { t2: string; t3: string };
  addSyncSample(t1: string, t2: string, t3: string, t4: string): void;
  resetSync(): void;
  getSyncStatus(): {
    offsetNanos: string;
    uncertaintyMs: number;
    sampleCount: number;
    quality: 'excellent' | 'good' | 'ok' | 'poor';
    isReady: boolean;
  };
  convertRemoteToLocal(remoteNanos: string, offsetNanos: string): string;
}

/**
 * TypeScript interface for RaceSessionModule
 */
export interface IRaceSessionModule {
  setRole(role: string): void;
  getRole(): string;
  setSessionId(sessionId: string): void;
  setClockOffset(offsetNanos: string): void;
  convertPtsToUptime(
    tCrossPtsSeconds: number,
    ptsNowSeconds: number,
    uptimeNowNanos: string
  ): string;
  recordLocalStart(
    tCrossPtsSeconds: number,
    ptsNowSeconds: number,
    uptimeNowNanos: string
  ): string;
  recordRemoteStart(tStartRemoteNanos: string): void;
  computeSplit(
    tCrossPtsSeconds: number,
    ptsNowSeconds: number,
    uptimeNowNanos: string
  ): {
    splitNanos: string;
    splitMs: number;
    tFinishLocalNanos: string;
    tStartInFinishDomainNanos: string;
  };
  reset(): void;
  fullReset(): void;
  getStatus(): {
    role: string;
    sessionId: string;
    hasStartTime: boolean;
    hasFinishTime: boolean;
    clockOffsetNanos: string;
  };
}

// Export typed modules
export const RaceSync: IRaceSyncModule = RaceSyncModule;
export const RaceSession: IRaceSessionModule = RaceSessionModule;

/**
 * Helper: Get current uptime in nanoseconds as string
 */
export function getUptimeNanos(): string {
  return RaceSync.getUptimeNanos();
}

/**
 * Helper: Handle sync ping and return pong timestamps
 */
export function handleSyncPing(t1: string): { t2: string; t3: string } {
  return RaceSync.handleSyncPing(t1);
}

/**
 * Helper: Add a sync sample for offset calculation
 */
export function addSyncSample(
  t1: string,
  t2: string,
  t3: string,
  t4: string
): void {
  RaceSync.addSyncSample(t1, t2, t3, t4);
}

/**
 * Helper: Get current sync status
 */
export function getSyncStatus() {
  return RaceSync.getSyncStatus();
}

/**
 * Helper: Convert PTS crossing time to uptime nanoseconds
 */
export function convertPtsToUptime(
  tCrossPtsSeconds: number,
  ptsNowSeconds: number,
  uptimeNowNanos: string
): string {
  return RaceSession.convertPtsToUptime(
    tCrossPtsSeconds,
    ptsNowSeconds,
    uptimeNowNanos
  );
}

/**
 * Helper: Record local start event and get uptime nanos
 */
export function recordLocalStart(
  tCrossPtsSeconds: number,
  ptsNowSeconds: number,
  uptimeNowNanos: string
): string {
  return RaceSession.recordLocalStart(
    tCrossPtsSeconds,
    ptsNowSeconds,
    uptimeNowNanos
  );
}

/**
 * Helper: Compute split time on finish phone
 */
export function computeSplit(
  tCrossPtsSeconds: number,
  ptsNowSeconds: number,
  uptimeNowNanos: string
) {
  return RaceSession.computeSplit(
    tCrossPtsSeconds,
    ptsNowSeconds,
    uptimeNowNanos
  );
}
