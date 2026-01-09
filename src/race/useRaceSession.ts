import { useState, useCallback, useEffect, useRef } from 'react';
import { raceTransport } from './transport/SupabaseTransport';
import {
  RaceMessage,
  RaceRole,
  RaceState,
  SyncStatus,
  ConnectionState,
  generateRoomCode,
  generateDeviceId,
  generateSessionId,
} from './transport/types';
import {
  RaceSync,
  RaceSession,
  getUptimeNanos,
  handleSyncPing,
  addSyncSample,
  getSyncStatus,
  recordLocalStart,
  computeSplit,
} from './native/RaceNative';

interface RaceResult {
  splitMs: number;
  splitNanos: string;
  uncertaintyMs: number;
}

interface UseRaceSessionReturn {
  // State
  state: RaceState;
  role: RaceRole | null;
  roomCode: string | null;
  connectionState: ConnectionState;
  syncStatus: SyncStatus | null;
  partnerConnected: boolean;
  result: RaceResult | null;
  error: string | null;

  // Actions
  createRoom: (role: RaceRole) => Promise<string>;
  joinRoom: (code: string, role: RaceRole) => Promise<void>;
  startSync: () => Promise<void>;
  armDetection: () => void;
  handleLocalCrossing: (
    triggerPtsSeconds: number,
    ptsNowSeconds: number,
    uptimeNowNanos: string
  ) => Promise<void>;
  reset: () => void;
  disconnect: () => Promise<void>;
}

export function useRaceSession(): UseRaceSessionReturn {
  // State
  const [state, setState] = useState<RaceState>('idle');
  const [role, setRole] = useState<RaceRole | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for message handling
  const deviceIdRef = useRef(generateDeviceId());
  const sessionIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const syncSampleCountRef = useRef(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Create a message with proper headers
  const createMessage = useCallback(
    <T extends RaceMessage['type']>(
      type: T,
      payload: Omit<Extract<RaceMessage, { type: T }>, 'type' | 'sessionId' | 'senderId' | 'seq'>
    ): Extract<RaceMessage, { type: T }> => {
      seqRef.current += 1;
      return {
        type,
        sessionId: sessionIdRef.current || '',
        senderId: deviceIdRef.current,
        seq: seqRef.current,
        ...payload,
      } as Extract<RaceMessage, { type: T }>;
    },
    []
  );

  // Handle incoming messages
  const handleMessage = useCallback(
    async (message: RaceMessage) => {
      console.log('[RaceSession] Received:', message.type);

      switch (message.type) {
        case 'roleConfirm':
          // Partner confirmed their role
          setPartnerConnected(true);
          if (state === 'pairing') {
            setState('syncing');
          }
          break;

        case 'syncPing':
          // Respond to sync ping immediately
          const { t2, t3 } = handleSyncPing(message.t1);
          const pongMessage = createMessage('syncPong', {
            t1: message.t1,
            t2,
            t3,
          });
          await raceTransport.send(pongMessage);
          break;

        case 'syncPong':
          // Add sample to native sync module
          const t4 = getUptimeNanos();
          addSyncSample(message.t1, message.t2, message.t3, t4);
          syncSampleCountRef.current += 1;

          // Update sync status
          const status = getSyncStatus();
          setSyncStatus(status);

          // Check if sync is ready
          if (status.isReady && state === 'syncing') {
            // Store offset in session module
            RaceSession.setClockOffset(status.offsetNanos);
            setState('ready');
          }
          break;

        case 'ready':
          // Partner is ready
          if (message.role !== role) {
            setPartnerConnected(true);
          }
          break;

        case 'startEvent':
          // Start phone has triggered - only relevant for finish phone
          if (role === 'finish') {
            RaceSession.recordRemoteStart(message.tStart);
            setState('running');
          }
          break;

        case 'finishResult':
          // Finish phone has sent result
          setResult({
            splitMs: Number(message.splitNanos) / 1_000_000,
            splitNanos: message.splitNanos,
            uncertaintyMs: message.uncertaintyMs,
          });
          setState('finished');
          break;
      }
    },
    [state, role, createMessage]
  );

  // Subscribe to transport messages
  useEffect(() => {
    const unsubMessage = raceTransport.onMessage(handleMessage);
    const unsubConnection = raceTransport.onConnectionChange(setConnectionState);

    return () => {
      unsubMessage();
      unsubConnection();
    };
  }, [handleMessage]);

  // Create a new room
  const createRoom = useCallback(
    async (selectedRole: RaceRole): Promise<string> => {
      const code = generateRoomCode();
      sessionIdRef.current = generateSessionId();
      seqRef.current = 0;

      setRole(selectedRole);
      setRoomCode(code);
      setState('pairing');
      setError(null);

      // Set role in native module
      RaceSession.setRole(selectedRole);
      RaceSession.setSessionId(sessionIdRef.current);

      // Connect to room
      await raceTransport.connect(code, sessionIdRef.current);

      // Send role confirmation
      const msg = createMessage('roleConfirm', { role: selectedRole });
      await raceTransport.send(msg);

      return code;
    },
    [createMessage]
  );

  // Join an existing room
  const joinRoom = useCallback(
    async (code: string, selectedRole: RaceRole): Promise<void> => {
      sessionIdRef.current = generateSessionId();
      seqRef.current = 0;

      setRole(selectedRole);
      setRoomCode(code.toUpperCase());
      setState('pairing');
      setError(null);

      // Set role in native module
      RaceSession.setRole(selectedRole);
      RaceSession.setSessionId(sessionIdRef.current);

      // Connect to room
      await raceTransport.connect(code.toUpperCase(), sessionIdRef.current);

      // Send role confirmation
      const msg = createMessage('roleConfirm', { role: selectedRole });
      await raceTransport.send(msg);
    },
    [createMessage]
  );

  // Start clock synchronization
  const startSync = useCallback(async (): Promise<void> => {
    if (!partnerConnected) {
      setError('Partner not connected');
      return;
    }

    setState('syncing');
    RaceSync.resetSync();
    syncSampleCountRef.current = 0;

    // Send sync pings in a burst (50-100 samples over ~3 seconds)
    const sendPing = async () => {
      const t1 = getUptimeNanos();
      const msg = createMessage('syncPing', { t1 });
      await raceTransport.send(msg);
    };

    // Send pings every 30ms for ~3 seconds = 100 samples
    let pingCount = 0;
    const maxPings = 100;

    syncIntervalRef.current = setInterval(async () => {
      if (pingCount >= maxPings) {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
        return;
      }

      await sendPing();
      pingCount++;
    }, 30);
  }, [partnerConnected, createMessage]);

  // Arm detection (ready to detect crossing)
  const armDetection = useCallback(() => {
    setState('armed');

    // Notify partner we're ready
    if (role) {
      const msg = createMessage('ready', { role });
      raceTransport.send(msg);
    }
  }, [role, createMessage]);

  // Handle local crossing detection
  const handleLocalCrossing = useCallback(
    async (
      triggerPtsSeconds: number,
      ptsNowSeconds: number,
      uptimeNowNanos: string
    ): Promise<void> => {
      if (role === 'start') {
        // Start phone: convert PTS to uptime and send to finish phone
        const tStartNanos = recordLocalStart(
          triggerPtsSeconds,
          ptsNowSeconds,
          uptimeNowNanos
        );

        const msg = createMessage('startEvent', { tStart: tStartNanos });
        await raceTransport.send(msg);

        setState('running');
      } else if (role === 'finish') {
        // Finish phone: compute split time
        const splitResult = computeSplit(
          triggerPtsSeconds,
          ptsNowSeconds,
          uptimeNowNanos
        );

        const uncertaintyMs = syncStatus?.uncertaintyMs ?? 999;

        setResult({
          splitMs: splitResult.splitMs,
          splitNanos: splitResult.splitNanos,
          uncertaintyMs,
        });

        // Broadcast result
        const msg = createMessage('finishResult', {
          splitNanos: splitResult.splitNanos,
          uncertaintyMs,
        });
        await raceTransport.send(msg);

        setState('finished');
      }
    },
    [role, syncStatus, createMessage]
  );

  // Reset for new race
  const reset = useCallback(() => {
    RaceSession.reset();
    setResult(null);
    setState('ready');
    setError(null);
  }, []);

  // Disconnect and cleanup
  const disconnect = useCallback(async () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    await raceTransport.disconnect();

    RaceSession.fullReset();
    RaceSync.resetSync();

    setState('idle');
    setRole(null);
    setRoomCode(null);
    setPartnerConnected(false);
    setSyncStatus(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    state,
    role,
    roomCode,
    connectionState,
    syncStatus,
    partnerConnected,
    result,
    error,
    createRoom,
    joinRoom,
    startSync,
    armDetection,
    handleLocalCrossing,
    reset,
    disconnect,
  };
}
