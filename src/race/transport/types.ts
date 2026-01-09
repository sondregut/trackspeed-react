/**
 * Race message types for multi-phone timing
 * All nanosecond timestamps are strings (BigInt can't serialize to JSON)
 */

export type RaceRole = 'start' | 'finish';

export type SyncQuality = 'excellent' | 'good' | 'ok' | 'poor';

// Base message fields for ordering + dedupe
interface BaseMessage {
  sessionId: string;
  senderId: string;
  seq: number;
}

// Clock sync ping: initiator sends t1
export interface SyncPingMessage extends BaseMessage {
  type: 'syncPing';
  t1: string; // uptime nanos as string
}

// Clock sync pong: responder sends t2, t3
export interface SyncPongMessage extends BaseMessage {
  type: 'syncPong';
  t1: string; // echo back original t1
  t2: string; // responder receive time
  t3: string; // responder send time
}

// Role confirmation after pairing
export interface RoleConfirmMessage extends BaseMessage {
  type: 'roleConfirm';
  role: RaceRole;
}

// Start phone sends when crossing detected
export interface StartEventMessage extends BaseMessage {
  type: 'startEvent';
  tStart: string; // crossing time in uptime nanos
}

// Finish phone sends final result
export interface FinishResultMessage extends BaseMessage {
  type: 'finishResult';
  splitNanos: string; // elapsed time in nanos
  uncertaintyMs: number; // sync uncertainty
}

// Ready signal - phone is armed and ready
export interface ReadyMessage extends BaseMessage {
  type: 'ready';
  role: RaceRole;
}

// Heartbeat for connection health
export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
}

export type RaceMessage =
  | SyncPingMessage
  | SyncPongMessage
  | RoleConfirmMessage
  | StartEventMessage
  | FinishResultMessage
  | ReadyMessage
  | HeartbeatMessage;

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Sync status from native module
export interface SyncStatus {
  offsetNanos: string;
  uncertaintyMs: number;
  sampleCount: number;
  quality: SyncQuality;
  isReady: boolean;
}

// Race session state
export type RaceState =
  | 'idle'
  | 'pairing'
  | 'syncing'
  | 'ready'
  | 'armed'
  | 'running'
  | 'finished';

// Utility: parse string nanos to BigInt
export function parseNanos(s: string): bigint {
  return BigInt(s);
}

// Utility: format BigInt nanos to string
export function formatNanos(n: bigint): string {
  return n.toString();
}

// Utility: convert nanos to milliseconds
export function nanosToMs(nanos: bigint): number {
  return Number(nanos / BigInt(1_000_000));
}

// Utility: convert milliseconds to nanos
export function msToNanos(ms: number): bigint {
  return BigInt(Math.round(ms * 1_000_000));
}

// Generate a random room code (6 alphanumeric chars)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate a unique device ID
export function generateDeviceId(): string {
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Generate a session ID
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
