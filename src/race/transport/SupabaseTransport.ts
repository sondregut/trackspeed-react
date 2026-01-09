import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { RaceMessage, ConnectionState } from './types';

type MessageCallback = (message: RaceMessage) => void;
type ConnectionCallback = (state: ConnectionState) => void;

/**
 * SupabaseTransport - Dumb pipe for race messages via Supabase Realtime Broadcast
 *
 * Responsibilities:
 * - Join/leave a room (channel)
 * - Send messages (broadcast)
 * - Receive messages
 * - Track connection state
 * - Deduplicate by sessionId + senderId + seq
 */
export class SupabaseTransport {
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private connectionState: ConnectionState = 'disconnected';

  // Deduplication: track seen messages by senderId -> max seq
  private seenSeqs: Map<string, number> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Connect to a race room
   */
  async connect(roomCode: string, sessionId: string): Promise<void> {
    if (this.channel) {
      await this.disconnect();
    }

    this.roomCode = roomCode;
    this.currentSessionId = sessionId;
    this.seenSeqs.clear();
    this.setConnectionState('connecting');

    const channelName = `race-${roomCode}`;

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive own messages
      },
    });

    // Listen for broadcast messages
    this.channel.on('broadcast', { event: 'race' }, (payload) => {
      const message = payload.payload as RaceMessage;
      this.handleIncomingMessage(message);
    });

    // Subscribe to channel
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.setConnectionState('connected');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.setConnectionState('error');
      }
    });
  }

  /**
   * Disconnect from current room
   */
  async disconnect(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.roomCode = null;
    this.currentSessionId = null;
    this.seenSeqs.clear();
    this.setConnectionState('disconnected');
  }

  /**
   * Send a message to the room
   */
  async send(message: RaceMessage): Promise<boolean> {
    if (!this.channel || this.connectionState !== 'connected') {
      console.warn('[Transport] Cannot send: not connected');
      return false;
    }

    try {
      const result = await this.channel.send({
        type: 'broadcast',
        event: 'race',
        payload: message,
      });
      return result === 'ok';
    } catch (error) {
      console.error('[Transport] Send error:', error);
      return false;
    }
  }

  /**
   * Register a callback for incoming messages
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Register a callback for connection state changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    // Immediately notify of current state
    callback(this.connectionState);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }

  /**
   * Handle incoming message with deduplication
   */
  private handleIncomingMessage(message: RaceMessage): void {
    // Filter wrong session
    if (this.currentSessionId && message.sessionId !== this.currentSessionId) {
      console.log('[Transport] Ignoring message from different session');
      return;
    }

    // Deduplicate by senderId + seq
    const lastSeq = this.seenSeqs.get(message.senderId) ?? -1;
    if (message.seq <= lastSeq) {
      console.log('[Transport] Ignoring duplicate/stale message');
      return;
    }
    this.seenSeqs.set(message.senderId, message.seq);

    // Notify all listeners
    this.messageCallbacks.forEach((cb) => {
      try {
        cb(message);
      } catch (error) {
        console.error('[Transport] Message callback error:', error);
      }
    });
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.connectionCallbacks.forEach((cb) => {
        try {
          cb(state);
        } catch (error) {
          console.error('[Transport] Connection callback error:', error);
        }
      });
    }
  }
}

// Singleton instance
export const raceTransport = new SupabaseTransport();
